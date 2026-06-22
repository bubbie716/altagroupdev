import { useState } from "react";
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
import {
  saveApiSession,
  submitApiApplication,
  type ApiSession,
} from "@/lib/exchange/api-access";

type GateTab = "sign-in" | "apply";

const useCaseOptions = [
  "Brokerage integration",
  "Research & analytics",
  "Terminal integration",
  "Institutional data feed",
  "Other",
];

const fieldClass =
  "mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground shadow-none";

function toSelectValue(option: string) {
  return option.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const previewPrimaryButtonClass =
  "cursor-not-allowed rounded-md bg-foreground/40 px-5 py-2.5 text-[13px] font-medium text-background/70";

export function ApiAccessGate({ onAuthenticated }: { onAuthenticated: (session: ApiSession) => void }) {
  const [tab, setTab] = useState<GateTab>("sign-in");

  function enterPreviewDocs() {
    const record = submitApiApplication({
      organization: "Preview Consumer",
      contactName: "Demo Access",
      useCase: "Terminal integration",
      description: "Preview documentation access.",
    });
    const session = { key: record.key, organization: record.organization };
    saveApiSession(session);
    onAuthenticated(session);
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <Card className="mb-6">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Alta Exchange API documentation is restricted to licensed consumers. Sign in with your API
          key or submit an application for review.
        </p>
      </Card>

      <div className="mb-6 flex justify-center gap-1 border-b border-border/60 pb-4">
        {(
          [
            { id: "sign-in" as const, label: "Sign in" },
            { id: "apply" as const, label: "Apply for access" },
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

      {tab === "sign-in" ? (
        <Card>
          <div className="space-y-5">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                API key
              </span>
              <input
                type="text"
                readOnly
                placeholder="ax_live_..."
                className={cn(fieldClass, "font-mono")}
              />
            </label>
            <Card className="border-gold/30 bg-gold/5 !p-4">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Sign-in is simulated in this preview. API keys will be issued after manual review in
                production.
              </p>
            </Card>
            <button type="button" disabled className={previewPrimaryButtonClass}>
              Sign in (preview only)
            </button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="space-y-5">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Organization
              </span>
              <input
                type="text"
                readOnly
                placeholder="Firm or institution name"
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Contact name
              </span>
              <input
                type="text"
                readOnly
                placeholder="Primary technical contact"
                className={fieldClass}
              />
            </label>
            <div className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Use case
              </span>
              <Select disabled>
                <SelectTrigger
                  className={cn(
                    fieldClass,
                    "h-auto min-h-10 disabled:cursor-not-allowed disabled:opacity-100 [&>svg]:text-muted-foreground [&>svg]:opacity-50",
                  )}
                >
                  <SelectValue placeholder="Select use case" />
                </SelectTrigger>
                <SelectContent>
                  {useCaseOptions.map((option) => (
                    <SelectItem key={option} value={toSelectValue(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Intended integration
              </span>
              <Textarea
                readOnly
                placeholder="Describe how you plan to use Alta Exchange market data…"
                className={cn(fieldClass, "min-h-[5rem] resize-none focus-visible:ring-0")}
              />
            </label>
            <Card className="border-gold/30 bg-gold/5 !p-4">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Applications are reviewed manually. Submission is simulated in this preview.
              </p>
            </Card>
            <button type="button" disabled className={previewPrimaryButtonClass}>
              Submit application (preview only)
            </button>
          </div>
        </Card>
      )}

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={enterPreviewDocs}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline"
        >
          View API documentation (preview access) →
        </button>
      </div>
    </div>
  );
}
