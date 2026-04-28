import {
AlertDialog,
AlertDialogAction,
AlertDialogCancel,
AlertDialogContent,
AlertDialogDescription,
AlertDialogFooter,
AlertDialogHeader,
AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatMessage {
id: string;
role: 'user' | 'assistant';
content: string;
timestamp: Date;
}

interface EndSessionDialogProps {
open: boolean;
onOpenChange: (open: boolean) => void;
messages: ChatMessage[];
onConfirm: () => void;
closeReason?: string | null;
}

function getCloseReasonText(closeReason?: string | null): string {
if (closeReason === 'inactivity') {
  return 'Konversationen avslutades automatiskt på grund av inaktivitet. Vill du spara en kopia innan du stänger?';
}
if (closeReason && closeReason.startsWith('agent:')) {
  return 'Handläggaren har avslutat denna konversation. Vill du spara en kopia innan du stänger?';
}
if (closeReason === 'customer') {
  return 'Du avslutade konversationen. Vill du spara en kopia av chatten innan du stänger?';
}
return 'Konversationen är avslutad. Vill du spara en kopia innan du stänger?';
}

export function EndSessionDialog({ open, onOpenChange, messages, onConfirm, closeReason = null }: EndSessionDialogProps) {

const generateChatLog = (): string => {
const header = `Atlas Chattlogg
Datum: ${new Date().toLocaleDateString('sv-SE')}
Tid: ${new Date().toLocaleTimeString('sv-SE')}
${'='.repeat(50)}

`;

const messageLog = messages.map(msg => {
const time = msg.timestamp.toLocaleTimeString('sv-SE', { 
hour: '2-digit', 
minute: '2-digit' 
});
const sender = msg.role === 'user' ? 'Du' : 'Atlas';
// Remove markdown formatting for plain text
const cleanContent = msg.content
.replace(/\*\*(.*?)\*\*/g, '$1')
.replace(/\*(.*?)\*/g, '$1')
.replace(/^- /gm, '• ');

return `[${time}] ${sender}:\n${cleanContent}\n`;
}).join('\n');

const footer = `
${'='.repeat(50)}
Slut på chattlogg`;

return header + messageLog + footer;
};

const handleDownload = () => {
const log = generateChatLog();
const blob = new Blob([log], { type: 'text/plain;charset=utf-8' });
const url = URL.createObjectURL(blob);

const a = document.createElement('a');
a.href = url;
a.download = `atlas-chatt-${new Date().toISOString().split('T')[0]}.txt`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);

onConfirm();
};

const handleCloseWithoutDownload = () => {
onConfirm();
};

return (
<AlertDialog open={open} onOpenChange={onOpenChange}>
<AlertDialogContent className="sm:max-w-lg border-border/50 shadow-xl">
<AlertDialogHeader className="text-center sm:text-left">
<div className="mx-auto sm:mx-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
<Download className="w-6 h-6 text-primary" />
</div>
<AlertDialogTitle className="text-xl font-semibold">
Ärendet avslutat
</AlertDialogTitle>
<AlertDialogDescription className="text-muted-foreground">
{getCloseReasonText(closeReason)}
</AlertDialogDescription>
</AlertDialogHeader>

<AlertDialogFooter className="flex-col gap-3 sm:flex-row sm:gap-2 mt-4">
<AlertDialogCancel className="sm:flex-1 order-3 sm:order-1">
Avbryt
</AlertDialogCancel>
<Button
variant="ghost"
onClick={handleCloseWithoutDownload}
className="gap-2 sm:flex-1 order-2 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
>
<X className="w-4 h-4" />
Stäng utan att spara
</Button>
<Button
onClick={handleDownload}
className="gap-2 sm:flex-1 order-1 sm:order-3 bg-primary hover:bg-primary/90"
>
<Download className="w-4 h-4" />
Ladda ner logg
</Button>
</AlertDialogFooter>
</AlertDialogContent>
</AlertDialog>
);
}
