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
vehicle: "BIL" | "MC" | "AM" | "LASTBIL"; 
}

interface NameInputDialogProps {
open: boolean;
onOpenChange: (open: boolean) => void;
onConfirm: (contactInfo: ContactInfo) => void;
defaultCity?: string | null;      
defaultVehicle?: "BIL" | "MC" | "AM" | "LASTBIL" | null;
offices: any[]; // 🔥 TILLAGD: Tar emot listan från AtlasChat.tsx
}

export function NameInputDialog({ open, onOpenChange, onConfirm, defaultCity, defaultVehicle, offices }: NameInputDialogProps) {
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
if (!city) newErrors.city = "Vänligen välj kontor";
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
vehicle: vehicle as "BIL" | "MC" | "AM" | "LASTBIL",
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
Välj kontor och fyll i dina uppgifter för att starta chatten.
</DialogDescription>
</DialogHeader>

<form onSubmit={handleSubmit} className="space-y-4">
<div className="space-y-2">
<Label className="flex items-center gap-2"><User className="h-4 w-4" /> Namn *</Label>
<Input 
value={name} 
onChange={(e) => setName(e.target.value)} 
placeholder="Ditt namn" 
className={errors.name ? "border-destructive" : ""} 
/>
{errors.name && <p className="text-[10px] text-destructive font-medium ml-1">{errors.name}</p>}
</div>

<div className="space-y-2">
<Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> E-post *</Label>
<Input 
type="email" 
value={email} 
onChange={(e) => setEmail(e.target.value)} 
placeholder="din.email@exempel.se" 
className={errors.email ? "border-destructive" : ""} 
/>
{errors.email && <p className="text-[10px] text-destructive font-medium ml-1">{errors.email}</p>}
</div>

{/* 🔥 DIN BEVARADE TELEFON-STATE NU KOPPLAD TILL INPUT */}
<div className="space-y-2">
<Label className="flex items-center gap-2"><Phone className="h-4 w-4" /> Telefon (valfritt)</Label>
<Input 
type="tel" 
value={phone} 
onChange={(e) => setPhone(e.target.value)} 
placeholder="070-000 00 00" 
/>
</div>

{/* KONTOR: Välj vilket kontor ärendet skickas till */}
<div className="space-y-2">
<Label className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Kontor *</Label>
<Select value={city} onValueChange={(v) => setCity(v)}>
<SelectTrigger className={errors.city ? "border-destructive" : ""}>
<SelectValue placeholder="Välj kontor" />
</SelectTrigger>
<SelectContent className="max-h-[400px]">
<SelectGroup>
<SelectLabel className="text-primary font-bold border-b pb-1">Välj kontor</SelectLabel>
<SelectItem value="Centralsupport" className="font-semibold italic">Centralsupport (Inkorgen)</SelectItem>

{/* 🚀 Dynamisk loop: Renderar kontoren från databasen (ERSÄTTER ALLA GRUPPERADE STÄDER) */}
{offices.map((office) => (
<SelectItem key={office.id} value={office.name}>
{office.name}
</SelectItem>
))}

</SelectGroup>
</SelectContent>
</Select>
{errors.city && <p className="text-[10px] text-destructive font-medium ml-1">{errors.city}</p>}
</div>

{/* FORDONSTYP: DIN BEVARADE CAR-IKON OCH LABEL */}
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
<SelectItem value="LASTBIL">Lastbil / Buss</SelectItem>
</SelectContent>
</Select>
{errors.vehicle && <p className="text-[10px] text-destructive font-medium ml-1">{errors.vehicle}</p>}
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