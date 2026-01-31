import { User } from "lucide-react";

interface HumanModeIndicatorProps {
  agentName?: string | null;
}

export function HumanModeIndicator({ agentName }: HumanModeIndicatorProps) {
  return (
    <div className="px-4 py-2 bg-primary/10 border-b border-primary/20">
      <div className="flex items-center gap-2 text-sm text-primary">
        <User className="w-4 h-4" />
        <span className="font-medium">
          {agentName 
            ? `Du pratar nu med ${agentName}` 
            : 'Du pratar nu med support'}
        </span>
        {!agentName && (
          <span className="ml-auto text-xs text-primary/70 animate-pulse">
            Inväntar svar...
          </span>
        )}
      </div>
    </div>
  );
}
