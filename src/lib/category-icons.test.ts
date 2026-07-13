import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { ChatBubble } from "@/components/chat/ChatBubble";
import {
  CATEGORY_ICON_FALLBACK,
  CATEGORY_ICON_KEYS,
  resolveCategoryIcon,
} from "./category-icons";

describe("category icons", () => {
  it("keeps the canonical key catalog frozen and complete", () => {
    expect(Object.isFrozen(CATEGORY_ICON_KEYS)).toBe(true);
    expect(CATEGORY_ICON_KEYS).toHaveLength(25);
    expect(new Set(CATEGORY_ICON_KEYS).size).toBe(CATEGORY_ICON_KEYS.length);
  });

  it.each(["CAR", "BIKE", "MOPED", "TRUCK", "TRAILER"])(
    "resolves the live key %s without using the fallback",
    (key) => {
      expect(resolveCategoryIcon(key)).not.toBe(CATEGORY_ICON_FALLBACK);
    },
  );

  it("uses the neutral fallback for unknown and missing keys", () => {
    expect(resolveCategoryIcon("MUTTRAR")).toBe(CATEGORY_ICON_FALLBACK);
    expect(resolveCategoryIcon(undefined)).toBe(CATEGORY_ICON_FALLBACK);
  });

  it("renders no icon for a legacy choice without an icon key", () => {
    const markup = renderToStaticMarkup(createElement(ChatBubble, {
      content: "Välj ett alternativ",
      isUser: false,
      choices: [{ label: "Bil", value: "BIL" }],
      onChoiceSelect: () => undefined,
    }));

    expect(markup).toContain(">Bil</button>");
    expect(markup).not.toContain('aria-hidden="true"');
  });
});
