import { User } from "lucide-react";

interface HumanModeIndicatorProps {
agentNames?: string[];
}

function formatAgentNames(names: string[]): string {
if (names.length === 0) return '';
if (names.length === 1) return names[0];
if (names.length === 2) return `${names[0]} och ${names[1]}`;
return `${names.slice(0, -1).join(', ')} och ${names[names.length - 1]}`;
}

export function HumanModeIndicator({ agentNames = [] }: HumanModeIndicatorProps) {
const hasAgents = agentNames.length > 0;
const formattedNames = formatAgentNames(agentNames);

return (
<div className="px-4 py-2 bg-primary/10 border-b border-primary/20">
<div className="flex items-center gap-2 text-sm text-primary">
<User className="w-4 h-4" />
<span className="font-medium">
{hasAgents
? `Du pratar nu med ${formattedNames}`
: 'Du pratar nu med support'}
</span>
{!hasAgents && (
<span className="ml-auto text-xs text-primary/70 animate-pulse">
Inväntar svar...
</span>
)}
</div>
</div>
);
}
