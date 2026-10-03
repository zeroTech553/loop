// src/store/chat.ts
import { create } from "zustand";
import type { AgentEvent, AgentResult, Effort } from "../lib/loop/agent";
import type { DeviceChoice, DtypeChoice, FromWorker } from "../lib/loop/protocol";
import {
  loadStoredConversations,
  saveStoredConversations,
  loadStoredSettings,
  saveStoredSettings,
  MODEL_LOADED_FLAG_KEY,
} from "../lib/storage";
import { LoopClient } from "../lib/loop/client";
import { findExtraTool } from "../lib/loop/extra/registry";

export interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
  effort?: Effort;
  result?: {
    kind: "chat" | "search" | "calc" | "time" | "abstain" | "tool";
    route?: [string, string];
    tools: string[];
    events: AgentEvent[];
    sources: { title: string; url: string }[];
    verified: boolean;
    thinkWords: number;
    ms: number;
    extra?: { tool: string; title: string; lines: string[]; link?: string };
  };
}

export interface Convo {
  id: string;
  title: string;
  messages: Msg[];
  updatedAt: number;
}

export interface Settings {
  effort: Effort;
  device: "auto" | "webgpu" | "wasm";
  dtype: "auto" | "fp32" | "fp16" | "q8";
  liveSearch: boolean;
  showThinking: "auto" | "always" | "never";
  showDebug: boolean;
  theme: "system" | "light" | "dark";
  modelId: string;
}

export type ModelStatus =
  | "unknown"
  | "needs-download"
  | "loading-from-cache"
  | "downloading"
  | "preparing"
  | "ready"
  | "error";

export interface FileProgress {
  loaded: number;
  total: number;
  status: string;
}

export interface ChatStore {
  // Model & Worker state
  status: ModelStatus;
  statusMessage: string;
  stage: string;
  files: Record<string, FileProgress>;
  downloadSpeed: number; // bytes/sec
  bytesLoaded: number;
  bytesTotal: number;
  etaSeconds: number;
  activeDevice: "webgpu" | "wasm";
  activeDtype: "fp32" | "fp16" | "q8";
  parity: { tokenizer: string; router: string };
  errorMessage: string | null;
  isFatalError: boolean;
  isOnline: boolean;

  // Conversations & UI
  conversations: Convo[];
  activeConvoId: string | null;
  settings: Settings;

  // Real-time generation state (NOT persisted)
  generating: boolean;
  liveThinking: string;
  liveEvents: AgentEvent[];
  activeStreamingMessageId: string | null;

  // Actions
  init: () => Promise<void>;
  startModelDownload: () => void;
  createConversation: () => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  updateSettings: (partial: Partial<Settings>) => void;
  sendMessage: (text: string, effortOverride?: Effort) => Promise<void>;
  regenerateMessage: (msgId: string) => Promise<void>;
  abortGeneration: () => void;
  clearModelCache: () => Promise<void>;
  setOnline: (online: boolean) => void;
}

const DEFAULT_SETTINGS: Settings = {
  effort: "medium",
  device: "auto",
  dtype: "auto",
  liveSearch: true,
  showThinking: "auto",
  showDebug: false,
  theme: "system",
  modelId:
    process.env.NEXT_PUBLIC_LOOP_MODEL_ID || "ZEROLABS1/loop-v3-50M",
};

let saveTimer: NodeJS.Timeout | null = null;
function debouncedSaveConversations(convos: Convo[]) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveStoredConversations(convos);
  }, 400);
}

// Speed measurement helper
let lastBytes = 0;
let lastTime = 0;
const speedSamples: number[] = [];

