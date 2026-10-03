// src/components/ToolCards.tsx
"use client";

import React from "react";
import { Calculator, Search, Clock, ExternalLink, Wrench } from "lucide-react";
import { cn } from "@/lib/cn";
import { useChatStore } from "@/store/chat";

export function SkeletonCard({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="w-full border border-[var(--border)] bg-[var(--surface)] rounded-xl p-3 my-2 animate-pulse font-mono text-xs">
      <div className="flex items-center gap-1.5 text-[var(--muted)] mb-2">
        {icon}
        <span className="font-semibold">{title}</span>
        <span className="ml-auto text-[11px] opacity-70">Running…</span>
      </div>
      <div className="h-4 bg-[var(--surface-2)] rounded w-3/4 mb-1.5" />
      <div className="h-4 bg-[var(--surface-2)] rounded w-1/2" />
    </div>
  );
}

export function CalcCard({ expr, result }: { expr: string; result?: string }) {
  if (!result) {
    return <SkeletonCard title="Calculator" icon={<Calculator className="w-3.5 h-3.5" />} />;
  }

  const isError = result.toLowerCase().startsWith("error");

  return (
    <div className="w-full border border-[var(--border)] bg-[var(--surface)] rounded-xl p-3.5 my-2 font-mono transition-all">
      <div className="flex items-center gap-1.5 text-xs text-[var(--muted)] mb-1.5">
        <Calculator className="w-3.5 h-3.5 text-[var(--accent)]" />
        <span className="font-semibold uppercase tracking-wider text-[11px]">Calculator</span>
      </div>
      <div className="text-xs text-[var(--muted)] select-all truncate mb-1">
        {expr}
      </div>
      <div
        className={cn(
          "text-xl font-bold tracking-tight select-all",
          isError ? "text-[var(--danger)] text-sm" : "text-[var(--text)]"
        )}
      >
        {isError ? result : `= ${result}`}
      </div>
    </div>
  );
}

export function SearchCard({
  query,
  body,
  sources = [],
}: {
  query: string;
  body?: string;
  sources?: { title: string; url: string }[];
}) {
  const isOnline = useChatStore((s) => s.isOnline);

  if (body === undefined) {
    return <SkeletonCard title="Wikipedia Search" icon={<Search className="w-3.5 h-3.5" />} />;
  }

  const cleanBody = body.trim();
  const isNoResults = cleanBody === "(no results)" || cleanBody === "";

  // Parse lines like [1] Title: snippet
  const parsedPassages: { idx: string; title: string; snippet: string; url?: string }[] = [];
  const lines = cleanBody.split("\n");
  for (const line of lines) {
    const match = line.match(/^\[(\d+)\]\s+(.*?):\s+(.*)$/);
    if (match) {
      const idx = match[1];
      const title = match[2];
      const snippet = match[3];
      const matchingSource = sources.find((s) => s.title.toLowerCase() === title.toLowerCase());
      const url =
        matchingSource?.url ||
        `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
      parsedPassages.push({ idx, title, snippet, url });
    }
  }

  return (
    <div className="w-full border border-[var(--border)] bg-[var(--surface)] rounded-xl p-3.5 my-2 text-xs transition-all">
      <div className="flex items-center gap-1.5 text-[var(--muted)] mb-2">
        <Search className="w-3.5 h-3.5 text-[var(--accent)]" />
        <span className="font-medium text-[11px] uppercase tracking-wider font-mono">
          Searched Wikipedia
        </span>
        <span className="font-mono text-xs text-[var(--text)] truncate max-w-[240px]">
          "{query}"
        </span>
      </div>

      {isNoResults ? (
        <div className="text-[var(--muted)] py-1 italic">
          {!isOnline
            ? "You're offline — search needs internet connection."
            : "No matching Wikipedia results found."}
        </div>
      ) : (
        <div className="space-y-2 mt-1">
          {parsedPassages.map((p, i) => (
            <div key={i} className="border-t border-[var(--border)] pt-2 first:border-0 first:pt-0">
              <div className="flex items-center gap-1.5 font-medium text-[var(--text)] mb-0.5">
                <span className="inline-block px-1 py-0.2 bg-[var(--surface-2)] text-[10px] font-mono rounded text-[var(--muted)]">
                  [{p.idx}]
                </span>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                >
                  {p.title}
                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </a>
              </div>
              <p className="text-[var(--muted)] text-[12px] line-clamp-2 leading-relaxed">
                {p.snippet}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ClockCard({ timeStr }: { timeStr?: string }) {
  if (!timeStr) {
    return <SkeletonCard title="Clock (UTC)" icon={<Clock className="w-3.5 h-3.5" />} />;
  }

  // Format local time equivalent
  let localString = "";
  try {
    const now = new Date();
    localString = new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "medium",
    }).format(now);
  } catch {
    localString = new Date().toLocaleString();
  }

  return (
    <div className="w-full border border-[var(--border)] bg-[var(--surface)] rounded-xl p-3.5 my-2 font-mono transition-all">
      <div className="flex items-center gap-1.5 text-xs text-[var(--muted)] mb-1">
        <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
        <span className="font-semibold uppercase tracking-wider text-[11px]">Clock (UTC)</span>
      </div>
      <div className="text-lg font-bold text-[var(--text)] tracking-tight">
        {timeStr}
      </div>
      <div className="text-[11px] text-[var(--muted)] mt-1">
        Local equivalent: {localString}
      </div>
    </div>
  );
}

export function ExtraToolCard({
  title,
  lines,
  link,
}: {
  title: string;
  lines: string[];
  link?: string;
}) {
  return (
    <div className="w-full border border-[var(--border)] bg-[var(--surface)] rounded-xl p-3.5 my-2 text-xs transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[var(--text)] font-semibold font-mono">
          <Wrench className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>{title}</span>
        </div>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline"
          >
            Open Source
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
      <div className="space-y-1 font-mono text-[13px] leading-relaxed text-[var(--text)]">
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
