export function shouldRestoreTextareaFocus(
  wasDisabled: boolean,
  disabled: boolean,
  submittedFromTextarea: boolean
): boolean {
  return wasDisabled && !disabled && submittedFromTextarea;
}
