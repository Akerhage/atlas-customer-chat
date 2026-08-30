import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const atlasChatSource = readFileSync(new URL("./AtlasChat.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const atlasClientSource = readFileSync(new URL("../../lib/atlas-client.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function sourceBlock(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start, `missing start marker ${startMarker}`).toBeGreaterThanOrEqual(0);
  expect(end, `missing end marker ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("AtlasChat history assignment sync", () => {
  it("carries assigned agent display name through the history response", () => {
    expect(atlasClientSource).toContain("assigned_agent_name?: string | null;");

    const responseBlock = sourceBlock(
      atlasClientSource,
      "return {\nmessages: data.messages || [],",
      "};\n}",
    );
    expect(responseBlock).toContain("assigned_agent_name: typeof data.assigned_agent_name === 'string' ? data.assigned_agent_name : null,");
  });

  it("syncs the human-mode status name from history polling", () => {
    const pollHistoryBlock = sourceBlock(
      atlasChatSource,
      "const pollHistory = useCallback(async (options: PollHistoryOptions = {}) => {",
      "// Check if session is archived",
    );

    expect(pollHistoryBlock).toContain("const historyAssignedAgentName =");
    expect(pollHistoryBlock).toContain("history.assigned_agent_name.trim()");
    expect(pollHistoryBlock).toContain("setAssignedAgentName(history.human_mode ? historyAssignedAgentName : null);");
    expect(pollHistoryBlock).toContain("setAgentNames(history.human_mode && historyAssignedAgentName ? [historyAssignedAgentName] : []);");
  });
});
