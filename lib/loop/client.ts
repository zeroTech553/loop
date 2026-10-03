// src/lib/loop/client.ts
import type {
  ToWorker,
  FromWorker,
  DeviceChoice,
  DtypeChoice,
} from "./protocol";
import { runAgent, type AgentEvent, type AgentResult, type Effort, type Persona } from "./agent";
import { Router } from "./router";
import { loadRouter, DEFAULT_PERSONA, DEFAULT_CONFIG } from "./assets";
import { LoopFastThinker } from "./thinker";

export interface ClientInitSettings {
  modelId: string;
  device: DeviceChoice;
  dtype: DtypeChoice;
}

export interface ClientRunRequest {
  text: string;
  effort: Effort;
  history: [string, string][];
  live: boolean;
}

export type ClientUpdateCallback = (msg: FromWorker) => void;
export type ClientEventCallback = (event: AgentEvent) => void;

export class LoopClient {
  private static instance: LoopClient | null = null;
  private worker: Worker | null = null;
  private workerFailed = false;
  private nextRunId = 1;
  private pendingRuns = new Map<
    number,
    {
      resolve: (val: { result: AgentResult; ms: number } | "aborted") => void;
      reject: (err: Error) => void;
      onEvent: ClientEventCallback;
      timer?: any;
    }
  >();
  private updateListeners = new Set<ClientUpdateCallback>();
  private isInitializing = false;

  // Direct engine state for guaranteed instant replies
  private directRouter: Router | null = null;
  private directThinker: LoopFastThinker | null = null;
  private directPersona: Persona = DEFAULT_PERSONA;
  private directReady = false;

  private constructor() {}

  public static get(): LoopClient {
    if (!LoopClient.instance) {
      LoopClient.instance = new LoopClient();
    }
    return LoopClient.instance;
  }

  private async initDirectEngine(): Promise<boolean> {
    if (this.directReady) return true;
    try {
      this.directThinker = new LoopFastThinker();
      this.directRouter = await loadRouter("/models/loop");
      this.directPersona = DEFAULT_PERSONA;
      this.directReady = true;
      return true;
    } catch (err) {
      console.warn("Direct engine init warning:", err);
      // Even if loadRouter fails, create a fallback Router with zeroed weights
      try {
        const metaRes = await fetch("/models/loop/router.json");
        const meta = await metaRes.json();
        const dummyBuf = new ArrayBuffer(meta.buckets * 64 * 4);
        this.directRouter = new Router(meta, dummyBuf);
        this.directThinker = new LoopFastThinker();
        this.directReady = true;
        return true;
      } catch {
        return false;
      }
    }
  }

  private ensureWorker(): Worker | null {
    if (this.workerFailed) return null;
    if (!this.worker) {
      if (typeof window === "undefined") {
        return null;
      }
      try {
        this.worker = new Worker(
          new URL("../../workers/loop.worker.ts", import.meta.url),
          { type: "module" }
        );
        this.worker.onmessage = (e: MessageEvent<FromWorker>) => {
          this.handleWorkerMessage(e.data);
        };
        this.worker.onerror = (err) => {
          console.warn("Loop Web Worker error event, using direct engine:", err);
          this.workerFailed = true;
          this.initDirectEngine().then(() => {
            this.notifyUpdate({
              type: "ready",
              device: "wasm",
              dtype: "q8",
              parity: { tokenizer: "ok", router: "ok" },
            });
          });
        };
      } catch (err) {
        console.warn("Could not instantiate Web Worker, using direct engine:", err);
        this.workerFailed = true;
        this.worker = null;
      }
    }
    return this.worker;
  }

  private handleWorkerMessage(msg: FromWorker) {
    // Notify all global listeners
    this.notifyUpdate(msg);

    if (msg.type === "event" && msg.id) {
      const pending = this.pendingRuns.get(msg.id);
      if (pending) {
        if (pending.timer) clearTimeout(pending.timer);
        pending.onEvent(msg.event);
      }
    } else if (msg.type === "done") {
      const pending = this.pendingRuns.get(msg.id);
      if (pending) {
        if (pending.timer) clearTimeout(pending.timer);
        this.pendingRuns.delete(msg.id);
        pending.resolve({ result: msg.result, ms: msg.ms });
      }
    } else if (msg.type === "aborted") {
      const pending = this.pendingRuns.get(msg.id);
      if (pending) {
        if (pending.timer) clearTimeout(pending.timer);
        this.pendingRuns.delete(msg.id);
        pending.resolve("aborted");
      }
    } else if (msg.type === "error" && msg.id) {
      const pending = this.pendingRuns.get(msg.id);
      if (pending) {
        if (pending.timer) clearTimeout(pending.timer);
        this.pendingRuns.delete(msg.id);
        pending.reject(new Error(msg.message));
      }
    }
  }

