import { useState, useEffect, useRef } from "react";
import { Mail, MapPin, Car, Phone, Paperclip, X, Loader2, FileText, Image } from "lucide-react";
import {
Dialog,
DialogContent,
DialogDescription,
DialogHeader,
DialogTitle,
DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
Select,
SelectContent,
SelectGroup,
SelectItem,
SelectLabel,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
Tooltip,
TooltipContent,
TooltipTrigger,
} from "@/components/ui/tooltip";
import {
ALLOWED_ATTACHMENT_MIME_TYPES,
HTML_IMAGE_PASTE_MESSAGE,
MAX_ATTACHMENT_FILES,
MAX_ATTACHMENT_FILE_SIZE_MB,
MAX_CUSTOMER_MESSAGE_LENGTH,
clipboardHasHtmlContent,
clipboardHasHtmlImages,
clipboardHasText,
getClipboardFiles,
sanitizeHtmlPasteForAiMode,
usePendingAttachments,
} from "@/lib/pending-attachments";
import type { ActiveVehicle } from "@/lib/atlas-client";

interface ContactFormDialogProps {
onSubmit?: (data: any) => void;
selectedCity?: string | null;
selectedVehicle?: string | null;
generalMode?: boolean;
offices: any[];
activeVehicles: ActiveVehicle[];
}

const DEFAULT_CITY = "Centralsupport";
const DEFAULT_VEHICLE = "BIL";
const GENERAL_VEHICLE_VALUE = "OVRIGT";
const HTML_IMAGE_PASTE_TOAST_ID = "atlas-form-html-image-paste";
const VEHICLE_OPTIONS: { value: ActiveVehicle | typeof GENERAL_VEHICLE_VALUE; label: string }[] = [
{ value: GENERAL_VEHICLE_VALUE, label: "Övrigt / Allmän fråga" },
{ value: "BIL", label: "Bil (B)" },
{ value: "MC", label: "Motorcykel (A)" },
{ value: "AM", label: "Moped (AM)" },
{ value: "LASTBIL", label: "Lastbil / Buss" },
{ value: "SLÄP", label: "Släp (BE/B96)" },
];

const getOfficeDisplayName = (office: any) => {
const city = String(office?.city || '').trim();
const area = String(office?.area || '').trim();
return String(office?.display_name || (city ? (area ? `${city} - ${area}` : city) : '') || office?.name || '').trim();
};

const normalizeOfficeLabel = (value: string | null | undefined) =>
String(value || '').trim().replace(/[\u2013\u2014]/g, '-').replace(/\s*-\s*/g, ' - ').toLowerCase();

const splitCityArea = (value: string | null | undefined) => {
const normalized = String(value || '').trim();
const parts = normalized.replace(/[\u2013\u2014]/g, '-').split(/\s+-\s+/);
return parts.length === 2
? { city: parts[0].trim(), area: parts[1].trim() }
: { city: normalized, area: null };
};

const findSafeOfficeByLabel = (offices: any[], value: string | null | undefined) => {
const normalized = normalizeOfficeLabel(value);
if (!normalized) return undefined;

const matches = offices.filter((office) => [office.routing_tag, office.name, getOfficeDisplayName(office)]
.some((candidate) => normalizeOfficeLabel(candidate) === normalized));
if (matches.length === 1) return matches[0];

const { city, area } = splitCityArea(value);
if (!city || !area) return undefined;
const exactMatches = offices.filter((office) =>
normalizeOfficeLabel(office.city) === normalizeOfficeLabel(city) &&
normalizeOfficeLabel(office.area) === normalizeOfficeLabel(area)
);
return exactMatches.length === 1 ? exactMatches[0] : undefined;
};

export function ContactFormDialog({ onSubmit, selectedCity, selectedVehicle, generalMode = false, offices, activeVehicles }: ContactFormDialogProps) {
const [open, setOpen] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);
const [wantsCallback, setWantsCallback] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);
const {
attachments,
activeAttachmentCount,
isUploading,
validAttachments,
addFiles,
removeAttachment,
clearAttachments,
} = usePendingAttachments({ endpoint: "/api/customer/upload" });

