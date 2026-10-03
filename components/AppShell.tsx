// src/components/AppShell.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useChatStore } from "@/store/chat";
import { Sidebar } from "./Sidebar";
import { ChatView } from "./ChatView";
import { Onboarding } from "./Onboarding";
import { StatusPill } from "./StatusPill";
import { SettingsDialog } from "./SettingsDialog";
import { Menu, Plus, Settings as SettingsIcon, WifiOff } from "lucide-react";
import { cn } from "@/lib/cn";

export function AppShell() {
  const status = useChatStore((s) => s.status);
  const isOnline = useChatStore((s) => s.isOnline);
  const generating = useChatStore((s) => s.generating);
  const init = useChatStore((s) => s.init);
  const createConversation = useChatStore((s) => s.createConversation);
  const abortGeneration = useChatStore((s) => s.abortGeneration);
  const setOnline = useChatStore((s) => s.setOnline);

  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState("appearance");

  // Initialize client store on mount
  useEffect(() => {
    init();

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Global keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === "k") {
        e.preventDefault();
        createConversation();
      } else if (isCmdOrCtrl && e.key === ",") {
        e.preventDefault();
        setIsSettingsOpen(true);
      } else if (e.key === "Escape" && generating) {
        abortGeneration();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [init, createConversation, generating, abortGeneration, setOnline]);

  const openSettings = (tab = "appearance") => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  };

  // Splash screen for cached reload
  if (status === "loading-from-cache") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-[var(--bg)] p-4 select-none">
        <div className="w-12 h-12 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center mb-4 animate-pulse">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="w-6 h-6"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7a5 5 0 1 0 5 5" />
          </svg>
        </div>
        <h1 className="text-sm font-semibold text-[var(--text)] tracking-tight mb-2">
          Loading Loop from your device…
        </h1>
        <div className="w-48 h-1 bg-[var(--surface-2)] rounded-full overflow-hidden">
          <div className="h-full bg-[var(--accent)] w-1/3 animate-[slide_1.5s_infinite_linear]" />
        </div>
      </div>
    );
  }

  // First run onboarding
  if (status === "needs-download" || status === "unknown") {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-[var(--bg)]">
        <Onboarding />
        <SettingsDialog
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          initialTab={settingsInitialTab}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      {/* Sidebar Navigation */}
      <Sidebar
        isOpenMobile={isSidebarOpenMobile}
        onCloseMobile={() => setIsSidebarOpenMobile(false)}
        onOpenSettings={() => openSettings("appearance")}
      />

      {/* Main Area */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
        {/* Sticky Header */}
        <header className="relative h-14 shrink-0 px-3 sm:px-5 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] z-20">
          <div className="flex items-center gap-2">
            {/* Mobile hamburger */}
            <button
              onClick={() => setIsSidebarOpenMobile(true)}
              className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors lg:hidden cursor-pointer"
              aria-label="Open sidebar menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Wordmark */}
            <div className="flex items-baseline gap-1.5 select-none">
              <span className="font-bold text-base tracking-tight text-[var(--text)]">
                Loop
              </span>
              <span className="text-[10px] font-medium text-[var(--muted)]">
                by ZEROLABS
              </span>
            </div>
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-2">
            <StatusPill onOpenSettings={openSettings} />

            <button
              onClick={() => createConversation()}
              className="p-2 rounded-xl text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
              title="New Chat (Ctrl+K)"
              aria-label="New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              onClick={() => openSettings("appearance")}
              className="p-2 rounded-xl text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
              title="Settings (Ctrl+,)"
              aria-label="Settings"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>

          {/* 2-px Accent progress hairline under header while generating */}
          {generating && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--surface-2)] overflow-hidden">
              <div className="h-full bg-[var(--accent)] w-1/3 animate-[slide_1.2s_infinite_linear]" />
            </div>
          )}
        </header>

        {/* Offline notice banner */}
        {!isOnline && (
          <div className="bg-[var(--surface-2)] border-b border-[var(--border)] px-4 py-1.5 flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
            <WifiOff className="w-3.5 h-3.5 text-[var(--warn)]" />
            <span>
              You're offline. Chat, maths, and the clock still work; search is unavailable.
            </span>
          </div>
        )}

        {/* Chat view */}
        <ChatView />
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab={settingsInitialTab}
      />
    </div>
  );
}
