import { describe, expect, it } from "vitest";
import { renderChatMarkdownPlainText } from "./chat-markdown-plain-text";

const asciiPunctuation = String.raw`!"#$%&'()*+,-./:;<=>?@[\]^_` + "`" + String.raw`{|}~`;

describe("chat markdown plain-text rendering", () => {
  it("matches the bubble-visible text for escaped punctuation and links", () => {
    const escaped = Array.from(asciiPunctuation).map((ch) => `\\${ch}`).join("");
    const rendered = renderChatMarkdownPlainText(
      [
        `Muttrar och Skruvar${escaped}`,
        "[Läs mer](https://www.bossesfejksida.se/kategori_muttrar_skruvar)",
        "[Starta ett ärende](#atlas-human)",
      ].join("\n\n"),
    );

    expect(rendered).toContain(`Muttrar och Skruvar${asciiPunctuation}`);
    expect(rendered).toContain("Läs mer (https://www.bossesfejksida.se/kategori_muttrar_skruvar)");
    expect(rendered).toContain("Starta ett ärende");
    expect(rendered).not.toMatch(/\\[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/);
    expect(rendered).not.toContain("[Läs mer](");
  });
});
