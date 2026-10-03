// src/workers/loop.worker.ts
import type {
  ToWorker,
  FromWorker,
  DeviceChoice,
  DtypeChoice,
} from "../lib/loop/protocol";
import {
  TransformersThinker,
  LoopFastThinker,
  type Device,
  type Dtype,
  type ProgressInfo,
} from "../lib/loop/thinker";
import {
  loadRouter,
  loadPersona,
  loadConfig,
  loadParity,
  type ParityData,
} from "../lib/loop/assets";
import { Router, route } from "../lib/loop/router";
import { runAgent, type Persona, type AgentEvent } from "../lib/loop/agent";

let thinker: TransformersThinker | LoopFastThinker | null = null;
let router: Router | null = null;
let persona: Persona | null = null;
let routerConf = 0.95;
let currentDevice: Device = "wasm";
let currentDtype: Dtype = "q8";

let status: "uninitialized" | "loading" | "ready" | "busy" = "uninitialized";
let activeAborter: AbortController | null = null;
let initPromise: Promise<void> | null = null;

function post(msg: FromWorker) {
  self.postMessage(msg);
}

async function inspectCapabilities(
  deviceReq: DeviceChoice,
  dtypeReq: DtypeChoice
): Promise<{ candidates: { device: Device; dtype: Dtype }[] }> {
  let detectedDevice: Device = "wasm";
  let hasF16 = false;

  try {
    const gpu = (navigator as any).gpu;
    if (gpu) {
      const adapter = await gpu.requestAdapter();
      if (adapter) {
        detectedDevice = "webgpu";
        hasF16 = !!adapter.features?.has("shader-f16");
      }
    }
  } catch (err) {
    console.warn("GPU adapter request failed:", err);
  }

  const chosenDevice: Device =
    deviceReq === "auto" ? detectedDevice : deviceReq;

  let chosenDtype: Dtype;
  if (dtypeReq === "auto") {
    if (chosenDevice === "webgpu") {
      chosenDtype = hasF16 ? "fp16" : "fp32";
    } else {
      chosenDtype = "q8";
    }
  } else {
    chosenDtype = dtypeReq;
  }

  const rawList: { device: Device; dtype: Dtype }[] = [
    { device: chosenDevice, dtype: chosenDtype },
    { device: chosenDevice, dtype: "fp32" },
    { device: "wasm", dtype: "q8" },
    { device: "wasm", dtype: "fp32" },
  ];

  // Filter out duplicates
  const candidates: { device: Device; dtype: Dtype }[] = [];
  const seen = new Set<string>();
  for (const c of rawList) {
    const key = `${c.device}:${c.dtype}`;
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(c);
    }
  }

  return { candidates };
}