const [formData, setFormData] = useState({
name: "",
email: "",
phone: "",
subject: "",
message: "",
city: "",
vehicle: "",
});
const singletonOfficeLabel = offices.length === 1 ? getOfficeDisplayName(offices[0]) : null;
useEffect(() => {
if (open) {
const fallbackVehicle = activeVehicles.includes(DEFAULT_VEHICLE) ? DEFAULT_VEHICLE : activeVehicles[0] || DEFAULT_VEHICLE;
const nextVehicle = generalMode ? GENERAL_VEHICLE_VALUE : (activeVehicles.includes(selectedVehicle as ActiveVehicle) ? selectedVehicle : fallbackVehicle);
setFormData(prev => ({
...prev,
phone: "",
city: selectedCity || singletonOfficeLabel || DEFAULT_CITY,
vehicle: nextVehicle,
}));
setWantsCallback(false);
}
}, [open, selectedCity, selectedVehicle, generalMode, activeVehicles, singletonOfficeLabel]);

const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
const files = e.target.files;
if (!files?.length) return;
void addFiles(files);
if (fileInputRef.current) fileInputRef.current.value = "";
};

const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
if (!formData.name.trim() || !formData.email.trim() || !formData.city || !formData.vehicle || !formData.message.trim()) {
toast.error("Vänligen fyll i alla obligatoriska fält (*)");
return;
}
if (isUploading) {
toast.error("Vänta tills alla filer är uppladdade");
return;
}

setIsSubmitting(true);
try {
const selectedOffice = findSafeOfficeByLabel(offices, formData.city);
const targetAgentId = selectedOffice ? selectedOffice.routing_tag : null;
const split = splitCityArea(formData.city);
const routingCity = selectedOffice ? selectedOffice.city : (formData.city === DEFAULT_CITY ? DEFAULT_CITY : (split.city || null));
const routingArea = selectedOffice ? selectedOffice.area : split.area;
const phoneDigits = wantsCallback ? formData.phone.trim() : "";
const isGeneralVehicle = formData.vehicle === GENERAL_VEHICLE_VALUE;
const { phone: _phone, vehicle: _vehicle, ...formDataWithoutPhone } = formData;

const response = await fetch("/api/customer/message-form", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
...formDataWithoutPhone,
vehicle: isGeneralVehicle ? "" : formData.vehicle,
...(isGeneralVehicle ? { vehicle_choice: GENERAL_VEHICLE_VALUE } : {}),
...(phoneDigits ? { phone: phoneDigits } : {}),
agent_id: targetAgentId,
city: routingCity,
area: routingArea,
attachments: validAttachments.map(a => ({
name: a.name,
url: a.url,
filename: a.filename,
isImage: a.isImage,
})),
}),
});

if (!response.ok) throw new Error("Failed to send");
toast.success("Tack! Ditt meddelande har skickats.");
setOpen(false);
setFormData({ name: "", email: "", phone: "", subject: "", message: "", city: "", vehicle: "" });
setWantsCallback(false);
clearAttachments();
} catch (error) {
toast.error("Något gick fel. Försök igen senare.");
} finally {
setIsSubmitting(false);
}
};

const insertMessageAtSelection = (target: HTMLTextAreaElement, text: string) => {
if (!text) return;
const start = target.selectionStart ?? target.value.length;
const end = target.selectionEnd ?? target.value.length;
const next = `${target.value.slice(0, start)}${text}${target.value.slice(end)}`
.slice(0, MAX_CUSTOMER_MESSAGE_LENGTH);
const nextCursor = Math.min(start + text.length, next.length);
setFormData((prev) => ({ ...prev, message: next }));
requestAnimationFrame(() => {
target.focus();
target.setSelectionRange(nextCursor, nextCursor);
});
};

