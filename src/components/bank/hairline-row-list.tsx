import { cn } from "@/lib/utils";

/**
 * Hairline row list shell — outer `bg-surface-1` card with hairline border
 * and divided list items. Used for directory-style content (statements,
 * contacts, transfers hub).
 */
export function HairlineRowList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface-1 divide-y divide-border",
        className,
      )}
    >
      {children}
    </ul>
  );
}