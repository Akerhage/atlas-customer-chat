import { User, CheckCircle, Clock } from "lucide-react";

type HumanStatus = 'waiting' | 'assigned' | 'active';

interface HumanModeIndicatorProps {
agentNames?: string[];
assignedAgentName?: string | null;
status?: HumanStatus;
}

function formatAgentNames(names: string[]): string {
if (names.length === 0) return '';
if (names.length === 1) return names[0];
if (names.length === 2) return `${names[0]} och ${names[1]}`;
return `${names.slice(0, -1).join(', ')} och ${names[names.length - 1]}`;
}

export function HumanModeIndicator({
agentNames = [],
assignedAgentName = null,
status,
}: HumanModeIndicatorProps) {
const resolvedStatus: HumanStatus =
status ?? (assignedAgentName ? 'active' : agentNames.length > 0 ? 'active' : 'waiting');

if (resolvedStatus === 'assigned') {
return (
<div className="px-4 py-2 bg-primary/10 border-b border-primary/20">
<div className="flex items-center gap-2 text-sm text-primary">
<CheckCircle className="w-4 h-4" />
<span className="font-medium">
{`Tilldelad: ${assignedAgentName || 'handläggare'}`}
</span>
<span className="ml-auto text-xs text-primary/70 animate-pulse">
Inväntar svar...
</span>
</div>
</div>
);
}

if (resolvedStatus === 'waiting') {
return (
<div className="px-4 py-2 bg-primary/10 border-b border-primary/20">
<div className="flex items-center gap-2 text-sm text-primary">
<Clock className="w-4 h-4" />
<span className="font-medium">Inväntar handläggare</span>
<span className="ml-auto text-xs text-primary/70 animate-pulse">
Köar...
</span>
</div>
</div>
);
}

const formattedNames = assignedAgentName || formatAgentNames(agentNames);
return (
<div className="px-4 py-2 bg-primary/10 border-b border-primary/20">
<div className="flex items-center gap-2 text-sm text-primary">
<User className="w-4 h-4" />
<span className="font-medium">
{formattedNames
? `Du pratar nu med ${formattedNames}`
: 'Du pratar nu med support'}
</span>
</div>
</div>
);
}
