import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/atlas-client", () => ({
  getCustomerTemplates: async () => [],
  resolveTenantAssetUrl: (url: string | null | undefined) => url || null,
}));

import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatHeader } from "./ChatHeader";

const atlasChatSource = readFileSync(new URL("./AtlasChat.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

const renderHeader = (humanMode: boolean) => renderToStaticMarkup(
  createElement(
    TooltipProvider,
    null,
    createElement(ChatHeader, {
      onRequestHuman: () => undefined,
      humanMode,
      isDark: true,
      onToggleTheme: () => undefined,
      offices: [],
      onTemplateSelect: () => undefined,
      activeVehicles: [],
      intakeMode: "legacy",
      categoryChoices: [],
      formLabels: { unit: "Kontor", category: "Kategori" },
    }),
  ),
);

describe("ChatHeader human-mode action", () => {
  it("shows the human handoff before escalation, hides it in human mode, and restores it afterwards", () => {
    expect(renderHeader(false)).toContain('aria-label="Prata med människa"');
    expect(renderHeader(true)).not.toContain('aria-label="Prata med människa"');
    expect(renderHeader(false)).toContain('aria-label="Prata med människa"');
  });

  it("receives raw human mode from AtlasChat so archived human sessions do not revive a dead action", () => {
    expect(atlasChatSource).toContain("humanMode={humanMode}");
    expect(atlasChatSource).not.toContain("humanMode={humanMode && !isArchived}");
  });
});
