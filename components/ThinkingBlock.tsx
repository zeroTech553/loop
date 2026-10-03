// src/components/ThinkingBlock.tsx
"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import { cn } from "@/lib/cn";

interface ThinkingBlockProps {
  thinkingText: string;
  isGenerating?: boolean;
  preference?: "auto" | "always" | "never";
  wordCount?: number;
}

export function ThinkingBlock({
  thinkingText,
  isGenerating = false,
  preference = "auto",
  wordCount,
}: ThinkingBlockProps) {
  if (preference === "never" || !thinkingText.trim()) {
    return null;
  }

  const defaultOpen = preference === "always" ? true : isGenerating;
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    if (preference === "auto") {
      setIsOpen(isGenerating);
    }
  }, [isGenerating, preference]);

  const words =
    wordCount !== undefined
      ? wordCount
      : thinkingText.split(/\s+/).filter(Boolean).length;

  return (
    <div className="w-full border border-[var(--border)] rounded-xl bg-[var(--surface)] overflow-hidden my-2">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer select-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 font-medium">
          <Brain className="w-3.5 h-3.5 opacity-80" />
          <span>
            Thinking {isGenerating ? "in progress…" : `· ${words} words`}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-70">
          <span className="text-[11px]">{isOpen ? "Hide" : "Show"}</span>
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 pt-1 border-t border-[var(--border)]">
          <div className="max-h-[180px] overflow-y-auto text-[13px] font-mono leading-relaxed text-[var(--muted)] whitespace-pre-wrap select-text pr-1">
            {thinkingText}
            {isGenerating && (
              <span className="inline-block w-1.5 h-3.5 ml-1 bg-[var(--accent)] animate-pulse align-middle" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
