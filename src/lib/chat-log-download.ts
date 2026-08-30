export interface ChatLogMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface DownloadDocument {
  body: {
    appendChild(node: Node): Node;
    removeChild(node: Node): Node;
  };
  createElement(tagName: "a"): HTMLAnchorElement;
}

interface DownloadUrlApi {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

interface DownloadChatLogOptions {
  now?: Date;
  document?: DownloadDocument;
  url?: DownloadUrlApi;
}

export function generateChatLog(messages: ChatLogMessage[], now = new Date()): string {
  const header = `Atlas Chattlogg
Datum: ${now.toLocaleDateString("sv-SE")}
Tid: ${now.toLocaleTimeString("sv-SE")}
${"=".repeat(50)}

`;

  const messageLog = messages.map((msg) => {
    const time = msg.timestamp.toLocaleTimeString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const sender = msg.role === "user" ? "Du" : "Atlas";
    const cleanContent = msg.content
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/^- /gm, "- ");

    return `[${time}] ${sender}:\n${cleanContent}\n`;
  }).join("\n");

  const footer = `
${"=".repeat(50)}
Slut på chattlogg`;

  return header + messageLog + footer;
}

export function downloadChatLog(messages: ChatLogMessage[], options: DownloadChatLogOptions = {}): void {
  const now = options.now ?? new Date();
  const documentRef = options.document ?? document;
  const urlApi = options.url ?? URL;
  const log = generateChatLog(messages, now);
  const blob = new Blob([log], { type: "text/plain;charset=utf-8" });
  const url = urlApi.createObjectURL(blob);

  const a = documentRef.createElement("a") as HTMLAnchorElement;
  a.href = url;
  a.download = `atlas-chatt-${now.toISOString().split("T")[0]}.txt`;
  documentRef.body.appendChild(a);
  a.click();
  documentRef.body.removeChild(a);
  urlApi.revokeObjectURL(url);
}
