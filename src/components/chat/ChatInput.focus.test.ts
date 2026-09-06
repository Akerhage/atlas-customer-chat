import { describe, expect, it } from "vitest";
import { shouldRestoreFocusForSendSource, shouldRestoreTextareaFocus } from "./chat-input-focus";

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

  it("derives focus intent from every send source without a permissive default", () => {
    expect(shouldRestoreFocusForSendSource("textarea")).toBe(true);
    expect(shouldRestoreFocusForSendSource("quick-action")).toBe(false);
    expect(shouldRestoreFocusForSendSource("menu")).toBe(false);
  });
});
