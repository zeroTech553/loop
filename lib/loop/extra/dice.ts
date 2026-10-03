// src/lib/loop/extra/dice.ts
import type { ExtraResult } from "./convert";

function secureRandomInt(min: number, max: number): number {
  const range = max - min + 1;
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return min + (arr[0] % range);
}

export const rollTool = {
  name: "roll",
  usage: "/roll <NdS> (e.g. /roll 2d6 or /roll 20) or /random <min> <max>",
  hint: "Roll dice or pick cryptographically random numbers",
  async run(args: string): Promise<ExtraResult> {
    const s = args.trim().toLowerCase();

    // Check for random min max
    const randMatch = s.match(/^(?:random\s+)?(\d+)\s+(\d+)$/);
    if (randMatch) {
      const min = parseInt(randMatch[1], 10);
      const max = parseInt(randMatch[2], 10);
      if (min >= max) {
        return {
          title: "Random Number",
          lines: ["Min value must be less than max value."],
        };
      }
      const val = secureRandomInt(min, max);
      return {
        title: "Random Number",
        lines: [`Result (${min} to ${max}): ${val}`],
      };
    }

    // Check for NdS or dS or S
    const diceMatch = s.match(/^(\d*)d(\d+)$/) || s.match(/^(\d+)$/);
    if (!diceMatch) {
      return {
        title: "Dice Roller",
        lines: [
          "Format examples: /roll 2d6, /roll 1d20, /roll 100, /random 1 100",
          "Limits: Up to 20 dice, up to 1000 sides.",
        ],
      };
    }

    let count = 1;
    let sides = 6;
    if (diceMatch[2]) {
      count = diceMatch[1] ? parseInt(diceMatch[1], 10) : 1;
      sides = parseInt(diceMatch[2], 10);
    } else {
      sides = parseInt(diceMatch[1], 10);
    }

    if (count < 1 || count > 20) {
      return {
        title: "Dice Roller",
        lines: ["Number of dice must be between 1 and 20."],
      };
    }
    if (sides < 2 || sides > 1000) {
      return {
        title: "Dice Roller",
        lines: ["Sides per die must be between 2 and 1000."],
      };
    }

    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(secureRandomInt(1, sides));
    }
    const sum = rolls.reduce((a, b) => a + b, 0);

    const rollStr = rolls.length > 1 ? `[${rolls.join(", ")}]` : rolls[0].toString();
    return {
      title: `Roll ${count}d${sides}`,
      lines: [
        count > 1 ? `Rolls: ${rollStr}` : `Result: ${rollStr}`,
        count > 1 ? `Total: ${sum}` : "",
      ].filter(Boolean),
    };
  },
};
