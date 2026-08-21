import { describe, expect, it } from "vitest";
import {
  CHAT_TEXT_SIZE_STEPS,
  DEFAULT_CHAT_TEXT_SIZE,
  normalizeChatTextSize,
  readChatTextSize,
  saveChatTextSize,
} from "./chat-text-size";

describe("customer chat text size", () => {
  it("mirrors the proven Atlas four-step scale and keeps 13px as the default", () => {
    expect(CHAT_TEXT_SIZE_STEPS).toEqual([
      { value: 11, label: "Liten" },
      { value: 13, label: "Normal" },
      { value: 16, label: "Stor" },
      { value: 19, label: "Större" },
    ]);
    expect(DEFAULT_CHAT_TEXT_SIZE).toBe(13);
  });

  it.each([
    ["11", 11],
    [13, 13],
    ["16", 16],
    [19, 19],
    ["12", 13],
    [22, 13],
    [null, 13],
    [undefined, 13],
    ["broken", 13],
  ])("normalizes %j without inventing an unmeasured size", (value, expected) => {
    expect(normalizeChatTextSize(value)).toBe(expected);
  });

  it("persists only the text preference and tolerates blocked storage", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    saveChatTextSize(19, storage);
    expect(readChatTextSize(storage)).toBe(19);

    const blocked = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(readChatTextSize(blocked)).toBe(13);
    expect(() => saveChatTextSize(16, blocked)).not.toThrow();
  });
});
