import { Link } from "@tanstack/react-router";
import {
  INTERNAL_ACCOUNT_WORKSPACE_SEARCH,
  INTERNAL_ALTA_CARD_APPLICATION_SEARCH,
  INTERNAL_ALTA_CARD_REVIEW_SEARCH,
  INTERNAL_ALTA_CARD_WORKSPACE_SEARCH,
  INTERNAL_ALTA_PAY_RECORD_SEARCH,
  INTERNAL_COMPANY_WORKSPACE_SEARCH,
  INTERNAL_INVOICE_RECORD_SEARCH,
  INTERNAL_LOAN_WORKSPACE_SEARCH,
  INTERNAL_PAYMENT_LINK_RECORD_SEARCH,
  INTERNAL_TRANSACTION_WORKSPACE_SEARCH,
  INTERNAL_TRANSFER_RECORD_SEARCH,
  INTERNAL_USER_WORKSPACE_SEARCH,
  internalWorkspaceTabSearch,
  serializeInternalSearch,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";

export type RelatedRecordKind =
  | "user"
  | "company"
  | "bank_account"
  | "transaction"
  | "loan"
  | "lending_application"
  | "alta_card"
  | "alta_card_application"
  | "alta_card_review"
  | "alta_pay"
  | "scheduled_transfer"
  | "invoice"
  | "payment_link"
  | "statement"
  | "deal_room"
  | "relationship";

export type RelatedRecord = {
  kind: RelatedRecordKind;
  id: string;
  label: string;
  sublabel?: string;
  href?: string;
  /** When false, render descriptive text only — destination is not guaranteed to resolve. */
  linkable?: boolean;
};

const KIND_LABELS: Record<RelatedRecordKind, string> = {
  user: "Customer",
  company: "Company",
  bank_account: "Account",
  transaction: "Transaction",
  loan: "Loan",
  lending_application: "Lending application",
  alta_card: "Alta Card",
  alta_card_application: "Card application",
  alta_card_review: "Card review",
  alta_pay: "Alta Pay",
  scheduled_transfer: "Scheduled transfer",
  invoice: "Invoice",
  payment_link: "Payment link",
  statement: "Statement",
  deal_room: "Deal room",
  relationship: "Relationship",
};

type RelatedRecordLinkTarget = {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
};

function parseHrefTarget(href: string, site?: string | null): RelatedRecordLinkTarget {
  const u = new URL(href, "https://alta.local");
  const search = Object.fromEntries(u.searchParams.entries());
  return {
    to: u.pathname,
    search: withInternalSiteSearch(search, site),
  };
}

export function relatedRecordTarget(
  record: RelatedRecord,
  site?: string | null,
): RelatedRecordLinkTarget {
  if (record.href) return parseHrefTarget(record.href, site);

  switch (record.kind) {
    case "user":
      return {
        to: "/internal/users/$userId",
        params: { userId: record.id },
        search: withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, site),
      };
    case "company":
      return {
        to: "/internal/companies/$companyId",
        params: { companyId: record.id },
        search: withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, site),
      };
    case "bank_account":
      return {
        to: "/internal/bank/accounts/$accountId",
        params: { accountId: record.id },
        search: withInternalSiteSearch(INTERNAL_ACCOUNT_WORKSPACE_SEARCH, site),
      };
    case "transaction":
      return {
        to: "/internal/bank/transactions/$transactionId",
        params: { transactionId: record.id },
        search: withInternalSiteSearch(INTERNAL_TRANSACTION_WORKSPACE_SEARCH, site),
      };
    case "loan":
      return {
        to: "/internal/lending/loans/$loanId",
        params: { loanId: record.id },
        search: withInternalSiteSearch(INTERNAL_LOAN_WORKSPACE_SEARCH, site),
      };
    case "lending_application":
      return {
        to: "/internal/lending/applications/$applicationId",
        params: { applicationId: record.id },
        search: withInternalSiteSearch({ section: "evidence" }, site),
      };
    case "alta_card":
      return {
        to: "/internal/alta-card/$cardId",
        params: { cardId: record.id },
        search: withInternalSiteSearch(INTERNAL_ALTA_CARD_WORKSPACE_SEARCH, site),
      };
    case "alta_card_application":
      return {
        to: "/internal/alta-card/applications/$applicationId",
        params: { applicationId: record.id },
        search: withInternalSiteSearch(INTERNAL_ALTA_CARD_APPLICATION_SEARCH, site),
      };
    case "alta_card_review":
      return {
        to: "/internal/alta-card/reviews/$reviewId",
        params: { reviewId: record.id },
        search: withInternalSiteSearch(INTERNAL_ALTA_CARD_REVIEW_SEARCH, site),
      };
    case "alta_pay":
      return {
        to: "/internal/bank/alta-pay/$referenceCode",
        params: { referenceCode: record.id },
        search: withInternalSiteSearch(INTERNAL_ALTA_PAY_RECORD_SEARCH, site),
      };
    case "scheduled_transfer":
      return {
        to: "/internal/bank/transfers/$transferId",
        params: { transferId: record.id },
        search: withInternalSiteSearch(INTERNAL_TRANSFER_RECORD_SEARCH, site),
      };
    case "invoice":
      return {
        to: "/internal/bank/alta-pay/invoices/$invoiceId",
        params: { invoiceId: record.id },
        search: withInternalSiteSearch(INTERNAL_INVOICE_RECORD_SEARCH, site),
      };
    case "payment_link":
      return {
        to: "/internal/bank/alta-pay/payment-links/$paymentLinkId",
        params: { paymentLinkId: record.id },
        search: withInternalSiteSearch(INTERNAL_PAYMENT_LINK_RECORD_SEARCH, site),
      };
    case "statement":
      return {
        to: "/internal/bank/accounts/$accountId",
        params: { accountId: record.id },
        search: withInternalSiteSearch(internalWorkspaceTabSearch("statements"), site),
      };
    case "deal_room":
      return record.id.startsWith("/")
        ? parseHrefTarget(record.id, site)
        : {
            to: "/internal/lending/deal-rooms/$dealRoomId",
            params: { dealRoomId: record.id },
            search: withInternalSiteSearch({}, site),
          };
    case "relationship":
      return record.id.includes("company")
        ? {
            to: "/internal/companies/$companyId",
            params: { companyId: record.id.replace("company:", "") },
            search: withInternalSiteSearch(
              { ...internalWorkspaceTabSearch("overview"), section: "relationship" },
              site,
            ),
          }
        : {
            to: "/internal/users/$userId",
            params: { userId: record.id.replace("user:", "") },
            search: withInternalSiteSearch(
              { ...internalWorkspaceTabSearch("overview"), section: "relationship" },
              site,
            ),
          };
  }
}

