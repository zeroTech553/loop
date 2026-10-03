// src/components/RouteChip.tsx
"use client";

import React from "react";
import { MessageSquare, Search, Calculator, Clock, HelpCircle } from "lucide-react";
import { cn } from "@/lib/cn";

interface RouteChipProps {
  label: string;
  source: string;
  showDebug: boolean;
  probs?: number[] | null;
}

export function RouteChip({ label, source, showDebug }: RouteChipProps) {
  const isUnsure = source === "unsure";
  if (!showDebug && !isUnsure) {
    // Show only a minimal tool icon if not debug mode and not unsure
    if (label === "search") {
      return (
        <span className="inline-flex items-center text-[var(--muted)]" title="Wikipedia search">
          <Search className="w-3.5 h-3.5" />
        </span>
      );
    }
    if (label === "calc") {
      return (
        <span className="inline-flex items-center text-[var(--muted)]" title="Calculator">
          <Calculator className="w-3.5 h-3.5" />
        </span>
      );
    }
    if (label === "time") {
      return (
        <span className="inline-flex items-center text-[var(--muted)]" title="Clock">
          <Clock className="w-3.5 h-3.5" />
        </span>
      );
    }
    return null;
  }

  let icon = <MessageSquare className="w-3 h-3" />;
  if (label === "search") icon = <Search className="w-3 h-3" />;
  else if (label === "calc") icon = <Calculator className="w-3 h-3" />;
  else if (label === "time") icon = <Clock className="w-3 h-3" />;
  else if (isUnsure) icon = <HelpCircle className="w-3 h-3" />;

  let sourceText = "rule";
  if (source === "router") {
    sourceText = "classifier";
  } else if (source === "unsure") {
    sourceText = "model decided";
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono tracking-tight",
        "bg-[var(--surface-2)] text-[var(--muted)] border border-[var(--border)]"
      )}
    >
      {icon}
      <span>
        {label} · {sourceText}
      </span>
    </div>
  );
}
