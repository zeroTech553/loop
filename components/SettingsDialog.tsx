// src/components/SettingsDialog.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useChatStore } from "@/store/chat";
import { formatBytes } from "@/lib/format";
import {
  X,
  Moon,
  Sun,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Trash2,
  ExternalLink,
  Cpu,
  Brain,
  Search,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { DeviceChoice, DtypeChoice } from "@/lib/loop/protocol";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}

export function SettingsDialog({
  isOpen,
  onClose,
  initialTab = "appearance",
}: SettingsDialogProps) {
  const settings = useChatStore((s) => s.settings);
  const updateSettings = useChatStore((s) => s.updateSettings);
  const activeDevice = useChatStore((s) => s.activeDevice);
  const activeDtype = useChatStore((s) => s.activeDtype);
  const parity = useChatStore((s) => s.parity);
  const clearModelCache = useChatStore((s) => s.clearModelCache);

  const [activeTab, setActiveTab] = useState(initialTab);
  const [modelRepoInput, setModelRepoInput] = useState(settings.modelId);
  const [storageUsage, setStorageUsage] = useState<number | null>(null);
  const [storageQuota, setStorageQuota] = useState<number | null>(null);
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setModelRepoInput(settings.modelId);
  }, [settings.modelId]);

  // Load storage estimates
  useEffect(() => {
    if (isOpen && typeof navigator !== "undefined" && navigator.storage) {
      navigator.storage.estimate().then((est) => {
        setStorageUsage(est.usage ?? null);
        setStorageQuota(est.quota ?? null);
      });
      if (navigator.storage.persisted) {
        navigator.storage.persisted().then((p) => setIsPersisted(p));
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleThemeChange = (t: "system" | "light" | "dark") => {
    updateSettings({ theme: t });
    if (typeof document !== "undefined") {
      if (t === "system") {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", t);
      }
    }
  };

  const tabs = [
    { id: "appearance", label: "Appearance" },
    { id: "thinking", label: "Thinking & Debug" },
    { id: "search", label: "Search" },
    { id: "model", label: "Model & Engine" },
    { id: "storage", label: "Storage & Parity" },
    { id: "about", label: "About" },
  ];

  const getParityDot = (str: string) => {
    if (str.startsWith("ok")) return "bg-[var(--ok)]";
    if (str.startsWith("MISMATCH")) return "bg-[var(--danger)]";
    return "bg-[var(--warn)]";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-label="Settings"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-bold text-[var(--text)] tracking-tight">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--border)] px-4 overflow-x-auto no-scrollbar gap-1 pt-1 bg-[var(--surface-2)]/40">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-all cursor-pointer",
                activeTab === tab.id
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-[var(--text)]">
          {/* APPEARANCE */}
          {activeTab === "appearance" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-2">Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "system", label: "System", icon: <Laptop className="w-4 h-4" /> },
                    { id: "light", label: "Light", icon: <Sun className="w-4 h-4" /> },
                    { id: "dark", label: "Dark", icon: <Moon className="w-4 h-4" /> },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleThemeChange(t.id as any)}
                      className={cn(
                        "flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer",
                        settings.theme === t.id
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)] font-semibold shadow-xs"
                          : "border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--text)]"
                      )}
                    >
                      {t.icon}
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* THINKING & DEBUG */}
          {activeTab === "thinking" && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold block mb-1">
                  Model Thinking Block
                </label>
                <p className="text-[11px] text-[var(--muted)] mb-2">
                  Controls visibility of Loop's internal reasoning tokens.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "auto", label: "Auto (While running)" },
                    { id: "always", label: "Always Expanded" },
                    { id: "never", label: "Never (Hidden)" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => updateSettings({ showThinking: opt.id as any })}
                      className={cn(
                        "p-2.5 rounded-xl border text-xs font-medium text-center transition-all cursor-pointer",
                        settings.showThinking === opt.id
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)] font-semibold shadow-xs"
                          : "border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--text)]"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-xs">Runtime Trace & Debug</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    Show router intent badges and agent verification guard logs.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showDebug}
                  onChange={(e) => updateSettings({ showDebug: e.target.checked })}
                  className="w-4 h-4 accent-[var(--accent)] rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* SEARCH */}
          {activeTab === "search" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-xs">Live Wikipedia Search</div>
                  <div className="text-[11px] text-[var(--muted)] max-w-sm mt-0.5">
                    When enabled, Loop retrieves relevant snippets directly from
                    en.wikipedia.org to verify facts.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.liveSearch}
                  onChange={(e) => updateSettings({ liveSearch: e.target.checked })}
                  className="w-4 h-4 accent-[var(--accent)] rounded cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[11px] text-[var(--muted)] leading-relaxed">
                <div className="font-semibold text-[var(--text)] mb-1 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Privacy Guarantee
                </div>
                Only the search query itself is sent to wikipedia.org via direct
                CORS API calls. Your chat conversation never leaves your device.
              </div>
            </div>
          )}

          {/* MODEL & ENGINE */}
          {activeTab === "model" && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold block mb-1">
                  Hugging Face Model Repository
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={modelRepoInput}
                    onChange={(e) => setModelRepoInput(e.target.value)}
                    placeholder="e.g. ZEROLABS1/loop-v3-50M-onnx"
                    className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)] font-mono focus:outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    onClick={() => {
                      if (modelRepoInput.trim() !== settings.modelId) {
                        updateSettings({ modelId: modelRepoInput.trim() });
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text)] font-medium hover:bg-[var(--border)] transition-colors cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
                <p className="text-[11px] text-[var(--muted)] mt-1">
                  Default: ZEROLABS1/loop-v3-50M-onnx (must be a PUBLIC repo).
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">
                  Execution Device
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "auto", label: "Auto (WebGPU first)" },
                    { id: "webgpu", label: "Force WebGPU" },
                    { id: "wasm", label: "Force WASM (CPU)" },
                  ].map((dev) => (
                    <button
                      key={dev.id}
                      onClick={() => updateSettings({ device: dev.id as DeviceChoice })}
                      className={cn(
                        "p-2.5 rounded-xl border text-xs font-medium text-center transition-all cursor-pointer",
                        settings.device === dev.id
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)] font-semibold shadow-xs"
                          : "border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--text)]"
                      )}
                    >
                      {dev.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">
                  Precision (Dtype)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "auto", label: "Auto", sub: "Best match" },
                    { id: "fp16", label: "fp16", sub: "~102 MB" },
                    { id: "q8", label: "q8", sub: "~51 MB" },
                    { id: "fp32", label: "fp32", sub: "~204 MB" },
                  ].map((dt) => (
                    <button
                      key={dt.id}
                      onClick={() => updateSettings({ dtype: dt.id as DtypeChoice })}
                      className={cn(
                        "p-2 rounded-xl border text-xs font-medium text-center transition-all cursor-pointer",
                        settings.dtype === dt.id
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)] font-semibold shadow-xs"
                          : "border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--text)]"
                      )}
                    >
                      <div className="font-semibold">{dt.label}</div>
                      <div className="text-[10px] text-[var(--muted)] mt-0.5">{dt.sub}</div>
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-[var(--warn)] mt-2">
                  Note: Changing device or precision reloads the model into memory.
                </div>
              </div>
            </div>
          )}

          {/* STORAGE & PARITY */}
          {activeTab === "storage" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                  <div className="text-[11px] text-[var(--muted)] font-medium">Active Engine</div>
                  <div className="text-sm font-bold text-[var(--text)] mt-1 uppercase font-mono">
                    {activeDevice} · {activeDtype}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                  <div className="text-[11px] text-[var(--muted)] font-medium">Browser Cache Usage</div>
                  <div className="text-sm font-bold text-[var(--text)] mt-1 font-mono">
                    {storageUsage !== null ? formatBytes(storageUsage) : "Unknown"}
                    {storageQuota !== null && (
                      <span className="text-[11px] text-[var(--muted)] font-normal ml-1">
                        / {formatBytes(storageQuota)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Parity Status */}
              <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-2">
                <div className="font-semibold text-xs text-[var(--text)] mb-2">
                  Parity Verification (vs Original Python Agent)
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[var(--muted)]">Byte-Level BPE Tokenizer:</span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("w-2 h-2 rounded-full", getParityDot(parity.tokenizer))} />
                    <span>{parity.tokenizer}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs font-mono border-t border-[var(--border)] pt-1.5">
                  <span className="text-[var(--muted)]">Hashed N-gram Router:</span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("w-2 h-2 rounded-full", getParityDot(parity.router))} />
                    <span>{parity.router}</span>
                  </div>
                </div>
              </div>

              {/* Persistent storage */}
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-medium">Persistent Storage:</span>
                  <span className="ml-1 text-[var(--muted)]">
                    {isPersisted ? "Granted (browser will not clear cache)" : "Not granted / Standard"}
                  </span>
                </div>
              </div>

              {/* Delete model cache */}
              <div className="pt-3 border-t border-[var(--border)]">
                {confirmDelete ? (
                  <div className="p-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 space-y-2">
                    <div className="text-xs font-semibold text-[var(--danger)]">
                      Delete downloaded model and reset browser cache?
                    </div>
                    <div className="text-[11px] text-[var(--muted)]">
                      You will need to re-download the model weights on next use.
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={async () => {
                          await clearModelCache();
                          setConfirmDelete(false);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[var(--danger)] text-white text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        Yes, Delete Model
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] text-[var(--text)] text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--danger)] bg-[var(--danger)]/10 hover:bg-[var(--danger)]/20 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete downloaded model</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ABOUT */}
          {activeTab === "about" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center font-bold">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">Loop v3.2</h3>
                  <div className="text-xs text-[var(--muted)]">
                    50 Million Parameters · Llama Architecture
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2 text-xs leading-relaxed text-[var(--muted)]">
                <p>
                  Loop is a tiny language-model AI agent created by{" "}
                  <strong className="text-[var(--text)]">ZEROLABS</strong>.
                  Trained from scratch to specialize in short conversational chats,
                  exact-arithmetic calculation, device clock lookup, and grounded fact
                  answering through live Wikipedia passages.
                </p>
                <p>
                  It executes 100% inside your browser using ONNX WebGPU runtime and
                  transformers.js. No cloud APIs, no analytics, no keys required.
                </p>
              </div>

              <div className="pt-2">
                <a
                  href="https://zerolabs.live"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline font-semibold"
                >
                  Visit zerolabs.live
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
