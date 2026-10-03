import { get, set, del } from "idb-keyval";

export const CONVO_STORAGE_KEY = "loop:conversations:v1";
export const SETTINGS_STORAGE_KEY = "loop:settings:v1";
export const MODEL_LOADED_FLAG_KEY = "loop:loaded:v1";

export async function loadStoredConversations<T>(fallback: T): Promise<T> {
  if (typeof window === "undefined") return fallback;
  try {
    const data = await get<T>(CONVO_STORAGE_KEY);
    return data ?? fallback;
  } catch (err) {
    console.warn("IndexedDB load failed, using fallback:", err);
    return fallback;
  }
}

export async function saveStoredConversations<T>(data: T): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await set(CONVO_STORAGE_KEY, data);
  } catch (err) {
    console.warn("IndexedDB save failed:", err);
  }
}

export async function clearStoredConversations(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await del(CONVO_STORAGE_KEY);
  } catch (err) {
    console.warn("IndexedDB delete failed:", err);
  }
}

export function loadStoredSettings<T>(fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveStoredSettings<T>(settings: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn("localStorage settings save failed:", err);
  }
}
