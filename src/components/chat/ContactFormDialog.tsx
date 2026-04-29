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

interface Attachment {
name: string;
url: string;
filename: string;
isImage: boolean;
uploading?: boolean;
error?: string;
tempId: string;
}

interface ContactFormDialogProps {
onSubmit?: (data: any) => void;
selectedCity?: string | null;
selectedVehicle?: string | null;
offices: any[];
}

const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 10;
const ALLOWED_MIME = [
"image/jpeg", "image/png", "image/gif", "image/webp",
"application/pdf",
"application/msword",
"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
"application/vnd.ms-excel",
"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
"application/vnd.ms-powerpoint",
"application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

const getOfficeDisplayName = (office: any) => {
const city = String(office?.city || '').trim();
const area = String(office?.area || '').trim();
return String(office?.display_name || (city ? (area ? `${city} - ${area}` : city) : '') || office?.name || '').trim();
};

const normalizeOfficeLabel = (value: string | null | undefined) =>
String(value || '').trim().replace(/[\u2013\u2014]/g, '-').replace(/\s*-\s*/g, ' - ').toLowerCase();

const findOfficeByLabel = (offices: any[], value: string | null | undefined) => {
const normalized = normalizeOfficeLabel(value);
return offices.find((office) => [office.routing_tag, office.name, getOfficeDisplayName(office)]
.some((candidate) => normalizeOfficeLabel(candidate) === normalized));
};

export function ContactFormDialog({ onSubmit, selectedCity, selectedVehicle, offices }: ContactFormDialogProps) {
const [open, setOpen] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);
const [attachments, setAttachments] = useState<Attachment[]>([]);
const fileInputRef = useRef<HTMLInputElement>(null);

const [formData, setFormData] = useState({
name: "",
email: "",
phone: "",
subject: "",
message: "",
city: "",
vehicle: "",
});

useEffect(() => {
if (open) {
setFormData(prev => ({
...prev,
city: selectedCity || prev.city || "",
vehicle: selectedVehicle || prev.vehicle || "",
}));
}
}, [open, selectedCity, selectedVehicle]);

const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
const files = Array.from(e.target.files || []);
if (!files.length) return;

// Reset input so same file can be re-selected if removed
if (fileInputRef.current) fileInputRef.current.value = "";

const remaining = MAX_FILES - attachments.filter(a => !a.error).length;
if (remaining <= 0) {
toast.error(`Max ${MAX_FILES} filer tillåtna`);
return;
}

const toUpload = files.slice(0, remaining);
if (files.length > remaining) {
toast.warning(`Bara ${remaining} fler fil(er) kan läggas till (max ${MAX_FILES})`);
}

for (const file of toUpload) {
if (!ALLOWED_MIME.includes(file.type)) {
toast.error(`Filtypen stöds inte: ${file.name}`);
continue;
}
if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
toast.error(`${file.name} är för stor (max ${MAX_FILE_SIZE_MB} MB)`);
continue;
}

const tempId = crypto.randomUUID();
const isImage = file.type.startsWith("image/");

// Add placeholder with loading state
setAttachments(prev => [...prev, {
tempId,
name: file.name,
url: "",
filename: "",
isImage,
uploading: true,
}]);

try {
const formPayload = new FormData();
formPayload.append("file", file);

const res = await fetch("/api/customer/upload", {
method: "POST",
body: formPayload,
});

if (!res.ok) {
const err = await res.json().catch(() => ({}));
throw new Error(err.error || "Upload misslyckades");
}

const data = await res.json();

setAttachments(prev => prev.map(a =>
a.tempId === tempId
? { ...a, url: data.url, filename: data.filename, uploading: false }
: a
));
} catch (err: any) {
setAttachments(prev => prev.map(a =>
a.tempId === tempId
? { ...a, uploading: false, error: err.message || "Fel vid uppladdning" }
: a
));
toast.error(`Kunde inte ladda upp ${file.name}`);
}
}
};

const removeAttachment = (tempId: string) => {
setAttachments(prev => prev.filter(a => a.tempId !== tempId));
};

const isUploading = attachments.some(a => a.uploading);
const validAttachments = attachments.filter(a => !a.uploading && !a.error);

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
const selectedOffice = findOfficeByLabel(offices, formData.city);
const targetAgentId = selectedOffice ? selectedOffice.routing_tag : null;
const routingCity = selectedOffice ? selectedOffice.city : null;
const routingArea = selectedOffice ? selectedOffice.area : null;

const response = await fetch("/api/customer/message-form", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
...formData,
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
setAttachments([]);
} catch (error) {
toast.error("Något gick fel. Försök igen senare.");
} finally {
setIsSubmitting(false);
}
};

const isFormValid =
formData.name.trim() &&
formData.email.trim() &&
formData.city !== "" &&
formData.vehicle !== "" &&
formData.message.trim() &&
!isUploading;

