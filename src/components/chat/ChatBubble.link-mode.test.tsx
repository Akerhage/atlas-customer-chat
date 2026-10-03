import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ChatBubble } from "./ChatBubble";

const renderBotMessage = (content: string) => renderToStaticMarkup(
  <ChatBubble
    messageId="link-mode"
    content={content}
    isUser={false}
    timestamp={new Date("2026-10-03T10:00:00.000Z")}
  />,
);

const css = readFileSync(new URL("../../index.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("ChatBubble bot link rendering", () => {
  it("marks only paragraphs whose only real content is one link as button paragraphs", () => {
    const markup = renderBotMessage(
      [
        "[Starta ett ärende](#atlas-human)",
        "",
        "Läs våra köpvillkor och policy [här](https://atlas-support.se/policy).",
      ].join("\n"),
    );

    const paragraphs = (markup.match(/<p\b[^>]*>[\s\S]*?<\/p>/g) ?? [])
      .filter((paragraph) => paragraph.includes("href="));
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toContain('data-atlas-link-mode="alone"');
    expect(paragraphs[0]).toContain('href="#atlas-human"');
    expect(paragraphs[1]).toContain('data-atlas-link-mode="text"');
    expect(paragraphs[1]).toContain("Läs våra köpvillkor");
    expect(paragraphs[1]).toContain('href="https://atlas-support.se/policy"');
  });

  it("does not let CSS decide button links with :only-child", () => {
    expect(css).toContain('[data-atlas-link-mode="alone"] > a');
    expect(css).toContain('[data-atlas-link-mode="text"] a');
    expect(css).not.toContain("p > a:only-child");
    expect(css).not.toContain("p > a[target=\"_blank\"]:only-child");
  });
});
