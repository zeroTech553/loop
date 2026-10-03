// src/lib/loop/extra/registry.ts
import { calcNormalize, toolCalc } from "../tools/calc";
import { convertTool, type ExtraResult } from "./convert";
import { defineTool } from "./define";
import { weatherTool } from "./weather";
import { rollTool } from "./dice";

export type { ExtraResult };

export interface ExtraTool {
  name: string;
  usage: string;
  hint: string;
  run(args: string, signal?: AbortSignal): Promise<ExtraResult>;
}

export const calcTool: ExtraTool = {
  name: "calc",
  usage: "/calc <expression>",
  hint: "Direct evaluation using Loop's verified exact-arithmetic engine",
  async run(args: string): Promise<ExtraResult> {
    const expr = args.trim();
    if (!expr) {
      return {
        title: "Calculator",
        lines: ["Please provide an expression. Example: /calc 12 * (4 + 6) or /calc 25% of 800"],
      };
    }
    const norm = calcNormalize(expr) ?? expr;
    const res = toolCalc(norm);
    return {
      title: "Calculator",
      lines: [`${expr} = ${res}`],
    };
  },
};

export const EXTRA_TOOLS: ExtraTool[] = [
  convertTool,
  defineTool,
  weatherTool,
  rollTool,
  calcTool,
];

export function findExtraTool(commandName: string): ExtraTool | undefined {
  const norm = commandName.toLowerCase().replace(/^\//, "");
  return EXTRA_TOOLS.find((t) => t.name === norm);
}
