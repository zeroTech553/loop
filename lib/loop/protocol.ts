import type { AgentEvent, AgentResult, Effort } from "./agent";

export type DeviceChoice = "auto" | "webgpu" | "wasm";
export type DtypeChoice = "auto" | "fp32" | "fp16" | "q8";

export type ToWorker =
  | { type: "init"; modelId: string; device: DeviceChoice; dtype: DtypeChoice }
  | { type: "run"; id: number; text: string; effort: Effort; history: [string, string][]; live: boolean }
  | { type: "abort" }
  | { type: "clear-cache" };

export type FromWorker =
  | { type: "progress"; file: string; loaded: number; total: number; status: string }
  | { type: "stage"; stage: "device" | "download" | "assets" | "warmup" | "parity" | "ready"; message: string }
  | { type: "ready"; device: "webgpu" | "wasm"; dtype: "fp32" | "fp16" | "q8"; parity: { tokenizer: string; router: string } }
  | { type: "event"; id: number; event: AgentEvent }
  | { type: "done"; id: number; result: AgentResult; ms: number }
  | { type: "aborted"; id: number }
  | { type: "cache-cleared" }
  | { type: "error"; id?: number; message: string; fatal?: boolean };
