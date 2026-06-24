"use client";

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
  DEMO_API_KEY,
  saveApiSession,
  submitApiApplication,
  validateApiKey,
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
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

export function ApiAccessGate({ onAuthenticated }: { onAuthenticated: (session: ApiSession) => void }) {
  const [tab, setTab] = useState<GateTab>("sign-in");
  const [apiKey, setApiKey] = useState("");
  const [organization, setOrganization] = useState("");
  const [contactName, setContactName] = useState("");
  const [useCase, setUseCase] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const session = validateApiKey(apiKey);
      if (!session) {
        setError("Invalid API key. Check your key or apply for access below.");
        return;
      }
      saveApiSession(session);
      onAuthenticated(session);
    } finally {
      setPending(false);
    }
  }

  function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setApplySuccess(null);
    if (!organization.trim() || !contactName.trim() || !useCase || !description.trim()) {
      setError("Complete all fields before submitting.");
      return;
    }
    setPending(true);
    try {
      const record = submitApiApplication({
        organization: organization.trim(),
        contactName: contactName.trim(),
        useCase,
        description: description.trim(),
      });
      const session = { key: record.key, organization: record.organization };
      saveApiSession(session);
      setApplySuccess(record.key);
      onAuthenticated(session);
    } finally {
      setPending(false);
    }
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
            onClick={() => {
              setTab(t.id);
              setError(null);
            }}
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
          <form onSubmit={handleSignIn} className="space-y-5">
            <label className="block">
              <span className="type-meta">
                API key
              </span>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={DEMO_API_KEY}
                className={cn(fieldClass, "font-mono")}
                required
                autoComplete="off"
              />
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-[12px] text-muted-foreground">
              Preview demo key:{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">
                {DEMO_API_KEY}
              </code>
            </p>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-border-strong bg-surface-2 px-5 py-2.5 text-[13px] font-medium transition-colors hover:bg-surface-2/80 disabled:opacity-50"
            >
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </Card>
      ) : (
        <Card>
          <form onSubmit={handleApply} className="space-y-5">
            <label className="block">
              <span className="type-meta">
                Organization
              </span>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Firm or institution name"
                className={fieldClass}
                required
              />
            </label>
            <label className="block">
              <span className="type-meta">
                Contact name
              </span>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Primary technical contact"
                className={fieldClass}
                required
              />
            </label>
            <div className="block">
              <span className="type-meta">
                Use case
              </span>
              <Select value={useCase} onValueChange={setUseCase} required>
                <SelectTrigger className={cn(fieldClass, "h-auto min-h-10")}>
                  <SelectValue placeholder="Select use case" />
                </SelectTrigger>
                <SelectContent>
                  {useCaseOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="block">
              <span className="type-meta">
                Intended integration
              </span>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe how you plan to use Alta Exchange market data…"
                className={cn(fieldClass, "min-h-[5rem]")}
                required
              />
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {applySuccess && (
              <Card className="border-gold/30 bg-gold/5 !p-4">
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Application approved for this preview environment. Your API key has been issued and
                  you are now signed in.
                </p>
                <code className="mt-2 block break-all font-mono text-[12px] text-foreground">
                  {applySuccess}
                </code>
              </Card>
            )}
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-border-strong bg-surface-2 px-5 py-2.5 text-[13px] font-medium transition-colors hover:bg-surface-2/80 disabled:opacity-50"
            >
              {pending ? "Submitting…" : "Submit application"}
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