return (
<Dialog open={open} onOpenChange={setOpen}>
<Tooltip>
<TooltipTrigger asChild>
<DialogTrigger asChild>
<button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
<Mail className="w-5 h-5" />
</button>
</DialogTrigger>
</TooltipTrigger>
<TooltipContent><p>Skicka meddelande</p></TooltipContent>
</Tooltip>

<DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
<DialogHeader>
<DialogTitle>Skicka meddelande</DialogTitle>
<DialogDescription>Fyll i formuläret nedan för att skicka ett meddelande till oss.</DialogDescription>
</DialogHeader>

<form onSubmit={handleSubmit} className="space-y-4 text-foreground">
<div className="grid grid-cols-2 gap-4">
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

<div className="space-y-2">
<Label className="flex items-center gap-2"><Phone className="h-4 w-4" /> Telefon</Label>
<Input
type="tel"
placeholder="0701234567 (valfritt)"
value={formData.phone}
onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
maxLength={10}
/>
</div>

<div className="space-y-2">
<Label className="flex items-center gap-2 font-bold text-primary"><MapPin className="h-4 w-4" /> Kontor *</Label>
<Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
<SelectTrigger><SelectValue placeholder="Välj kontor" /></SelectTrigger>
<SelectContent className="max-h-[400px]">
<SelectGroup>
<SelectLabel className="text-primary font-bold border-b pb-1">Global</SelectLabel>
<SelectItem value="Centralsupport" className="font-bold">Centralsupport (Huvudinkorgen)</SelectItem>
</SelectGroup>
<SelectGroup>
<SelectLabel className="font-bold border-t mt-2 pt-2">📍 Välj Kontor</SelectLabel>
{offices.map((office) => (
<SelectItem key={office.id} value={getOfficeDisplayName(office)}>{getOfficeDisplayName(office)}</SelectItem>
))}
</SelectGroup>
</SelectContent>
</Select>
</div>

<div className="space-y-2">
<Label className="flex items-center gap-2 font-bold text-primary"><Car className="h-4 w-4" /> Fordon *</Label>
<Select value={formData.vehicle} onValueChange={(v) => setFormData({ ...formData, vehicle: v })}>
<SelectTrigger><SelectValue placeholder="Välj fordonstyp" /></SelectTrigger>
<SelectContent>
<SelectItem value="BIL">Bil (B)</SelectItem>
<SelectItem value="MC">Motorcykel (A)</SelectItem>
<SelectItem value="AM">Moped (AM)</SelectItem>
<SelectItem value="LASTBIL">Lastbil / Buss</SelectItem>
</SelectContent>
</Select>
</div>

<Textarea
placeholder="Meddelande *"
value={formData.message}
onChange={(e) => setFormData({ ...formData, message: e.target.value })}
onPaste={(e) => {
const imageFiles = Array.from(e.clipboardData.files).filter(file => file.type.startsWith("image/"));
if (!imageFiles.length) return;

e.preventDefault();
const dataTransfer = new DataTransfer();
imageFiles.forEach(file => dataTransfer.items.add(file));

const pasteInput = document.createElement("input");
pasteInput.type = "file";
pasteInput.multiple = true;
pasteInput.files = dataTransfer.files;

void handleFileSelect({ target: pasteInput } as React.ChangeEvent<HTMLInputElement>);
}}
rows={4}
className="resize-none"
maxLength={2000}
/>

{/* ── Bilagor ── */}
<div className="space-y-2">
{attachments.length > 0 && (
<ul className="space-y-1.5">
{attachments.map((a) => (
<li
key={a.tempId}
className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 border ${
  a.error
	? "border-destructive/40 bg-destructive/10 text-destructive"
	: "border-border bg-muted/40"
}`}
>
{a.uploading ? (
  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
) : a.isImage ? (
  <Image className="h-4 w-4 shrink-0 text-primary" />
) : (
  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
)}
<span className="flex-1 truncate">
  {a.uploading ? `Laddar upp ${a.name}…` : a.error ? `${a.name} — ${a.error}` : a.name}
</span>
<button
  type="button"
  onClick={() => removeAttachment(a.tempId)}
  className="text-muted-foreground hover:text-foreground transition-colors"
>
  <X className="h-3.5 w-3.5" />
</button>
</li>
))}
</ul>
)}

{attachments.filter(a => !a.error).length < MAX_FILES && (
<button
type="button"
onClick={() => fileInputRef.current?.click()}
disabled={isUploading}
className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
>
<Paperclip className="h-4 w-4" />
{attachments.length === 0 ? "Bifoga fil eller bild" : "Lägg till fler filer"}
<span className="text-xs opacity-60">
({attachments.filter(a => !a.error).length}/{MAX_FILES}, max {MAX_FILE_SIZE_MB} MB/st)
</span>
</button>
)}

<input
ref={fileInputRef}
type="file"
multiple
accept={ALLOWED_MIME.join(",")}
onChange={handleFileSelect}
className="hidden"
/>
</div>

<div className="flex justify-end gap-2 pt-2">
<Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
Avbryt
</Button>
<Button type="submit" disabled={!isFormValid || isSubmitting}>
{isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Skickar…</> : "Skicka Mail"}
</Button>
</div>
</form>
</DialogContent>
</Dialog>
);
}