export function relatedRecordHref(record: RelatedRecord, site?: string | null): string {
  const { to, params, search } = relatedRecordTarget(record, site);
  let path = to;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      path = path.replace(`$${key}`, value);
    }
  }
  if (!search || Object.keys(search).length === 0) return path;
  const query = serializeInternalSearch(search);
  return query ? `${path}?${query}` : path;
}

export function RelatedRecords({
  records,
  site,
}: {
  records: RelatedRecord[];
  site?: string | null;
}) {
  if (records.length === 0) {
    return <p className="text-[11px] text-muted-foreground">No related records linked to this entity.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {records.map((record) => {
        const linkable = record.linkable !== false;
        if (!linkable) {
          return (
            <li key={`${record.kind}-${record.id}`} className="px-1 py-0.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                {KIND_LABELS[record.kind]}
              </span>
              <div className="text-[12px] font-medium leading-tight text-muted-foreground">
                {record.label}
              </div>
              {record.sublabel ? (
                <div className="font-mono text-[10px] text-muted-foreground">{record.sublabel}</div>
              ) : null}
            </li>
          );
        }
        const target = relatedRecordTarget(record, site);
        return (
          <li key={`${record.kind}-${record.id}`}>
            <Link
              to={target.to as "/"}
              params={target.params}
              search={target.search}
              className="block rounded border border-transparent px-1 py-0.5 hover:border-border/60 hover:bg-surface-2/40"
            >
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                {KIND_LABELS[record.kind]}
              </span>
              <div className="text-[12px] font-medium leading-tight">{record.label}</div>
              {record.sublabel ? (
                <div className="font-mono text-[10px] text-muted-foreground">{record.sublabel}</div>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function RelatedRecordsCompact({
  records,
  limit = 5,
  site,
}: {
  records: RelatedRecord[];
  limit?: number;
  site?: string | null;
}) {
  return <RelatedRecords records={records.slice(0, limit)} site={site} />;
}
