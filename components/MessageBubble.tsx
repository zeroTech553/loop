// src/components/MessageBubble.tsx
"use client";

import React, { useState } from "react";
import type { Msg } from "@/store/chat";
import { RouteChip } from "./RouteChip";
import { ThinkingBlock } from "./ThinkingBlock";
import { CalcCard, SearchCard, ClockCard, ExtraToolCard } from "./ToolCards";
import { VerifyFooter } from "./VerifyFooter";
import { Copy, Check, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import type { AgentEvent } from "@/lib/loop/agent";

interface MessageBubbleProps {
  msg: Msg;
  isLastAssistant?: boolean;
  isStreaming?: boolean;
  liveThinking?: string;
  liveEvents?: AgentEvent[];
  showDebug?: boolean;
  showThinkingPreference?: "auto" | "always" | "never";
  onRegenerate?: () => void;
}

export function MessageBubble({
  msg,
  isLastAssistant = false,
  isStreaming = false,
  liveThinking = "",
  liveEvents = [],
  showDebug = false,
  showThinkingPreference = "auto",
  onRegenerate,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [showDebugDetails, setShowDebugDetails] = useState(false);

  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end my-3">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl bg-[var(--surface-2)] text-[var(--text)] px-4 py-2.5 text-[15px] leading-relaxed select-text shadow-2xs whitespace-pre-wrap break-words">
          {msg.text}
        </div>
      </div>
    );
  }

  // Assistant message
  const result = msg.result;
  const events = isStreaming ? liveEvents : result?.events || [];
  const route = result?.route;

  // Extract thinking text from events or liveThinking
  const completedThinks = events
    .filter((e) => e.k === "think")
    .map((e: any) => e.text.trim())
    .filter(Boolean)
    .join("\n\n");

  const displayThinking = isStreaming
    ? liveThinking || completedThinks
    : completedThinks;

  // Find tool calls and results
  const toolCalls: {
    name: string;
    arg: string;
    resultBody?: string;
    sources?: { title: string; url: string }[];
  }[] = [];

  for (const e of events) {
    if (e.k === "call") {
      toolCalls.push({ name: e.name, arg: e.arg });
    } else if (e.k === "result") {
      const last = toolCalls[toolCalls.length - 1];
      if (last && last.name === e.name) {
        last.resultBody = e.body;
        last.sources = e.sources;
      }
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.text || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-start gap-3 my-4 group">
      {/* 24-px Avatar Dot */}
      <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shrink-0 mt-1 shadow-xs">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="w-3.5 h-3.5"
        >
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 14a4 4 0 1 1 4-4 4 4 0 0 1-4 4z" />
        </svg>
      </div>

      {/* Content Column */}
      <div className="flex-1 min-w-0">
        {/* Route Chip */}
        {route && (
          <div className="mb-1.5">
            <RouteChip
              label={route[0]}
              source={route[1]}
              showDebug={showDebug}
            />
          </div>
        )}

        {/* Thinking Block */}
        {displayThinking && (
          <ThinkingBlock
            thinkingText={displayThinking}
            isGenerating={isStreaming}
            preference={showThinkingPreference}
            wordCount={result?.thinkWords}
          />
        )}

        {/* Tool Cards */}
        {toolCalls.map((tc, idx) => {
          if (tc.name === "calc") {
            return <CalcCard key={idx} expr={tc.arg} result={tc.resultBody} />;
          }
          if (tc.name === "search") {
            return (
              <SearchCard
                key={idx}
                query={tc.arg}
                body={tc.resultBody}
                sources={tc.sources}
              />
            );
          }
          if (tc.name === "time") {
            return <ClockCard key={idx} timeStr={tc.resultBody} />;
          }
          return null;
        })}

        {/* Extra Tool Card if present */}
        {result?.extra && (
          <ExtraToolCard
            title={result.extra.title}
            lines={result.extra.lines}
            link={result.extra.link}
          />
        )}

        {/* Answer Text */}
        <div className="text-[16px] leading-[1.65] text-[var(--text)] whitespace-pre-wrap select-text break-words mt-1">
          {msg.text ? (
            msg.text
          ) : isStreaming ? (
            <div className="flex items-center gap-1.5 py-1 text-[var(--muted)]">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:0.15s]" />
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:0.3s]" />
            </div>
          ) : null}
        </div>

        {/* Verify Footer */}
        <VerifyFooter
          kind={result?.kind}
          verified={result?.verified}
          sources={result?.sources}
        />

        {/* Action Row */}
        {!isStreaming && msg.text && (
          <div className="flex items-center gap-2 mt-2 pt-1 text-xs text-[var(--muted)]">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 p-1 sm:px-2 sm:py-1 rounded-md hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors cursor-pointer"
              title="Copy answer"
              aria-label="Copy answer"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-[var(--ok)]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
            </button>

            {isLastAssistant && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="inline-flex items-center gap-1 p-1 sm:px-2 sm:py-1 rounded-md hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors cursor-pointer"
                title="Regenerate reply"
                aria-label="Regenerate reply"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Regenerate</span>
              </button>
            )}

            {result?.ms ? (
              <span className="opacity-60 text-[11px] ml-1">
                · {formatDuration(result.ms)}
              </span>
            ) : null}
          </div>
        )}

        {/* Debug Collapsible Details */}
        {showDebug && events.length > 0 && (
          <div className="mt-3 pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setShowDebugDetails((prev) => !prev)}
              className="flex items-center gap-1 text-[11px] font-mono text-[var(--muted)] hover:text-[var(--text)] cursor-pointer select-none"
            >
              {showDebugDetails ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>Runtime Trace ({events.length} events)</span>
            </button>

            {showDebugDetails && (
              <div className="mt-2 p-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg font-mono text-[11px] space-y-1.5 overflow-x-auto max-h-60 overflow-y-auto">
                {events.map((e, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-1 rounded",
                      e.k === "guard"
                        ? "bg-[var(--warn)]/15 text-[var(--warn)] font-semibold"
                        : "text-[var(--muted)]"
                    )}
                  >
                    <span className="opacity-60 uppercase mr-2 font-bold">[{e.k}]</span>
                    {e.k === "route" && `${e.label} (${e.source})`}
                    {e.k === "think" && e.text}
                    {e.k === "call" && `${e.name}: ${e.arg}`}
                    {e.k === "result" && `${e.name} -> ${e.body.slice(0, 100)}...`}
                    {e.k === "guard" && e.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
