interface TypingIndicatorProps {
agentName?: string | null;
}

export function TypingIndicator({ agentName }: TypingIndicatorProps = {}) {
return (
<div className="flex justify-start animate-fade-in-up">
<div className="bg-bubble-atlas-bg border border-bubble-atlas-border rounded-bubble rounded-bl-md px-4 py-3 bubble-shadow-atlas">
<div className="flex items-center gap-2">
{/* Avatar */}
<div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
<svg
className="w-3 h-3 text-primary animate-pulse-soft"
fill="none"
viewBox="0 0 24 24"
stroke="currentColor"
strokeWidth={2}
>
<path
strokeLinecap="round"
strokeLinejoin="round"
d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
/>
</svg>
</div>

{agentName && (
<span className="text-xs text-muted-foreground font-medium">{agentName} skriver</span>
)}

{/* Typing dots */}
<div className="flex items-center gap-1">
<div className="w-2 h-2 rounded-full bg-typing-dot typing-dot" />
<div className="w-2 h-2 rounded-full bg-typing-dot typing-dot" />
<div className="w-2 h-2 rounded-full bg-typing-dot typing-dot" />
</div>
</div>
</div>
</div>
);
}
