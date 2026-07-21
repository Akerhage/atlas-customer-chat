import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { Car, User } from "lucide-react";
import { resolveCategoryIcon } from "@/lib/category-icons";

// Tillåt markdown-formattering och bilder men blockera script, on*-attribut
// och fri inline-styling/classer som kan spräcka chatlayouten.
const sanitizeSchema = {
...defaultSchema,
tagNames: [
...(defaultSchema.tagNames ?? []),
'img', 'span', 'div', 'figure', 'figcaption',
],
attributes: {
...defaultSchema.attributes,
'a': ['href', 'target', 'rel'],
'img': ['src', 'alt', 'width', 'height'],
},
};

interface ChatBubbleProps {
content: string;
isUser: boolean;
timestamp?: Date;
isLatest?: boolean;
senderName?: string | null;
choices?: { label: string; value: string; icon?: string; fullWidth?: boolean }[];
onChoiceSelect?: (value: string) => void;
onRequestHuman?: () => void;
onOpenContactForm?: () => void;
}

export function ChatBubble({ content, isUser, timestamp, isLatest, senderName, choices, onChoiceSelect, onRequestHuman, onOpenContactForm }: ChatBubbleProps) {
// Visa agentens namn om angivet, annars "Atlas" för AI-svar
const displayName = isUser ? 'Du' : (senderName || 'Atlas');
const hasLargeChoiceSet = (choices?.length ?? 0) > 12;

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
"max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-bubble overflow-hidden",
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
<div className={cn(
"text-sm leading-relaxed max-w-none",
isUser
? "atlas-user-message"
: "atlas-bot-message"
)}>
<div className="atlas-message-content">
<ReactMarkdown
rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
components={{
a: ({ node, ...props }) => {
const href = typeof props.href === 'string' ? props.href : '';
if (href === '#atlas-human') {
return (
<a
{...props}
href={href}
onClick={(event) => {
event.preventDefault();
onRequestHuman?.();
}}
/>
);
}
if (href === '#atlas-contact') {
return (
<a
{...props}
href={href}
onClick={(event) => {
event.preventDefault();
onOpenContactForm?.();
}}
/>
);
}
return <a {...props} target="_blank" rel="noopener noreferrer" />;
},
}}
>
{content}
</ReactMarkdown>
</div>
</div>

{/* Quick-reply knappar för intake-flödet */}
{choices && choices.length > 0 && onChoiceSelect && (
<div className={cn(
"flex flex-wrap gap-2 mt-3",
hasLargeChoiceSet && "max-h-56 overflow-y-auto overscroll-contain pr-1 chat-choice-scrollbar"
)}>
{choices.map((choice) => {
const ChoiceIcon = choice.icon ? resolveCategoryIcon(choice.icon) : null;
return (
<button
key={choice.value}
onClick={() => onChoiceSelect(choice.value)}
className={cn(
"inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 active:scale-95 transition-all duration-150",
choice.fullWidth && "w-full justify-center text-center whitespace-normal"
)}
>
{ChoiceIcon && <ChoiceIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
{choice.label}
</button>
);
})}
</div>
)}

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
