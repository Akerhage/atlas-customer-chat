import { describe, expect, it } from "vitest";

import { shouldStartNewChatAtTop } from "./chat-scroll-machine";

describe("initial chat scroll", () => {
  it("starts a new chat at the welcome heading only after history has been measured", () => {
    expect(shouldStartNewChatAtTop({
      initialHistoryLoaded: false,
      initialScrollHandled: false,
      initialHistoryHadMessages: false,
      humanMode: false,
      messageCount: 1,
    })).toBe(false);
    expect(shouldStartNewChatAtTop({
      initialHistoryLoaded: true,
      initialScrollHandled: false,
      initialHistoryHadMessages: false,
      humanMode: false,
      messageCount: 1,
    })).toBe(true);
  });

  it("preserves bottom scrolling for returning sessions and later message changes", () => {
    expect(shouldStartNewChatAtTop({
      initialHistoryLoaded: true,
      initialScrollHandled: false,
      initialHistoryHadMessages: true,
      humanMode: false,
      messageCount: 8,
    })).toBe(false);
    expect(shouldStartNewChatAtTop({
      initialHistoryLoaded: true,
      initialScrollHandled: true,
      initialHistoryHadMessages: false,
      humanMode: false,
      messageCount: 2,
    })).toBe(false);
  });

  it("waits for a renderable message before consuming the initial-scroll decision", () => {
    expect(shouldStartNewChatAtTop({
      initialHistoryLoaded: true,
      initialScrollHandled: false,
      initialHistoryHadMessages: false,
      humanMode: false,
      messageCount: 0,
    })).toBe(false);
  });

  it("never overrides human mode's bottom scrolling", () => {
    expect(shouldStartNewChatAtTop({
      initialHistoryLoaded: true,
      initialScrollHandled: false,
      initialHistoryHadMessages: false,
      humanMode: true,
      messageCount: 1,
    })).toBe(false);
  });
});
