import { createFileRoute, redirect } from "@tanstack/react-router";

type AltaPaySearch = {
  employeeCardId?: string;
  cardId?: string;
  tab?: "scheduled" | "recurring" | "autopay";
};

function parseAltaPayTab(value: unknown): AltaPaySearch["tab"] | undefined {
  if (value === "scheduled" || value === "recurring" || value === "autopay") return value;
  return undefined;
}

/**
 * Compatibility redirect:
 * - Pay now → ?action=pay
 * - scheduled/recurring → Activity → Scheduled
 * - autopay → Activity → AutoPay
 * Invoice routes under /bank/pay/invoices remain canonical.
 */
export const Route = createFileRoute("/bank/pay/")({
  validateSearch: (search: Record<string, unknown>): AltaPaySearch => {
    const result: AltaPaySearch = {};
    if (typeof search.employeeCardId === "string" && search.employeeCardId.trim()) {
      result.employeeCardId = search.employeeCardId.trim();
    }
    if (typeof search.cardId === "string" && search.cardId.trim()) {
      result.cardId = search.cardId.trim();
    }
    const tab = parseAltaPayTab(search.tab);
    if (tab) result.tab = tab;
    return result;
  },
  beforeLoad: ({ search }) => {
    if (search.tab === "scheduled" || search.tab === "recurring") {
      throw redirect({
        to: "/bank/activity",
        search: { view: "scheduled" },
        replace: true,
      });
    }
    if (search.tab === "autopay") {
      throw redirect({
        to: "/bank/activity",
        search: { view: "autopay" },
        replace: true,
      });
    }
    throw redirect({
      to: "/bank",
      search: {
        action: "pay",
        ...(search.cardId ? { cardId: search.cardId } : {}),
        ...(search.employeeCardId ? { employeeCardId: search.employeeCardId } : {}),
      },
      replace: true,
    });
  },
});
