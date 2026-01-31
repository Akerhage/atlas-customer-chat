import { useState, useEffect } from "react";
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { User, Mail, Phone, MapPin, Car } from "lucide-react";

export interface ContactInfo {
name: string;
email: string;
phone?: string;
city: string;      // För routing till rätt kontor
vehicle: "BIL" | "MC" | "AM"; 
}

interface NameInputDialogProps {
open: boolean;
onOpenChange: (open: boolean) => void;
onConfirm: (contactInfo: ContactInfo) => void;
defaultCity?: string | null;      // Från val i chatten
defaultVehicle?: "BIL" | "MC" | "AM" | null;
}

export function NameInputDialog({ open, onOpenChange, onConfirm, defaultCity, defaultVehicle }: NameInputDialogProps) {
const [name, setName] = useState("");
const [email, setEmail] = useState("");
const [phone, setPhone] = useState("");
const [city, setCity] = useState("");
const [vehicle, setVehicle] = useState<string>("");
const [errors, setErrors] = useState<{ name?: string; email?: string; city?: string; vehicle?: string }>({});

// 🔥 Synka förval när popupen öppnas så kunden slipper välja om
useEffect(() => {
if (open) {
if (defaultCity) setCity(defaultCity);
if (defaultVehicle) setVehicle(defaultVehicle);
}
}, [open, defaultCity, defaultVehicle]);

const validateEmail = (email: string): boolean => {
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
return emailRegex.test(email);
};

const handleSubmit = (e: React.FormEvent) => {
e.preventDefault();

const trimmedName = name.trim();
const trimmedEmail = email.trim();
const newErrors: any = {};

if (!trimmedName) newErrors.name = "Vänligen ange ditt namn";
if (!trimmedEmail || !validateEmail(trimmedEmail)) newErrors.email = "Vänligen ange en giltig e-postadress";
if (!city) newErrors.city = "Vänligen välj mottagare";
if (!vehicle) newErrors.vehicle = "Vänligen välj fordonstyp";

if (Object.keys(newErrors).length > 0) {
setErrors(newErrors);
return;
}

onConfirm({
name: trimmedName,
email: trimmedEmail,
phone: phone.trim() || undefined,
city: city, 
vehicle: vehicle as "BIL" | "MC" | "AM",
});

resetForm();
};

const resetForm = () => {
setName("");
setEmail("");
setPhone("");
setCity("");
setVehicle("");
setErrors({});
};

const handleClose = () => {
resetForm();
onOpenChange(false);
};

const isFormValid = name.trim().length >= 2 && validateEmail(email.trim()) && city !== "" && vehicle !== "";

return (
<Dialog open={open} onOpenChange={handleClose}>
<DialogContent className="sm:max-w-md">
<DialogHeader className="text-center sm:text-center">
<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
<User className="h-6 w-6 text-primary" />
</div>
<DialogTitle className="text-xl">Vem vill du prata med?</DialogTitle>
<DialogDescription className="text-base">
Välj destination och fyll i dina uppgifter för att starta chatten.
</DialogDescription>
</DialogHeader>

<form onSubmit={handleSubmit} className="space-y-4">
<div className="space-y-2">
<Label className="flex items-center gap-2"><User className="h-4 w-4" /> Namn *</Label>
<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ditt namn" />
</div>

<div className="space-y-2">
<Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> E-post *</Label>
<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="din.email@exempel.se" />
</div>

{/* MOTTAGARE: GRUPPERAD DROPDOWN (FLIKA UT STORSTÄDER) */}
<div className="space-y-2">
<Label className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Mottagare *</Label>
<Select value={city} onValueChange={(v) => setCity(v)}>
<SelectTrigger className={errors.city ? "border-destructive" : ""}>
<SelectValue placeholder="Välj destination" />
</SelectTrigger>
<SelectContent className="max-h-[400px]">
<SelectGroup>
<SelectLabel className="text-primary font-bold">Global</SelectLabel>
<SelectItem value="Centralsupport" className="font-bold">Centralsupport (Inkorgen)</SelectItem>
</SelectGroup>

<SelectGroup>
<SelectLabel className="text-muted-foreground mt-2 border-t pt-2 font-bold">📍 Göteborg</SelectLabel>
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
<SelectLabel className="text-muted-foreground mt-2 border-t pt-2 font-bold">📍 Stockholm</SelectLabel>
<SelectItem value="Stockholm – Djursholm">Djursholm</SelectItem>
<SelectItem value="Stockholm – Enskededalen">Enskededalen</SelectItem>
<SelectItem value="Stockholm – Kungsholmen">Kungsholmen</SelectItem>
<SelectItem value="Stockholm – Österåker">Österåker</SelectItem>
<SelectItem value="Stockholm – Östermalm">Östermalm</SelectItem>
<SelectItem value="Stockholm – Södermalm">Södermalm</SelectItem>
<SelectItem value="Stockholm – Solna">Solna</SelectItem>
</SelectGroup>

<SelectGroup>
<SelectLabel className="text-muted-foreground mt-2 border-t pt-2 font-bold">📍 Malmö</SelectLabel>
<SelectItem value="Malmö – Bulltofta">Bulltofta</SelectItem>
<SelectItem value="Malmö – City">City</SelectItem>
<SelectItem value="Malmö – Limhamn">Limhamn</SelectItem>
<SelectItem value="Malmö – Södervärn">Södervärn</SelectItem>
<SelectItem value="Malmö – Triangeln">Triangeln</SelectItem>
<SelectItem value="Malmö – Värnhem">Värnhem</SelectItem>
<SelectItem value="Malmö – Västra Hamnen">Västra Hamnen</SelectItem>
</SelectGroup>

<SelectGroup>
<SelectLabel className="text-muted-foreground mt-2 border-t pt-2 font-bold">📍 Lund & Helsingborg</SelectLabel>
<SelectItem value="Lund – Katedral">Lund – Katedral</SelectItem>
<SelectItem value="Lund – Södertull">Lund – Södertull</SelectItem>
<SelectItem value="Helsingborg – City">Helsingborg – City</SelectItem>
<SelectItem value="Helsingborg – Hälsobacken">Helsingborg – Hälsobacken</SelectItem>
</SelectGroup>

<SelectGroup>
<SelectLabel className="text-muted-foreground mt-2 border-t pt-2 font-bold">📍 Övriga kontor</SelectLabel>
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
<Label className="flex items-center gap-2"><Car className="h-4 w-4" /> Fordonstyp *</Label>
<Select value={vehicle} onValueChange={(v) => setVehicle(v)}>
<SelectTrigger className={errors.vehicle ? "border-destructive" : ""}>
<SelectValue placeholder="Välj fordon" />
</SelectTrigger>
<SelectContent>
<SelectItem value="BIL">Bil (B)</SelectItem>
<SelectItem value="MC">Motorcykel (A)</SelectItem>
<SelectItem value="AM">Moped (AM)</SelectItem>
</SelectContent>
</Select>
</div>

<DialogFooter className="gap-2 sm:gap-0">
<Button type="button" variant="outline" onClick={handleClose}>Avbryt</Button>
<Button type="submit" disabled={!isFormValid}>Starta chatt</Button>
</DialogFooter>
</form>
</DialogContent>
</Dialog>
);
}