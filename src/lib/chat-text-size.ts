export const CHAT_TEXT_SIZE_STEPS = [
  { value: 11, label: "Liten" },
  { value: 13, label: "Normal" },
  { value: 16, label: "Stor" },
  { value: 19, label: "Större" },
] as const;

export type ChatTextSize = (typeof CHAT_TEXT_SIZE_STEPS)[number]["value"];

export const DEFAULT_CHAT_TEXT_SIZE: ChatTextSize = 13;
export const CHAT_TEXT_SIZE_STORAGE_KEY = "atlas_customer_chat_text_size";

interface TextSizeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function normalizeChatTextSize(value: unknown): ChatTextSize {
  const numeric = typeof value === "number"
    ? value
    : (typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN);
  const match = CHAT_TEXT_SIZE_STEPS.find(step => step.value === numeric);
  return match?.value ?? DEFAULT_CHAT_TEXT_SIZE;
}

function browserStorage(): TextSizeStorage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function readChatTextSize(storage?: TextSizeStorage): ChatTextSize {
  try {
    return normalizeChatTextSize((storage ?? browserStorage())?.getItem(CHAT_TEXT_SIZE_STORAGE_KEY));
  } catch {
    return DEFAULT_CHAT_TEXT_SIZE;
  }
}

export function saveChatTextSize(size: ChatTextSize, storage?: TextSizeStorage): void {
  try {
    (storage ?? browserStorage())?.setItem(CHAT_TEXT_SIZE_STORAGE_KEY, String(size));
  } catch {
    // Lagring kan vara blockerad i tredjepartsiframe. Storleken fungerar ändå i
    // den aktiva React-sessionen; endast persistensen faller bort.
  }
}
