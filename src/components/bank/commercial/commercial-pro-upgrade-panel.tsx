"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingMessage } from "@/components/ui/loading-indicator";
import { LOADING_COPY } from "@/lib/ui/route-loading";
import {
  BankRequestErrorCard,
  BankRequestSubmitButton,
  BankRequestSuccessCard,
  type BankRequestSubmissionResult,
} from "@/components/bank/bank-request-submission-ui";
import { florin } from "@/lib/bank/api";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import type { CommercialBillingPreview } from "@/lib/bank/commercial-billing-types";
import { COMMERCIAL_PLAN_LABELS } from "@/lib/bank/commercial-banking-types";
import {
  fetchCommercialBillingPreview,
  purchaseCommercialProPlan,
} from "@/lib/bank/commercial-banking.functions";
import { formatActivityDateTime } from "@/lib/format-datetime";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60";

const UPGRADE_DESCRIPTION =
  "Upgrade to Alta Commercial Pro for unlimited invoices, payment links, and team members.";

const upgradeDialogClass =
  "max-w-md gap-3 border-border bg-background p-5 sm:max-h-[min(85dvh,calc(100dvh-5rem))]";

type FormView = "compose" | "review" | "success" | "error";

type CommercialProUpgradePanelProps = {
  companyId: string;
  onCompleted: () => void;
  children: (props: { open: () => void; loading: boolean }) => ReactNode;
};

function formatBillingAccountLabel(account: {
  accountName: string;
  accountNumber: string;
  availableBalance: number;
}): string {
  return `${account.accountName} · ${account.accountNumber} · ${florin(account.availableBalance)} available`;
}

