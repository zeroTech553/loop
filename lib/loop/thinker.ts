import {
  AutoTokenizer,
  AutoModelForCausalLM,
  TextStreamer,
  InterruptableStoppingCriteria,
  env,
} from "@huggingface/transformers";
import type { Thinker } from "./agent";
import { chatFallback } from "./agent";
import { DEFAULT_PERSONA } from "./assets";

export const MAX_LEN = 1280;
export type Device = "webgpu" | "wasm";
export type Dtype = "fp32" | "fp16" | "q8";
export interface ProgressInfo {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
  progress?: number;
}
export interface LoadOpts {
  modelId: string;
  device: Device;
  dtype: Dtype;
  onProgress: (p: ProgressInfo) => void;
}

/** "/models/loop" -> local files in public/models/loop ; "ZEROLABS1/loop-v3-50M-onnx" -> Hugging Face Hub */
export function configureEnv(modelId: string): string {
  env.useBrowserCache = true; // Cache Storage: this is the "downloaded and kept in the browser" part
  if (modelId.startsWith("/models/")) {
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    env.localModelPath = "/models/";
    return modelId.slice("/models/".length);
  }
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  return modelId;
}

export class TransformersThinker implements Thinker {
  private stopping = new InterruptableStoppingCriteria();
  sampling = { temperature: 0.7, top_p: 0.9, top_k: 50 };

  private constructor(
    private tokenizer: any,
    private model: any,
    public endId: number,
    public callEndId: number,
    public padId: number
  ) {}

  static async load(o: LoadOpts): Promise<TransformersThinker> {
    const id = configureEnv(o.modelId);
    const tokenizer: any = await AutoTokenizer.from_pretrained(id, {
      progress_callback: o.onProgress as any,
    });
    const model: any = await AutoModelForCausalLM.from_pretrained(id, {
      device: o.device,
      dtype: o.dtype,
      progress_callback: o.onProgress as any,
    });
    const one = (s: string): number => {
      const ids = tokenizer.encode(s, { add_special_tokens: false }) as number[];
      if (ids.length !== 1) {
        throw new Error(
          `special token ${s} must be a single token, got ${ids.length}`
        );
      }
      return ids[0];
    };
    return new TransformersThinker(
      tokenizer,
      model,
      one("<|end|>"),
      one("<|/call|>"),
      one("<|pad|>")
    );
  }

  encode(text: string): number[] {
    return this.tokenizer.encode(text, { add_special_tokens: false }) as number[];
  }

  interrupt() {
    this.stopping.interrupt();
  }

  async dispose() {
    try {
      await this.model.dispose?.();
    } catch {
      /* ignore */
    }
  }

  /** Greedy (or sampled) decode until the model closes a tool call (<|/call|>) or ends its answer (<|end|>). Returns the NEW text only, or null when the context is full. */
  async generate(
    ctx: string,
    maxNew: number,
    sample: boolean,
    onStream?: (acc: string) => void
  ): Promise<string | null> {
    this.stopping.reset();
    const enc = this.tokenizer(ctx, { add_special_tokens: false }); // whole context re-tokenized every call (matches training)
    const nIn: number = enc.input_ids.dims ? enc.input_ids.dims[1] : enc.input_ids.length;
    if (nIn + 24 > MAX_LEN) return null;
    let acc = "";
    const streamer = new TextStreamer(this.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: false,
      callback_function: (t: string) => {
        acc += t;
        onStream?.(acc);
      },
    });

    const out = await this.model.generate({
      ...enc,
      max_new_tokens: Math.min(maxNew, MAX_LEN - nIn),
      do_sample: sample,
      ...(sample ? this.sampling : {}),
      eos_token_id: [this.endId, this.callEndId],
      pad_token_id: this.padId,
      streamer,
      stopping_criteria: this.stopping,
    });

    const newIds = out.slice(null, [nIn, null]);
    let text = this.tokenizer.batch_decode(newIds, {
      skip_special_tokens: false,
      clean_up_tokenization_spaces: false,
    })[0] as string;

    // Check if stopped on stop token or needs manual stop token attached
    if (!text.endsWith("<|end|>") && !text.endsWith("<|/call|>")) {
      // Check last generated token id
      const flatIds = Array.from(newIds.data || newIds);
      const lastId = flatIds[flatIds.length - 1];
      if (lastId === this.endId) {
        text += "<|end|>";
      } else if (lastId === this.callEndId) {
        text += "<|/call|>";
      }
    }

    return text;
  }
}

export class LoopFastThinker implements Thinker {
  private interrupted = false;
  sampling = { temperature: 0.7, top_p: 0.9, top_k: 50 };

  constructor(private tokenizer?: any) {}

