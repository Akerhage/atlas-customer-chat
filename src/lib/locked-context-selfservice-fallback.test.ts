import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as sync from "./locked-context-selfservice-sync";

const current = { selectedCity: null as string | null, selectedVehicle: null as string | null };
const fallback = (sync as Record<string, unknown>).resolveLockedContextFallbackSync as
  | ((input: { current: typeof current; lockedContext: Record<string, unknown> }) => Record<string, unknown> | null)
  | undefined;

describe("F-264 locked context without exactly one office", () => {
  it("syncs the vehicle when the server only knows the vehicle", () => {
    expect(typeof fallback).toBe("function");
    expect(fallback!({ current, lockedContext: { city: null, area: null, vehicle: "BIL" } })).toMatchObject({
      selectedVehicle: "BIL",
      vehicleWasSetByThisSync: true,
      generalMode: false,
      selectedCity: null,
      cityChanged: false,
    });
  });

  it("syncs the city label when the city has several offices, without picking a unit", () => {
    expect(typeof fallback).toBe("function");
    const next = fallback!({ current, lockedContext: { city: "göteborg", area: null, vehicle: "MC" } });
    expect(next).toMatchObject({ selectedCity: "Göteborg", cityChanged: true, selectedVehicle: "MC" });
    expect(next).not.toHaveProperty("unitId");
  });

  it("keeps the old LASTBIL guard and the OVRIGT reset", () => {
    expect(typeof fallback).toBe("function");
    expect(fallback!({
      current: { selectedCity: null, selectedVehicle: "LASTBIL" },
      lockedContext: { vehicle: "BIL" },
    })).toBeNull();
    expect(fallback!({
      current: { selectedCity: null, selectedVehicle: "MC" },
      lockedContext: { vehicle: null, vehicle_choice: "OVRIGT" },
    })).toMatchObject({ selectedVehicle: null, generalMode: true });
  });

  it("is wired into the widget when the exact-office sync gives nothing", () => {
    const source = readFileSync(new URL("../components/chat/AtlasChat.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    const start = source.indexOf("const applyLockedContextSync = async");
    const block = source.slice(start, source.indexOf("const beginStandardSelfservice", start));
    expect(block).toContain("if (!next) {");
    expect(block).toContain("resolveLockedContextFallbackSync({");
  });
});
