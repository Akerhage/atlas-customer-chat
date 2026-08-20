import { describe, expect, it } from "vitest";
import { officeOffersVehicle, resolveVehicleForOffice } from "./vehicle-utils";

describe("officeOffersVehicle", () => {
  it.each([
    [[], "BIL", true],
    [["Bil"], "BIL", true],
    [["bil"], "BIL", true],
    [["AM / Bil"], "BIL", true],
    [["MC-Bil"], "MC", true],
    [["Lastbil"], "BIL", false],
    [["Släp / Lastbil"], "SLÄP", true],
  ] as const)("matches %j against %s", (servicesOffered, vehicle, expected) => {
    expect(officeOffersVehicle({ services_offered: servicesOffered }, vehicle)).toBe(expected);
  });
});

describe("resolveVehicleForOffice", () => {
  const wideOffice = { services_offered: ["Bil", "MC"] };
  const narrowOffice = { services_offered: ["Bil"] };

  it("clears a selected vehicle on an AV office and preserves it on a PÅ office", () => {
    expect(resolveVehicleForOffice(narrowOffice, "MC")).toBeNull();
    expect(resolveVehicleForOffice(wideOffice, "MC")).toBe("MC");
  });

  it("proves the AV→PÅ round trip without inventing a replacement vehicle", () => {
    const cleared = resolveVehicleForOffice(narrowOffice, "MC");
    const preserved = resolveVehicleForOffice(wideOffice, "MC");
    expect({ cleared, preserved }).toEqual({ cleared: null, preserved: "MC" });
  });
});
