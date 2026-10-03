// src/lib/loop/extra/convert.ts
export interface ExtraResult {
  title: string;
  lines: string[];
  link?: string;
}

const LENGTH: Record<string, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  km: 1000,
  in: 0.0254,
  inch: 0.0254,
  inches: 0.0254,
  ft: 0.3048,
  feet: 0.3048,
  foot: 0.3048,
  yd: 0.9144,
  yard: 0.9144,
  yards: 0.9144,
  mi: 1609.344,
  mile: 1609.344,
  miles: 1609.344,
  kilometer: 1000,
  kilometers: 1000,
  meter: 1,
  meters: 1,
  centimeter: 0.01,
  centimeters: 0.01,
  millimeter: 0.001,
  millimeters: 0.001,
};

const MASS: Record<string, number> = {
  mg: 0.000001,
  milligram: 0.000001,
  milligrams: 0.000001,
  g: 0.001,
  gram: 0.001,
  grams: 0.001,
  kg: 1,
  kilogram: 1,
  kilograms: 1,
  oz: 0.028349523125,
  ounce: 0.028349523125,
  ounces: 0.028349523125,
  lb: 0.45359237,
  lbs: 0.45359237,
  pound: 0.45359237,
  pounds: 0.45359237,
};

const VOLUME: Record<string, number> = {
  ml: 0.001,
  milliliter: 0.001,
  milliliters: 0.001,
  l: 1,
  liter: 1,
  liters: 1,
  tsp: 0.00492892,
  teaspoon: 0.00492892,
  teaspoons: 0.00492892,
  tbsp: 0.0147868,
  tablespoon: 0.0147868,
  tablespoons: 0.0147868,
  cup: 0.236588,
  cups: 0.236588,
  gal: 3.78541,
  gallon: 3.78541,
  gallons: 3.78541,
};

const SPEED: Record<string, number> = {
  kmh: 1 / 3.6,
  "km/h": 1 / 3.6,
  mph: 0.44704,
  ms: 1,
  "m/s": 1,
};

const TEMP_UNITS = new Set(["c", "f", "k", "celsius", "fahrenheit", "kelvin"]);

function normUnit(u: string): string {
  const l = u.toLowerCase().trim().replace(/s$/, "");
  if (l === "celsiu" || l === "celsius") return "c";
  if (l === "fahrenheit") return "f";
  if (l === "kelvin") return "k";
  return u.toLowerCase().trim();
}

function convertTemp(val: number, from: string, to: string): number {
  let c = val;
  if (from === "f") c = (val - 32) * (5 / 9);
  else if (from === "k") c = val - 273.15;

  if (to === "c") return c;
  if (to === "f") return c * (9 / 5) + 32;
  if (to === "k") return c + 273.15;
  return c;
}

export const convertTool = {
  name: "convert",
  usage: "/convert <value> <unit> to <target unit>",
  hint: "Convert lengths, masses, volumes, temperatures, speeds",
  async run(args: string): Promise<ExtraResult> {
    const m = args
      .trim()
      .match(/^([\d.]+)\s*([a-zA-Z/%]+)\s+(?:to|in|into)\s+([a-zA-Z/%]+)$/i);
    if (!m) {
      return {
        title: "Unit Converter",
        lines: [
          "Format: /convert 5 km to miles or /convert 100 f to c",
          "Supported: mm, cm, m, km, in, ft, yd, mi, mg, g, kg, oz, lb, ml, l, tsp, tbsp, cup, gal, km/h, mph, m/s, c, f, k",
        ],
      };
    }

    const val = parseFloat(m[1]);
    if (isNaN(val)) {
      return { title: "Unit Converter", lines: ["Invalid number to convert."] };
    }

    const u1 = m[2].toLowerCase().trim();
    const u2 = m[3].toLowerCase().trim();
    const nu1 = normUnit(u1);
    const nu2 = normUnit(u2);

    if (TEMP_UNITS.has(nu1) && TEMP_UNITS.has(nu2)) {
      const out = convertTemp(val, nu1, nu2);
      const resStr = parseFloat(out.toPrecision(6)).toString();
      return {
        title: "Unit Conversion",
        lines: [`${val} °${nu1.toUpperCase()} = ${resStr} °${nu2.toUpperCase()}`],
      };
    }

    const categories = [LENGTH, MASS, VOLUME, SPEED];
    for (const cat of categories) {
      if (u1 in cat && u2 in cat) {
        const standard = val * cat[u1];
        const converted = standard / cat[u2];
        const resStr = parseFloat(converted.toPrecision(6)).toString();
        return {
          title: "Unit Conversion",
          lines: [`${val} ${u1} = ${resStr} ${u2}`],
        };
      }
    }

    return {
      title: "Unit Converter",
      lines: [
        `Cannot convert between '${u1}' and '${u2}'. Make sure both are in the same category (e.g. length, mass, temperature).`,
      ],
    };
  },
};
