import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

const backLinkClass =
  "-ml-1 mb-6 inline-flex items-center gap-1.5 rounded-md px-1 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground";

export function CommercialAccountBackLink({ accountId }: { accountId: string }) {
  return (
    <Link
      to="/bank/account/$accountId"
      params={{ accountId }}
      className={backLinkClass}
    >
      <ChevronLeft className="size-4 shrink-0" aria-hidden />
      Back to account
    </Link>
  );
}

export function commercialCompanySearch(companyId: string, accountId?: string) {
  return accountId ? { companyId, accountId } : { companyId };
}
