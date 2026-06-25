import { Link } from "@tanstack/react-router";

export function BankAccountActivityLink({
  accountId,
  accountName,
  accountNumber,
}: {
  accountId: string;
  accountName: string;
  accountNumber: string;
}) {
  return (
    <Link to="/bank/account/$accountId" params={{ accountId }} className="hover:text-gold">
      <div className="text-[12px]">{accountName}</div>
      <div className="font-mono text-[11px] text-muted-foreground">{accountNumber}</div>
    </Link>
  );
}
