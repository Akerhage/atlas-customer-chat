import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { shouldRestoreTextareaFocus } from "./chat-input-focus";

const atlasChatSource = readFileSync(new URL("./AtlasChat.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const chatInputSource = readFileSync(new URL("./ChatInput.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("ChatInput focus intent", () => {
  it("restores focus after a textarea submission finishes", () => {
    expect(shouldRestoreTextareaFocus(true, false, true)).toBe(true);
  });

  it("does not focus after a menu or quick-question response finishes", () => {
    expect(shouldRestoreTextareaFocus(true, false, false)).toBe(false);
  });

  it("does not focus while the input remains disabled", () => {
    expect(shouldRestoreTextareaFocus(true, true, true)).toBe(false);
  });

  it("binds typed and menu sends to opposite focus intents", () => {
    expect(atlasChatSource).toMatch(/const handleQuickAction[\s\S]*?handleSendMessage\(message, contextData\);/);
    expect(atlasChatSource).toMatch(/const handleInputSend[\s\S]*?handleSendMessage\(message, contextData, true\);/);
    expect(chatInputSource).toContain("shouldRestoreTextareaFocus(wasDisabledRef.current, disabled, restoreFocusAfterReply)");
  });
});
