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

  it("preserves an explicitly empty Standard registry", () => {
    expect(resolveEffectiveCategories(standardProfile, [], vehicles)).toEqual([]);
  });

  it.each([undefined, null, "broken", [{ id: "", label: "Fel", icon: "X" }]])(
    "adapts active vehicles when the standard registry is missing or invalid (%j)",
    (registry) => {
      expect(resolveEffectiveCategories(standardProfile, registry, vehicles)).toEqual([
        { id: "BIL", label: "BIL", icon: "BIL", active: true },
        { id: "MC", label: "MC", icon: "MC", active: true },
      ]);
    }
  );

  // 🔴 REGELN ÄNDRAD 2026-08-19 (`#331`): registerposter som INTE är fordonsnycklar
  // läggs numera till efter fordonen — en trafikskola ska nå kunden med sina egna
  // kategorier. Fordonen använder fortfarande ID:t som etikett när registret inte
  // känner till dem, vilket är vad detta kontrakt ursprungligen vaktade.
  it("uses the vehicle adapter when the registry knows no vehicle id, and appends the own category", () => {
    expect(resolveEffectiveCategories(fallbackProfile, [
      { id: "MUTTRAR", label: "Muttrar", icon: "NUT", active: true },
    ], vehicles)).toEqual([
      { id: "BIL", label: "BIL", icon: "BIL", active: true },
      { id: "MC", label: "MC", icon: "MC", active: true },
      { id: "MUTTRAR", label: "Muttrar", icon: "NUT", active: true },
    ]);
  });

  // #323: kunden läste `BIL` i stället för `Bil` i allt utom Standard.
  it("takes label and icon from the registry outside standard, but keeps active_vehicles as the active set", () => {
    expect(resolveEffectiveCategories(fallbackProfile, [
      { id: "BIL", label: "Bil", icon: "CAR", active: true },
      { id: "MC", label: "Motorcykel", icon: "BIKE", active: true },
      // LASTBIL står i registret men saknas i active_vehicles och ska INTE dyka upp:
      // vilka kategorier som är aktiva ägs av active_vehicles utanför Standard.
      { id: "LASTBIL", label: "Lastbil", icon: "TRUCK", active: true },
    ], vehicles)).toEqual([
      { id: "BIL", label: "Bil", icon: "CAR", active: true },
      { id: "MC", label: "Motorcykel", icon: "BIKE", active: true },
    ]);
  });

  // #331: en trafikskolas EGNA kategorier ska nå kunden, utan att fordonsnycklarnas
  // ägarskap ändras. Livemätt orsak: servern släppte igenom EKONOMI men widgeten
  // härledde listan ur active_vehicles och visade den aldrig.
  it("appends own non-vehicle registry categories outside standard, after the vehicles", () => {
    expect(resolveEffectiveCategories(fallbackProfile, [
      { id: "BIL", label: "Bil", icon: "CAR", active: true },
      { id: "EKONOMI", label: "Ekonomi", icon: "COIN", active: true },
      { id: "PENSIONERAD", label: "Pensionerad", icon: "X", active: false },
    ], ["BIL", "MC"])).toEqual([
      { id: "BIL", label: "Bil", icon: "CAR", active: true },
      { id: "MC", label: "MC", icon: "MC", active: true },
      { id: "EKONOMI", label: "Ekonomi", icon: "COIN", active: true },
    ]);
  });

  // 🔴 Ägarskapet får inte kastas om: en fordonsnyckel som INTE står i active_vehicles
  // ska förbli dold även om registret säger active — det är L-011/#313:s regel.
  it("never lets the registry re-activate a vehicle that active_vehicles omits", () => {
    const result = resolveEffectiveCategories(fallbackProfile, [
      { id: "BIL", label: "Bil", icon: "CAR", active: true },
      { id: "LASTBIL", label: "Lastbil", icon: "TRUCK", active: true },
    ], ["BIL"]);
    expect(result.map(category => category.id)).toEqual(["BIL"]);
  });

  // En inaktiv registerpost får ge etikett, men får inte styra aktiv-mängden:
  // den ägaren är active_vehicles utanför Standard (L-011/#313).
  it("still shows a vehicle whose registry entry is inactive, using its label", () => {
    expect(resolveEffectiveCategories(fallbackProfile, [
      { id: "BIL", label: "Bil", icon: "CAR", active: false },
    ], ["BIL"])).toEqual([
      { id: "BIL", label: "Bil", icon: "CAR", active: true },
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
