import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CompanyProfile } from "@/lib/exchange/types";
import {
  createPreviewIssuerSession,
  type IssuerSession,
} from "@/lib/exchange/issuer-access";

const fieldClass =
  "mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground shadow-none";

const previewPrimaryButtonClass =
  "cursor-not-allowed rounded-md bg-foreground/40 px-5 py-2.5 text-[13px] font-medium text-background/70";

const monthOptions = [
  "June 2026",
  "May 2026",
  "April 2026",
  "March 2026",
];

function UploadPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface-2/30 px-4 py-8 text-center">
      <div className="type-meta">
        {label}
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">Drag and drop or browse — preview only</p>
      <button
        type="button"
        disabled
        className="mt-4 cursor-not-allowed rounded border border-border px-3 py-1.5 type-meta"
      >
        Choose file
      </button>
    </div>
  );
}

export function IssuerAccessGate({
  company,
  onAuthenticated,
}: {
  company: CompanyProfile;
  onAuthenticated: (session: IssuerSession) => void;
}) {
  function enterPreviewPortal() {
    onAuthenticated(createPreviewIssuerSession(company.symbol, company.name));
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <Card className="mb-6">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          The issuer portal is restricted to verified listing owners and authorized representatives of{" "}
          {company.name}. Sign in to publish corporate announcements and monthly financial updates.
        </p>
      </Card>

      <Card>
        <div className="space-y-5">
          <label className="block">
            <span className="type-meta">
              Issuer email
            </span>
            <input type="text" readOnly placeholder="issuer@company.republic" className={fieldClass} />
          </label>
          <label className="block">
            <span className="type-meta">
              Access code
            </span>
            <input type="text" readOnly placeholder="••••••••••••" className={cn(fieldClass, "font-mono")} />
          </label>
          <Card className="border-gold/30 bg-gold/5 !p-4">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Issuer authentication is simulated in this preview. Credentials are issued after Alta
              Exchange listing verification in production.
            </p>
          </Card>
          <button type="button" disabled className={previewPrimaryButtonClass}>
            Sign in (preview only)
          </button>
        </div>
      </Card>

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={enterPreviewPortal}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline"
        >
          Enter issuer portal (preview access) →
        </button>
      </div>
    </div>
  );
}

type PortalTab = "announcement" | "financial";

export function IssuerPortalPanel({
  company,
  session,
  onSignOut,
}: {
  company: CompanyProfile;
  session: IssuerSession;
  onSignOut: () => void;
}) {
  const [tab, setTab] = useState<PortalTab>("announcement");

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card className="mb-8 flex flex-wrap items-center justify-between gap-4 border-gold/30 bg-gold/5">
        <div>
          <div className="type-meta">
            Issuer portal · {company.symbol}
          </div>
          <div className="mt-1 font-medium">{session.organization}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/exchange/company/$ticker"
            params={{ ticker: company.symbol.toLowerCase() }}
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline"
          >
            View public profile →
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-md border border-border px-4 py-2 text-[13px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </Card>

      <div className="mb-6 flex justify-center gap-1 border-b border-border/60 pb-4">
        {(
          [
            { id: "announcement" as const, label: "Corporate announcement" },
            { id: "financial" as const, label: "Monthly financial update" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-[12px] tracking-wide transition-colors",
              tab === t.id
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "announcement" ? (
        <Card>
          <div className="space-y-5">
            <label className="block">
              <span className="type-meta">
                Announcement title
              </span>
              <input
                type="text"
                readOnly
                placeholder="Headline visible on your ticker page"
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="type-meta">
                Announcement body
              </span>
              <Textarea
                readOnly
                placeholder="Full announcement text for investors and market participants…"
                className={cn(fieldClass, "min-h-[6rem] focus-visible:ring-0")}
              />
            </label>
            <UploadPlaceholder label="Supporting document (optional)" />
            <Card className="border-gold/30 bg-gold/5 !p-4">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Announcements are published to your Alta Exchange ticker page after review. Submission
                is simulated in this preview.
              </p>
            </Card>
            <button type="button" disabled className={previewPrimaryButtonClass}>
              Publish announcement (preview only)
            </button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="space-y-5">
            <div className="block">
              <span className="type-meta">
                Reporting period
              </span>
              <Select disabled>
                <SelectTrigger
                  className={cn(
                    fieldClass,
                    "h-auto min-h-10 disabled:cursor-not-allowed disabled:opacity-100 [&>svg]:text-muted-foreground [&>svg]:opacity-50",
                  )}
                >
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => (
                    <SelectItem key={month} value={month.toLowerCase().replace(/\s+/g, "-")}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <UploadPlaceholder label="Monthly financial update (PDF)" />
            <label className="block">
              <span className="type-meta">
                Summary note
              </span>
              <Textarea
                readOnly
                placeholder="Brief summary accompanying the monthly financial update…"
                className={cn(fieldClass, "min-h-[4.5rem] focus-visible:ring-0")}
              />
            </label>
            <Card className="border-gold/30 bg-gold/5 !p-4">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Monthly financial updates are filed to your ticker page and indexed in Alta Exchange
                research. Upload is simulated in this preview.
              </p>
            </Card>
            <button type="button" disabled className={previewPrimaryButtonClass}>
              Submit financial update (preview only)
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
