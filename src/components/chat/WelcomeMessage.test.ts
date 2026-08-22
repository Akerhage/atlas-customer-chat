import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/atlas-client", () => ({
  resolveTenantAssetUrl: (url: string | null | undefined) => url || null,
}));

import { WelcomeMessage } from "./WelcomeMessage";

describe("WelcomeMessage tenant greeting", () => {
  it("greets with the tenant name while keeping the Atlas brand asset in the welcome card", () => {
    const markup = renderToStaticMarkup(createElement(WelcomeMessage, {
      companyName: "Mätbolaget",
      companyLogoUrl: "/tenant-logo.png",
    }));

    expect(markup).toContain("Välkommen till Mätbolaget");
    expect(markup).not.toContain("Välkommen till Atlas!");
    expect(markup).not.toContain("/tenant-logo.png");
  });
});
