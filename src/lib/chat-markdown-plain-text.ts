import { unified } from "unified";
import remarkParse from "remark-parse";

type MarkdownNode = {
  type?: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
};

const parser = unified().use(remarkParse);

function compactInline(text: string): string {
  return text.replace(/[ \t\n\r]+/g, " ").trim();
}

function renderInline(node: MarkdownNode): string {
  switch (node.type) {
    case "text":
    case "inlineCode":
    case "code":
      return node.value || "";
    case "break":
      return "\n";
    case "link": {
      const label = compactInline(renderInlineChildren(node));
      const url = String(node.url || "").trim();
      if (/^https?:\/\//i.test(url)) return `${label} (${url})`;
      return label;
    }
    case "image":
      return node.value || "";
    default:
      return renderInlineChildren(node);
  }
}

function renderInlineChildren(node: MarkdownNode): string {
  return (node.children || []).map(renderInline).join("");
}

function renderBlock(node: MarkdownNode): string[] {
  switch (node.type) {
    case "root":
      return (node.children || []).flatMap(renderBlock);
    case "paragraph":
    case "heading":
      return [compactInline(renderInlineChildren(node))].filter(Boolean);
    case "list":
      return (node.children || []).flatMap(renderBlock);
    case "listItem": {
      const text = compactInline((node.children || []).flatMap(renderBlock).join(" "));
      return text ? [`• ${text}`] : [];
    }
    case "blockquote":
      return (node.children || []).flatMap(renderBlock);
    case "thematicBreak":
      return [];
    default: {
      const text = compactInline(renderInline(node));
      return text ? [text] : [];
    }
  }
}

export function renderChatMarkdownPlainText(markdown: string): string {
  const tree = parser.parse(markdown) as MarkdownNode;
  return renderBlock(tree).join("\n").trim();
}
