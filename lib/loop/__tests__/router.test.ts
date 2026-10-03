// src/lib/loop/__tests__/router.test.ts
import { describe, it, expect } from "vitest";
import { route, routerFeats, Router } from "../router";

describe("Loop Router & Feats", () => {
  const throwingRouter = {
    meta: { buckets: 32768, rdim: 64, rhid: 128, classes: ["chat", "search", "calc", "time"], router_conf: 0.95 },
    probs: () => {
      throw new Error("Router.probs should not be called when rule matches!");
    },
  } as unknown as Router;

  it("short circuits to chat for greetings", () => {
    const res = route("hi", throwingRouter);
    expect(res.label).toBe("chat");
    expect(res.source).toBe("rules");
  });

  it("short circuits to chat for thanks", () => {
    const res = route("Thanks!", throwingRouter);
    expect(res.label).toBe("chat");
    expect(res.source).toBe("rules");
  });

  it("short circuits to time for clock queries", () => {
    const res = route("what time is it", throwingRouter);
    expect(res.label).toBe("time");
    expect(res.source).toBe("rules");
  });

  it("short circuits to calc for arithmetic expressions", () => {
    const res = route("what is 37 times 12", throwingRouter);
    expect(res.label).toBe("calc");
    expect(res.source).toBe("rules");
  });

  it("computes deterministic routerFeats within valid bucket range [0, 32768)", () => {
    const feats1 = routerFeats("Hello 123", 32768);
    const feats2 = routerFeats("Hello 123", 32768);

    expect(feats1.length).toBeGreaterThan(0);
    expect(Array.from(feats1)).toEqual(Array.from(feats2));

    for (let i = 0; i < feats1.length; i++) {
      expect(feats1[i]).toBeGreaterThanOrEqual(0);
      expect(feats1[i]).toBeLessThan(32768);
    }
  });
});
