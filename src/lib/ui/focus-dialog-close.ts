/** Focus the dialog/sheet close control on open (constrained 44×44 hit target). */
export function focusDialogCloseButton(container: EventTarget | null) {
  if (!container || typeof (container as Element).querySelector !== "function") return;
  const close = (container as Element).querySelector("[data-dialog-close]") as {
    focus?: () => void;
  } | null;
  close?.focus?.();
}
