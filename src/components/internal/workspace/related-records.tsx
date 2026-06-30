import { Link } from "@tanstack/react-router";

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
  | "statement"
  | "deal_room"
  | "relationship";

export type RelatedRecord = {
  kind: RelatedRecordKind;
  id: string;
  label: string;
  sublabel?: string;
  href?: string;
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
  statement: "Statement",
  deal_room: "Deal room",
  relationship: "Relationship",
};

export function relatedRecordHref(record: RelatedRecord): string {
  if (record.href) return record.href;
  switch (record.kind) {
    case "user":
      return `/internal/users/${record.id}`;
    case "company":
      return `/internal/companies/${record.id}`;
    case "bank_account":
      return `/internal/bank/accounts/${record.id}`;
    case "transaction":
      return `/internal/bank/transactions/${record.id}`;
    case "loan":
      return `/internal/lending/loans/${record.id}`;
    case "lending_application":
      return `/internal/lending/applications/${record.id}?tab=thread`;
    case "alta_card":
      return `/internal/alta-card/${record.id}`;
    case "alta_card_application":
      return `/internal/alta-card/applications/${record.id}`;
    case "alta_card_review":
      return `/internal/alta-card/reviews/${record.id}`;
    case "alta_pay":
      return `/internal/bank/alta-pay`;
    case "statement":
      return `/internal/bank/accounts/${record.id}?tab=statements`;
    case "deal_room":
      return record.id.startsWith("/")
        ? record.id
        : `/internal/lending/deal-rooms/${record.id}`;
    case "relationship":
      return record.id.includes("company")
        ? `/internal/companies/${record.id.replace("company:", "")}?tab=relationship`
        : `/internal/users/${record.id.replace("user:", "")}?tab=relationship`;
  }
}

export function RelatedRecords({ records }: { records: RelatedRecord[] }) {
  if (records.length === 0) {
    return <p className="text-[11px] text-muted-foreground">No related records linked to this entity.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {records.map((record) => (
        <li key={`${record.kind}-${record.id}`}>
          <Link
            to={relatedRecordHref(record) as "/"}
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
      ))}
    </ul>
  );
}

export function RelatedRecordsCompact({ records, limit = 5 }: { records: RelatedRecord[]; limit?: number }) {
  return <RelatedRecords records={records.slice(0, limit)} />;
}
