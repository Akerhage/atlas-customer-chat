import { describe, expect, it } from "vitest";

import {
  normalizeCategoryRegistryEntries,
  normalizeTenantProfile,
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

describe("normalizeTenantProfile", () => {
  it("preserves a valid tenant profile", () => {
    expect(normalizeTenantProfile(FALLBACK_PROFILE)).toEqual(FALLBACK_PROFILE);
  });

  it("parses a valid JSON tenant profile", () => {
    expect(normalizeTenantProfile(JSON.stringify(FALLBACK_PROFILE))).toEqual(FALLBACK_PROFILE);
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