export function CommercialProUpgradePanel({
  companyId,
  onCompleted,
  children,
}: CommercialProUpgradePanelProps) {
  const router = useRouter();
  const fetchPreview = useServerFn(fetchCommercialBillingPreview);
  const purchasePro = useServerFn(purchaseCommercialProPlan);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<FormView>("compose");
  const [preview, setPreview] = useState<CommercialBillingPreview | null>(null);
  const [billingAccountId, setBillingAccountId] = useState("");
  const [composeError, setComposeError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<BankRequestSubmissionResult | null>(null);

  const selectedAccount = preview?.billingAccounts.find(
    (account) => account.id === billingAccountId,
  );

  function resetForm() {
    setView("compose");
    setComposeError(null);
    setErrorReason(null);
    setSubmission(null);
    setPreview(null);
    setBillingAccountId("");
  }

  async function openPanel() {
    setOpen(true);
    resetForm();
    setLoading(true);
    try {
      const nextPreview = await fetchPreview({ data: { companyId } });
      setPreview(nextPreview);
      setBillingAccountId(
        nextPreview.billingAccount?.id ?? nextPreview.billingAccounts[0]?.id ?? "",
      );
      if (nextPreview.billingAccounts.length === 0) {
        setComposeError("Open a business Alta account with available funds to upgrade.");
      } else if (!nextPreview.canPurchase) {
        setComposeError("This company is not eligible to purchase Pro right now.");
      }
    } catch (err) {
      setComposeError(
        err instanceof Error
          ? err.message.replace(/^BAD_REQUEST:/, "")
          : "Could not load billing preview.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && view === "success") {
      void router.invalidate();
      onCompleted();
    }
    setOpen(next);
    if (!next) {
      resetForm();
    }
  }

  function goToReview() {
    setComposeError(null);
    if (!billingAccountId) {
      setComposeError("Select a billing account.");
      return;
    }
    if (!selectedAccount) {
      setComposeError("Select a valid billing account.");
      return;
    }
    if (preview && !preview.canPurchase) {
      setComposeError("This company is not eligible to purchase Pro right now.");
      return;
    }
    setView("review");
  }

  async function submitUpgrade(e: React.FormEvent) {
    e.preventDefault();
    if (!billingAccountId || !preview || submitting) return;

    setSubmitting(true);

    try {
      const result = await purchasePro({
        data: { companyId, billingAccountId },
      });

      const submitted: BankRequestSubmissionResult = {
        referenceCode: result.referenceCode,
        amount: result.monthlyFee,
        submittedAt: new Date().toISOString(),
        accountName: selectedAccount?.accountName ?? "—",
        accountNumber: selectedAccount?.accountNumber ?? "—",
      };

      setSubmission(submitted);
      setView("success");
    } catch (err) {
      setErrorReason(formatCustomerActionError(err, "commercial_pro_upgrade"));
      setView("error");
    } finally {
      setSubmitting(false);
    }
  }

  function renderContent() {
    if (loading) {
      return <LoadingMessage>{LOADING_COPY.commercialUpgrade}</LoadingMessage>;
    }

    if (view === "success" && submission) {
      return (
        <BankRequestSuccessCard
          kind="commercial_pro_upgrade"
          result={submission}
          variant="embedded"
          onSubmitAnother={() => handleOpenChange(false)}
        />
      );
    }

    if (view === "error") {
      return (
        <BankRequestErrorCard
          reason={errorReason}
          variant="embedded"
          onTryAgain={() => {
            setErrorReason(null);
            setView("review");
          }}
        />
      );
    }

    if (view === "review" && preview && selectedAccount) {
      return (
        <form onSubmit={submitUpgrade} className="space-y-4">
          <div className="space-y-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
                Review upgrade
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Confirm the details below. Your billing account will be charged immediately.
              </p>
            </div>

            <div className="space-y-3 border-y border-border/60 py-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Current plan</span>
                <span className="font-medium">{COMMERCIAL_PLAN_LABELS[preview.currentPlan]}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">New plan</span>
                <span className="font-medium">{COMMERCIAL_PLAN_LABELS[preview.targetPlan]}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Billing account</span>
                <span className="text-right">
                  <span className="font-medium">{selectedAccount.accountName}</span>
                  <span className="mt-0.5 block font-mono text-[12px] text-muted-foreground">
                    {selectedAccount.accountNumber}
                  </span>
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Monthly fee</span>
                <span className="type-finance-nums">{florin(preview.monthlyFee)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Next billing date</span>
                <span className="text-right text-[13px]">
                  {formatActivityDateTime(preview.nextBillingDate)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Available balance</span>
                <span className="type-finance-nums">
                  {florin(selectedAccount.availableBalance)}
                </span>
              </div>
            </div>

            <fieldset
              disabled={submitting}
              className="flex flex-wrap items-center gap-2 border-0 p-0 m-0 min-w-0"
            >
              <button
                type="button"
                disabled={submitting}
                onClick={() => setView("compose")}
                className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium transition-colors hover:bg-surface-2/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
              <BankRequestSubmitButton
                kind="commercial_pro_upgrade"
                submitting={submitting}
                showContainer={false}
              />
            </fieldset>
          </div>
        </form>
      );
    }

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goToReview();
        }}
        className="space-y-4"
      >
        <fieldset disabled={submitting} className="space-y-4 border-0 p-0 m-0 min-w-0">
            <label className="block">
              <span className={fieldLabel}>Billing account</span>
              <Select
                value={billingAccountId}
                onValueChange={setBillingAccountId}
                disabled={submitting || !preview?.billingAccounts.length}
              >
                <SelectTrigger className={`${inputClass} h-auto min-h-10`}>
                  <SelectValue placeholder="Select billing account" />
                </SelectTrigger>
                <SelectContent>
                  {preview?.billingAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {formatBillingAccountLabel(account)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {preview
                  ? `First charge ${florin(preview.monthlyFee)} · Next billing ${formatActivityDateTime(preview.nextBillingDate)}`
                  : null}
              </p>
            </label>
          </fieldset>

          {composeError ? <p className="text-sm text-destructive">{composeError}</p> : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium transition-colors hover:bg-surface-2/60"
            >
              Cancel
            </button>
            <BankRequestSubmitButton
              kind="commercial_pro_upgrade"
              submitting={false}
              disabled={!preview?.billingAccounts.length || !preview.canPurchase}
              label="Review Upgrade"
              showContainer={false}
            />
          </div>
        </form>
      );
  }

  const showIntro = view === "compose" && !loading;

  return (
    <>
      {children({ open: () => void openPanel(), loading })}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className={upgradeDialogClass}>
          <DialogHeader className="space-y-1 pr-8">
            <DialogTitle className="font-serif text-[18px] leading-snug">Upgrade to Pro</DialogTitle>
            {showIntro ? (
              <DialogDescription className="text-[13px] leading-relaxed">
                {UPGRADE_DESCRIPTION}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          {renderContent()}
        </DialogContent>
      </Dialog>
    </>
  );
}
