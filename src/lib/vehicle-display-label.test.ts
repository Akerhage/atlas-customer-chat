import { describe, expect, it } from "vitest";
import { buildVehicleDisplayOptions, getVehicleDisplayLabel } from "./vehicle-display-label";

const categoryChoices = [
  { value: "BIL", label: "Personbil" },
  { value: "MC", label: "Motorcykel" },
];

describe("shared vehicle display label", () => {
  it.each([
    ["BIL", "Personbil"],
    ["MC", "Motorcykel"],
    ["AM", "Moped"],
    ["LASTBIL", "Tung trafik"],
    ["SLÄP", "Släp"],
    ["EGEN", "EGEN"],
    [null, ""],
  ])("resolves %s through tenant choice then shared fallback", (value, expected) => {
    expect(getVehicleDisplayLabel(categoryChoices, value)).toBe(expected);
  });

  it("builds contact-form choices through the same tenant and fallback chain", () => {
    expect(buildVehicleDisplayOptions(categoryChoices, ["AM", "BIL", "LASTBIL", "SLÄP"]))
      .toEqual([
        { value: "BIL", label: categoryChoices[0].label },
        { value: "AM", label: "Moped" },
        { value: "LASTBIL", label: "Tung trafik" },
        { value: "SLÄP", label: "Släp" },
      ]);
  });
});
