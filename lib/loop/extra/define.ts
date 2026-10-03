// src/lib/loop/extra/define.ts
import type { ExtraResult } from "./convert";

export const defineTool = {
  name: "define",
  usage: "/define <topic>",
  hint: "Look up an encyclopedic definition from Wikipedia",
  async run(args: string, signal?: AbortSignal): Promise<ExtraResult> {
    const q = args.trim();
    if (!q) {
      return {
        title: "Define",
        lines: ["Please provide a topic to look up. Example: /define Quantum Computing"],
      };
    }

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    signal?.addEventListener("abort", () => ctl.abort(), { once: true });

    try {
      const titleSlug = encodeURIComponent(q.replace(/\s+/g, "_"));
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${titleSlug}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: ctl.signal,
      });

      if (!res.ok) {
        return {
          title: `Define: ${q}`,
          lines: ["No article found on Wikipedia."],
        };
      }

      const data = await res.json();
      const title = data.title || q;
      const desc = data.description ? `(${data.description})` : "";
      const extract = (data.extract || "").slice(0, 400).trim();
      const link = data.content_urls?.desktop?.page;

      const lines = [];
      if (desc) lines.push(desc);
      lines.push(extract || "No summary text available.");

      return {
        title: `Definition: ${title}`,
        lines,
        link,
      };
    } catch {
      return {
        title: `Define: ${q}`,
        lines: ["Could not fetch definition (timed out or network error)."],
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
