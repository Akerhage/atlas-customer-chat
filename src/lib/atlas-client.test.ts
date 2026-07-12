import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

async function loadGetTenantConfig() {
  vi.stubGlobal("window", { location: { origin: "https://box4.atlas-support.se" } });
  return (await import("./atlas-client")).getTenantConfig;
}

function installStorage() {
  const values = new Map<string, string>([
    ["chat_session_id", "session_test"],
    ["chat_owner_token", "owner_test"],
  ]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
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

describe("sendMessage locked context", () => {
  it("includes category_id and unit_id when supplied", async () => {
    installStorage();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ answer: "ok", sessionId: "session_test" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { sendMessage } = await import("./atlas-client");

    await sendMessage("hej", false, {
      city: "Stockholm",
      category_id: "MUTTRAR",
      unit_id: "bosses_kundtjanst",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.locked_context).toMatchObject({
      city: "Stockholm",
      category_id: "MUTTRAR",
      unit_id: "bosses_kundtjanst",
    });
  });

  it("omits the new fields from the legacy payload", async () => {
    installStorage();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ answer: "ok", sessionId: "session_test" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { sendMessage } = await import("./atlas-client");

    await sendMessage("hej", false, { city: "Stockholm", vehicle: "BIL" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.locked_context).toEqual({
      city: "Stockholm",
      area: null,
      vehicle: "BIL",
      agent_id: null,
    });
    expect(body.locked_context).not.toHaveProperty("category_id");
    expect(body.locked_context).not.toHaveProperty("unit_id");
  });
});
