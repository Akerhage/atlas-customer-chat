import { describe, expect, it } from "vitest";
import { menuChoiceValue, type StandardSelfserviceMenuItem } from "@/lib/standard-selfservice-machine";
import { buildQuickQuestionCategories } from "./QuickQuestionsButton";

const standardItems: StandardSelfserviceMenuItem[] = [{
  id: "offer-1",
  label: "Vilka körkortspaket erbjuder ni i Göteborg - Ullevi?",
  action: {
    type: "offering",
    unit_id: "goteborg_ullevi",
    category_id: "BIL",
    offering_id: "paket-bas",
  },
}];

describe("QuickQuestionsButton category builder", () => {
  it("keeps the deterministic selfservice section before the empty-context return", () => {
    const categories = buildQuickQuestionCategories({
      selectedCity: "",
      selectedVehicle: null,
      generalMode: false,
      selectedOffice: null,
      availableVehicles: [],
      quickQuestions: [],
      standardSelfserviceMenu: standardItems,
    });

    expect(categories[0]).toEqual({
      category: "Priser & tjänster",
      questions: [],
      actions: [{
        label: "Vilka körkortspaket erbjuder ni i Göteborg - Ullevi?",
        value: menuChoiceValue("offer-1"),
      }],
    });
  });

  it("keeps tenant quick questions as strings and standard selfservice as actions", () => {
    const categories = buildQuickQuestionCategories({
      selectedCity: "Göteborg - Ullevi",
      selectedVehicle: "BIL",
      generalMode: false,
      selectedOffice: { city: "Göteborg", area: "Ullevi" },
      availableVehicles: ["BIL"],
      quickQuestions: ["Vad krävs för att få övningsköra privat?"],
      standardSelfserviceMenu: standardItems,
    });

    const selfservice = categories.find(category => category.category === "Priser & tjänster");
    const tenant = categories.find(category => category.category === "Vanliga frågor");
    expect(selfservice?.actions?.[0].value).toBe(menuChoiceValue("offer-1"));
    expect(selfservice?.questions).toEqual([]);
    expect(tenant?.questions).toEqual(["Vad krävs för att få övningsköra privat?"]);
    expect(tenant?.actions).toBeUndefined();
  });
});
