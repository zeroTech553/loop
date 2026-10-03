// src/components/CalculatorPad.tsx
"use client";

import React, { useState } from "react";
import { toolCalc } from "@/lib/loop/tools/calc";
import { X, Delete, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/cn";

interface CalculatorPadProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertResult: (val: string) => void;
}

export function CalculatorPad({ isOpen, onClose, onInsertResult }: CalculatorPadProps) {
  const [expr, setExpr] = useState("");

  if (!isOpen) return null;

  const result = expr ? toolCalc(expr) : "";
  const isError = result.toLowerCase().startsWith("error");

  const append = (char: string) => {
    setExpr((prev) => prev + char);
  };

  const backspace = () => {
    setExpr((prev) => prev.slice(0, -1));
  };

  const clear = () => {
    setExpr("");
  };

  const keys = [
    ["C", "(", ")", "/"],
    ["7", "8", "9", "*"],
    ["4", "5", "6", "-"],
    ["1", "2", "3", "+"],
    ["0", ".", "%", "**"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4">
      <div
        className="w-full max-w-sm bg-[var(--surface)] border border-[var(--border)] rounded-t-2xl sm:rounded-2xl p-4 shadow-xl transition-transform"
        role="dialog"
        aria-label="Calculator Keypad"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-3">
          <span className="font-semibold text-sm text-[var(--text)]">Exact Calculator</span>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Display */}
        <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-3 mb-3 font-mono text-right">
          <div className="text-xs text-[var(--muted)] min-h-[16px] truncate select-all">
            {expr || "0"}
          </div>
          <div
            className={cn(
              "text-lg font-bold min-h-[28px] truncate mt-1 select-all",
              isError ? "text-[var(--danger)] text-sm" : "text-[var(--text)]"
            )}
          >
            {expr ? (isError ? result : `= ${result}`) : "0"}
          </div>
        </div>

        {/* 4x5 Keypad */}
        <div className="grid grid-cols-4 gap-1.5 mb-3 font-mono">
          {keys.map((row, rIdx) =>
            row.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  if (k === "C") clear();
                  else append(k);
                }}
                className={cn(
                  "h-11 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center select-none cursor-pointer",
                  k === "C"
                    ? "bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20"
                    : "+-*/%**".includes(k)
                    ? "bg-[var(--accent-soft)] text-[var(--accent)] hover:opacity-80"
                    : "bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--border)]"
                )}
              >
                {k}
              </button>
            ))
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={backspace}
            className="flex items-center justify-center gap-1.5 h-10 rounded-lg text-xs font-medium bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--border)] transition-colors cursor-pointer"
          >
            <Delete className="w-3.5 h-3.5" />
            Delete
          </button>
          <button
            type="button"
            disabled={!result || isError}
            onClick={() => {
              if (result && !isError) {
                onInsertResult(result);
                onClose();
              }
            }}
            className={cn(
              "flex items-center justify-center gap-1.5 h-10 rounded-lg text-xs font-medium transition-colors cursor-pointer",
              result && !isError
                ? "bg-[var(--accent)] text-white hover:opacity-90"
                : "bg-[var(--surface-2)] text-[var(--muted)] opacity-50 cursor-not-allowed"
            )}
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
            Insert result
          </button>
        </div>
      </div>
    </div>
  );
}
