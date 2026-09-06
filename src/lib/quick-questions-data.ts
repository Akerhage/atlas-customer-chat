import type { ActiveVehicle } from "./atlas-client";

export interface QuestionCategory {
category: string;
questions: string[];
actions?: QuickQuestionAction[];
/** Explicit answer context. Null means general; undefined preserves legacy selection context. */
vehicleContext?: ActiveVehicle | null;
}

export interface QuickQuestionAction {
label: string;
value: string;
}

export const COMMON_QUESTIONS: QuestionCategory[] = [
{
category: "Populära frågor",
questions: [
"Vilka betalningsalternativ finns?",
"Hur lång tid tar det att ta körkort för bil?",
],
},
{
category: "Betalning & Avbokning",
questions: [
"Erbjuder ni delbetalning eller avbetalning?",
"Vad gäller om jag blir sjuk och måste avboka?",
"När måste jag senast avboka en körlektion?",
"Hur fungerar ångerrätten?",
],
},
{
category: "Tillstånd & Regler",
questions: [
"Hur ansöker jag om körkortstillstånd?",
"Hur länge gäller ett körkortstillstånd?",
"Krävs läkarintyg för att ta körkort?",
"Får man ha passagerare när man övningskör?",
],
},
];
