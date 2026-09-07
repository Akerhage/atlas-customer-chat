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
