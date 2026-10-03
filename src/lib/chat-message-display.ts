export type DisplayChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type HistoryMessage = {
  role: "user" | "atlas" | "agent";
  content: string;
  timestamp?: number | string | null;
};

function historyRole(role: HistoryMessage["role"]): DisplayChatMessage["role"] {
  return role === "user" ? "user" : "assistant";
}

function validStoredTimestamp(value: HistoryMessage["timestamp"]): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function mapHistoryMessages(
  history: HistoryMessage[],
  previous: DisplayChatMessage[],
  now: () => Date = () => new Date(),
): DisplayChatMessage[] {
  return history.map((message, index) => {
    const role = historyRole(message.role);
    const existing = previous.find((candidate) => candidate.content === message.content && candidate.role === role);
    return {
      id: existing?.id || `history_${index}_${now().getTime()}`,
      role,
      content: message.content,
      timestamp: validStoredTimestamp(message.timestamp) || existing?.timestamp || now(),
    };
  });
}

export function buildDisplayMessages<T extends Pick<DisplayChatMessage, "role" | "content">>(
  messages: T[],
  displayUserContent: (value: string) => string,
): T[] {
  return messages.map((message) => message.role === "user"
    ? { ...message, content: displayUserContent(message.content) }
    : message);
}

export function resolveArchivedMessage(closeReason: string | null | undefined): string {
  if (closeReason === "inactivity") return "Chatten har stängts automatiskt på grund av inaktivitet.";
  if (closeReason === "deleted") return "Chatten har avslutats.";
  if (closeReason === "customer" || closeReason?.startsWith("customer:")) return "Du avslutade chatten.";
  return "Chatten är avslutad av handläggaren.";
}
