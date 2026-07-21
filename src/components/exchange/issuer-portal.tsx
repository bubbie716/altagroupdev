import { Card } from "@/components/page-shell";
import { EmptyState } from "@/components/data/empty-state";
import type { CompanyProfile } from "@/lib/exchange/types";

const fieldClass =
  "mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground shadow-none";

const unavailablePrimaryButtonClass =
  "cursor-not-allowed rounded-md bg-foreground/40 px-5 py-2.5 text-[13px] font-medium text-background/70";

export function IssuerAccessGate({ company }: { company: CompanyProfile }) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <Card className="mb-6">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          The issuer portal is restricted to verified listing owners and authorized representatives of{" "}
          {company.name}. Sign in to publish corporate announcements and monthly financial updates.
        </p>
      </Card>

      <EmptyState
        eyebrow="Alta Exchange · Issuer Portal"
        title="Issuer portal is not available yet."
        description="Listing verification and issuer credentials are required before announcements or financial updates can be published."
        className="max-w-xl"
      />

      <Card className="mt-8">
        <div className="space-y-5 opacity-60">
          <label className="block">
            <span className="type-meta">Issuer email</span>
            <input type="text" readOnly placeholder="issuer@company.republic" className={fieldClass} />
          </label>
          <label className="block">
            <span className="type-meta">Access code</span>
            <input type="text" readOnly placeholder="••••••••••••" className={fieldClass} />
          </label>
          <button type="button" disabled className={unavailablePrimaryButtonClass}>
            Sign in (unavailable)
          </button>
        </div>
      </Card>
    </div>
  );
}

export function IssuerPortalPanel() {
  return (
    <EmptyState
      eyebrow="Alta Exchange · Issuer Portal"
      title="Issuer portal is not available yet."
      description="Corporate announcements and monthly financial updates will be published here after listing verification and issuer access are enabled."
      className="max-w-xl"
    />
  );
}
