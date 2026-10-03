import { describe, expect, it } from "vitest";
import { getVehicleDisplayLabel } from "./vehicle-display-label";

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
});
