// src/lib/loop/agent.ts  - 1:1 port of the notebook's Agent. Pure TS: the model is injected via the Thinker interface.
import { calcNormalize, toolCalc, toolNow } from "./tools/calc";
import { route, Router } from "./router";
import { toolSearch, formatResults } from "./tools/search";

export type Effort = "low" | "medium" | "high";
export const EFFORT_RT: Record<Effort, { maxCalls: number; maxNew: number }> = {
  low: { maxCalls: 1, maxNew: 260 }, medium: { maxCalls: 1, maxNew: 320 }, high: { maxCalls: 2, maxNew: 480 },
};
export const SPECIALS = ["<|user|>", "<|bot|>", "<|effort|>", "<|think|>", "<|/think|>", "<|call|>", "<|/call|>", "<|result|>", "<|/result|>", "<|answer|>", "<|end|>"];
const SPEC_RE = new RegExp(SPECIALS.map((s) => s.replace(/[|/]/g, "\\$&")).join("|"), "g");
const INTENT_LINE = { chat: "Intent: chat.", search: "Intent: fact question.", calc: "Intent: math.", time: "Intent: time." } as const;
export const ABSTAIN = ["I couldn't find a reliable answer to that.", "I couldn't verify that from my search, so I'd rather not guess.", "I don't have a reliable answer for that."];
const isAbstain = (a: string | null) => !!a && /couldn't find a reliable|rather not guess|don't have a reliable|can't compute/i.test(a);

const CALL_RE = /<\|call\|>\n(\w+): (.*?)\n<\|\/call\|>\s*$/s;
const ANS_RE = /<\|answer\|>\n(.*?)\n?<\|end\|>/s;
const THINK_RE = /<\|think\|>\n(.*?)<\|\/think\|>/gs;
const QUOTE_RE = /says: "(.*?)"/gs;

export interface Thinker { generate(ctx: string, maxNew: number, sample: boolean, onStream?: (acc: string) => void): Promise<string | null> }
export interface Persona { replies: Record<string, string[]>; human_claim: string; fallback_default: string }
export type AgentEvent =
  | { k: "route"; label: string; source: string; probs: number[] | null }
  | { k: "stream"; text: string }                    // accumulated raw text of the segment being generated
  | { k: "think"; text: string }
  | { k: "call"; name: string; arg: string }
  | { k: "result"; name: string; body: string; sources: { title: string; url: string }[] }
  | { k: "guard"; text: string };
export interface AgentResult {
  kind: "chat" | "search" | "calc" | "time" | "abstain"; answer: string; effort: Effort; thinkWords: number; tools: string[];
  route: [string, string]; events: AgentEvent[]; sources: { title: string; url: string }[]; verified: boolean;
}

export const buildPrompt = (history: [string, string][], text: string, effort: Effort) =>
  history.slice(-2).map(([u, a]) => `<|user|>\n${u}\n<|bot|>\n${a}\n<|end|>\n`).join("") + `<|user|>\n${text}\n<|effort|>\n${effort}\n`;

