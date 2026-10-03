import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import type { PluggableList } from "unified";

export const chatMarkdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "img", "span", "div", "figure", "figcaption",
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
  },
};

export const chatMarkdownRehypePlugins: PluggableList = [
  rehypeRaw,
  [rehypeSanitize, chatMarkdownSanitizeSchema],
];

export function parseChatMarkdown(markdown: string): unknown {
  const processor = unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, chatMarkdownSanitizeSchema);
  return processor.runSync(processor.parse(markdown));
}