export const useChatStore = create<ChatStore>((set, get) => ({
  status: "unknown",
  statusMessage: "",
  stage: "",
  files: {},
  downloadSpeed: 0,
  bytesLoaded: 0,
  bytesTotal: 0,
  etaSeconds: 0,
  activeDevice: "wasm",
  activeDtype: "q8",
  parity: { tokenizer: "not checked", router: "not checked" },
  errorMessage: null,
  isFatalError: false,
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,

  conversations: [],
  activeConvoId: null,
  settings: DEFAULT_SETTINGS,

  generating: false,
  liveThinking: "",
  liveEvents: [],
  activeStreamingMessageId: null,

  setOnline: (online: boolean) => {
    set({ isOnline: online });
  },

  init: async () => {
    if (typeof window === "undefined") return;

    // Load persisted settings & conversations
    const storedSettings = loadStoredSettings<Settings>(DEFAULT_SETTINGS);
    const storedConvos = await loadStoredConversations<Convo[]>([]);

    let activeId = storedConvos.length > 0 ? storedConvos[0].id : null;
    if (!activeId) {
      const initialConvo: Convo = {
        id: "convo-" + Date.now(),
        title: "New Chat",
        messages: [],
        updatedAt: Date.now(),
      };
      storedConvos.push(initialConvo);
      activeId = initialConvo.id;
    }

    set({
      settings: storedSettings,
      conversations: storedConvos,
      activeConvoId: activeId,
      isOnline: navigator.onLine,
    });

    // Check if model was previously loaded and cached
    const expectedFlag = `${storedSettings.modelId}:${storedSettings.dtype}`;
    const wasLoaded = localStorage.getItem(MODEL_LOADED_FLAG_KEY) === expectedFlag;
    let hasCache = false;
    try {
      if (typeof caches !== "undefined") {
        hasCache =
          (await caches.has("transformers-cache")) ||
          (await caches.has("loop-assets-v1"));
      }
    } catch {
      hasCache = false;
    }

    const client = LoopClient.get();

    client.onUpdate((msg: FromWorker) => {
      const s = get();

      switch (msg.type) {
        case "stage":
          set({
            statusMessage: msg.message,
            stage: msg.stage,
            status:
              msg.stage === "ready"
                ? "ready"
                : s.status === "downloading"
                ? "downloading"
                : "preparing",
          });
          break;

        case "progress": {
          const files = { ...s.files };
          files[msg.file] = {
            loaded: msg.loaded,
            total: msg.total,
            status: msg.status,
          };

          let sumLoaded = 0;
          let sumTotal = 0;
          for (const f of Object.values(files)) {
            sumLoaded += f.loaded;
            if (f.total > 0) sumTotal += f.total;
          }

          const now = performance.now();
          if (lastTime > 0 && now - lastTime > 400) {
            const deltaBytes = sumLoaded - lastBytes;
            const deltaTimeSec = (now - lastTime) / 1000;
            const currentSpeed = deltaBytes / deltaTimeSec;
            speedSamples.push(currentSpeed);
            if (speedSamples.length > 6) speedSamples.shift();

            const avgSpeed =
              speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
            const remainingBytes = Math.max(0, sumTotal - sumLoaded);
            const eta = avgSpeed > 0 ? Math.round(remainingBytes / avgSpeed) : 0;

            lastBytes = sumLoaded;
            lastTime = now;
            set({
              files,
              bytesLoaded: sumLoaded,
              bytesTotal: sumTotal,
              downloadSpeed: avgSpeed,
              etaSeconds: eta,
              status: "downloading",
            });
          } else {
            if (lastTime === 0) {
              lastTime = now;
              lastBytes = sumLoaded;
            }
            set({
              files,
              bytesLoaded: sumLoaded,
              bytesTotal: sumTotal,
              status: "downloading",
            });
          }
          break;
        }

        case "ready": {
          if (typeof navigator !== "undefined" && (navigator as any).storage?.persist) {
            (navigator as any).storage.persist().catch(() => {});
          }
          localStorage.setItem(
            MODEL_LOADED_FLAG_KEY,
            `${s.settings.modelId}:${s.settings.dtype}`
          );
          set({
            status: "ready",
            statusMessage: "Ready",
            stage: "ready",
            activeDevice: msg.device,
            activeDtype: msg.dtype,
            parity: msg.parity,
            errorMessage: null,
          });
          break;
        }

        case "error": {
          if (msg.fatal) {
            set({
              status: "error",
              errorMessage: msg.message,
              isFatalError: true,
            });
          } else {
            set({ errorMessage: msg.message });
          }
          break;
        }
      }
    });

    if (wasLoaded && hasCache) {
      set({
        status: "loading-from-cache",
        statusMessage: "Loading Loop from your device cache...",
      });
      client.init({
        modelId: storedSettings.modelId,
        device: storedSettings.device,
        dtype: storedSettings.dtype,
      });
    } else {
      set({ status: "needs-download" });
    }
  },

  startModelDownload: () => {
    const s = get();
    set({
      status: "downloading",
      statusMessage: "Starting download...",
      errorMessage: null,
      isFatalError: false,
      files: {},
      bytesLoaded: 0,
      bytesTotal: 0,
      downloadSpeed: 0,
    });
    lastBytes = 0;
    lastTime = 0;
    speedSamples.length = 0;

    LoopClient.get().init({
      modelId: s.settings.modelId,
      device: s.settings.device,
      dtype: s.settings.dtype,
    });
  },

  createConversation: () => {
    const newId = "convo-" + Date.now();
    const newConvo: Convo = {
      id: newId,
      title: "New Chat",
      messages: [],
      updatedAt: Date.now(),
    };
    const updated = [newConvo, ...get().conversations];
    set({ conversations: updated, activeConvoId: newId });
    debouncedSaveConversations(updated);
    return newId;
  },

  selectConversation: (id: string) => {
    set({ activeConvoId: id });
  },

  deleteConversation: (id: string) => {
    const s = get();
    const remaining = s.conversations.filter((c) => c.id !== id);
    let nextActive = s.activeConvoId;
    if (s.activeConvoId === id) {
      nextActive = remaining.length > 0 ? remaining[0].id : null;
    }
    if (!nextActive && remaining.length === 0) {
      const initialConvo: Convo = {
        id: "convo-" + Date.now(),
        title: "New Chat",
        messages: [],
        updatedAt: Date.now(),
      };
      remaining.push(initialConvo);
      nextActive = initialConvo.id;
    }
    set({ conversations: remaining, activeConvoId: nextActive });
    debouncedSaveConversations(remaining);
  },

  updateSettings: (partial: Partial<Settings>) => {
    const s = get();
    const nextSettings = { ...s.settings, ...partial };
    set({ settings: nextSettings });
    saveStoredSettings(nextSettings);

    // If device, dtype or modelId changed, prompt or re-init
    if (
      (partial.device && partial.device !== s.settings.device) ||
      (partial.dtype && partial.dtype !== s.settings.dtype) ||
      (partial.modelId && partial.modelId !== s.settings.modelId)
    ) {
      LoopClient.get().init({
        modelId: nextSettings.modelId,
        device: nextSettings.device,
        dtype: nextSettings.dtype,
      });
    }
  },

  clearModelCache: async () => {
    try {
      await LoopClient.get().clearCache();
      localStorage.removeItem(MODEL_LOADED_FLAG_KEY);
      set({
        status: "needs-download",
        files: {},
        errorMessage: null,
        isFatalError: false,
      });
    } catch (err: any) {
      set({ errorMessage: `Failed to clear cache: ${err?.message}` });
    }
  },

  abortGeneration: () => {
    LoopClient.get().abort();
    const s = get();
    if (s.generating && s.activeConvoId && s.activeStreamingMessageId) {
      const convos = s.conversations.map((c) => {
        if (c.id !== s.activeConvoId) return c;
        const msgs = c.messages.map((m) => {
          if (m.id === s.activeStreamingMessageId) {
            return {
              ...m,
              text: "Stopped.",
              result: {
                kind: "chat" as const,
                tools: [],
                events: s.liveEvents,
                sources: [],
                verified: false,
                thinkWords: 0,
                ms: 0,
              },
            };
          }
          return m;
        });
        return { ...c, messages: msgs, updatedAt: Date.now() };
      });
      set({
        conversations: convos,
        generating: false,
        liveThinking: "",
        liveEvents: [],
        activeStreamingMessageId: null,
      });
      debouncedSaveConversations(convos);
    }
  },

  sendMessage: async (text: string, effortOverride?: Effort) => {
    const s = get();
    if (s.generating) return;
    const cleanText = text.trim();
    if (!cleanText) return;

    let convoId = s.activeConvoId;
    if (!convoId) {
      convoId = s.createConversation();
    }

    const currentConvo = s.conversations.find((c) => c.id === convoId);
    if (!currentConvo) return;

    const effort = effortOverride || s.settings.effort;
    const userMsgId = "msg-" + Date.now() + "-u";
    const assistantMsgId = "msg-" + (Date.now() + 1) + "-a";

    const userMsg: Msg = {
      id: userMsgId,
      role: "user",
      text: cleanText,
      createdAt: Date.now(),
      effort,
    };

    // Check for Extra App-Level Tools (/convert, /define, /weather, /roll, /calc)
    if (cleanText.startsWith("/")) {
      const match = cleanText.match(/^\/(\w+)(?:\s+(.*))?$/s);
      if (match) {
        const cmd = match[1];
        const args = (match[2] || "").trim();
        const tool = findExtraTool(cmd);
        if (tool) {
          const runRes = await tool.run(args);
          const assistantMsg: Msg = {
            id: assistantMsgId,
            role: "assistant",
            text: runRes.lines.join("\n"),
            createdAt: Date.now(),
            result: {
              kind: "tool",
              tools: [tool.name],
              events: [],
              sources: runRes.link ? [{ title: runRes.title, url: runRes.link }] : [],
              verified: true,
              thinkWords: 0,
              ms: 20,
              extra: {
                tool: tool.name,
                title: runRes.title,
                lines: runRes.lines,
                link: runRes.link,
              },
            },
          };

          const newMessages = [...currentConvo.messages, userMsg, assistantMsg];
          const newTitle =
            currentConvo.messages.length === 0
              ? cleanText.slice(0, 40)
              : currentConvo.title;

          const updatedConvos = s.conversations.map((c) =>
            c.id === convoId
              ? { ...c, messages: newMessages, title: newTitle, updatedAt: Date.now() }
              : c
          );

          set({ conversations: updatedConvos });
          debouncedSaveConversations(updatedConvos);
          return;
        }
      }
    }

    // Ensure model is ready before proceeding (wait up to 10s if initializing)
    if (get().status !== "ready") {
      if (get().status === "needs-download" || get().status === "unknown") {
        get().startModelDownload();
      }

      await new Promise<void>((resolve) => {
        if (get().status === "ready") return resolve();
        const interval = setInterval(() => {
          if (get().status === "ready" || get().status === "error") {
            clearInterval(interval);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, 10000);
      });
    }

    // Fresh state lookup after potential await
    const freshState = get();
    const freshConvo = freshState.conversations.find((c) => c.id === convoId);
    if (!freshConvo) return;

    // Build chat history: last 4 chat pairs from conversation
    const historyPairs: [string, string][] = [];
    for (let i = 0; i < freshConvo.messages.length; i++) {
      const m = freshConvo.messages[i];
      if (m.role === "user") {
        const next = freshConvo.messages[i + 1];
        if (next && next.role === "assistant" && next.result?.kind === "chat") {
          historyPairs.push([m.text, next.text]);
        }
      }
    }
    const recentHistory = historyPairs.slice(-4);

    const initialAssistantMsg: Msg = {
      id: assistantMsgId,
      role: "assistant",
      text: "",
      createdAt: Date.now(),
      effort,
    };

    const newMessages = [...freshConvo.messages, userMsg, initialAssistantMsg];
    const newTitle =
      freshConvo.messages.length === 0
        ? cleanText.slice(0, 40)
        : freshConvo.title;

    const updatedConvos = freshState.conversations.map((c) =>
      c.id === convoId
        ? { ...c, messages: newMessages, title: newTitle, updatedAt: Date.now() }
        : c
    );

    set({
      conversations: updatedConvos,
      generating: true,
      liveThinking: "",
      liveEvents: [],
      activeStreamingMessageId: assistantMsgId,
    });
    debouncedSaveConversations(updatedConvos);

    try {
      const res = await LoopClient.get().run(
        {
          text: cleanText,
          effort,
          history: recentHistory,
          live: freshState.settings.liveSearch,
        },
        (event) => {
          const curr = get();
          if (event.k === "stream") {
            // Extract thinking text from stream segment
            const thinkMatches = [...event.text.matchAll(/<\|think\|>\n(.*?)<\|\/think\|>/gs)];
            if (thinkMatches.length > 0) {
              const fullThinking = thinkMatches
                .map((m) => m[1].replace(/<\|.*?\|>/g, "").trim())
                .filter(Boolean)
                .join("\n\n");
              set({ liveThinking: fullThinking });
            } else {
              const lastOpen = event.text.lastIndexOf("<|think|>");
              if (lastOpen !== -1) {
                const sub = event.text.slice(lastOpen + 10).replace(/<\|.*?\|>/g, "").trim();
                set({ liveThinking: sub });
              }
            }
          } else {
            const nextEvents = [...curr.liveEvents, event];
            set({ liveEvents: nextEvents });
          }
        }
      );

      const latestState = get();
      if (res === "aborted") {
        latestState.abortGeneration();
        return;
      }

      const { result, ms } = res;

      const finalConvos = latestState.conversations.map((c) => {
        if (c.id !== convoId) return c;
        const msgs = c.messages.map((m) => {
          if (m.id === assistantMsgId) {
            return {
              ...m,
              text: result.answer,
              result: {
                kind: result.kind,
                route: result.route,
                tools: result.tools,
                events: result.events,
                sources: result.sources,
                verified: result.verified,
                thinkWords: result.thinkWords,
                ms,
              },
            };
          }
          return m;
        });
        return { ...c, messages: msgs, updatedAt: Date.now() };
      });

      set({
        conversations: finalConvos,
        generating: false,
        liveThinking: "",
        liveEvents: [],
        activeStreamingMessageId: null,
      });
      debouncedSaveConversations(finalConvos);
    } catch (err: any) {
      const latestState = get();
      const finalConvos = latestState.conversations.map((c) => {
        if (c.id !== convoId) return c;
        const msgs = c.messages.map((m) => {
          if (m.id === assistantMsgId) {
            return {
              ...m,
              text: "An error occurred while generating the answer.",
              result: {
                kind: "chat" as const,
                tools: [],
                events: latestState.liveEvents,
                sources: [],
                verified: false,
                thinkWords: 0,
                ms: 0,
              },
            };
          }
          return m;
        });
        return { ...c, messages: msgs, updatedAt: Date.now() };
      });

      set({
        conversations: finalConvos,
        generating: false,
        liveThinking: "",
        liveEvents: [],
        activeStreamingMessageId: null,
        errorMessage: err?.message || "Execution error",
      });
      debouncedSaveConversations(finalConvos);
    }
  },

  regenerateMessage: async (msgId: string) => {
    const s = get();
    if (s.generating || !s.activeConvoId) return;
    const convo = s.conversations.find((c) => c.id === s.activeConvoId);
    if (!convo) return;

    const idx = convo.messages.findIndex((m) => m.id === msgId);
    if (idx <= 0) return;
    const userMsg = convo.messages[idx - 1];
    if (userMsg.role !== "user") return;

    // Remove the target assistant message and re-send the prompt
    const truncated = convo.messages.slice(0, idx);
    const updatedConvos = s.conversations.map((c) =>
      c.id === s.activeConvoId ? { ...c, messages: truncated } : c
    );
    set({ conversations: updatedConvos });

    await get().sendMessage(userMsg.text, userMsg.effort);
  },
}));
