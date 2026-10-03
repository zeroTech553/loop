// src/components/Composer.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/store/chat";
import { ArrowUp, Square, Wrench, Calculator, Globe } from "lucide-react";
import { EXTRA_TOOLS, type ExtraTool } from "@/lib/loop/extra/registry";
import { CalculatorPad } from "./CalculatorPad";
import { cn } from "@/lib/cn";
import type { Effort } from "@/lib/loop/agent";

interface ComposerProps {
  onSend: (text: string) => void;
  onStop: () => void;
}

export function Composer({ onSend, onStop }: ComposerProps) {
  const [text, setText] = useState("");
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showCalcPad, setShowCalcPad] = useState(false);
  const [selectedSlashIdx, setSelectedSlashIdx] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const generating = useChatStore((s) => s.generating);
  const status = useChatStore((s) => s.status);
  const settings = useChatStore((s) => s.settings);
  const updateSettings = useChatStore((s) => s.updateSettings);

  const isModelReady = status !== "downloading" && status !== "error";
  const charCount = text.length;

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [text]);

  // Non-ASCII check (> 30% non-ASCII letters)
  let nonAsciiWarning = false;
  if (text.trim().length > 5) {
    let nonAsciiCount = 0;
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) > 127) nonAsciiCount++;
    }
    if (nonAsciiCount / text.length > 0.3) {
      nonAsciiWarning = true;
    }
  }

  // Slash commands filter
  const isSlashActive = text.startsWith("/") && !text.includes(" ");
  const slashQuery = isSlashActive ? text.slice(1).toLowerCase() : "";
  const filteredTools = EXTRA_TOOLS.filter(
    (t) => t.name.startsWith(slashQuery) || t.hint.toLowerCase().includes(slashQuery)
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSlashActive && filteredTools.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSlashIdx((prev) => (prev + 1) % filteredTools.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSlashIdx((prev) => (prev - 1 + filteredTools.length) % filteredTools.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectSlashTool(filteredTools[selectedSlashIdx]);
        return;
      }
      if (e.key === "Escape") {
        setText("");
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      // Desktop Enter sends, mobile Shift+Enter allows newline
      const isTouch = typeof window !== "undefined" && "ontouchstart" in window;
      if (!isTouch) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const selectSlashTool = (tool: ExtraTool) => {
    setText(`/${tool.name} `);
    textareaRef.current?.focus();
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || generating) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const setEffort = (eff: Effort) => {
    updateSettings({ effort: eff });
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto px-4 pb-2">
      {/* Non-ASCII English warning */}
      {nonAsciiWarning && (
        <div className="mb-1 text-[11px] text-[var(--muted)] flex items-center gap-1.5 px-2">
          <Globe className="w-3 h-3 text-[var(--accent)]" />
          <span>Loop understands English best.</span>
        </div>
      )}

      {/* Slash command popup */}
      {isSlashActive && filteredTools.length > 0 && (
        <div className="absolute bottom-full left-4 right-4 mb-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden z-30">
          <div className="p-1.5 border-b border-[var(--border)] text-[11px] text-[var(--muted)] px-3 font-medium">
            App-Level Tools (Deterministic)
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filteredTools.map((t, idx) => (
              <button
                key={t.name}
                type="button"
                onClick={() => selectSlashTool(t)}
                className={cn(
                  "w-full text-left px-3 py-1.5 rounded-lg flex flex-col transition-colors cursor-pointer",
                  idx === selectedSlashIdx
                    ? "bg-[var(--accent-soft)] text-[var(--text)]"
                    : "text-[var(--text)] hover:bg-[var(--surface-2)]"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-xs text-[var(--accent)]">
                    /{t.name}
                  </span>
                  <span className="text-[11px] font-mono text-[var(--muted)]">
                    {t.usage}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--muted)]">{t.hint}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tools Menu Popover */}
      {showToolsMenu && (
        <div className="absolute bottom-full left-4 sm:left-6 mb-2 w-72 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl p-2 z-30">
          <div className="flex items-center justify-between px-2 pb-1.5 border-b border-[var(--border)] text-xs font-semibold text-[var(--text)]">
            <span>Tools & Helpers</span>
            <button
              onClick={() => setShowToolsMenu(false)}
              className="text-[11px] text-[var(--muted)] hover:text-[var(--text)]"
            >
              Close
            </button>
          </div>
          <div className="py-1 space-y-1">
            <button
              type="button"
              onClick={() => {
                setShowToolsMenu(false);
                setShowCalcPad(true);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-2)] flex items-center gap-2.5 text-xs text-[var(--text)] cursor-pointer"
            >
              <Calculator className="w-4 h-4 text-[var(--accent)]" />
              <div>
                <div className="font-medium">Calculator Keypad</div>
                <div className="text-[11px] text-[var(--muted)]">Interactive 4×5 math pad</div>
              </div>
            </button>
            <div className="border-t border-[var(--border)] pt-1 my-1" />
            {EXTRA_TOOLS.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => {
                  setShowToolsMenu(false);
                  selectSlashTool(t);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-2)] text-xs cursor-pointer"
              >
                <div className="font-mono font-medium text-[var(--accent)] text-xs">
                  /{t.name}
                </div>
                <div className="text-[11px] text-[var(--muted)]">{t.hint}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Composer Box */}
      <div
        className={cn(
          "w-full rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-2.5 transition-all shadow-xs",
          "focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]/15"
        )}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={400}
          placeholder="Message Loop… (type / for tools)"
          aria-label="Message Loop"
          className="w-full bg-transparent resize-none border-0 text-[16px] text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none px-2 pt-1 pb-2 leading-relaxed"
        />

        <div className="flex items-center justify-between pt-1 gap-2 border-t border-[var(--border)]/60">
          {/* Left tools: Effort segmented control + Tools button */}
          <div className="flex items-center gap-2">
            {/* Tools launcher */}
            <button
              type="button"
              onClick={() => setShowToolsMenu((prev) => !prev)}
              aria-label="Tools menu"
              title="Open tools and calculator"
              className={cn(
                "p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer",
                showToolsMenu && "bg-[var(--surface-2)] text-[var(--text)]"
              )}
            >
              <Wrench className="w-4 h-4" />
            </button>

            {/* Effort Control */}
            <div
              className="inline-flex items-center p-0.5 rounded-lg bg-[var(--surface-2)] text-[11px] font-medium"
              title="Effort level: Low (fast), Medium (balanced), High (deeper thinking & 2 tool calls)"
            >
              {(["low", "medium", "high"] as Effort[]).map((eff) => (
                <button
                  key={eff}
                  type="button"
                  onClick={() => setEffort(eff)}
                  className={cn(
                    "px-2 py-0.5 rounded-md capitalize transition-all cursor-pointer",
                    settings.effort === eff
                      ? "bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold"
                      : "text-[var(--muted)] hover:text-[var(--text)]"
                  )}
                >
                  {eff}
                </button>
              ))}
            </div>
          </div>

          {/* Right tools: Char count & Send / Stop */}
          <div className="flex items-center gap-2">
            {charCount >= 340 && (
              <span className="text-[11px] font-mono text-[var(--muted)]">
                {charCount}/400
              </span>
            )}

            {generating ? (
              <button
                type="button"
                onClick={onStop}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--danger)] text-white hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                title="Stop generation (Esc)"
                aria-label="Stop generation"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!text.trim() || !isModelReady}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-xs",
                  text.trim() && isModelReady
                    ? "bg-[var(--accent)] text-white hover:opacity-90 cursor-pointer"
                    : "bg-[var(--surface-2)] text-[var(--muted)] opacity-50 cursor-not-allowed"
                )}
                title="Send message (Enter)"
                aria-label="Send message"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="text-center mt-1.5">
        <span className="text-[11px] text-[var(--muted)] opacity-80 select-none">
          Loop is a tiny experimental model and can be wrong. Facts are checked against Wikipedia passages.
        </span>
      </div>

      <CalculatorPad
        isOpen={showCalcPad}
        onClose={() => setShowCalcPad(false)}
        onInsertResult={(val) => {
          setText((prev) => (prev ? `${prev} ${val}` : val));
          textareaRef.current?.focus();
        }}
      />
    </div>
  );
}
