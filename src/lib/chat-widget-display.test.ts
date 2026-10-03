import { describe, expect, it } from "vitest";
import {
  buildLockedContextSyncToast,
  buildOfficeMenuQuestion,
  mapChoiceValueToDisplayLabel,
} from "./chat-widget-display";

const categoryChoices = [
  { label: "Bil", value: "BIL" },
  { label: "MC", value: "MC" },
  { label: "Lastbil", value: "LASTBIL" },
];

const officeChoices = [
  { label: "My Driving Academy Support", value: "Centralsupport" },
  { label: "Kristianstad", value: "Kristianstad" },
];

describe("widget display helpers", () => {
  it("describes only the context values that the current sync changed", () => {
    expect(buildLockedContextSyncToast({
      cityLabel: "Kristianstad",
      nextVehicle: null,
      previousVehicle: null,
      vehicleWasSetByThisSync: false,
      categoryChoices,
    })).toBe("Vi har anpassat dina val till Kristianstad.");

    expect(buildLockedContextSyncToast({
      cityLabel: "Eslöv",
      nextVehicle: "BIL",
      previousVehicle: null,
      vehicleWasSetByThisSync: true,
      categoryChoices,
    })).toBe("Vi har anpassat dina val till Eslöv och Bil.");

    expect(buildLockedContextSyncToast({
      cityLabel: "Eslöv",
      nextVehicle: "BIL",
      previousVehicle: "LASTBIL",
      vehicleWasSetByThisSync: false,
      categoryChoices,
    })).toBe("Vi har anpassat dina val till Eslöv.");
  });

  it("uses the shared vehicle fallback when the active vehicle is outside tenant choices", () => {
    expect(buildLockedContextSyncToast({
      cityLabel: "Eslöv",
      nextVehicle: "AM",
      previousVehicle: null,
      vehicleWasSetByThisSync: true,
      categoryChoices,
    })).toBe("Vi har anpassat dina val till Eslöv och Moped.");
  });

  it("uses tenant unit words for the engine office menu instead of intake copy", () => {
    expect(buildOfficeMenuQuestion("kontor")).toBe("Välj kontor.");
    expect(buildOfficeMenuQuestion("avdelning")).toBe("Välj avdelning.");
    expect(buildOfficeMenuQuestion("")).toBe("Välj enhet.");
  });

  it("shows clicked choice labels live and after history reload while preserving sentinels", () => {
    expect(mapChoiceValueToDisplayLabel("Centralsupport", officeChoices)).toBe("My Driving Academy Support");
    expect(mapChoiceValueToDisplayLabel("Kristianstad", officeChoices)).toBe("Kristianstad");
    expect(mapChoiceValueToDisplayLabel("__unknown__", officeChoices)).toBe("__unknown__");
  });
});
