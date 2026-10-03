// src/lib/loop/tools/search.ts
export interface Passage { title: string; text: string }

const STOP = new Set(
  ("a an the of in on at to is are was were what whats who whom which tell me about explain give quick summary do you know please can could i want how and for it this that " +
   "with by as be from or latest news info information search look up describe something exactly overview say hey when where why did does has have had been many much there " +
   "their his her its than then after before during").split(" "),
);
export const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "");
export const toks = (s: string) => fold(s).toLowerCase().match(/[a-z0-9]+/g) ?? [];
export const contentToks = (s: string) => toks(s).filter((w) => !STOP.has(w));
const sentences = (text: string) => text.trim().split(/(?<=[.!?])\s+/).filter(Boolean);

/** short, query-focused snippet (<= maxChars) - this is what the model sees, exactly as in training */
export function snippet(text: string, query: string, maxChars = 360): string {
  text = text.trim();
  if (text.length <= maxChars) return text;
  const ss = sentences(text);
  const qt = new Set(contentToks(query));
  if (!ss.length) return text.slice(0, maxChars);
  let best = 0, bestScore = -1;
  ss.forEach((s, i) => { const sc = toks(s).filter((w, j, a) => a.indexOf(w) === j && qt.has(w)).length; if (sc > bestScore) { bestScore = sc; best = i; } });
  let lo = best, hi = best, cur = ss[best].length;
  for (;;) {
    let grown = false;
    if (hi + 1 < ss.length && cur + 1 + ss[hi + 1].length <= maxChars) { hi++; cur += 1 + ss[hi + 1].length; grown = true; }
    if (lo - 1 >= 0 && cur + 1 + ss[lo - 1].length <= maxChars) { lo--; cur += 1 + ss[lo].length; grown = true; }
    if (!grown) break;
  }
  return ss.slice(lo, hi + 1).join(" ").slice(0, maxChars);
}

/** the text pasted between <|result|> and <|/result|> */
export const formatResults = (sn: { title: string; snippet: string }[]) =>
  sn.map((r, j) => `[${j + 1}] ${r.title}: ${r.snippet}`).join("\n") + "\n";

const cache = new Map<string, Passage[]>();
/** live Wikipedia (CORS-enabled with origin=*). Never throws: returns [] on any failure. */
export async function wikiLive(query: string, n: number, signal?: AbortSignal, timeoutMs = 6000): Promise<Passage[]> {
  const key = `${query}|${n}`;
  if (cache.has(key)) return cache.get(key)!;
  const API = "https://en.wikipedia.org/w/api.php";
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  signal?.addEventListener("abort", () => ctl.abort(), { once: true });
  try {
    const q1 = new URLSearchParams({ action: "query", list: "search", srsearch: query, srlimit: String(n), format: "json", origin: "*" });
    const r1 = await (await fetch(`${API}?${q1}`, { signal: ctl.signal })).json();
    const titles: string[] = (r1?.query?.search ?? []).map((h: any) => h.title);
    if (!titles.length) return [];
    const q2 = new URLSearchParams({ action: "query", prop: "extracts", exintro: "1", explaintext: "1", exlimit: String(n), exchars: "1500", titles: titles.join("|"), format: "json", redirects: "1", origin: "*" });
    const r2 = await (await fetch(`${API}?${q2}`, { signal: ctl.signal })).json();
    const pages: Record<string, string> = {};
    for (const p of Object.values<any>(r2?.query?.pages ?? {})) pages[p.title] = p.extract ?? "";
    const out: Passage[] = [];
    for (const t of titles) { const x = (pages[t] ?? "").replace(/\s+/g, " ").trim(); if (x.length > 60) out.push({ title: t, text: x }); }
    cache.set(key, out);
    return out;
  } catch { return []; }
  finally { clearTimeout(timer); }
}

/** what the thinker sees for a search call: low -> 2 passages, medium/high -> 3 */
export async function toolSearch(query: string, effort: "low" | "medium" | "high", live: boolean, signal?: AbortSignal) {
  const q = query.trim() || "?";
  const pool = live ? await wikiLive(q, effort === "low" ? 2 : 3, signal) : [];
  const seen = new Set<string>(), out: { title: string; snippet: string; url: string }[] = [];
  for (const p of pool) {
    if (seen.has(p.text)) continue;
    seen.add(p.text);
    out.push({ title: p.title, snippet: snippet(p.text, q), url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}` });
  }
  return out;
}
