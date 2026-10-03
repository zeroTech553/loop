// src/components/Onboarding.tsx
"use client";

import React, { useState } from "react";
import { useChatStore } from "@/store/chat";
import { formatBytes, formatSpeed } from "@/lib/format";
import {
  ShieldCheck,
  WifiOff,
  CheckCircle,
  Download,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/cn";

export function Onboarding() {
  const status = useChatStore((s) => s.status);
  const statusMessage = useChatStore((s) => s.statusMessage);
  const stage = useChatStore((s) => s.stage);
  const files = useChatStore((s) => s.files);
  const bytesLoaded = useChatStore((s) => s.bytesLoaded);
  const bytesTotal = useChatStore((s) => s.bytesTotal);
  const downloadSpeed = useChatStore((s) => s.downloadSpeed);
  const etaSeconds = useChatStore((s) => s.etaSeconds);
  const errorMessage = useChatStore((s) => s.errorMessage);
  const settings = useChatStore((s) => s.settings);
  const updateSettings = useChatStore((s) => s.updateSettings);
  const startModelDownload = useChatStore((s) => s.startModelDownload);

  const [showFileDetails, setShowFileDetails] = useState(false);
  const [modelRepoInput, setModelRepoInput] = useState(settings.modelId);
  const [showRepoEdit, setShowRepoEdit] = useState(false);

  const isDownloading = status === "downloading" || status === "preparing";
  const isError = status === "error";

  const percent =
    bytesTotal > 0 ? Math.min(100, Math.round((bytesLoaded / bytesTotal) * 100)) : 0;

  // Stages progression
  const stageOrder = ["device", "download", "assets", "warmup", "parity", "ready"];
  const currentStageIndex = stageOrder.indexOf(stage);

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-[var(--bg)] min-h-[100dvh]">
      <div className="w-full max-w-[440px] bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 sm:p-7 shadow-xl transition-all">
        {/* Logo mark */}
        <div className="w-12 h-12 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center mb-5 mx-auto shadow-xs">
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

        {/* Title & Subtitle */}
        <h1 className="text-xl font-bold text-center text-[var(--text)] tracking-tight mb-1.5">
          Meet Loop
        </h1>
        <p className="text-xs text-center text-[var(--muted)] mb-6">
          A tiny AI that runs entirely on your device.
        </p>

        {/* 3 Core Value Bullets */}
        {!isDownloading && !isError && (
          <div className="space-y-3.5 mb-7">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-[var(--surface-2)] text-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-semibold text-[var(--text)]">Private</div>
                <div className="text-[var(--muted)] mt-0.5">
                  Your chats never leave this device. No servers, no logs.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-[var(--surface-2)] text-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
                <WifiOff className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-semibold text-[var(--text)]">Offline-ready</div>
                <div className="text-[var(--muted)] mt-0.5">
                  Downloads once, then loads straight from your browser cache.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-[var(--surface-2)] text-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-semibold text-[var(--text)]">Careful</div>
                <div className="text-[var(--muted)] mt-0.5">
                  Facts are verified against Wikipedia passages; abstains if unsure.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Downloading UI */}
        {isDownloading && (
          <div className="my-5 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--text)] mb-1.5">
                <span>{statusMessage || "Preparing Loop…"}</span>
                <span className="font-mono">{percent}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(5, percent)}%` }}
                />
              </div>

              {/* Stats line */}
              {bytesTotal > 0 && (
                <div className="flex items-center justify-between text-[11px] font-mono text-[var(--muted)] mt-2">
                  <span>
                    {formatBytes(bytesLoaded)} of {formatBytes(bytesTotal)}
                  </span>
                  <span>
                    {formatSpeed(downloadSpeed)} · ~{etaSeconds}s left
                  </span>
                </div>
              )}
            </div>

            {/* Stages Checklist */}
            <div className="p-3 bg-[var(--surface-2)] rounded-xl border border-[var(--border)] text-xs space-y-1.5">
              {[
                { id: "device", name: "Hardware acceleration check" },
                { id: "download", name: "Downloading model weights" },
                { id: "assets", name: "Loading router & persona" },
                { id: "warmup", name: "Warming up shaders" },
                { id: "parity", name: "Verifying accuracy" },
              ].map((st, idx) => {
                const isDone = currentStageIndex > idx;
                const isCurrent = currentStageIndex === idx;

                return (
                  <div
                    key={st.id}
                    className={cn(
                      "flex items-center gap-2 text-[11px]",
                      isDone
                        ? "text-[var(--ok)] font-medium"
                        : isCurrent
                        ? "text-[var(--accent)] font-semibold animate-pulse"
                        : "text-[var(--muted)] opacity-50"
                    )}
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        isDone
                          ? "bg-[var(--ok)]"
                          : isCurrent
                          ? "bg-[var(--accent)]"
                          : "bg-[var(--border)]"
                      )}
                    />
                    <span>{st.name}</span>
                  </div>
                );
              })}
            </div>

            {/* Collapsible file details */}
            {Object.keys(files).length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowFileDetails((prev) => !prev)}
                  className="flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer select-none"
                >
                  {showFileDetails ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  <span>File Download Details ({Object.keys(files).length})</span>
                </button>

                {showFileDetails && (
                  <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] font-mono text-[10px]">
                    {Object.entries(files).map(([fname, f]) => {
                      const fPct =
                        f.total > 0 ? Math.round((f.loaded / f.total) * 100) : 0;
                      return (
                        <div key={fname} className="space-y-0.5">
                          <div className="flex justify-between text-[var(--muted)] truncate">
                            <span className="truncate max-w-[180px]">{fname}</span>
                            <span>{fPct}%</span>
                          </div>
                          <div className="w-full h-1 bg-[var(--surface-2)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--accent)]"
                              style={{ width: `${fPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="my-5 p-4 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 space-y-3">
            <div className="flex items-start gap-2.5 text-[var(--danger)]">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed font-medium">
                {errorMessage || "Failed to download model weights."}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => startModelDownload()}
                className="w-full py-2 px-3 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try again</span>
              </button>

              <button
                onClick={() => {
                  updateSettings({ device: "wasm", dtype: "q8" });
                  startModelDownload();
                }}
                className="w-full py-2 px-3 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-xs font-medium hover:bg-[var(--border)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Use compatible mode (WASM, q8 ~51 MB)</span>
              </button>
            </div>
          </div>
        )}

        {/* Primary Download / Run Buttons */}
        {!isDownloading && (
          <div className="space-y-2.5">
            <button
              onClick={() => startModelDownload()}
              className="w-full py-3 px-4 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-95 transition-opacity flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Run App Fast (Fetch & Run)</span>
            </button>

            <div className="text-center text-[11px] text-[var(--muted)]">
              Direct local engine + live Wikipedia & math tools
            </div>

            {/* HuggingFace Repo edit toggle */}
            <div className="text-center pt-1">
              <button
                onClick={() => setShowRepoEdit((prev) => !prev)}
                className="text-[11px] text-[var(--muted)] hover:text-[var(--text)] underline decoration-dotted cursor-pointer"
              >
                {showRepoEdit ? "Hide repo settings" : `Using: ${settings.modelId}`}
              </button>
            </div>

            {showRepoEdit && (
              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs space-y-2 mt-2">
                <label className="font-semibold block text-[11px] text-[var(--text)]">
                  Change Hugging Face Model ID:
                </label>
                <input
                  type="text"
                  value={modelRepoInput}
                  onChange={(e) => setModelRepoInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                />
                <button
                  onClick={() => {
                    updateSettings({ modelId: modelRepoInput.trim() });
                    setShowRepoEdit(false);
                  }}
                  className="w-full py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium cursor-pointer"
                >
                  Save Model ID
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
