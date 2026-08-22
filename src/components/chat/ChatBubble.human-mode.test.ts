import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChatBubble } from "./ChatBubble";

const renderHumanLink = (humanMode: boolean) => renderToStaticMarkup(createElement(ChatBubble, {
  messageId: "human-link-test",
  content: "[Prata med en människa](#atlas-human)",
  isUser: false,
  humanMode,
  onRequestHuman: () => undefined,
}));

describe("ChatBubble human handoff link", () => {
  it("keeps the link reachable before escalation and renders ordinary text in human mode", () => {
    expect(renderHumanLink(false)).toContain('href="#atlas-human"');
    const humanModeMarkup = renderHumanLink(true);
    expect(humanModeMarkup).toContain("Prata med en människa");
    expect(humanModeMarkup).not.toContain('href="#atlas-human"');
  });
});
