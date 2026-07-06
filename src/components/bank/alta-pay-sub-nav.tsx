import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type AltaPaySubNavTab = "now" | "invoices" | "scheduled" | "recurring" | "autopay";

const engineTabs: Array<{ id: Exclude<AltaPaySubNavTab, "now" | "invoices">; label: string }> = [
  { id: "scheduled", label: "Scheduled" },
  { id: "recurring", label: "Recurring" },
  { id: "autopay", label: "AutoPay merchants" },
];

const tabButtonClass = (active: boolean) =>
  cn(
    "rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
    active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
  );

export function AltaPaySubNav({
  activeTab,
  unreadInvoiceCount = 0,
}: {
  activeTab: AltaPaySubNavTab;
  unreadInvoiceCount?: number;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-border pb-1">
      <Link to="/bank/pay" className={tabButtonClass(activeTab === "now")}>
        Pay now
      </Link>
      <Link
        to="/bank/pay/invoices"
        className={cn(
          tabButtonClass(activeTab === "invoices"),
          "inline-flex items-center gap-2",
        )}
      >
        Received invoices
        {unreadInvoiceCount > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[11px] font-medium leading-none text-background tabular-nums">
            {unreadInvoiceCount > 99 ? "99+" : unreadInvoiceCount}
          </span>
        ) : null}
      </Link>
      {engineTabs.map((item) => (
        <Link
          key={item.id}
          to="/bank/pay"
          search={{ tab: item.id }}
          className={tabButtonClass(activeTab === item.id)}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
