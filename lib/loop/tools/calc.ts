// src/lib/loop/tools/calc.ts  (pure, no DOM, no deps)
type Num = { int: true; v: bigint } | { int: false; v: number };
const I = (v: bigint): Num => ({ int: true, v });
const F = (v: number): Num => ({ int: false, v });
const toF = (n: Num): number => (n.int ? Number(n.v) : n.v);
class ZeroDiv extends Error {}
class Invalid extends Error {}

function tokenize(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " ") { i++; continue; }
    if (src.startsWith("**", i)) { out.push("**"); i += 2; continue; }
    if ("+-*/%()".includes(c)) { out.push(c); i++; continue; }
    const m = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(i));
    if (!m) throw new Invalid();
    out.push(m[0]); i += m[0].length;
  }
  return out;
}

function evaluate(expr: string): Num {
  const t = tokenize(expr.trim());
  let p = 0;
  const peek = () => t[p];
  const next = () => t[p++];
  const add = (a: Num, b: Num, sign: 1 | -1): Num =>
    a.int && b.int ? I(sign === 1 ? a.v + b.v : a.v - b.v) : F(sign === 1 ? toF(a) + toF(b) : toF(a) - toF(b));
  const mul = (a: Num, b: Num): Num => (a.int && b.int ? I(a.v * b.v) : F(toF(a) * toF(b)));
  const div = (a: Num, b: Num): Num => { if (toF(b) === 0) throw new ZeroDiv(); return F(toF(a) / toF(b)); };
  const mod = (a: Num, b: Num): Num => {
    if (toF(b) === 0) throw new ZeroDiv();
    if (a.int && b.int) { let r = a.v % b.v; if (r !== 0n && (r < 0n) !== (b.v < 0n)) r += b.v; return I(r); }
    const x = toF(a), y = toF(b); return F(x - y * Math.floor(x / y));
  };
  const pow = (a: Num, b: Num): Num => {
    if (Math.abs(toF(b)) > 12 || Math.abs(toF(a)) > 1e6) throw new Invalid();
    if (a.int && b.int && b.v >= 0n) return I(a.v ** b.v);
    if (toF(a) === 0 && toF(b) < 0) throw new ZeroDiv();
    return F(Math.pow(toF(a), toF(b)));
  };
  const parseExpr = (): Num => {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") { const op = next(); v = add(v, parseTerm(), op === "+" ? 1 : -1); }
    return v;
  };
  const parseTerm = (): Num => {
    let v = parseFactor();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = next(); const r = parseFactor();
      v = op === "*" ? mul(v, r) : op === "/" ? div(v, r) : mod(v, r);
    }
    return v;
  };
  const parseFactor = (): Num => {
    if (peek() === "+") { next(); return parseFactor(); }
    if (peek() === "-") { next(); const v = parseFactor(); return v.int ? I(-v.v) : F(-v.v); }
    return parsePower();
  };
  const parsePower = (): Num => {
    const base = parseAtom();
    if (peek() === "**") { next(); return pow(base, parseFactor()); }
    return base;
  };
  const parseAtom = (): Num => {
    const tok = next();
    if (tok === undefined) throw new Invalid();
    if (tok === "(") { const v = parseExpr(); if (next() !== ")") throw new Invalid(); return v; }
    if (/^(\d|\.)/.test(tok)) return /^\d+$/.test(tok) ? I(BigInt(tok)) : F(parseFloat(tok));
    throw new Invalid();
  };
  const v = parseExpr();
  if (p !== t.length) throw new Invalid();
  return v;
}

function fmtNum(n: Num): string {
  if (n.int) return n.v.toString();
  let x = n.v;
  if (!Number.isFinite(x)) return "error: invalid result";
  x = Math.round(x * 1e6) / 1e6;
  if (Number.isInteger(x)) return BigInt(x).toString();
  return String(x);
}

/** the tool the model calls: returns the result string, or "error: ..." */
export function toolCalc(expr: string): string {
  try { return fmtNum(evaluate(expr)); }
  catch (e) { return e instanceof ZeroDiv ? "error: division by zero" : "error: invalid expression"; }
}

/** 'what is 37 times 12' / '25% of 80' / '(12+8)*3' -> expression string, or null when it is not arithmetic */
export function calcNormalize(text: string): string | null {
  let s = text.toLowerCase().trim().replace(/[?!. ]+$/, "");
  s = s.replace(/^(what is|what's|whats|calculate|compute|solve|evaluate|how much is|find|tell me)\s+/, "");
  s = s.replace(/(?<=\d),(?=\d{3})/g, "");
  s = s.replace(/(\d+(?:\.\d+)?)\s*(?:%|percent)\s*of\s*/g, "($1/100)*");
  s = s.replace(/\bsquared\b/g, "**2").replace(/\bcubed\b/g, "**3");
  s = s.replace(/\bto the power of\b/g, "**").replace(/\^/g, "**");
  s = s.replace(/\b(multiplied by|times)\b/g, "*").replace(/(?<=\d)\s*x\s*(?=\d)/g, "*");
  s = s.replace(/\b(divided by|over)\b/g, "/");
  s = s.replace(/\bplus\b/g, "+").replace(/\bminus\b/g, "-").replace(/\b(modulo|mod)\b/g, "%");
  s = s.replace(/×/g, "*").replace(/÷/g, "/");
  s = s.replace(/\s+/g, " ").trim();
  if (!/^[\d\s+\-*/().%]+$/.test(s)) return null;
  if (!/\d/.test(s) || !/[+\-*/%]/.test(s.replace(/^[-+]+/, ""))) return null;
  return s;
}

const TIME_PATTERNS = [
  "(what('s| is)? )?(the )?(current )?(time|date|day)( is it)?( now| today| right now)?",
  "what (time|day|date) is it( now| today| right now)?",
  "what('s| is) (today'?s? )?date( today)?",
  "what day is (it )?today",
  "today'?s date",
  "tell me the (time|date)",
  "what('s| is) today",
  "what('s| is) the time( right now)?",
  "what is the date",
].map((p) => new RegExp("^(?:" + p + ")$"));
export function isTimeQuery(text: string): boolean {
  const s = text.toLowerCase().trim().replace(/[?!. ]+$/, "").replace(/\s+/g, " ");
  return TIME_PATTERNS.some((re) => re.test(s));
}

/** '%A, %Y-%m-%d %H:%M UTC' */
export function toolNow(): string {
  const d = new Date();
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(d);
  const iso = d.toISOString();
  return `${wd}, ${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}
