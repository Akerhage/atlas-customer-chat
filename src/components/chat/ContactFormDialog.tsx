import { useState, useEffect } from "react";
import { Mail, MapPin, Car } from "lucide-react";
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
}

// 🔥 Hjälpfunktion för att matcha agenterna i atlas.db
const normalizeForAgent = (label: string): string => {
if (!label || label === "Centralsupport") return "centralsupport";
return label
.toLowerCase()
.replace(/å|ä/g, 'a')
.replace(/ö/g, 'o')
.replace(/\s*[–-]\s*/g, '_')
.replace(/\s+/g, '_')
.trim();
};

export function ContactFormDialog({ onSubmit, selectedCity, selectedVehicle }: ContactFormDialogProps) {
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
if (!formData.email.trim() || !formData.city || !formData.vehicle) {
toast.error("Vänligen fyll i alla obligatoriska fält (*)");
return;
}
setIsSubmitting(true);

try {
// 🔥 ROUTING: Skapa agent_id för att matcha create_agents.js
const targetAgentId = normalizeForAgent(formData.city);

let routingCity: string | null = null;
let routingArea: string | null = null;

if (formData.city !== "Centralsupport") {
const parts = formData.city.split(/ – | - /);
routingCity = parts[0].trim();
routingArea = parts.length === 2 ? parts[1].trim() : null;
}

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

const isFormValid = formData.email.trim() && formData.city !== "" && formData.vehicle !== "";

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
<Label>Namn</Label>
<Input placeholder="Ditt namn" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
</div>
<div className="space-y-2">
<Label>E-post *</Label>
<Input type="email" placeholder="din.email@exempel.se" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
</div>
</div>

<div className="space-y-2">
<Label className="flex items-center gap-2 font-bold text-primary"><MapPin className="h-4 w-4" /> Mottagare *</Label>
<Select value={formData.city} onValueChange={(v) => setFormData({...formData, city: v})}>
<SelectTrigger><SelectValue placeholder="Välj destination" /></SelectTrigger>
<SelectContent className="max-h-[400px]">
<SelectGroup>
<SelectLabel className="text-primary font-bold border-b pb-1">Global</SelectLabel>
<SelectItem value="Centralsupport" className="font-bold">Centralsupport (Huvudinkorgen)</SelectItem>
</SelectGroup>
<SelectGroup>
<SelectLabel className="font-bold border-t mt-2 pt-2">📍 Göteborg</SelectLabel>
<SelectItem value="Göteborg – Åby">Åby</SelectItem>
<SelectItem value="Göteborg – Dingle">Dingle</SelectItem>
<SelectItem value="Göteborg – Högsbo">Högsbo</SelectItem>
<SelectItem value="Göteborg – Hovås">Hovås</SelectItem>
<SelectItem value="Göteborg – Kungälv">Kungälv</SelectItem>
<SelectItem value="Göteborg – Mölndal">Mölndal</SelectItem>
<SelectItem value="Göteborg – Mölnlycke">Mölnlycke</SelectItem>
<SelectItem value="Göteborg – Stora Holm">Stora Holm</SelectItem>
<SelectItem value="Göteborg – Ullevi">Ullevi</SelectItem>
<SelectItem value="Göteborg – Västra Frölunda">Västra Frölunda</SelectItem>
</SelectGroup>
<SelectGroup>
<SelectLabel className="font-bold border-t mt-2 pt-2">📍 Stockholm</SelectLabel>
<SelectItem value="Stockholm – Djursholm">Djursholm</SelectItem>
<SelectItem value="Stockholm – Enskededalen">Enskededalen</SelectItem>
<SelectItem value="Stockholm – Kungsholmen">Kungsholmen</SelectItem>
<SelectItem value="Stockholm – Österåker">Österåker</SelectItem>
<SelectItem value="Stockholm – Östermalm">Östermalm</SelectItem>
<SelectItem value="Stockholm – Södermalm">Södermalm</SelectItem>
<SelectItem value="Stockholm – Solna">Solna</SelectItem>
</SelectGroup>
<SelectGroup>
<SelectLabel className="font-bold border-t mt-2 pt-2">📍 Malmö</SelectLabel>
<SelectItem value="Malmö – Bulltofta">Bulltofta</SelectItem>
<SelectItem value="Malmö – City">City</SelectItem>
<SelectItem value="Malmö – Limhamn">Limhamn</SelectItem>
<SelectItem value="Malmö – Södervärn">Södervärn</SelectItem>
<SelectItem value="Malmö – Triangeln">Triangeln</SelectItem>
<SelectItem value="Malmö – Värnhem">Värnhem</SelectItem>
<SelectItem value="Malmö – Västra Hamnen">Västra Hamnen</SelectItem>
</SelectGroup>
<SelectGroup>
<SelectLabel className="font-bold border-t mt-2 pt-2">📍 Övriga kontor</SelectLabel>
<SelectItem value="Lund – Katedral">Lund – Katedral</SelectItem>
<SelectItem value="Lund – Södertull">Lund – Södertull</SelectItem>
<SelectItem value="Helsingborg – City">Helsingborg – City</SelectItem>
<SelectItem value="Helsingborg – Hälsobacken">Helsingborg – Hälsobacken</SelectItem>
<SelectItem value="Ängelholm">Ängelholm</SelectItem>
<SelectItem value="Eslöv">Eslöv</SelectItem>
<SelectItem value="Gävle">Gävle</SelectItem>
<SelectItem value="Hässleholm">Hässleholm</SelectItem>
<SelectItem value="Höllviken">Höllviken</SelectItem>
<SelectItem value="Kalmar">Kalmar</SelectItem>
<SelectItem value="Kristianstad">Kristianstad</SelectItem>
<SelectItem value="Kungsbacka">Kungsbacka</SelectItem>
<SelectItem value="Landskrona">Landskrona</SelectItem>
<SelectItem value="Linköping">Linköping</SelectItem>
<SelectItem value="Trelleborg">Trelleborg</SelectItem>
<SelectItem value="Umeå">Umeå</SelectItem>
<SelectItem value="Uppsala">Uppsala</SelectItem>
<SelectItem value="Varberg">Varberg</SelectItem>
<SelectItem value="Västerås">Västerås</SelectItem>
<SelectItem value="Växjö">Växjö</SelectItem>
<SelectItem value="Vellinge">Vellinge</SelectItem>
<SelectItem value="Ystad">Ystad</SelectItem>
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