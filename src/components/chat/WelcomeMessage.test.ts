import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/atlas-client", () => ({
  resolveTenantAssetUrl: (url: string | null | undefined) => url || null,
}));

import { WelcomeMessage } from "./WelcomeMessage";
import { resolveChatUnitWord } from "@/lib/tenant-capabilities";

const atlasChatSource = readFileSync(new URL("./AtlasChat.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const welcomeSource = readFileSync(new URL("./WelcomeMessage.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function renderWelcome(profile: Parameters<typeof resolveChatUnitWord>[0], companyName: string): string {
  // Facit binds till DATA + REGEL: ordet läses ur profilen genom resolvern, aldrig
  // som handskriven sträng i testet.
  const unitWord = resolveChatUnitWord(profile).toLocaleLowerCase("sv-SE");
  return renderToStaticMarkup(createElement(WelcomeMessage, { companyName, unitWord }));
}

describe("WelcomeMessage tenant greeting", () => {
  it("greets with the tenant name while keeping the Atlas brand asset in the welcome card", () => {
    const markup = renderToStaticMarkup(createElement(WelcomeMessage, {
      companyName: "Mätbolaget",
      companyLogoUrl: "/tenant-logo.png",
      unitWord: "kontor",
    }));

    expect(markup).toContain("Välkommen till Mätbolaget");
    expect(markup).not.toContain("Välkommen till Atlas!");
    expect(markup).not.toContain("/tenant-logo.png");
  });
});

// 🔴 Livemätt 2026-09-03 på alla fem boxar via /api/tenant-name: sandbox har
// labels.unit = "Avdelning", men välkomstrubriken skrev ut "rätt kontor" ändå.
// Raden var en syskonyta som ALDRIG anropade resolveChatUnitWord — ett svep på
// resolverns namn hade missat den helt. Testet binder DET RENDERADE ordet.
describe("WelcomeMessage enhetsord", () => {
  it("renderar tenantens eget enhetsord i välkomstraden", () => {
    const sandbox = {
      schema_version: 1,
      edition: "trafikskola",
      labels: { unit: "Avdelning" },
    };
    const ownWord = sandbox.labels.unit.toLocaleLowerCase("sv-SE");
    const markup = renderWelcome(sandbox, "Pelles Trafikskola");

    expect(markup).toContain(`rätt svar eller rätt ${ownWord}`);
    // Negativ vakt PARAD med den positiva ovan — ett tyst noll-svep får aldrig stå ensamt.
    expect(markup).not.toContain("kontor");
  });

  it("behåller dagens ord för tenanter utan egna labels", () => {
    // Box1/htig/base/box4 får inte flytta sig av fixen: utan eget label styr editionen.
    const trafikMarkup = renderWelcome({ schema_version: 1, edition: "trafikskola" }, "Box1");
    const standardMarkup = renderWelcome({ schema_version: 1, edition: "standard" }, "Box4");

    expect(trafikMarkup).toContain("rätt svar eller rätt kontor");
    expect(standardMarkup).toContain("rätt svar eller rätt avdelning");
    expect(standardMarkup).not.toContain("rätt kontor");
  });

  it("hämtar ordet från anroparen — komponenten hårdkodar det inte och löser det inte själv", () => {
    // Komponenten har ingen tenantprofil i sin props-kedja; upplösningen bor hos
    // anroparen. Vakten hindrar att ordet återuppstår som literal här.
    expect(welcomeSource).toContain("rätt svar eller rätt {unitWord}");
    expect(welcomeSource).not.toContain("rätt kontor");
    // Ingen egen upplösning och ingen ny fetch i komponenten — kommentaren som
    // NAMNGER resolvern ska däremot få stå kvar, så vakten går på anropet/importen.
    expect(welcomeSource).not.toContain("resolveChatUnitWord(");
    expect(welcomeSource).not.toContain("tenant-capabilities");

    // Call site: WelcomeMessage måste MATAS med det upplösta ordet, annars är
    // komponenten grön medan kunden fortfarande läser fel ord.
    const start = atlasChatSource.indexOf("<WelcomeMessage");
    expect(start).toBeGreaterThanOrEqual(0);
    const jsx = atlasChatSource.slice(start, atlasChatSource.indexOf("/>", start));
    expect(jsx).toContain("unitWord={");
    expect(jsx).toContain("contextBarUnitWord");
    expect(atlasChatSource).toContain("const contextBarUnitWord = resolveChatUnitWord(tenantProfile);");
  });
});
