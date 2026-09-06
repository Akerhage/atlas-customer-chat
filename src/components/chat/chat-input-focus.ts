export type ChatSendSource = "textarea" | "quick-action" | "menu";

export function shouldRestoreFocusForSendSource(source: ChatSendSource): boolean {
  return source === "textarea";
}

export function shouldRestoreTextareaFocus(
  wasDisabled: boolean,
  disabled: boolean,
  submittedFromTextarea: boolean
): boolean {
  return wasDisabled && !disabled && submittedFromTextarea;
}