const normq = (s: string) => s.replace(/"/g, "'").replace(/[“”’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

export function chatCat(text: string): string {
  const t = text.toLowerCase();
  if (/^(hi+|hello+|hey+|good (morning|afternoon|evening)|howdy|hiya|yo)\b/.test(t)) return "greeting";
  if (/\b(thanks|thank you)\b/.test(t)) return "thanks";
  if (/\b(bye|goodbye|see you|good night)\b/.test(t)) return "bye";
  if (/\b(who are you|your name|about yourself|are you (a|an) )/.test(t)) return "identity";
  if (/\b(sad|happy|tired|stressed|anxious|excited|lonely|bored|angry|worried|nervous|upset|scared|i feel|i'm feeling|i am feeling|i had a)\b/.test(t)) return "feeling";
  if (/\b(joke|story|poem|riddle|write)\b/.test(t)) return "creative";
  if (/\b(advice|tips?|how (can|do|should) i|should i|suggest|recommend)\b/.test(t)) return "advice";
  if (/\b(do you (like|think|enjoy|prefer)|favorite|favourite|what do you think)\b/.test(t)) return "opinion";
  return "smalltalk";
}
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export function chatFallback(text: string, p: Persona): string {
  const r = p.replies[chatCat(text)];
  return r?.length ? pick(r) : p.fallback_default;
}

export function chatProblem(a: string | null, history: [string, string][], p: Persona): string | null {
  if (!a || a.trim().length < 2) return "empty";
  if (a.length > 500) return "too long";
  if (a.includes("<|") || a.includes("|>")) return "format tokens leaked";
  if (/[^\x00-\x7f]{4,}/.test(a)) return "garbled text";
  const w = a.toLowerCase().split(/\s+/).filter(Boolean);
  if (w.length >= 8 && new Set(w).size / w.length < 0.45) return "repetitive";
  if (/(\b\w+\b)(\s+\1){3,}/.test(a.toLowerCase())) return "repeated word loop";
  if (history.slice(-2).some((h) => a.trim() === h[1].trim())) return "same reply as the previous turn";
  if (/\b(1[0-9]{3}|20[0-9]{2})\b/.test(a) || /\d{3,}/.test(a)) return "states numbers or dates (chat must not claim facts)";
  if (new RegExp(p.human_claim, "i").test(a)) return "claims human experiences";
  return null;
}

export interface AgentDeps { thinker: Thinker; router: Router; persona: Persona; routerConf: number; live: boolean; signal?: AbortSignal; onEvent?: (e: AgentEvent) => void }

export async function runAgent(text: string, effort: Effort, history: [string, string][], d: AgentDeps): Promise<AgentResult> {
  const events: AgentEvent[] = []; const ev = (e: AgentEvent) => { events.push(e); d.onEvent?.(e); };
  const E = EFFORT_RT[effort];
  const r = route(text, d.router, d.routerConf);
  let prefill = "";
  if (r.source === "rules" || r.source === "router") { ev({ k: "route", label: r.label, source: r.source, probs: r.probs }); prefill = `<|think|>\n${INTENT_LINE[r.label]}\n`; }
  else ev({ k: "route", label: r.label, source: "unsure", probs: r.probs });
  let ctx = buildPrompt(history, text, effort) + prefill; const ctx0 = ctx;
  const samp = r.label === "chat" && (r.source === "rules" || r.source === "router"); // only certain chat is sampled
  let first = true, calls = 0, answer: string | null = null, aborted: string | null = null;
  const used: string[] = [], results: string[] = [], thinks: string[] = []; let last: [string, string, string] | null = null;
  let sources: { title: string; url: string }[] = [];
  for (;;) {
    if (d.signal?.aborted) throw new DOMException("aborted", "AbortError");
    const seg = await d.thinker.generate(ctx, E.maxNew, samp, (acc) => d.onEvent?.({ k: "stream", text: (first ? prefill : "") + acc }));
    if (seg === null) { aborted = "context is full"; break; }
    const shown = (first ? prefill : "") + seg; first = false; ctx += seg;
    for (const m of shown.matchAll(THINK_RE)) { thinks.push(m[1]); ev({ k: "think", text: m[1].replace(/\s+$/, "") }); }
    const m = CALL_RE.exec(seg);
    if (m) {
      if (calls >= E.maxCalls) { aborted = `tool budget for effort=${effort} is used up`; break; }
      calls++; const name = m[1], arg = m[2].trim(); let body: string; let srcs: { title: string; url: string }[] = [];
      if (name === "search") {
        const found = await toolSearch(arg, effort, d.live, d.signal);
        body = found.length ? formatResults(found) : "(no results)\n"; srcs = found.map((f) => ({ title: f.title, url: f.url })); sources = [...sources, ...srcs];
      } else if (name === "calc") { const x = toolCalc(arg); body = x + "\n"; last = ["calc", arg, x]; }
      else if (name === "time") { const x = toolNow(); body = x + "\n"; last = ["time", "now", x]; }
      else { aborted = `unknown tool '${name}'`; break; }
      used.push(name); ev({ k: "call", name, arg }); ev({ k: "result", name, body: body.replace(/\s+$/, ""), sources: srcs });
      results.push(body); ctx += `\n<|result|>\n${body}<|/result|>\n`; continue;
    }
    const a = ANS_RE.exec(seg);
    if (a) answer = a[1].trim(); else aborted = "the model did not finish its answer";
    break;
  }
  let kind: AgentResult["kind"] = used.includes("search") ? "search" : used.includes("calc") ? "calc" : used.includes("time") ? "time" : "chat";
  if (kind === "chat" && thinks.some((t) => t.includes("Intent: fact question"))) { // a fact question must never be answered without a passage
    kind = "search";
    if (answer !== null && !isAbstain(answer)) { ev({ k: "guard", text: "fact question answered without searching -> not trusted" }); answer = null; }
  }
  const guard: string[] = []; let verified = false;
  if (aborted) { guard.push(`stopped: ${aborted}`); answer = null; }
  if (kind === "search") {
    const res = normq(results.join(" "));
    const badQ = thinks.flatMap((t) => [...t.matchAll(QUOTE_RE)].map((m) => m[1])).filter((q) => !res.includes(normq(q)));
    if (answer !== null && badQ.length) { guard.push(`the thinking quotes text that is not in any passage ('${badQ[0].slice(0, 50)}') -> not trusted`); answer = null; }
    else if (answer !== null && !isAbstain(answer) && !res.includes(normq(answer))) { guard.push(`answer '${answer}' is not in any passage -> not trusted`); answer = null; }
    else if (answer !== null && !isAbstain(answer)) verified = true;
    if (answer === null) answer = ABSTAIN[0];
  } else if (kind === "calc") {
    const n = r.source === "rules" ? calcNormalize(text) : null;
    if (n !== null && last !== null && toolCalc(n) !== last[2]) { guard.push(`the thinker used '${last[1]}'; the question parses as '${n}'. Using the parsed one.`); last = ["calc", n, toolCalc(n)]; answer = null; }
    if (last![2].startsWith("error")) { if (answer === null || (!isAbstain(answer) && !answer.includes("can't compute"))) answer = `I can't compute that: ${last![2].slice(7)}.`; }
    else if (answer === null || !answer.includes(last![2])) { if (answer !== null) guard.push("the final answer did not contain the calculator result -> replaced"); answer = `${last![1]} = ${last![2]}`; }
    verified = true;
  } else if (kind === "time") {
    if (answer === null || !answer.includes(last![2])) { if (answer !== null) guard.push("the final answer did not contain the clock reading -> replaced"); answer = `It is ${last![2]}.`; }
    verified = true;
  } else {
    if (answer !== null) answer = answer.replace(SPEC_RE, "").trim();
    let why = chatProblem(answer, history, d.persona);
    if (why && samp) { // try the model again (new sample) before giving up on it
      for (let i = 0; i < 2; i++) {
        if (d.signal?.aborted) throw new DOMException("aborted", "AbortError");
        const seg2 = await d.thinker.generate(ctx0, E.maxNew, true); const m2 = ANS_RE.exec(seg2 ?? "");
        const a2 = m2 ? m2[1].replace(SPEC_RE, "").trim() : null;
        if (a2 && !chatProblem(a2, history, d.persona)) { guard.push(`chat reply re-sampled (${why})`); answer = a2; why = null; break; }
      }
    }
    if (why) { guard.push(`chat reply rejected (${why}) -> safe fallback`); answer = chatFallback(text, d.persona); }
  }
  for (const g of guard) ev({ k: "guard", text: g });
  if (kind === "search" && isAbstain(answer)) kind = "abstain";
  return { kind, answer: answer!, effort, thinkWords: thinks.reduce((n, t) => n + t.split(/\s+/).filter(Boolean).length, 0), tools: used,
           route: [r.label, r.source], events, sources: kind === "search" ? sources : [], verified };
}
