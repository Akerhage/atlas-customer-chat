import { parseChatMarkdown } from "./chat-markdown";

type MarkdownNode = {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: MarkdownNode[];
};

const BLOCK_TAGS = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "figure", "figcaption"]);

function renderNode(node: MarkdownNode): string {
  if (node.type === "text") return String(node.value || "").replace(/[\t\n\r ]+/g, " ");
  if (node.type !== "element" && node.type !== "root") return "";
  const tag = String(node.tagName || "").toLowerCase();
  if (tag === "br") return "\n";
  if (tag === "img") return String(node.properties?.alt || "");
  if (tag === "ul" || tag === "ol") {
    let index = Number(node.properties?.start || 1);
    return (node.children || []).map((child) => {
      if (child.type !== "element" || child.tagName !== "li") return renderNode(child);
      const marker = tag === "ol" ? `${index++}. ` : "• ";
      return `${marker}${renderChildren(child).trim()}\n`;
    }).join("");
  }
  const content = renderChildren(node);
  if (tag === "a") {
    const href = String(node.properties?.href || "").trim();
    return /^https?:\/\//i.test(href) ? `${content} (${href})` : content;
  }
  return BLOCK_TAGS.has(tag) ? `\n${content}\n` : content;
}

function renderChildren(node: MarkdownNode): string {
  return (node.children || []).map(renderNode).join("");
}

export function renderChatMarkdownPlainText(markdown: string): string {
  return renderNode(parseChatMarkdown(markdown) as MarkdownNode)
    .replace(/[\t\r ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