const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
const pastedFiles = getClipboardFiles(e.clipboardData);
if (!pastedFiles.length) {
if (clipboardHasHtmlContent(e.clipboardData)) {
e.preventDefault();
const { text, removedImages } = sanitizeHtmlPasteForAiMode(e.clipboardData);
if (text) insertMessageAtSelection(e.currentTarget, text);
if (removedImages || clipboardHasHtmlImages(e.clipboardData)) {
toast.info(HTML_IMAGE_PASTE_MESSAGE, { id: HTML_IMAGE_PASTE_TOAST_ID });
}
}
return;
}

if (!clipboardHasText(e.clipboardData)) {
e.preventDefault();
}

void addFiles(pastedFiles);
};

const isFormValid =
formData.name.trim() &&
formData.email.trim() &&
formData.city !== "" &&
formData.vehicle !== "" &&
formData.message.trim() &&
!isUploading;

const formHasContent = Boolean(
formData.name.trim() ||
formData.email.trim() ||
formData.phone.trim() ||
formData.subject.trim() ||
formData.message.trim() ||
attachments.length > 0
);

return (
<Dialog open={open} onOpenChange={setOpen}>
<Tooltip>
<TooltipTrigger asChild>
<DialogTrigger asChild>
<button className="p-1.5 sm:p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
<Mail className="w-5 h-5" />
</button>
</DialogTrigger>
</TooltipTrigger>
<TooltipContent><p>Skicka meddelande</p></TooltipContent>
</Tooltip>

<DialogContent
onInteractOutside={(e) => { if (formHasContent) e.preventDefault(); }}
onEscapeKeyDown={(e) => { if (formHasContent) e.preventDefault(); }}
className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto chat-scrollbar p-4 sm:p-6"
>
<DialogHeader className="pr-6 text-left">
<DialogTitle>Skicka meddelande</DialogTitle>
<DialogDescription>Fyll i formuläret nedan för att skicka ett meddelande till oss.</DialogDescription>
</DialogHeader>

<form onSubmit={handleSubmit} className="space-y-4 text-foreground">
<div className="grid grid-cols-1 min-[460px]:grid-cols-2 gap-4">
<div className="space-y-2">
<Label>Namn *</Label>
<Input
placeholder="Ditt namn"
value={formData.name}
onChange={(e) => setFormData({ ...formData, name: e.target.value })}
maxLength={100}
required
/>
</div>
<div className="space-y-2">
<Label>E-post *</Label>
<Input
type="email"
placeholder="din.email@exempel.se"
value={formData.email}
onChange={(e) => setFormData({ ...formData, email: e.target.value })}
maxLength={200}
required
/>
</div>
</div>

<div className="space-y-2 rounded-lg border border-border/70 bg-muted/35 px-3 py-2">
<div className="flex items-start gap-2">
<Checkbox
id="callback-opt-in"
checked={wantsCallback}
onCheckedChange={(checked) => {
const enabled = checked === true;
setWantsCallback(enabled);
if (!enabled) setFormData({ ...formData, phone: "" });
}}
className="mt-0.5"
/>
<Label htmlFor="callback-opt-in" className="flex cursor-pointer items-center gap-2 leading-snug">
<Phone className="h-4 w-4 shrink-0" />
Jag vill bli uppringd
</Label>
</div>
{wantsCallback && (
<Input
type="tel"
placeholder="0701234567"
value={formData.phone}
onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
maxLength={14}
aria-label="Telefonnummer"
/>
)}
</div>

<div className="space-y-2">
<Label className="flex items-center gap-2 font-bold text-primary"><MapPin className="h-4 w-4" /> Kontor *</Label>
{singletonOfficeLabel ? (
<div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{singletonOfficeLabel}</div>
) : (
<Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
<SelectTrigger><SelectValue placeholder="Välj kontor" /></SelectTrigger>
<SelectContent className="max-h-[min(60vh,400px)]">
<SelectGroup>
<SelectLabel className="text-primary font-bold border-b pb-1">Global</SelectLabel>
<SelectItem value="Centralsupport" className="font-bold">Centralsupport (Huvudinkorgen)</SelectItem>
</SelectGroup>
<SelectGroup>
<SelectLabel className="font-bold border-t mt-2 pt-2">Välj Kontor</SelectLabel>
{offices.map((office) => (
<SelectItem key={office.id} value={getOfficeDisplayName(office)}>{getOfficeDisplayName(office)}</SelectItem>
))}
</SelectGroup>
</SelectContent>
</Select>
)}
</div>

<div className="space-y-2">
<Label className="flex items-center gap-2 font-bold text-primary"><Car className="h-4 w-4" /> Fordon *</Label>
<Select value={formData.vehicle} onValueChange={(v) => setFormData({ ...formData, vehicle: v })}>
<SelectTrigger><SelectValue placeholder="Välj fordonstyp" /></SelectTrigger>
<SelectContent className="max-w-[calc(100vw-1rem)]">
{VEHICLE_OPTIONS.filter((option) => option.value === GENERAL_VEHICLE_VALUE || activeVehicles.includes(option.value as ActiveVehicle)).map((option) => (
<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
))}
</SelectContent>
</Select>
</div>

<Textarea
placeholder="Meddelande *"
value={formData.message}
onChange={(e) => setFormData({ ...formData, message: e.target.value })}
onPaste={handlePaste}
rows={4}
className="resize-none"
maxLength={MAX_CUSTOMER_MESSAGE_LENGTH}
/>

<div className="space-y-2">
{attachments.length > 0 && (
<ul className="space-y-1.5" data-testid="contact-form-attachments">
{attachments.map((a) => (
<li
key={a.tempId}
className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 border ${
  a.error
	? "border-destructive/40 bg-destructive/10 text-destructive"
	: "border-border bg-muted/40"
}`}
>
{a.isImage && a.previewUrl ? (
  <img src={a.previewUrl} alt={a.name} className="h-12 w-12 shrink-0 rounded border border-border object-cover" />
) : a.uploading ? (
  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
) : a.isImage ? (
  <Image className="h-4 w-4 shrink-0 text-primary" />
) : (
  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
)}
<span className="min-w-0 flex-1 truncate">
  {a.uploading ? `Laddar upp ${a.name}…` : a.error ? `${a.name} — ${a.error}` : a.name}
</span>
<button
  type="button"
  onClick={() => removeAttachment(a.tempId)}
  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
  aria-label={`Ta bort ${a.name}`}
>
  <X className="h-3.5 w-3.5" />
</button>
</li>
))}
</ul>
)}

{activeAttachmentCount < MAX_ATTACHMENT_FILES && (
<button
type="button"
onClick={() => fileInputRef.current?.click()}
disabled={isUploading}
className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1 text-left"
>
<Paperclip className="h-4 w-4 shrink-0" />
{attachments.length === 0 ? "Bifoga fil eller bild" : "Lägg till fler filer"}
<span className="text-xs opacity-60">
({activeAttachmentCount}/{MAX_ATTACHMENT_FILES}, max {MAX_ATTACHMENT_FILE_SIZE_MB} MB/st)
</span>
</button>
)}

<input
ref={fileInputRef}
type="file"
multiple
accept={ALLOWED_ATTACHMENT_MIME_TYPES.join(",")}
onChange={handleFileSelect}
className="hidden"
/>
</div>

{/* GDPR-information vid insamlingspunkten — relativ länk => boxens egen /privacy */}
<p className="text-xs text-muted-foreground/70 leading-snug">
Genom att skicka godkänner du att vi behandlar dina uppgifter enligt vår{" "}
<a
href="/privacy"
target="_blank"
rel="noopener noreferrer"
className="underline underline-offset-2 hover:text-foreground transition-colors"
>
integritetspolicy
</a>.
</p>

<div className="flex flex-col-reverse min-[420px]:flex-row min-[420px]:justify-end gap-2 pt-2">
<Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting} className="w-full min-[420px]:w-auto">
Avbryt
</Button>
<Button type="submit" disabled={!isFormValid || isSubmitting} className="w-full min-[420px]:w-auto">
{isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Skickar…</> : "Skicka Mail"}
</Button>
</div>
</form>
</DialogContent>
</Dialog>
);
}
