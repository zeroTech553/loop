// src/lib/loop/__tests__/agent.test.ts
import { describe, it, expect } from "vitest";
import { runAgent, type Thinker, type Persona, ABSTAIN } from "../agent";
import { Router } from "../router";

class FakeThinker implements Thinker {
  private queue: (string | null)[] = [];
  constructor(responses: (string | null)[]) {
    this.queue = [...responses];
  }
  async generate(): Promise<string | null> {
    if (this.queue.length === 0) return null;
    return this.queue.shift()!;
  }
}

const mockPersona: Persona = {
  replies: {
    greeting: ["Hello from persona!"],
    smalltalk: ["Just chatting safely."],
  },
  human_claim: "when i was|my wife",
  fallback_default: "Safe fallback response.",
};

const stubRouter = {
  meta: { buckets: 32768, rdim: 64, rhid: 128, classes: ["chat", "search", "calc", "time"], router_conf: 0.95 },
  probs: () => [0.7, 0.1, 0.1, 0.1],
} as unknown as Router;

describe("Loop Agent Loop & Guards", () => {
  it("handles greeting reply", async () => {
    const thinker = new FakeThinker([
      "<|think|>\nGreeting user.\n<|/think|>\n<|answer|>\nHello! How can I help you today?\n<|end|>",
    ]);
    const res = await runAgent("hi", "low", [], {
      thinker,
      router: stubRouter,
      persona: mockPersona,
      routerConf: 0.95,
      live: false,
      onEvent: () => {},
    });
    expect(res.kind).toBe("chat");
    expect(res.answer).toContain("Hello!");
  });

  it("handles calc happy path", async () => {
    const thinker = new FakeThinker([
      "<|think|>\nMath calculation.\n<|/think|>\n<|call|>\ncalc: 37*12\n<|/call|>",
      "<|think|>\nResult is 444.\n<|/think|>\n<|answer|>\n37*12 = 444\n<|end|>",
    ]);
    const res = await runAgent("what is 37 times 12", "medium", [], {
      thinker,
      router: stubRouter,
      persona: mockPersona,
      routerConf: 0.95,
      live: false,
      onEvent: () => {},
    });
    expect(res.kind).toBe("calc");
    expect(res.answer).toContain("444");
    expect(res.verified).toBe(true);
  });

  it("replaces calc answer if model used wrong expression (37*13 vs 37*12)", async () => {
    const thinker = new FakeThinker([
      "<|think|>\nMath calculation.\n<|/think|>\n<|call|>\ncalc: 37*13\n<|/call|>",
      "<|think|>\nResult is 481.\n<|/think|>\n<|answer|>\n37*13 = 481\n<|end|>",
    ]);
    const res = await runAgent("what is 37 times 12", "medium", [], {
      thinker,
      router: stubRouter,
      persona: mockPersona,
      routerConf: 0.95,
      live: false,
      onEvent: () => {},
    });
    expect(res.kind).toBe("calc");
    expect(res.answer).toContain("444");
    expect(res.events.some((e) => e.k === "guard" && e.text.includes("Using the parsed one"))).toBe(true);
  });

  it("handles time query and ensures answer contains clock reading", async () => {
    const thinker = new FakeThinker([
      "<|think|>\nClock lookup.\n<|/think|>\n<|call|>\ntime: now\n<|/call|>",
      "<|think|>\nFormatting time.\n<|/think|>\n<|answer|>\nThe time is now.\n<|end|>",
    ]);
    const res = await runAgent("what time is it", "low", [], {
      thinker,
      router: stubRouter,
      persona: mockPersona,
      routerConf: 0.95,
      live: false,
      onEvent: () => {},
    });
    expect(res.kind).toBe("time");
    expect(res.answer).toContain("UTC");
    expect(res.verified).toBe(true);
  });

  it("stops if tool budget for effort=medium is used up and abstains", async () => {
    const thinker = new FakeThinker([
      "<|think|>\nFirst call.\n<|/think|>\n<|call|>\ncalc: 2+2\n<|/call|>",
      "<|think|>\nSecond call exceeding medium budget.\n<|/think|>\n<|call|>\ncalc: 3+3\n<|/call|>",
    ]);
    const res = await runAgent("compute 2+2 and 3+3", "medium", [], {
      thinker,
      router: stubRouter,
      persona: mockPersona,
      routerConf: 0.95,
      live: false,
      onEvent: () => {},
    });
    expect(res.events.some((e) => e.k === "guard" && e.text.includes("tool budget for effort=medium is used up"))).toBe(true);
  });

  it("abstains when fact question answered without searching", async () => {
    const thinker = new FakeThinker([
      "<|think|>\nIntent: fact question.\nMarie Curie born in Poland.\n<|/think|>\n<|answer|>\nMarie Curie was born in Poland.\n<|end|>",
    ]);
    const res = await runAgent("where was Marie Curie born", "low", [], {
      thinker,
      router: stubRouter,
      persona: mockPersona,
      routerConf: 0.95,
      live: false,
      onEvent: () => {},
    });
    expect(res.kind).toBe("abstain");
    expect(res.answer).toBe(ABSTAIN[0]);
  });

  it("handles thinker returning null (context is full)", async () => {
    const thinker = new FakeThinker([null]);
    const res = await runAgent("hello", "low", [], {
      thinker,
      router: stubRouter,
      persona: mockPersona,
      routerConf: 0.95,
      live: false,
      onEvent: () => {},
    });
    expect(res.events.some((e) => e.k === "guard" && e.text.includes("context is full"))).toBe(true);
  });
});
