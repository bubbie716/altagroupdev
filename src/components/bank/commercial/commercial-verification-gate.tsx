import { Link } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";

export function CommercialVerificationGate({
  companyName,
  verificationStatus,
}: {
  companyName: string;
  verificationStatus: "verified" | "pending" | "unverified" | "rejected";
}) {
  const copy =
    verificationStatus === "pending"
      ? "Your company verification is in review. Alta Commercial unlocks once verification is complete."
      : verificationStatus === "rejected"
        ? "Company verification was not approved. Contact Alta Bank support to restore commercial access."
        : "Alta Commercial requires a verified business with an active Business Operating Account.";

  return (
    <Card className="!p-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
        Verification required
      </p>
      <h2 className="mt-3 text-xl font-medium tracking-tight">{companyName}</h2>
      <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{copy}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/bank/business"
          className="inline-flex items-center rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
        >
          Review business banking
        </Link>
        <Link
          to="/companies"
          className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2/60"
        >
          Company profile
        </Link>
      </div>
    </Card>
  );
}
