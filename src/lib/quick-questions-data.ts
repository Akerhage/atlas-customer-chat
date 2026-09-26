import type { ActiveVehicle } from "./atlas-client";

export interface QuestionCategory {
category: string;
questions: string[];
questionRefs?: Array<QuickQuestionRef | null>;
actions?: QuickQuestionAction[];
/** Explicit answer context. Null means general; undefined preserves legacy selection context. */
vehicleContext?: ActiveVehicle | null;
}

export interface QuickQuestionAction {
label: string;
value: string;
}

export interface QuickQuestionRef {
text: string;
section_ref?: Array<{ file: string; id: string }>;
service_ref?: { service_id: string };
}
