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

  it("keeps deterministic selfservice actions but removes RAG questions when AI replies are disabled", () => {
    const categories = buildQuickQuestionCategories({
      selectedCity: "Göteborg - Ullevi",
      selectedVehicle: "BIL",
      generalMode: false,
      selectedOffice: { city: "Göteborg", area: "Ullevi" },
      availableVehicles: ["BIL"],
      quickQuestions: ["Vad krävs för att få övningsköra privat?"],
      standardSelfserviceMenu: standardItems,
      aiRepliesEnabled: false,
    } as Parameters<typeof buildQuickQuestionCategories>[0] & { aiRepliesEnabled: boolean });

    expect(categories).toEqual([{
      category: "Priser & tjänster",
      questions: [],
      actions: [{
        label: "Vilka körkortspaket erbjuder ni i Göteborg - Ullevi?",
        value: menuChoiceValue("offer-1"),
      }],
    }]);
  });

  it.each([
    { industryRagEnabled: true, aiRepliesEnabled: true, expectRag: true, expectTenant: true },
    { industryRagEnabled: false, aiRepliesEnabled: true, expectRag: false, expectTenant: false },
    { industryRagEnabled: true, aiRepliesEnabled: false, expectRag: false, expectTenant: false },
    { industryRagEnabled: false, aiRepliesEnabled: false, expectRag: false, expectTenant: false },
  ])(
    "keeps deterministic selfservice while industry_rag=$industryRagEnabled and AI=$aiRepliesEnabled expose only valid question paths",
    ({ industryRagEnabled, aiRepliesEnabled, expectRag, expectTenant }) => {
      const categories = buildQuickQuestionCategories({
        selectedCity: "Göteborg - Ullevi",
        selectedVehicle: "BIL",
        generalMode: false,
        selectedOffice: { city: "Göteborg", area: "Ullevi" },
        availableVehicles: ["BIL"],
        quickQuestions: ["När stänger receptionen?"],
        standardSelfserviceMenu: standardItems,
        aiRepliesEnabled,
        industryRagEnabled,
      });

      expect(categories.find(category => category.category === "Priser & tjänster")?.actions).toHaveLength(1);
      expect(categories.some(category => category.category === "Kom igång med Bil")).toBe(expectRag);
      expect(categories.some(category => category.category === "Om kontoret i Göteborg - Ullevi")).toBe(expectRag);
      expect(categories.some(category => category.category === "Populära frågor")).toBe(expectRag);
      expect(categories.some(category => category.category === "Vanliga frågor")).toBe(expectTenant);
    }
  );

  it.each([
    ["missing", {}],
    ["undefined", { industryRagEnabled: undefined }],
    ["wrong typed", { industryRagEnabled: "false" }],
  ])("fails open for %s Branschkunskap input", (_label, override) => {
    const categories = buildQuickQuestionCategories({
      selectedCity: "Göteborg - Ullevi",
      selectedVehicle: "BIL",
      generalMode: false,
      selectedOffice: { city: "Göteborg", area: "Ullevi" },
      availableVehicles: ["BIL"],
      quickQuestions: [],
      standardSelfserviceMenu: standardItems,
      aiRepliesEnabled: true,
      ...override,
    } as unknown as Parameters<typeof buildQuickQuestionCategories>[0]);

    expect(categories.find(category => category.category === "Priser & tjänster")?.actions).toHaveLength(1);
    expect(categories.some(category => category.category === "Kom igång med Bil")).toBe(true);
  });
});