async function handleInit(
  modelId: string,
  deviceReq: DeviceChoice,
  dtypeReq: DtypeChoice
) {
  if (status === "loading" || status === "busy") return;
  status = "loading";

  try {
    post({
      type: "stage",
      stage: "device",
      message: "Checking hardware capabilities (WebGPU / WASM)...",
    });

    const { candidates } = await inspectCapabilities(deviceReq, dtypeReq);

    let loadedThinker: TransformersThinker | null = null;
    let chosenCandidate: { device: Device; dtype: Dtype } | null = null;
    let lastError: any = null;

    // Determine whether to attempt ONNX download
    let hasOnnx = false;
    if (modelId.includes("-onnx")) {
      hasOnnx = true;
    } else if (modelId.startsWith("/models/")) {
      try {
        const testRes = await fetch("/models/loop/onnx/model.onnx", { method: "HEAD" });
        hasOnnx = testRes.ok;
      } catch {
        hasOnnx = false;
      }
    }

    if (hasOnnx) {
      for (const c of candidates) {
        try {
          post({
            type: "stage",
            stage: "download",
            message: `Loading model in ${c.dtype} on ${c.device}...`,
          });

          loadedThinker = await TransformersThinker.load({
            modelId,
            device: c.device,
            dtype: c.dtype,
            onProgress: (p: ProgressInfo) => {
              post({
                type: "progress",
                file: p.file || "model",
                loaded: p.loaded || 0,
                total: p.total || 0,
                status: p.status,
              });
            },
          });

          chosenCandidate = c;
          break;
        } catch (err: any) {
          console.warn(`Candidate ${c.dtype} on ${c.device} failed:`, err);
        }
      }
    }

    if (!loadedThinker || !chosenCandidate) {
      post({
        type: "stage",
        stage: "download",
        message: "Starting Loop Fast Engine (unpacked 50M router + tools)...",
      });

      let tok: any = null;
      try {
        const { AutoTokenizer, env } = await import("@huggingface/transformers");
        env.allowLocalModels = true;
        env.allowRemoteModels = true;
        tok = await AutoTokenizer.from_pretrained("/models/loop");
      } catch (tErr) {
        console.warn("Fast tokenizer load fallback:", tErr);
      }

      thinker = new LoopFastThinker(tok) as any;
      chosenCandidate = candidates[0] || { device: "webgpu", dtype: "fp16" };
    } else {
      thinker = loadedThinker;
    }

    currentDevice = chosenCandidate.device;
    currentDtype = chosenCandidate.dtype;

    // Load assets
    post({
      type: "stage",
      stage: "assets",
      message: "Loading router weights, persona, and configuration...",
    });

    try {
      router = await loadRouter(modelId);
    } catch (rErr: any) {
      console.warn("Failed to load router.bin/router.json:", rErr);
      post({
        type: "error",
        message: `Could not load router weights from '${modelId}': ${rErr?.message}. Ensure router.bin and router.json exist and are public.`,
        fatal: true,
      });
      status = "uninitialized";
      return;
    }

    persona = await loadPersona(modelId);
    const cfg = await loadConfig(modelId);
    routerConf = cfg.router_conf ?? 0.95;
    if (thinker) {
      thinker.sampling = {
        temperature: cfg.chat_temp ?? 0.7,
        top_p: cfg.chat_top_p ?? 0.9,
        top_k: 50,
      };
    }

    // Warmup
    post({
      type: "stage",
      stage: "warmup",
      message: "Compiling shaders and warming up execution pipeline...",
    });

    try {
      if (thinker) {
        await thinker.generate("<|user|>\nhi\n<|effort|>\nlow\n", 2, false);
      }
    } catch (wErr) {
      console.warn("Warmup test error (non-fatal):", wErr);
    }

    // Parity check
    post({
      type: "stage",
      stage: "parity",
      message: "Verifying mathematical and tokenizer parity...",
    });

    let tokParityStr = "not available";
    let routerParityStr = "not available";

    const parityData: ParityData | null = await loadParity(modelId);
    if (parityData) {
      if (parityData.tokenizer && Array.isArray(parityData.tokenizer) && thinker) {
        let matched = 0;
        const total = parityData.tokenizer.length;
        for (const item of parityData.tokenizer) {
          const enc = thinker.encode(item.text);
          if (
            enc.length === item.ids.length &&
            enc.every((v, i) => v === item.ids[i])
          ) {
            matched++;
          }
        }
        tokParityStr =
          matched === total ? `ok (${matched}/${total})` : `MISMATCH (${total - matched}/${total})`;
      }

      if (parityData.router && Array.isArray(parityData.router)) {
        let matched = 0;
        const total = parityData.router.length;
        for (const item of parityData.router) {
          const rRes = route(item.text, router, routerConf);
          let ok = rRes.label === item.label && rRes.source === item.source;
          if (ok && item.probs && rRes.probs) {
            const maxDiff = Math.max(
              ...rRes.probs.map((p, idx) => Math.abs(p - (item.probs![idx] ?? 0)))
            );
            if (maxDiff > 1e-3) ok = false;
          }
          if (ok) matched++;
        }
        routerParityStr =
          matched === total ? `ok (${matched}/${total})` : `MISMATCH (${total - matched}/${total})`;
      }
    }

    status = "ready";
    post({
      type: "ready",
      device: currentDevice,
      dtype: currentDtype,
      parity: {
        tokenizer: tokParityStr,
        router: routerParityStr,
      },
    });
  } catch (err: any) {
    status = "uninitialized";
    post({
      type: "error",
      message: err?.message || "Failed to initialize Loop worker.",
      fatal: true,
    });
  }
}

async function handleRun(
  id: number,
  text: string,
  effort: any,
  history: [string, string][],
  live: boolean
) {
  if (initPromise) {
    try {
      await initPromise;
    } catch {
      // handled in init
    }
  }

  if (status !== "ready") {
    post({
      type: "error",
      id,
      message: "Loop model is not ready yet or is busy.",
    });
    return;
  }
  if (!thinker || !router || !persona) {
    post({
      type: "error",
      id,
      message: "Internal state missing thinker or router.",
    });
    return;
  }

  status = "busy";
  activeAborter = new AbortController();
  const startTime = performance.now();

  try {
    const result = await runAgent(
      text.slice(0, 400),
      effort,
      history,
      {
        thinker,
        router,
        persona,
        routerConf,
        live: live && navigator.onLine,
        signal: activeAborter.signal,
        onEvent: (event: AgentEvent) => {
          post({ type: "event", id, event });
        },
      }
    );

    const elapsed = Math.round(performance.now() - startTime);

    // Filter out stream events from final stored events
    const cleanEvents = result.events.filter((e) => e.k !== "stream");
    const cleanResult = { ...result, events: cleanEvents };

    status = "ready";
    activeAborter = null;
    post({ type: "done", id, result: cleanResult, ms: elapsed });
  } catch (err: any) {
    status = "ready";
    const wasAborted =
      activeAborter?.signal.aborted ||
      err?.name === "AbortError" ||
      err?.message === "aborted";
    activeAborter = null;

    if (wasAborted) {
      post({ type: "aborted", id });
    } else {
      post({
        type: "error",
        id,
        message: err?.message || "Generation encountered an unexpected error.",
      });
    }
  }
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;

  switch (msg.type) {
    case "init":
      initPromise = handleInit(msg.modelId, msg.device, msg.dtype);
      await initPromise;
      break;

    case "run":
      await handleRun(msg.id, msg.text, msg.effort, msg.history, msg.live);
      break;

    case "abort":
      if (activeAborter) {
        activeAborter.abort();
      }
      if (thinker) {
        thinker.interrupt();
      }
      break;

    case "clear-cache":
      try {
        if (typeof caches !== "undefined") {
          await caches.delete("transformers-cache");
          await caches.delete("loop-assets-v1");
        }
        if (thinker) {
          await thinker.dispose();
          thinker = null;
        }
        router = null;
        persona = null;
        status = "uninitialized";
        post({ type: "cache-cleared" });
      } catch (err: any) {
        post({
          type: "error",
          message: `Failed to clear cache: ${err?.message}`,
        });
      }
      break;
  }
};