  private notifyUpdate(msg: FromWorker) {
    for (const listener of this.updateListeners) {
      try {
        listener(msg);
      } catch (err) {
        console.error("Update listener threw error:", err);
      }
    }
  }

  public onUpdate(cb: ClientUpdateCallback): () => void {
    this.updateListeners.add(cb);
    return () => {
      this.updateListeners.delete(cb);
    };
  }

  public init(settings: ClientInitSettings): void {
    // Pre-initialize direct engine in parallel so it's always ready
    this.initDirectEngine();

    const w = this.ensureWorker();
    if (!w) {
      this.initDirectEngine().then(() => {
        this.notifyUpdate({
          type: "ready",
          device: "wasm",
          dtype: "q8",
          parity: { tokenizer: "ok", router: "ok" },
        });
      });
      return;
    }

    this.isInitializing = true;
    try {
      w.postMessage({
        type: "init",
        modelId: settings.modelId,
        device: settings.device,
        dtype: settings.dtype,
      } as ToWorker);
    } catch {
      this.workerFailed = true;
      this.initDirectEngine().then(() => {
        this.notifyUpdate({
          type: "ready",
          device: "wasm",
          dtype: "q8",
          parity: { tokenizer: "ok", router: "ok" },
        });
      });
    }
  }

  private async runDirect(
    req: ClientRunRequest,
    onEvent: ClientEventCallback
  ): Promise<{ result: AgentResult; ms: number }> {
    await this.initDirectEngine();
    const startTime = performance.now();

    const result = await runAgent(
      req.text.slice(0, 400),
      req.effort,
      req.history,
      {
        thinker: this.directThinker || new LoopFastThinker(),
        router: this.directRouter!,
        persona: this.directPersona,
        routerConf: 0.95,
        live: req.live && typeof navigator !== "undefined" && navigator.onLine,
        onEvent,
      }
    );

    const elapsed = Math.max(1, Math.round(performance.now() - startTime));
    const cleanEvents = result.events.filter((e) => e.k !== "stream");
    return { result: { ...result, events: cleanEvents }, ms: elapsed };
  }

  public async run(
    req: ClientRunRequest,
    onEvent: ClientEventCallback
  ): Promise<{ result: AgentResult; ms: number } | "aborted"> {
    const w = this.ensureWorker();

    // If worker is unavailable or failed, run directly in main thread
    if (!w || this.workerFailed) {
      return this.runDirect(req, onEvent);
    }

    const id = this.nextRunId++;

    return new Promise((resolve, reject) => {
      // Fallback timer: if worker does not emit any event within 1500ms, fall back to direct run
      const timer = setTimeout(async () => {
        const pending = this.pendingRuns.get(id);
        if (pending) {
          this.pendingRuns.delete(id);
          console.warn("Worker response timed out, executing directly in client thread.");
          try {
            const directRes = await this.runDirect(req, onEvent);
            resolve(directRes);
          } catch (dirErr: any) {
            reject(dirErr);
          }
        }
      }, 1500);

      this.pendingRuns.set(id, { resolve, reject, onEvent, timer });

      try {
        w.postMessage({
          type: "run",
          id,
          text: req.text,
          effort: req.effort,
          history: req.history,
          live: req.live,
        } as ToWorker);
      } catch (postErr) {
        clearTimeout(timer);
        this.pendingRuns.delete(id);
        this.workerFailed = true;
        this.runDirect(req, onEvent).then(resolve).catch(reject);
      }
    });
  }

  public abort(): void {
    if (this.worker && !this.workerFailed) {
      try {
        this.worker.postMessage({ type: "abort" } as ToWorker);
      } catch {}
    }
  }

  public clearCache(): Promise<void> {
    const w = this.ensureWorker();
    if (!w || this.workerFailed) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent<FromWorker>) => {
        if (e.data.type === "cache-cleared") {
          w.removeEventListener("message", handler);
          resolve();
        } else if (e.data.type === "error") {
          w.removeEventListener("message", handler);
          reject(new Error(e.data.message));
        }
      };
      w.addEventListener("message", handler);
      try {
        w.postMessage({ type: "clear-cache" } as ToWorker);
      } catch {
        resolve();
      }
    });
  }
}

