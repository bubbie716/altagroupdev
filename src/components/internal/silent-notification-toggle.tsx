"use client";

export function SilentNotificationToggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded border border-border/60 bg-surface-2/30 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="font-medium text-foreground">Silent</span>
        <span className="text-muted-foreground"> (Do not notify customer)</span>
      </span>
    </label>
  );
}
