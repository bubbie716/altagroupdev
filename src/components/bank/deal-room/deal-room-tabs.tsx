export type DealRoomTabId = "conversation" | "offers" | "documents" | "agreement" | "operations";

export const DEAL_ROOM_TABS: { id: DealRoomTabId; label: string; internalOnly?: boolean }[] = [
  { id: "conversation", label: "Conversation" },
  { id: "offers", label: "Offers" },
  { id: "documents", label: "Documents" },
  { id: "agreement", label: "Agreement" },
  { id: "operations", label: "Operations", internalOnly: true },
];

export function DealRoomTabs({
  active,
  onChange,
  variant = "user",
}: {
  active: DealRoomTabId;
  onChange: (tab: DealRoomTabId) => void;
  variant?: "user" | "internal";
}) {
  const tabs = DEAL_ROOM_TABS.filter((t) => variant === "internal" || !t.internalOnly);
  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-border bg-surface-1/60 px-4 sm:px-6"
      aria-label="Deal room sections"
    >
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              "relative shrink-0 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors",
              selected
                ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-gold"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
