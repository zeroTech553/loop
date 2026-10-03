// src/components/StatusPill.tsx
"use client";

import React from "react";
import { useChatStore } from "@/store/chat";
import { cn } from "@/lib/cn";
import { HardDrive } from "lucide-react";

interface StatusPillProps {
  onOpenSettings: (section?: string) => void;
}

export function StatusPill({ onOpenSettings }: StatusPillProps) {
  const status = useChatStore((s) => s.status);
  const activeDevice = useChatStore((s) => s.activeDevice);
  const activeDtype = useChatStore((s) => s.activeDtype);
  const isOnline = useChatStore((s) => s.isOnline);

  let dotColor = "bg-[var(--ok)]";
  let labelText = `On-device · ${activeDevice === "webgpu" ? "WebGPU" : "WASM"} · ${activeDtype}`;

  if (!isOnline && status === "ready") {
    dotColor = "bg-[var(--muted)]";
    labelText = "Offline (Local only)";
  } else if (status === "downloading" || status === "preparing" || status === "loading-from-cache") {
    dotColor = "bg-[var(--warn)] animate-pulse";
    labelText = status === "downloading" ? "Downloading…" : "Preparing…";
  } else if (status === "error") {
    dotColor = "bg-[var(--danger)]";
    labelText = "Engine Error";
  } else if (status === "needs-download" || status === "unknown") {
    dotColor = "bg-[var(--muted)]";
    labelText = "Not Downloaded";
  }

  return (
    <button
      onClick={() => onOpenSettings("storage")}
      className={cn(
        "inline-flex items-center gap-2 px-2.5 py-1 text-xs font-medium rounded-full",
        "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)] transition-colors border border-[var(--border)]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] cursor-pointer"
      )}
      title="View device engine and storage status"
      aria-label="Engine status"
    >
      <span className={cn("w-2 h-2 rounded-full", dotColor)} />
      <span className="truncate max-w-[170px] sm:max-w-none">{labelText}</span>
      <HardDrive className="w-3 h-3 ml-0.5 opacity-60 hidden sm:inline-block" />
    </button>
  );
}
