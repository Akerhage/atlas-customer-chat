import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Paperclip, Loader2, X, FileText, Image } from "lucide-react";
import { cn } from "@/lib/utils";
import { emitTyping, getSessionId } from "@/lib/atlas-client";
import type { ActiveVehicle } from "@/lib/atlas-client";
import { QuickQuestionsButton } from "./QuickQuestionsButton";
import { toast } from "sonner";
import {
AI_ATTACHMENT_BLOCKED_MESSAGE,
ALLOWED_ATTACHMENT_MIME_TYPES,
HTML_IMAGE_PASTE_MESSAGE,
MAX_ATTACHMENT_FILES,
MAX_ATTACHMENT_FILE_SIZE_MB,
appendAttachmentMarkdown,
clipboardHasFilesOrImages,
clipboardHasHtmlImages,
clipboardHasText,
getClipboardFiles,
sanitizeHtmlPasteForAiMode,
usePendingAttachments,
} from "@/lib/pending-attachments";

type VehicleType = ActiveVehicle | null;

interface ChatInputProps {
onSend: (message: string, context?: { vehicle: string; city: string }) => void;
disabled?: boolean;
placeholder?: string;
showQuickQuestions?: boolean;
selectedVehicle?: VehicleType;
selectedCity?: string | null;
onVehicleChange: (vehicle: VehicleType) => void;
onCityChange: (city: string | null) => void;
offices: any[];
humanMode: boolean;
aiRepliesEnabled?: boolean;
activeVehicles: ActiveVehicle[];
quickQuestions: string[];
}

const TYPING_THROTTLE_MS = 2000;
const AI_ATTACHMENT_BLOCKED_TOAST_ID = "atlas-ai-attachment-blocked";
const HTML_IMAGE_PASTE_TOAST_ID = "atlas-html-image-paste";

export function ChatInput({
onSend,
disabled = false,
placeholder = "Skriv ett meddelande...",
showQuickQuestions = false,
selectedVehicle = null,
selectedCity = null,
onVehicleChange,
onCityChange,
offices,
humanMode,
aiRepliesEnabled = true,
activeVehicles,
quickQuestions
}: ChatInputProps) {
const [message, setMessage] = useState("");
const textareaRef = useRef<HTMLTextAreaElement>(null);
const lastTypingTimeRef = useRef<number>(0);
const fileInputRef = useRef<HTMLInputElement>(null);
const {
attachments,
activeAttachmentCount,
isUploading,
validAttachments,
addFiles,
removeAttachment,
clearAttachments,
} = usePendingAttachments({
endpoint: "/api/upload",
getSessionId,
});

// Refocus when disabled flips from true to false. When `disabled={isTyping}`
// toggles while AI answers, the browser removes focus from the textarea.
const wasDisabledRef = useRef(disabled);
useEffect(() => {
if (wasDisabledRef.current && !disabled) {
textareaRef.current?.focus();
}
wasDisabledRef.current = disabled;
}, [disabled]);

const handleTyping = useCallback(() => {
const now = Date.now();
if (now - lastTypingTimeRef.current > TYPING_THROTTLE_MS) {
emitTyping();
lastTypingTimeRef.current = now;
}
}, []);

useEffect(() => {
const textarea = textareaRef.current;
if (textarea) {
textarea.style.height = "auto";
textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
}
}, [message]);

const handleSubmit = () => {
if (disabled || isUploading) return;

const trimmed = message.trim();
const outboundMessage = appendAttachmentMarkdown(trimmed, validAttachments);
if (!outboundMessage) return;

onSend(outboundMessage);
setMessage("");
clearAttachments();
if (textareaRef.current) {
textareaRef.current.style.height = "auto";
textareaRef.current.focus();
}
};

const handleKeyDown = (e: React.KeyboardEvent) => {
if (e.key === "Enter" && !e.shiftKey) {
e.preventDefault();
handleSubmit();
}
};

const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
const files = e.target.files;
if (!humanMode || !files?.length) return;
void addFiles(files);
if (fileInputRef.current) fileInputRef.current.value = "";
};

const insertTextAtSelection = (target: HTMLTextAreaElement, text: string) => {
if (!text) return;

const start = target.selectionStart ?? target.value.length;
const end = target.selectionEnd ?? target.value.length;
const nextMessage = `${target.value.slice(0, start)}${text}${target.value.slice(end)}`;
const nextCursor = start + text.length;
setMessage(nextMessage);
if (text.trim()) handleTyping();

requestAnimationFrame(() => {
const textarea = textareaRef.current;
if (!textarea) return;
textarea.focus();
textarea.setSelectionRange(nextCursor, nextCursor);
});
};

const showAiAttachmentBlockedToast = () => {
toast.info(AI_ATTACHMENT_BLOCKED_MESSAGE, {
id: AI_ATTACHMENT_BLOCKED_TOAST_ID,
});
};