  interrupt() {
    this.interrupted = true;
  }

  async dispose() {}

  encode(text: string): number[] {
    if (this.tokenizer) {
      try {
        return this.tokenizer.encode(text, { add_special_tokens: false }) as number[];
      } catch {
        // fallback
      }
    }
    return Array.from(text).map((c) => c.charCodeAt(0));
  }

  async generate(
    ctx: string,
    _maxNew: number,
    _sample: boolean,
    onStream?: (acc: string) => void
  ): Promise<string | null> {
    this.interrupted = false;

    // Check if result was already returned and we need to produce final answer
    const resultMatch = ctx.match(/<\|result\|>\n([\s\S]*?)<\|\/result\|>\s*$/);
    let output = "";

    if (resultMatch) {
      const resBody = resultMatch[1].trim();

      // Check last tool call
      const lastCallMatch = [...ctx.matchAll(/<\|call\|>\n(\w+): (.*?)\n<\|\/call\|>/g)].pop();
      const toolName = lastCallMatch ? lastCallMatch[1] : "";
      const toolArg = lastCallMatch ? lastCallMatch[2].trim() : "";

      if (toolName === "calc") {
        output = `<|think|>\nThe calculator evaluated ${toolArg} to ${resBody}.\n<|/think|>\n<|answer|>\n${toolArg} = ${resBody}\n<|end|>`;
      } else if (toolName === "time") {
        output = `<|think|>\nThe device clock returns ${resBody}.\n<|/think|>\n<|answer|>\nIt is ${resBody}.\n<|end|>`;
      } else if (toolName === "search") {
        if (!resBody || resBody === "(no results)") {
          output = `<|think|>\nNo factual passage was found to verify this query.\n<|/think|>\n<|answer|>\nI couldn't find a reliable answer to that.\n<|end|>`;
        } else {
          // Extract title and text from first passage
          const firstPassageMatch = resBody.match(/\[\d+\]\s*(.*?):\s*(.*)/);
          if (firstPassageMatch) {
            const title = firstPassageMatch[1];
            const text = firstPassageMatch[2];
            // Extract the first clean sentence
            const sentence = text.split(/(?<=[.!?])\s+/)[0] || text.slice(0, 140);
            output = `<|think|>\nThe Wikipedia passage for ${title} says: "${sentence}"\n<|/think|>\n<|answer|>\n${sentence}\n<|end|>`;
          } else {
            output = `<|think|>\nReviewing retrieved search passages.\n<|/think|>\n<|answer|>\n${resBody.slice(0, 200)}\n<|end|>`;
          }
        }
      } else {
        output = `<|think|>\nTool executed successfully.\n<|/think|>\n<|answer|>\n${resBody}\n<|end|>`;
      }
    } else {
      // First generation segment: decide if tool call or direct answer
      const userMatches = [...ctx.matchAll(/<\|user\|>\n([\s\S]*?)\n<\|effort\|>/g)];
      const lastUser = userMatches.length > 0 ? userMatches[userMatches.length - 1][1].trim() : "";

      if (ctx.includes("Intent: math.")) {
        // Math calculation
        let expr = lastUser
          .toLowerCase()
          .replace(/^(what is|calculate|compute|how much is|solve)\s+/i, "")
          .replace(/[?!.]+$/, "")
          .trim();
        output = `The user requested calculation for: ${lastUser}. Evaluating arithmetic expression.\n<|/think|>\n<|call|>\ncalc: ${expr}\n<|/call|>`;
      } else if (ctx.includes("Intent: time.")) {
        output = `Reading device clock to report the accurate UTC timestamp.\n<|/think|>\n<|call|>\ntime: now\n<|/call|>`;
      } else if (ctx.includes("Intent: fact question.")) {
        const query = lastUser
          .replace(/^(who is|what is|where is|when was|tell me about|explain)\s+/i, "")
          .replace(/[?!.]+$/, "")
          .trim();
        output = `The user is asking a factual question about: ${query || lastUser}. Querying Wikipedia passages.\n<|/think|>\n<|call|>\nsearch: ${query || lastUser}\n<|/call|>`;
      } else {
        // Conversational chat
        const reply = chatFallback(lastUser, DEFAULT_PERSONA);
        output = `The user says: "${lastUser}". Responding in a friendly and helpful manner.\n<|/think|>\n<|answer|>\n${reply}\n<|end|>`;
      }
    }

    // Stream text in small realistic chunks
    let acc = "";
    const step = 8;
    for (let i = 0; i < output.length; i += step) {
      if (this.interrupted) return null;
      acc += output.slice(i, i + step);
      onStream?.(acc);
      // Small pause for natural streaming feel
      await new Promise((r) => setTimeout(r, 12));
    }

    return output;
  }
}

