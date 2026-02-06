import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Paperclip, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { emitTyping } from "@/lib/atlas-client";
import { QuickQuestionsButton } from "./QuickQuestionsButton";
import axios from "axios";
import { toast } from "sonner";

type VehicleType = "BIL" | "MC" | "AM" | null;

interface ChatInputProps {
onSend: (message: string, context?: { vehicle: string; city: string }) => void;
disabled?: boolean;
placeholder?: string;
showQuickQuestions?: boolean;
selectedVehicle?: VehicleType;
selectedCity?: string | null;
onVehicleChange: (vehicle: VehicleType) => void;
onCityChange: (city: string | null) => void;
offices: any[]; // 🔥 TILLAGD: Krävs för QuickQuestionsButton
}

const TYPING_THROTTLE_MS = 2000;

export function ChatInput({ 
onSend, 
disabled = false, 
placeholder = "Skriv ett meddelande...",
showQuickQuestions = false,
selectedVehicle = null,
selectedCity = null,
onVehicleChange,
onCityChange,
offices // 🔥 TILLAGD
}: ChatInputProps) {
const [message, setMessage] = useState("");
const [isUploading, setIsUploading] = useState(false);
const textareaRef = useRef<HTMLTextAreaElement>(null);
const lastTypingTimeRef = useRef<number>(0);
const fileInputRef = useRef<HTMLInputElement>(null);

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
const trimmed = message.trim();
if (trimmed && !disabled && !isUploading) {
onSend(trimmed);
setMessage("");
if (textareaRef.current) textareaRef.current.style.height = "auto";
}
};

const handleKeyDown = (e: React.KeyboardEvent) => {
if (e.key === "Enter" && !e.shiftKey) {
e.preventDefault();
handleSubmit();
}
};

const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
const file = e.target.files?.[0];
if (!file) return;
if (file.size > 10 * 1024 * 1024) {
toast.error("Filen är för stor (Max 10MB)");
return;
}
setIsUploading(true);
const formData = new FormData();
formData.append("file", file);
try {
const res = await axios.post('/api/upload', formData, {
headers: { "Content-Type": "multipart/form-data" },
});
if (res.data.success) {
let fileLink = file.type.startsWith("image/") ? `![Bild](${res.data.url})` : `📎 [Fil: ${file.name}](${res.data.url})`;
onSend(fileLink);
toast.success("Fil skickad!");
}
} catch (error) {
toast.error("Kunde inte ladda upp filen.");
} finally {
setIsUploading(false);
if (fileInputRef.current) fileInputRef.current.value = "";
}
};

return (
<div className="p-4 bg-chat-input border-t border-border">
<div className={cn("flex items-end gap-2 bg-secondary/50 rounded-2xl px-4 py-2 border border-border/50 transition-all duration-200 focus-within:border-primary/30 input-glow")}>
<input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,.pdf,.doc,.docx,.txt" disabled={disabled || isUploading} />

<button onClick={() => fileInputRef.current?.click()} disabled={disabled || isUploading} className={cn("flex-shrink-0 w-8 h-8 -ml-1 mb-0.5 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors duration-200", isUploading && "cursor-wait opacity-70")}>
{isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
</button>

<textarea
ref={textareaRef}
value={message}
onChange={(e) => { setMessage(e.target.value); if (e.target.value.trim()) handleTyping(); }}
onKeyDown={handleKeyDown}
placeholder={isUploading ? "Laddar upp..." : placeholder}
disabled={disabled || isUploading}
rows={1}
className="flex-1 resize-none bg-transparent text-sm py-2 text-foreground focus:outline-none min-h-[24px] max-h-[120px]"
/>

{/* 🚀 SKICKAS VIDARE HÄR */}
{showQuickQuestions && !isUploading && (
<QuickQuestionsButton
onSendMessage={onSend}
selectedVehicle={selectedVehicle}
selectedCity={selectedCity}
onVehicleChange={onVehicleChange}
onCityChange={onCityChange}
disabled={disabled}
offices={offices} 
/>
)}

<button onClick={handleSubmit} disabled={disabled || !message.trim() || isUploading} className={cn("flex-shrink-0 w-9 h-9 rounded-xl mb-0.5 flex items-center justify-center transition-all duration-200", message.trim() && !disabled && !isUploading ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow" : "bg-muted text-muted-foreground cursor-not-allowed")}>
<Send className="w-4 h-4" />
</button>
</div>
<p className="text-[11px] text-muted-foreground/50 text-center mt-2">Tryck Enter för att skicka · Shift+Enter för ny rad</p>
</div>
);
}