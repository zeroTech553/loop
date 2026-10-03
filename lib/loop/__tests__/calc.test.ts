// src/lib/loop/__tests__/calc.test.ts
import { describe, it, expect } from "vitest";
import {
  toolCalc,
  calcNormalize,
  isTimeQuery,
} from "../tools/calc";

describe("Loop Calculator & Normalizer", () => {
  const cases: [string, string][] = [
    ["what is 37 times 12", "444"],
    ["25% of 80", "20"],
    ["(12 + 8) * 3", "60"],
    ["what's 144 divided by 12", "12"],
    ["9 squared", "81"],
    ["100 minus 37", "63"],
    ["what is 15 percent of 240", "36"],
    ["7 x 8", "56"],
    ["2 to the power of 10", "1024"],
    ["1000 / 8", "125"],
    ["what is 3 cubed", "27"],
    ["0.1+0.2", "0.3"],
    ["1/3", "0.333333"],
    ["-2**2", "-4"],
    ["-7 % 3", "2"],
  ];

  for (const [q, expected] of cases) {
    it(`evaluates "${q}" to ${expected}`, () => {
      const norm = calcNormalize(q);
      expect(norm).not.toBeNull();
      const res = toolCalc(norm!);
      expect(res).toBe(expected);
    });
  }

  it("handles division by zero", () => {
    expect(toolCalc("5/0")).toBe("error: division by zero");
  });

  it("handles invalid expressions and overflow powers", () => {
    expect(toolCalc("999999**13")).toBe("error: invalid expression");
  });

  it("returns null for non-math queries", () => {
    expect(calcNormalize("what is the speed of light")).toBeNull();
  });

  it("identifies time queries correctly", () => {
    expect(isTimeQuery("what time is it")).toBe(true);
    expect(isTimeQuery("What's the date today?")).toBe(true);
    expect(isTimeQuery("tell me the time")).toBe(true);
    expect(isTimeQuery("what is the date of the battle")).toBe(false);
  });
});
