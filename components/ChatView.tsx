// src/components/ChatView.tsx
"use client";

import React, { useRef, useEffect, useState } from "react";
import { useChatStore } from "@/store/chat";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";
import { ArrowDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

export function ChatView() {
  const conversations = useChatStore((s) => s.conversations);
  const activeConvoId = useChatStore((s) => s.activeConvoId);
  const generating = useChatStore((s) => s.generating);
  const liveThinking = useChatStore((s) => s.liveThinking);
  const liveEvents = useChatStore((s) => s.liveEvents);
  const activeStreamingMessageId = useChatStore((s) => s.activeStreamingMessageId);
  const settings = useChatStore((s) => s.settings);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const regenerateMessage = useChatStore((s) => s.regenerateMessage);
  const abortGeneration = useChatStore((s) => s.abortGeneration);

  const activeConvo = conversations.find((c) => c.id === activeConvoId);
  const messages = activeConvo?.messages || [];

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const isNearBottomRef = useRef(true);

  // Check if user is scrolled near bottom
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
    const near = distanceToBottom < 100;
    isNearBottomRef.current = near;
    setShowScrollBottom(!near);
  };

  const scrollToBottom = (smooth = true) => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  };

  // Auto-scroll when new messages or streaming updates arrive (only if near bottom)
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom(false);
    }
  }, [messages, liveThinking, liveEvents]);

  const suggestions = [
    "What is 15% of 240?",
    "Who is Marie Curie?",
    "What time is it?",
    "Tell me a joke",
  ];

  return (
    <div className="relative flex flex-col flex-1 h-full min-w-0 bg-[var(--bg)] overflow-hidden">
      {/* Scrollable messages container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 pb-20 select-text"
      >
        <div className="max-w-3xl mx-auto min-h-full flex flex-col justify-end">
          {messages.length === 0 ? (
            <div className="my-auto py-12 flex flex-col items-center justify-center text-center">
              {/* Logo mark */}
              <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center mb-4 shadow-xs">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="w-7 h-7"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7a5 5 0 1 0 5 5" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-[var(--text)] mb-2">
                How can I help?
              </h2>
              <p className="text-sm text-[var(--muted)] max-w-md mb-8">
                Loop is a 50M on-device AI agent by ZEROLABS. Your messages stay
                100% private in this browser.
              </p>

              {/* Suggestion chips */}
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg">
                {suggestions.map((sug) => (
                  <button
                    key={sug}
                    onClick={() => sendMessage(sug)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[var(--surface)] hover:bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] transition-all hover:scale-[1.02] cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>{sug}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m, idx) => {
                const isLastAssistant =
                  m.role === "assistant" && idx === messages.length - 1;
                const isCurrentlyStreaming =
                  generating && m.id === activeStreamingMessageId;

                return (
                  <MessageBubble
                    key={m.id}
                    msg={m}
                    isLastAssistant={isLastAssistant}
                    isStreaming={isCurrentlyStreaming}
                    liveThinking={liveThinking}
                    liveEvents={liveEvents}
                    showDebug={settings.showDebug}
                    showThinkingPreference={settings.showThinking}
                    onRegenerate={() => regenerateMessage(m.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Jump to latest button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-28 right-6 z-20 p-2 rounded-full bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] shadow-md hover:bg-[var(--surface-2)] transition-all cursor-pointer"
          title="Jump to latest"
          aria-label="Jump to latest"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Sticky Composer */}
      <div className="sticky bottom-0 z-10 w-full bg-[var(--bg)]/95 backdrop-blur-md pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] border-t border-[var(--border)]/40">
        <Composer
          onSend={(text) => sendMessage(text)}
          onStop={() => abortGeneration()}
        />
      </div>
    </div>
  );
}
