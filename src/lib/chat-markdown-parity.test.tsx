import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatBubble } from "../components/chat/ChatBubble";
import { renderChatMarkdownPlainText } from "./chat-markdown-plain-text";

const decodeHtml = (value: string) => value
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&#x27;|&#39;/g, "'");

function bubbleVisibleLines(markdown: string): string[] {
  const html = renderToStaticMarkup(
    <ChatBubble messageId="parity" content={markdown} isUser={false} />,
  );
  const start = html.indexOf('<div class="atlas-message-content">');
  const end = html.indexOf('</div></div>', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return decodeHtml(html.slice(start, end))
    .replace(/<br\s*\/?>/gi, "\u0000")
    .replace(/<\/(?:p|div|h[1-6]|li|blockquote|pre|ul|ol)>/gi, "\u0000")
    .replace(/<[^>]+>/g, "")
    .replace(/[\r\n\t ]+/g, " ")
    .split("\u0000")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

function logVisibleLines(markdown: string): string[] {
  return renderChatMarkdownPlainText(markdown)
    .split(/\r?\n/)
    .map((line) => line
      .replace(/^(?:•|\d+\.)\s+/, "")
      .replace(/ \(https?:\/\/[^)\s]+\)/g, "")
      .trim())
    .filter(Boolean);
}

describe("chat bubble and downloaded-log markdown parity", () => {
  const cases = [
    ["hard break spaces", "Första raden  \nAndra raden"],
    ["hard break slash", "Första raden\\\nAndra raden"],
    ["html br", "Första raden<br>Andra raden"],
    ["html blocks", "<p>Första blocket</p><div>Andra blocket</div>"],
    ["soft break", "Mjuk\nradbrytning"],
    ["bullet list", "- Första\n- Andra"],
    ["ordered list", "1. Första\n2. Andra"],
    ["links", "[Webb](https://example.test) och [ärende](#atlas-human)"],
  ] as const;

  it.each(cases)("keeps visible lines for %s", (_name, markdown) => {
    expect(logVisibleLines(markdown)).toEqual(bubbleVisibleLines(markdown));
  });

  it("keeps ordered-list order in the log", () => {
    expect(renderChatMarkdownPlainText("1. Första\n2. Andra").split("\n"))
      .toEqual(["1. Första", "2. Andra"]);
  });
});
