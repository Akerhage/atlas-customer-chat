import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

async function loadGetTenantConfig() {
  vi.stubGlobal("window", { location: { origin: "https://box4.atlas-support.se" } });
  return (await import("./atlas-client")).getTenantConfig;
}

describe("getTenantConfig tenant capability wiring", () => {
  it("normalizes tenant profile and category registry from the existing response", async () => {
    const getTenantConfig = await loadGetTenantConfig();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        company_name: "Bosses",
        active_vehicles: ["BIL", "MC"],
        tenant_profile: { schema_version: 1, edition: "standard" },
        category_registry: [{ id: "MUTTRAR", label: "Muttrar", icon: "NUT", active: true }],
      }),
    }));

    const config = await getTenantConfig();
    expect(config.tenantProfile).toEqual({ schema_version: 1, edition: "standard" });
    expect(config.categories).toEqual([
      { id: "MUTTRAR", label: "Muttrar", icon: "NUT", active: true },
    ]);
  });

  it.each([
    ["non-ok response", vi.fn().mockResolvedValue({ ok: false })],
    ["fetch rejection", vi.fn().mockRejectedValue(new Error("offline"))],
  ])("returns fallback profile and vehicle categories after %s", async (_label, fetchMock) => {
    const getTenantConfig = await loadGetTenantConfig();
    vi.stubGlobal("fetch", fetchMock);
    const config = await getTenantConfig();

    expect(config.tenantProfile).toEqual({ schema_version: 1, edition: "trafikskola" });
    expect(config.categories).toEqual([
      { id: "BIL", label: "BIL", icon: "BIL", active: true },
      { id: "MC", label: "MC", icon: "MC", active: true },
      { id: "AM", label: "AM", icon: "AM", active: true },
      { id: "LASTBIL", label: "LASTBIL", icon: "LASTBIL", active: true },
      { id: "SLÄP", label: "SLÄP", icon: "SLÄP", active: true },
    ]);
  });
});
