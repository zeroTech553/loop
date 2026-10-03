// src/components/VerifyFooter.tsx
"use client";

import React from "react";
import { CheckCircle2, Info, Calculator, Clock, ExternalLink } from "lucide-react";

interface VerifyFooterProps {
  kind?: "chat" | "search" | "calc" | "time" | "abstain" | "tool";
  verified?: boolean;
  sources?: { title: string; url: string }[];
}

export function VerifyFooter({ kind, verified, sources = [] }: VerifyFooterProps) {
  if (!kind || kind === "chat") return null;

  if (kind === "search" && verified) {
    return (
      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5 text-[var(--ok)] font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Answer verified in retrieved passages
        </span>
        {sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] opacity-75">Sources:</span>
            {sources.map((s, idx) => (
              <a
                key={idx}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-[var(--surface-2)] text-[var(--text)] hover:text-[var(--accent)] hover:underline border border-[var(--border)] transition-colors"
              >
                {s.title}
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (kind === "abstain") {
    return (
      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 opacity-80" />
          Loop couldn't verify this, so it chose not to guess
        </span>
        {sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            {sources.map((s, idx) => (
              <a
                key={idx}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)] hover:underline border border-[var(--border)] transition-colors"
              >
                {s.title}
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (kind === "calc") {
    return (
      <div className="flex items-center gap-1.5 pt-1 text-xs text-[var(--muted)]">
        <Calculator className="w-3.5 h-3.5 opacity-80" />
        <span>Computed with exact arithmetic calculator</span>
      </div>
    );
  }

  if (kind === "time") {
    return (
      <div className="flex items-center gap-1.5 pt-1 text-xs text-[var(--muted)]">
        <Clock className="w-3.5 h-3.5 opacity-80" />
        <span>Read from your device clock (UTC)</span>
      </div>
    );
  }

  return null;
}
