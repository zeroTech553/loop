import { Router, type RouterMeta } from "./router";
import type { Persona } from "./agent";

export const assetBase = (modelId: string) =>
  modelId.startsWith("/") ? modelId.replace(/\/$/, "") : `https://huggingface.co/${modelId}/resolve/main`;

export async function fetchCached(url: string): Promise<Response> {
  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open("loop-assets-v1");
      const hit = await cache.match(url);
      if (hit) return hit;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      await cache.put(url, res.clone());
      return res;
    } catch (e: any) {
      // If Cache API fails or URL not ok, try plain fetch if not already attempted
      if (e?.message?.includes(url)) throw e;
    }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

export const DEFAULT_PERSONA: Persona = {
  replies: {
    greeting: [
      "Hello! How can I help you today?",
      "Hi there! What can I help you with?",
      "Hey! Good to see you.",
    ],
    thanks: ["You're very welcome!", "Happy to help!", "Anytime!"],
    bye: ["Goodbye! Have a great day.", "See you later!", "Take care!"],
    identity: [
      "I'm Loop, a tiny 50M on-device AI agent built by ZEROLABS.",
      "I am Loop, an AI agent running directly in your browser.",
    ],
    feeling: [
      "I hope things go well for you. How can I help today?",
      "Thanks for sharing. I'm here if you need to ask a question, a calculation, or the time.",
    ],
    creative: [
      "Here's a quick riddle: What has keys but cannot unlock doors? A piano!",
      "A quick thought: Curiosity is the compass that leads us to discovery.",
    ],
    advice: [
      "I recommend taking things step by step. What specifically are you working on?",
      "A good approach is to break the problem into smaller parts.",
    ],
    opinion: [
      "As a tiny AI agent, I don't have personal feelings, but I'm fascinated by interesting ideas!",
      "I like helping out with calculations, time, and facts from Wikipedia!",
    ],
    smalltalk: [
      "I'm doing well, running smoothly right in your browser! How about you?",
    ],
  },
  human_claim:
    "\\b(when i was (young|a kid|born)|my (wife|husband|mom|dad|child|son|daughter)|yesterday i went to|i ate|i slept|i woke up)\\b",
  fallback_default:
    "I'm not sure I followed that. Could you say it another way, or ask me a fact, a calculation or the time?",
};

export interface LoopWebConfig {
  max_len: number;
  chat_temp: number;
  chat_top_p: number;
  router_conf: number;
  effort_runtime?: Record<string, { max_calls: number; max_new: number }>;
  specials?: string[];
}

export const DEFAULT_CONFIG: LoopWebConfig = {
  max_len: 1280,
  chat_temp: 0.7,
  chat_top_p: 0.9,
  router_conf: 0.95,
};

export interface ParityData {
  tokenizer: { text: string; ids: number[] }[];
  router: { text: string; probs?: number[]; label: string; source: string }[];
}

export async function loadRouter(modelId: string): Promise<Router> {
  let base = assetBase(modelId);
  let meta: RouterMeta;
  let buf: ArrayBuffer;

  try {
    const metaRes = await fetchCached(`${base}/router.json`);
    meta = await metaRes.json();
    const binRes = await fetchCached(`${base}/router.bin`);
    buf = await binRes.arrayBuffer();
  } catch (err) {
    // Fall back to local unpacked weights
    try {
      const metaRes = await fetchCached(`/models/loop/router.json`);
      meta = await metaRes.json();
      const binRes = await fetchCached(`/models/loop/router.bin`);
      buf = await binRes.arrayBuffer();
    } catch {
      throw err;
    }
  }

  const expectedBytes =
    (meta.buckets * meta.rdim +
      meta.rdim * meta.rhid +
      meta.rhid +
      meta.rhid * 4 +
      4) *
    4;
  if (buf.byteLength < expectedBytes) {
    throw new Error(
      `router.bin is smaller than expected (${buf.byteLength} vs ${expectedBytes} bytes)`
    );
  }

  return new Router(meta, buf);
}

export async function loadPersona(modelId: string): Promise<Persona> {
  try {
    const base = assetBase(modelId);
    const res = await fetchCached(`${base}/persona.json`);
    const p = await res.json();
    return {
      replies: p.replies || DEFAULT_PERSONA.replies,
      human_claim: p.human_claim || DEFAULT_PERSONA.human_claim,
      fallback_default: p.fallback_default || DEFAULT_PERSONA.fallback_default,
    };
  } catch (err) {
    console.warn("Could not load persona.json, using defaults:", err);
    return DEFAULT_PERSONA;
  }
}

export async function loadConfig(modelId: string): Promise<LoopWebConfig> {
  try {
    const base = assetBase(modelId);
    const res = await fetchCached(`${base}/loop_web_config.json`);
    const cfg = await res.json();
    return { ...DEFAULT_CONFIG, ...cfg };
  } catch (err) {
    console.warn("Could not load loop_web_config.json, using defaults:", err);
    return DEFAULT_CONFIG;
  }
}

export async function loadParity(modelId: string): Promise<ParityData | null> {
  try {
    const base = assetBase(modelId);
    const res = await fetchCached(`${base}/parity.json`);
    return await res.json();
  } catch {
    return null;
  }
}
