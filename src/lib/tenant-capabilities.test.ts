import { describe, expect, it } from "vitest";

import {
  normalizeCategoryRegistryEntries,
  normalizeTenantProfile,
  resolveEffectiveCategories,
} from "./tenant-capabilities";

const FALLBACK_PROFILE = {
  schema_version: 1,
  edition: "trafikskola",
};

describe("normalizeCategoryRegistryEntries", () => {
  it("preserves a valid legacy vehicle registry", () => {
    const registry = [
      { id: "BIL", label: "Bil", icon: "CAR", active: true },
      { id: "MC", label: "MC", icon: "BIKE", active: false },
    ];

    expect(normalizeCategoryRegistryEntries(registry)).toEqual(registry);
  });

  it("preserves a valid custom slug entry", () => {
    const registry = [
      { id: "MUTTRAR", label: "Muttrar", icon: "NUT", active: true },
    ];

    expect(normalizeCategoryRegistryEntries(registry)).toEqual(registry);
  });

  it("trims required string fields and defaults active to true", () => {
    expect(normalizeCategoryRegistryEntries([
      { id: " MUTTRAR ", label: " Muttrar ", icon: " NUT " },
    ])).toEqual([
      { id: "MUTTRAR", label: "Muttrar", icon: "NUT", active: true },
    ]);
  });

  it("filters entries with an empty id or label without throwing", () => {
    expect(normalizeCategoryRegistryEntries([
      { id: "", label: "Muttrar", icon: "NUT", active: true },
      { id: "MUTTRAR", label: "   ", icon: "NUT", active: true },
      { id: "BULTAR", label: "Bultar", icon: "BOLT", active: false },
    ])).toEqual([
      { id: "BULTAR", label: "Bultar", icon: "BOLT", active: false },
    ]);
  });

  it("filters entries with an empty icon without throwing", () => {
    expect(normalizeCategoryRegistryEntries([
      { id: "MUTTRAR", label: "Muttrar", icon: " " },
    ])).toEqual([]);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["string", "not-an-array"],
    ["object", { id: "MUTTRAR" }],
  ])("returns an empty registry for %s input", (_label, value) => {
    expect(normalizeCategoryRegistryEntries(value)).toEqual([]);
  });
});

describe("resolveEffectiveCategories", () => {
  const standardProfile = normalizeTenantProfile({ schema_version: 1, edition: "standard" });
  const fallbackProfile = normalizeTenantProfile(undefined);
  const vehicles = ["BIL", "MC"];

  it("uses a singleton registry for the standard profile and preserves inactive entries", () => {
    expect(resolveEffectiveCategories(standardProfile, [
      { id: "MUTTRAR", label: "Muttrar", icon: "NUT", active: false },
    ], vehicles)).toEqual([
      { id: "MUTTRAR", label: "Muttrar", icon: "NUT", active: false },
    ]);
  });

  it.each([undefined, null, "broken", [], [{ id: "", label: "Fel", icon: "X" }]])(
    "adapts active vehicles when the standard registry is empty or invalid (%j)",
    (registry) => {
      expect(resolveEffectiveCategories(standardProfile, registry, vehicles)).toEqual([
        { id: "BIL", label: "BIL", icon: "BIL", active: true },
        { id: "MC", label: "MC", icon: "MC", active: true },
      ]);
    }
  );

  it("uses the vehicle adapter for the fallback profile regardless of registry", () => {
    expect(resolveEffectiveCategories(fallbackProfile, [
      { id: "MUTTRAR", label: "Muttrar", icon: "NUT", active: true },
    ], vehicles)).toEqual([
      { id: "BIL", label: "BIL", icon: "BIL", active: true },
      { id: "MC", label: "MC", icon: "MC", active: true },
    ]);
  });

  it("never throws for hostile input", () => {
    const hostile = { toString: () => { throw new Error("hostile"); } };
    expect(() => resolveEffectiveCategories(standardProfile, null, [hostile as unknown as string])).not.toThrow();
    expect(resolveEffectiveCategories(standardProfile, null, [hostile as unknown as string])).toEqual([]);
  });
});

describe("normalizeTenantProfile", () => {
  it("preserves a valid tenant profile", () => {
    expect(normalizeTenantProfile(FALLBACK_PROFILE)).toEqual(FALLBACK_PROFILE);
  });

  it("parses a valid JSON tenant profile", () => {
    expect(normalizeTenantProfile(JSON.stringify(FALLBACK_PROFILE))).toEqual(FALLBACK_PROFILE);
  });

  it("preserves a minimal tenant profile without optional placeholders", () => {
    expect(normalizeTenantProfile({ schema_version: 1, edition: "trafikskola" })).toEqual(FALLBACK_PROFILE);
  });

  it("preserves a complete tenant profile with optional groups", () => {
    const profile = {
      schema_version: 1,
      edition: "standard",
      labels: { unit: "Avdelning", category: "Produktkategori", offering: "Produkt" },
      modules: {
        structured_answers: true,
        industry_rag: false,
        booking_links: false,
        campaigns: false,
      },
      intake: { mode: "category_first" },
    };

    expect(normalizeTenantProfile(profile)).toEqual(profile);
  });

  it("omits only invalid optional tenant profile subfields", () => {
    expect(normalizeTenantProfile({
      schema_version: 1,
      edition: " standard ",
      labels: { unit: " Avdelning ", category: " ", offering: 42, future_label: "ignored" },
      modules: {
        structured_answers: true,
        industry_rag: "false",
        booking_links: false,
        future_module: true,
      },
      intake: { mode: " " },
    })).toEqual({
      schema_version: 1,
      edition: "standard",
      labels: { unit: "Avdelning" },
      modules: { structured_answers: true, booking_links: false },
    });
  });

  it("omits invalid optional tenant profile groups", () => {
    expect(normalizeTenantProfile({
      schema_version: 1,
      edition: "standard",
      labels: [],
      modules: null,
      intake: "category_first",
    })).toEqual({ schema_version: 1, edition: "standard" });
  });

  it("falls back exactly for missing input", () => {
    expect(normalizeTenantProfile(undefined)).toEqual(FALLBACK_PROFILE);
  });

  it("falls back exactly for broken JSON", () => {
    expect(normalizeTenantProfile('{"schema_version":')).toEqual(FALLBACK_PROFILE);
  });

  it("falls back exactly for the wrong value type", () => {
    expect(normalizeTenantProfile([])).toEqual(FALLBACK_PROFILE);
  });

  it("falls back exactly for an unknown schema version", () => {
    expect(normalizeTenantProfile({ schema_version: 2, edition: "standard" })).toEqual(FALLBACK_PROFILE);
  });

  it("falls back exactly for a non-string edition", () => {
    expect(normalizeTenantProfile({ schema_version: 1, edition: 42 })).toEqual(FALLBACK_PROFILE);
  });
});
