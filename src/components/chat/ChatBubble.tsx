import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { Car, User } from "lucide-react";

// Tillåt formaterings-taggar och bilder men blockera script och on*-attribut.
// Utökar defaultSchema så att befintliga markdown-element (a, strong, em osv)
// och mallinnehåll (img, inline styles) renderas korrekt.
const sanitizeSchema = {
...defaultSchema,
tagNames: [
...(defaultSchema.tagNames ?? []),
'img', 'span', 'div', 'figure', 'figcaption',
],
attributes: {
...defaultSchema.attributes,
'*': ['style', 'className', 'class'],
'a': ['href', 'target', 'rel'],
'img': ['src', 'alt', 'width', 'height', 'style'],
},
};

interface ChatBubbleProps {
content: string;
isUser: boolean;
timestamp?: Date;
isLatest?: boolean;
senderName?: string | null;
}

export function ChatBubble({ content, isUser, timestamp, isLatest, senderName }: ChatBubbleProps) {
// Visa agentens namn om angivet, annars "Atlas" för AI-svar
const displayName = isUser ? 'Du' : (senderName || 'Atlas');

return (
<div
className={cn(
"flex w-full",
isUser ? "justify-end" : "justify-start",
isLatest && "animate-fade-in-up"
)}
>
<div
className={cn(
"max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-bubble",
"transition-all duration-200",
isUser
? "bg-bubble-user-bg text-bubble-user-text bubble-shadow-user rounded-br-md"
: "bg-bubble-atlas-bg text-bubble-atlas-text border border-bubble-atlas-border bubble-shadow-atlas rounded-bl-md"
)}
>
{/* Avatar */}
<div className={cn("flex items-center gap-2 mb-1.5", isUser && "justify-end")}>
{isUser ? (
<>
<span className="text-xs font-medium text-primary-foreground/70">{displayName}</span>
<div className="w-5 h-5 rounded-full bg-primary-foreground/20 flex items-center justify-center">
<User className="w-3 h-3 text-primary-foreground/80" />
</div>
</>
) : (
<>
<div className="w-5 h-5 rounded-full bg-red-500/15 flex items-center justify-center">
<Car className="w-3 h-3 text-red-500" />
</div>
<span className="text-xs font-medium text-muted-foreground">{displayName}</span>
</>
)}
</div>

{/* Message content */}
<div className="text-sm leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-strong:font-semibold">
<ReactMarkdown
className="atlas-message-content"
rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
components={{
a: ({ node, ...props }) => (
<a {...props} target="_blank" rel="noopener noreferrer" />
),
}}
>
{content}
</ReactMarkdown>
</div>

{/* Timestamp with date */}
{timestamp && (
<p
className={cn(
"text-[10px] mt-1.5 opacity-60",
isUser ? "text-right" : "text-left"
)}
>
{timestamp.toLocaleDateString('sv-SE', {
day: 'numeric',
month: 'short',
})}{' '}
{timestamp.toLocaleTimeString('sv-SE', {
hour: '2-digit',
minute: '2-digit',
})}
</p>
)}
</div>
</div>
);
}