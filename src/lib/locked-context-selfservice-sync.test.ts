import { describe, expect, it } from "vitest";
import {
  getOfficeDisplayName,
  resolveLockedContextSelfserviceSync,
} from "./locked-context-selfservice-sync";

const offices = [
  {
    routing_tag: "alpha_norr",
    display_name: "Alfastad - Norr",
    city: "Alfastad",
    area: "Norr",
    categories_offered: ["BIL", "SLÄP"],
  },
  {
    routing_tag: "beta",
    display_name: "Betakontoret",
    city: "Betastad",
    area: null,
    categories_offered: ["BIL"],
  },
];

const current = {
  selfserviceUnitId: "alpha_norr",
  selfserviceUnitLabel: "Alfastad - Norr",
  selectedCity: "Alfastad - Norr",
  selectedCategoryId: "SLÄP",
  selectedVehicle: "SLÄP",
};

describe("locked context selfservice sync", () => {
  it("makes every traffic consumer follow an exact locked unit and vehicle", () => {
    const next = resolveLockedContextSelfserviceSync({
      edition: "legacy_trafik",
      offices,
      current,
      lockedContext: { unit_id: "beta", city: "Betastad", area: null, vehicle: "BIL" },
    });

    expect(next).toEqual({
      office: offices[1],
      unitId: "beta",
      unitLabel: "Betakontoret",
      selectedCity: "Betakontoret",
      selectedCategoryId: "BIL",
      selectedVehicle: "BIL",
      menuUnitId: "beta",
      menuCategoryId: "BIL",
      escalationUnitLabel: "Betakontoret",
    });
  });

  it("uses the same office label in both directions and preserves an offered category", () => {
    const next = resolveLockedContextSelfserviceSync({
      edition: "legacy_trafik",
      offices,
      current: { ...current, selfserviceUnitId: "beta", selectedCategoryId: "BIL", selectedVehicle: "BIL" },
      lockedContext: { city: "Alfastad", area: "Norr", vehicle: null },
    });

    expect(next?.unitId).toBe("alpha_norr");
    expect(next?.unitLabel).toBe(getOfficeDisplayName(offices[0]));
    expect(next?.selectedCategoryId).toBe("BIL");
    expect(next?.menuUnitId).toBe("alpha_norr");
    expect(next?.menuCategoryId).toBe("BIL");
  });

  it("never maps a Standard category from the locked vehicle", () => {
    const next = resolveLockedContextSelfserviceSync({
      edition: "standard",
      offices,
      current,
      lockedContext: { unit_id: "beta", city: "Betastad", vehicle: "BIL" },
    });

    expect(next?.selectedCategoryId).toBe("SLÄP");
    expect(next?.selectedVehicle).toBe("BIL");
  });

  it("does nothing when the locked location is not exactly one office", () => {
    expect(resolveLockedContextSelfserviceSync({
      edition: "legacy_trafik",
      offices,
      current,
      lockedContext: { city: "Okänd ort", area: null, vehicle: "BIL" },
    })).toBeNull();
  });
});
