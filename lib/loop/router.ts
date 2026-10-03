// src/lib/loop/router.ts  (pure; weights come from router.bin)
import { calcNormalize, isTimeQuery } from "./tools/calc";

export const CLASSES = ["chat", "search", "calc", "time"] as const;
export type Label = (typeof CLASSES)[number];
export type RouteSource = "rules" | "router" | "unsure";

// ---- crc32 over UTF-8 bytes (identical to Python zlib.crc32) ----
const CRC_T = new Uint32Array(256);
for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_T[i] = c >>> 0; }
const enc = new TextEncoder();
function crc32(s: string): number {
  const b = enc.encode(s); let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function routerFeats(text: string, buckets: number): Int32Array {
  const t = " " + text.toLowerCase().trim().replace(/\s+/g, " ").replace(/\d/g, "0") + " ";
  const ws = t.match(/[a-z0-9']+|[^\sa-z0-9]/gu) ?? [];
  const items: string[] = [...ws];
  for (let i = 0; i + 1 < ws.length; i++) items.push(ws[i] + "_" + ws[i + 1]);
  const cps = Array.from(t); // code points, like Python str indexing
  for (const n of [3, 4, 5]) for (let i = 0; i + n <= cps.length; i++) items.push("#" + cps.slice(i, i + n).join(""));
  const out = new Int32Array(items.length);
  for (let i = 0; i < items.length; i++) out[i] = crc32(items[i]) % buckets; // buckets = 32768 (power of two)
  return out;
}

export interface RouterMeta { buckets: number; rdim: number; rhid: number; classes: string[]; router_conf: number }
export class Router {
  E: Float32Array; W1: Float32Array; b1: Float32Array; W2: Float32Array; b2: Float32Array;
  constructor(public meta: RouterMeta, buf: ArrayBuffer) {
    const { buckets, rdim, rhid } = meta; let off = 0;
    const take = (n: number) => { const a = new Float32Array(buf, off, n); off += n * 4; return a; };
    this.E = take(buckets * rdim); this.W1 = take(rdim * rhid); this.b1 = take(rhid); this.W2 = take(rhid * 4); this.b2 = take(4);
  }
  probs(text: string): number[] {
    const { buckets, rdim, rhid } = this.meta;
    const f = routerFeats(text, buckets);
    const x = new Float32Array(rdim);
    for (let i = 0; i < f.length; i++) { const o = f[i] * rdim; for (let d = 0; d < rdim; d++) x[d] += this.E[o + d]; }
    for (let d = 0; d < rdim; d++) x[d] /= Math.max(1, f.length);
    const h = new Float32Array(rhid);
    for (let j = 0; j < rhid; j++) { let s = this.b1[j]; for (let d = 0; d < rdim; d++) s += x[d] * this.W1[d * rhid + j]; h[j] = s > 0 ? s : 0; }
    const z = [0, 0, 0, 0];
    for (let c = 0; c < 4; c++) { let s = this.b2[c]; for (let j = 0; j < rhid; j++) s += h[j] * this.W2[j * 4 + c]; z[c] = s; }
    const m = Math.max(...z); const e = z.map((v) => Math.exp(v - m)); const sum = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / sum);
  }
}

const GREET_RE = /^(hi+|hello+|hey+|hiya|howdy|yo|sup|good (morning|afternoon|evening|night)|thanks?( you)?( so much| a lot)?|thx|bye|goodbye|see you( later)?)( there| loop| everyone| friend)?[\s!.?,]*$/;
const WH_RE = /^(what|whats|what's|who|whos|who's|whom|when|where|which|why|how)\b/i;
const SELF_RE = /\b(i|i'm|im|i've|me|my|mine|we|us|our|you|your|you're|yours|yourself|u|ur|weather|forecast)\b/i;

export interface RouteResult { label: Label; probs: number[] | null; source: RouteSource }
export function route(text: string, router: Router, routerConf = 0.95): RouteResult {
  const t = text.trim();
  if (GREET_RE.test(t.toLowerCase())) return { label: "chat", probs: null, source: "rules" };
  if (isTimeQuery(t)) return { label: "time", probs: null, source: "rules" };
  const expr = calcNormalize(t);
  if (expr !== null && t.length < 80) return { label: "calc", probs: null, source: "rules" };
  const p = router.probs(t);
  let label: Label = CLASSES[p.indexOf(Math.max(...p))];
  if (label === "calc" || label === "time") label = p[1] >= p[0] ? "search" : "chat";
  let source: RouteSource = Math.max(...p) >= routerConf ? "router" : "unsure";
  if (label === "chat" && source === "router" && WH_RE.test(t) && !SELF_RE.test(t) && p[1] > 0.02) source = "unsure";
  return { label, probs: p, source };
}
