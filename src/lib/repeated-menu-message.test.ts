import { describe, expect, it } from "vitest";
import { shouldSkipRepeatedMenuMessage } from "./repeated-menu-message";

const menuMessage = "Välj en fråga i Frågor & tjänster.";

describe("shouldSkipRepeatedMenuMessage", () => {
  it("does not skip when the message list is empty", () => {
    expect(shouldSkipRepeatedMenuMessage([], menuMessage)).toBe(false);
  });

  it("skips the same assistant message when it is last", () => {
    expect(shouldSkipRepeatedMenuMessage([
      { role: "assistant", content: menuMessage },
    ], menuMessage)).toBe(true);
  });

  it("does not skip the same text from the user", () => {
    expect(shouldSkipRepeatedMenuMessage([
      { role: "user", content: menuMessage },
    ], menuMessage)).toBe(false);
  });

  it("does not skip a different assistant response", () => {
    expect(shouldSkipRepeatedMenuMessage([
      { role: "assistant", content: "Ett riktigt svar på en snabbfråga." },
    ], menuMessage)).toBe(false);
  });

  it("does not skip when the same assistant text is not last", () => {
    expect(shouldSkipRepeatedMenuMessage([
      { role: "assistant", content: menuMessage },
      { role: "assistant", content: "Ett senare svar." },
    ], menuMessage)).toBe(false);
  });
});