const showHtmlImagePasteToast = () => {
toast.info(HTML_IMAGE_PASTE_MESSAGE, {
id: HTML_IMAGE_PASTE_TOAST_ID,
});
};

const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
if (!humanMode) {
if (!clipboardHasFilesOrImages(e.clipboardData)) return;

e.preventDefault();
const { text } = sanitizeHtmlPasteForAiMode(e.clipboardData);
insertTextAtSelection(e.currentTarget, text);
showAiAttachmentBlockedToast();
return;
}

const pastedFiles = getClipboardFiles(e.clipboardData);
if (!pastedFiles.length) {
if (clipboardHasHtmlImages(e.clipboardData)) {
showHtmlImagePasteToast();
}
return;
}

if (!clipboardHasText(e.clipboardData)) {
e.preventDefault();
}

void addFiles(pastedFiles);
};

const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
if (humanMode || !clipboardHasFilesOrImages(e.dataTransfer)) return;

e.preventDefault();
const { text } = sanitizeHtmlPasteForAiMode(e.dataTransfer);
insertTextAtSelection(e.currentTarget, text);
showAiAttachmentBlockedToast();
};

const canSend = !disabled && !isUploading && Boolean(message.trim() || validAttachments.length);

return (
<div className="p-4 bg-chat-input border-t border-border">
{humanMode && attachments.length > 0 && (
<div className="mb-2 space-y-1.5" data-testid="chat-input-attachments">
{attachments.map((attachment) => (
<div
key={attachment.tempId}
className={cn(
"flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
attachment.error ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-secondary/40"
)}
>
{attachment.isImage && attachment.previewUrl ? (
<img src={attachment.previewUrl} alt={attachment.name} className="h-12 w-12 shrink-0 rounded border border-border object-cover" />
) : attachment.uploading ? (
<Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
) : attachment.isImage ? (
<Image className="h-4 w-4 shrink-0 text-primary" />
) : (
<FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
)}
<span className="min-w-0 flex-1 truncate">
{attachment.uploading ? `Laddar upp ${attachment.name}...` : attachment.error ? `${attachment.name} - ${attachment.error}` : attachment.name}
</span>
<button
type="button"
onClick={() => removeAttachment(attachment.tempId)}
className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
aria-label={`Ta bort ${attachment.name}`}
>
<X className="h-3.5 w-3.5" />
</button>
</div>
))}
</div>
)}

<div className={cn("flex items-end gap-2 bg-secondary/50 rounded-2xl px-4 py-2 border border-border/50 transition-all duration-200 focus-within:border-primary/30 input-glow")}>
{humanMode && (
<input
type="file"
ref={fileInputRef}
className="hidden"
onChange={handleFileSelect}
accept={ALLOWED_ATTACHMENT_MIME_TYPES.join(",")}
multiple
disabled={disabled || isUploading || activeAttachmentCount >= MAX_ATTACHMENT_FILES}
/>
)}

{humanMode && (
<button
type="button"
onClick={() => fileInputRef.current?.click()}
disabled={disabled || isUploading || activeAttachmentCount >= MAX_ATTACHMENT_FILES}
className={cn("flex-shrink-0 w-8 h-8 -ml-1 mb-0.5 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors duration-200", isUploading && "cursor-wait opacity-70")}
title={`Bifoga fil eller bild (max ${MAX_ATTACHMENT_FILES}, ${MAX_ATTACHMENT_FILE_SIZE_MB} MB/st)`}
>
{isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
</button>
)}

<textarea
ref={textareaRef}
value={message}
onChange={(e) => { setMessage(e.target.value); if (e.target.value.trim()) handleTyping(); }}
onKeyDown={handleKeyDown}
onPaste={handlePaste}
onDrop={handleDrop}
placeholder={placeholder}
disabled={disabled}
rows={1}
className="flex-1 resize-none bg-transparent text-sm py-2 text-foreground focus:outline-none min-h-[24px] max-h-[120px] chat-input-scrollbar"
/>

{showQuickQuestions && !isUploading && (
<QuickQuestionsButton
onSendMessage={onSend}
selectedVehicle={selectedVehicle}
selectedCity={selectedCity}
onVehicleChange={onVehicleChange}
onCityChange={onCityChange}
disabled={disabled}
offices={offices}
activeVehicles={activeVehicles}
quickQuestions={quickQuestions}
/>
)}

<button
type="button"
onClick={handleSubmit}
disabled={!canSend}
className={cn("flex-shrink-0 w-9 h-9 rounded-xl mb-0.5 flex items-center justify-center transition-all duration-200", canSend ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow" : "bg-muted text-muted-foreground cursor-not-allowed")}
>
<Send className="w-4 h-4" />
</button>
</div>
{aiRepliesEnabled && !humanMode && (
<p className="text-[11px] text-muted-foreground/50 text-center mt-2">
Atlas AI kan ibland ge felaktiga svar. Kontrollera alltid viktig information med en handläggare.
</p>
)}
</div>
);
}
