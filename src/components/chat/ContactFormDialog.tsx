import { useState, useEffect } from "react";
import { Mail, MapPin, Car, Phone } from "lucide-react";
import {
Dialog,
DialogContent,
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
SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import {
Tooltip,
TooltipContent,
TooltipTrigger,
} from "@/components/ui/tooltip";

interface ContactFormDialogProps {
onSubmit?: (data: any) => void;
selectedCity?: string | null;
selectedVehicle?: string | null;
offices: any[]; // 🔥 TILLAGD
}

export function ContactFormDialog({ onSubmit, selectedCity, selectedVehicle, offices }: ContactFormDialogProps) {
const [open, setOpen] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);

// 1. VIKTIGT: State måste deklareras INNAN useEffect använder det
const [formData, setFormData] = useState({
name: "",
email: "",
phone: "",
subject: "",
message: "",
city: "",
vehicle: "",
});

// 2. Synka formuläret med chattens val när rutan öppnas
useEffect(() => {
if (open) {
setFormData(prev => ({
...prev,
// Använd chattens val om formuläret saknar värde, annars behåll det användaren skrivit
city: selectedCity || prev.city || "",
vehicle: selectedVehicle || prev.vehicle || ""
}));
}
}, [open, selectedCity, selectedVehicle]);

const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
if (!formData.name.trim() || !formData.email.trim() || !formData.city || !formData.vehicle) {
toast.error("Vänligen fyll i alla obligatoriska fält (*)");
return;
}
setIsSubmitting(true);

try {
// Hitta kontoret i den dynamiska listan för att få rätt routing-tagg och RAG-kontext
const selectedOffice = offices.find(o => o.name === formData.city);
const targetAgentId = selectedOffice ? selectedOffice.routing_tag : null; // null = centralsupport/huvudinkorg

const routingCity = selectedOffice ? selectedOffice.city : null;
const routingArea = selectedOffice ? selectedOffice.area : null;

const response = await fetch("/api/customer/message-form", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
...formData,
agent_id: targetAgentId, // 🔥 Skickas för routing till rätt agentmapp
city: routingCity,
area: routingArea,
}),
});

if (!response.ok) throw new Error("Failed to send");
toast.success("Tack! Ditt meddelande har skickats.");
setOpen(false);
setFormData({ name: "", email: "", phone: "", subject: "", message: "", city: "", vehicle: "" });
} catch (error) {
toast.error("Något gick fel. Försök igen senare.");
} finally {
setIsSubmitting(false);
}
};

const isFormValid = formData.name.trim() && formData.email.trim() && formData.city !== "" && formData.vehicle !== "";

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
<DialogHeader><DialogTitle>Skicka meddelande</DialogTitle></DialogHeader>
<form onSubmit={handleSubmit} className="space-y-4 text-foreground">
<div className="grid grid-cols-2 gap-4">
<div className="space-y-2">
<Label>Namn *</Label>
<Input placeholder="Ditt namn" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
</div>
<div className="space-y-2">
<Label>E-post *</Label>
<Input type="email" placeholder="din.email@exempel.se" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
</div>
</div>

<div className="space-y-2">
<Label className="flex items-center gap-2"><Phone className="h-4 w-4" /> Telefon</Label>
<Input type="tel" placeholder="070-123 45 67 (valfritt)" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
</div>

<div className="space-y-2">
<Label className="flex items-center gap-2 font-bold text-primary"><MapPin className="h-4 w-4" /> Kontor *</Label>
<Select value={formData.city} onValueChange={(v) => setFormData({...formData, city: v})}>
<SelectTrigger><SelectValue placeholder="Välj kontor" /></SelectTrigger>
<SelectContent className="max-h-[400px]">
<SelectGroup>
<SelectLabel className="text-primary font-bold border-b pb-1">Global</SelectLabel>
<SelectItem value="Centralsupport" className="font-bold">Centralsupport (Huvudinkorgen)</SelectItem>
</SelectGroup>
<SelectGroup>
<SelectLabel className="font-bold border-t mt-2 pt-2">📍 Välj Kontor</SelectLabel>
{/* 🚀 Dynamisk loop över kontoren från databasen (Atlas 4.0) */}
{offices.map((office) => (
<SelectItem key={office.id} value={office.name}>
{office.name}
</SelectItem>
))}
</SelectGroup>
</SelectContent>
</Select>
</div>

<div className="space-y-2">
<Label className="flex items-center gap-2 font-bold text-primary"><Car className="h-4 w-4" /> Fordon *</Label>
<Select value={formData.vehicle} onValueChange={(v) => setFormData({...formData, vehicle: v})}>
<SelectTrigger><SelectValue placeholder="Välj fordonstyp" /></SelectTrigger>
<SelectContent>
<SelectItem value="BIL">Bil (B)</SelectItem>
<SelectItem value="MC">Motorcykel (A)</SelectItem>
<SelectItem value="AM">Moped (AM)</SelectItem>
<SelectItem value="LASTBIL">Lastbil / Buss</SelectItem>
</SelectContent>
</Select>
</div>

<Textarea placeholder="Meddelande" value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})} rows={4} className="resize-none" />
<div className="flex justify-end gap-2 pt-2">
<Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>Avbryt</Button>
<Button type="submit" disabled={!isFormValid || isSubmitting}>Skicka Mail</Button>
</div>
</form>
</DialogContent>
</Dialog>
);
}