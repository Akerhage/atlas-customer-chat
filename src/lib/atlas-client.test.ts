import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function loadGetTenantConfig() {
  vi.stubGlobal("window", { location: { origin: "https://box4.atlas-support.se" } });
  return (await import("./atlas-client")).getTenantConfig;
}

function installStorage(initial: Array<[string, string]> = [
  ["chat_session_id", "session_test"],
  ["chat_owner_token", "owner_test"],
]) {
  const values = new Map<string, string>(initial);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  return values;
}

describe("getTenantConfig tenant capability wiring", () => {
  it("normalizes tenant profile and category registry from the existing response", async () => {
    const getTenantConfig = await loadGetTenantConfig();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        company_name: "Bosses",
        support_display_name: "  Bosses Support  ",
        active_vehicles: ["BIL", "MC"],
        tenant_profile: { schema_version: 1, edition: "standard" },
        category_registry: [{ id: "MUTTRAR", label: "Muttrar", icon: "NUT", active: true }],
      }),
    }));

    const config = await getTenantConfig();
    expect(config.supportDisplayName).toBe("Bosses Support");
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

    expect(config.supportDisplayName).toBeNull();
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

describe("standard selfservice client", () => {
  it("fetches a customer-safe menu with encoded unit and category ids", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{
          id: "opaque",
          label: "Vad kostar produkten?",
          action: {
            type: "offering",
            unit_id: "bosses_kundtjanst",
            category_id: "MUTTRAR",
            offering_id: "mutter-bas",
          },
        }],
        empty_message: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getStandardSelfserviceMenu } = await import("./atlas-client");

    const result = await getStandardSelfserviceMenu("bosses kundtjänst", "MUTTRAR");

    expect(fetchMock.mock.calls[0][0]).toContain(
      "unit_id=bosses+kundtj%C3%A4nst&category_id=MUTTRAR"
    );
    expect(result.items[0].id).toBe("opaque");
  });

  it("posts the exact action with the existing ownership token", async () => {
    installStorage();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        answer: "125 SEK",
        presentation: "125 SEK",
        source_ids: { offering_id: "mutter-bas" },
        values: { price: 125 },
        ownerToken: "owner_test",
        sessionId: "session_test",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { answerStandardSelfservice } = await import("./atlas-client");
    const action = {
      type: "offering" as const,
      unit_id: "bosses_kundtjanst",
      category_id: "MUTTRAR",
      offering_id: "mutter-bas",
    };

    const result = await answerStandardSelfservice(action);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);

    expect(body).toEqual({
      sessionId: "session_test",
      ownerToken: "owner_test",
      action,
    });
    expect(result.values).toEqual({ price: 125 });
  });

  it("recovers a desynchronized owned session through one new customer session", async () => {
    vi.resetModules();
    vi.stubGlobal("window", { location: { origin: "https://box4.atlas-support.se" } });
    const storage = installStorage([
      ["chat_session_id", "session_owned_elsewhere"],
      ["chat_owner_token", "stale_owner_token"],
    ]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => '{"error":"Invalid session token"}',
      })
      .mockImplementationOnce(async (_url, request) => {
        const recoverySessionId = JSON.parse(request.body as string).sessionId;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            answer: "Support och felhantering",
            presentation: "Så här fungerar support och felhantering.",
            source_ids: { fact_id: 42 },
            values: { answer: "Support och felhantering" },
            ownerToken: "fresh_owner_token",
            sessionId: recoverySessionId,
          }),
        };
      });
    vi.stubGlobal("fetch", fetchMock);
    const { answerStandardSelfservice } = await import("./atlas-client");
    const action = {
      type: "fact" as const,
      unit_id: "bosses_kundtjanst",
      category_id: "OVRIGA_FRAGOR",
      fact_id: 42,
    };

    const result = await answerStandardSelfservice(
      action,
      { canRecoverSession: () => true }
    );

    expect(result.presentation).toBe("Så här fungerar support och felhantering.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject({
      sessionId: "session_owned_elsewhere",
      ownerToken: "stale_owner_token",
      action,
    });
    const recoveredBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(recoveredBody.sessionId).not.toBe("session_owned_elsewhere");
    expect(recoveredBody).not.toHaveProperty("ownerToken");
    expect(storage.get("chat_session_id")).toBe(recoveredBody.sessionId);
    expect(storage.get("chat_owner_token")).toBe("fresh_owner_token");
    expect(storage.get("chat_owner_token_session_id")).toBe(recoveredBody.sessionId);
  });

  it("does not spend a doomed request when a stored session has no owner token", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      location: { origin: "https://box4.atlas-support.se" },
      setTimeout,
      clearTimeout,
    });
    installStorage([["chat_session_id", "session_missing_token"]]);
    const fetchMock = vi.fn().mockImplementation(async (_url, request) => {
      const recoverySessionId = JSON.parse(request.body as string).sessionId;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          answer: "Svar",
          presentation: "Levererat svar",
          ownerToken: "fresh_owner_token",
          sessionId: recoverySessionId,
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const { answerStandardSelfservice } = await import("./atlas-client");
    const pending = answerStandardSelfservice({
      type: "fact",
      unit_id: "bosses_kundtjanst",
      category_id: "OVRIGA_FRAGOR",
      fact_id: 42,
    }, { canRecoverSession: () => true });

    await vi.advanceTimersByTimeAsync(751);
    const result = await pending;

    expect(result.presentation).toBe("Levererat svar");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.sessionId).not.toBe("session_missing_token");
    expect(body).not.toHaveProperty("ownerToken");
  });

  it("keeps a wrong token blocked when session recovery is not safe", async () => {
    vi.resetModules();
    vi.stubGlobal("window", { location: { origin: "https://box4.atlas-support.se" } });
    const storage = installStorage([
      ["chat_session_id", "session_human_mode"],
      ["chat_owner_token", "wrong_owner_token"],
    ]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"error":"Invalid session token"}',
    });
    vi.stubGlobal("fetch", fetchMock);
    const { answerStandardSelfservice } = await import("./atlas-client");

    await expect(answerStandardSelfservice({
      type: "fact",
      unit_id: "bosses_kundtjanst",
      category_id: "OVRIGA_FRAGOR",
      fact_id: 42,
    }, { canRecoverSession: () => false })).rejects.toThrow("Selfservice answer error 401");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(storage.get("chat_session_id")).toBe("session_human_mode");
    expect(storage.get("chat_owner_token")).toBe("wrong_owner_token");
  });

  it("retries ownership recovery only once", async () => {
    vi.resetModules();
    vi.stubGlobal("window", { location: { origin: "https://box4.atlas-support.se" } });
    installStorage([
      ["chat_session_id", "session_wrong_token"],
      ["chat_owner_token", "wrong_owner_token"],
    ]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"error":"Invalid session token"}',
    });
    vi.stubGlobal("fetch", fetchMock);
    const { answerStandardSelfservice } = await import("./atlas-client");

    await expect(answerStandardSelfservice({
      type: "fact",
      unit_id: "bosses_kundtjanst",
      category_id: "OVRIGA_FRAGOR",
      fact_id: 42,
    }, { canRecoverSession: () => true })).rejects.toThrow("Selfservice answer error 401");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a token explicitly bound to a different stored session", async () => {
    vi.resetModules();
    vi.stubGlobal("window", { location: { origin: "https://box4.atlas-support.se" } });
    const storage = installStorage([
      ["chat_session_id", "session_current"],
      ["chat_owner_token", "owner_for_old_session"],
      ["chat_owner_token_session_id", "session_old"],
    ]);
    const { getOwnerToken } = await import("./atlas-client");

    expect(getOwnerToken()).toBeNull();
    expect(storage.has("chat_owner_token")).toBe(false);
    expect(storage.has("chat_owner_token_session_id")).toBe(false);
  });
});
