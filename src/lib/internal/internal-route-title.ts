/**
 * Deterministic internal console header titles from the URL pathname.
 * Same on SSR and client hydration — never reads module-global or prior-route state.
 */

export function resolveInternalRouteTitle(pathname: string): string {
  const path = normalizeInternalPath(pathname);

  if (path === "/internal" || path === "/internal/bank" || path === "/internal/terminal") {
    return "Home";
  }

  const rules: Array<{ test: RegExp; title: string }> = [
    { test: /^\/internal\/inbox(?:\/|$)/, title: "Inbox" },
    { test: /^\/internal\/users\/[^/]+/, title: "Customer" },
    { test: /^\/internal\/users$/, title: "Customers" },
    { test: /^\/internal\/companies\/[^/]+/, title: "Company" },
    { test: /^\/internal\/companies$/, title: "Companies" },
    { test: /^\/internal\/bank\/accounts\/[^/]+/, title: "Account" },
    { test: /^\/internal\/bank\/accounts$/, title: "Accounts" },
    { test: /^\/internal\/bank\/transactions\/[^/]+/, title: "Transaction" },
    { test: /^\/internal\/bank\/transactions$/, title: "Transactions" },
    { test: /^\/internal\/bank\/transfers\/[^/]+/, title: "Transfer" },
    { test: /^\/internal\/bank\/transfers$/, title: "Transfers" },
    { test: /^\/internal\/bank\/alta-pay\/[^/]+/, title: "Alta Pay" },
    { test: /^\/internal\/bank\/alta-pay$/, title: "Alta Pay" },
    { test: /^\/internal\/bank\/interest/, title: "Interest" },
    { test: /^\/internal\/bank\/statements/, title: "Statements" },
    { test: /^\/internal\/bank\/scheduled/, title: "Transfers" },
    { test: /^\/internal\/lending\/applications\/[^/]+/, title: "Lending Application" },
    { test: /^\/internal\/lending\/loans\/[^/]+/, title: "Loan" },
    { test: /^\/internal\/lending\/loans$/, title: "Loans" },
    { test: /^\/internal\/lending$/, title: "Lending" },
    { test: /^\/internal\/alta-card\/cards/, title: "Cards" },
    { test: /^\/internal\/alta-card\/applications\/[^/]+/, title: "Card application" },
    { test: /^\/internal\/alta-card\/reviews\/[^/]+/, title: "Card review" },
    { test: /^\/internal\/alta-card\/[^/]+/, title: "Alta Card" },
    { test: /^\/internal\/alta-card$/, title: "Alta Card" },
    { test: /^\/internal\/terminal\/portfolios\/[^/]+/, title: "Portfolio" },
    { test: /^\/internal\/terminal\/portfolios$/, title: "Portfolios" },
    { test: /^\/internal\/terminal\/orders\/[^/]+/, title: "Order" },
    { test: /^\/internal\/terminal\/orders$/, title: "Orders" },
    { test: /^\/internal\/terminal\/investors/, title: "Investors" },
    { test: /^\/internal\/terminal\/system/, title: "Terminal System" },
    { test: /^\/internal\/terminal\/settings/, title: "Terminal Settings" },
    { test: /^\/internal\/terminal\/inbox/, title: "Inbox" },
    { test: /^\/internal\/relationships/, title: "Relationships" },
    { test: /^\/internal\/embeds/, title: "Communications" },
    { test: /^\/internal\/audit/, title: "Audit" },
    { test: /^\/internal\/reports/, title: "Reports" },
    { test: /^\/internal\/compliance/, title: "Risk Signals" },
    { test: /^\/internal\/jobs/, title: "Jobs" },
    { test: /^\/internal\/settings/, title: "Settings" },
    { test: /^\/internal\/bank\/settings/, title: "Bank Settings" },
    { test: /^\/internal\/relationships\/[^/]+/, title: "Relationship" },
  ];

  for (const rule of rules) {
    if (rule.test.test(path)) return rule.title;
  }

  return "Operations";
}

function normalizeInternalPath(pathname: string): string {
  if (!pathname) return "/internal";
  const withoutQuery = pathname.split(/[?#]/, 1)[0] ?? pathname;
  const trimmed = withoutQuery.replace(/\/+$/, "") || "/";
  return trimmed.startsWith("/internal") ? trimmed : trimmed;
}
