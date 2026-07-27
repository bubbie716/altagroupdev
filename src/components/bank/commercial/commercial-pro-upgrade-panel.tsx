"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SkeletonFormPanel } from "@/components/ui/skeleton-form-panel";
import { LOADING_COPY } from "@/lib/ui/route-loading";
import {
  BankRequestErrorCard,
  BankRequestSubmitButton,
  BankRequestSuccessCard,
  type BankRequestSubmissionResult,
} from "@/components/bank/bank-request-submission-ui";
import { ResponsiveBankAction } from "@/components/bank/actions/responsive-bank-action";
import {
  BankActionFooter,
  BankActionSecondaryButton,
} from "@/components/bank/actions/bank-action-buttons";
import { florin } from "@/lib/bank/api";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import type { BankActionPhase } from "@/lib/bank/bank-action-flow";
import type { CommercialBillingPreview } from "@/lib/bank/commercial-billing-types";
import { COMMERCIAL_PLAN_LABELS } from "@/lib/bank/commercial-banking-types";
import {
  fetchCommercialBillingPreview,
  purchaseCommercialProPlan,
} from "@/lib/bank/commercial-banking.functions";
import { formatActivityDateTime } from "@/lib/format-datetime";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-0 focus-visible:shadow-none disabled:cursor-not-allowed disabled:opacity-60";

const UPGRADE_DESCRIPTION =
  "Upgrade to Alta Commercial Pro for unlimited invoices, payment links, and team members.";

type CommercialProUpgradePanelProps = {
  companyId: string;
  onCompleted: () => void;
  children: (props: { open: () => void; loading: boolean }) => ReactNode;
};

function BillingAccountOptionLabel({
  account,
}: {
  account: { accountName: string; accountNumber: string; availableBalance: number };
}) {
  return (
    <span className="block min-w-0">
      <span className="block truncate font-medium">{account.accountName}</span>
      <span className="mt-0.5 block truncate font-mono text-[12px] text-muted-foreground">
        {account.accountNumber} · {florin(account.availableBalance)} available
      </span>
    </span>
  );
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
  const [phase, setPhase] = useState<BankActionPhase>("details");
  const [preview, setPreview] = useState<CommercialBillingPreview | null>(null);
  const [billingAccountId, setBillingAccountId] = useState("");
  const [initialBillingAccountId, setInitialBillingAccountId] = useState("");
  const [composeError, setComposeError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [submission, setSubmission] = useState<BankRequestSubmissionResult | null>(null);

  const selectedAccount = preview?.billingAccounts.find(
    (account) => account.id === billingAccountId,
  );

  const dirty = useMemo(() => {
    if (phase === "success" || phase === "submitting") return false;
    if (phase === "review") return true;
    return Boolean(billingAccountId) && billingAccountId !== initialBillingAccountId;
  }, [phase, billingAccountId, initialBillingAccountId]);

  function resetForm() {
    setPhase("details");
    setComposeError(null);
    setErrorReason(null);
    setSubmission(null);
    setPreview(null);
    setBillingAccountId("");
    setInitialBillingAccountId("");
  }

  async function openPanel() {
    setOpen(true);
    resetForm();
    setLoading(true);
    try {
      const nextPreview = await fetchPreview({ data: { companyId } });
      setPreview(nextPreview);
      const defaultId =
        nextPreview.billingAccount?.id ?? nextPreview.billingAccounts[0]?.id ?? "";
      setBillingAccountId(defaultId);
      setInitialBillingAccountId(defaultId);
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
    if (!next && phase === "success") {
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
    setPhase("review");
  }

  async function submitUpgrade() {
    if (!billingAccountId || !preview || phase === "submitting") return;

    setPhase("submitting");

    try {
      const result = await purchasePro({
        data: { companyId, billingAccountId },
      });

      setSubmission({
        referenceCode: result.referenceCode,
        amount: result.monthlyFee,
        submittedAt: new Date().toISOString(),
        accountName: selectedAccount?.accountName ?? "—",
        accountNumber: selectedAccount?.accountNumber ?? "—",
      });
      setPhase("success");
    } catch (err) {
      setErrorReason(formatCustomerActionError(err, "commercial_pro_upgrade"));
      setPhase("error");
    }
  }

  const title =
    phase === "success"
      ? "Pro activated"
      : phase === "error"
        ? "Upgrade failed"
        : phase === "review" || phase === "submitting"
          ? "Review upgrade"
          : "Upgrade to Pro";

  const description =
    phase === "details" && !loading
      ? UPGRADE_DESCRIPTION
      : phase === "review"
        ? "Confirm the charge details below."
        : undefined;

  const showBack = phase === "review" || phase === "error";

  function renderBody() {
    if (loading) {
      return <SkeletonFormPanel fields={3} label={LOADING_COPY.commercialUpgrade} />;
    }

    if (phase === "success" && submission) {
      return (
        <BankRequestSuccessCard
          kind="commercial_pro_upgrade"
          result={submission}
          variant="embedded"
          onSubmitAnother={() => handleOpenChange(false)}
        />
      );
    }

    if (phase === "error") {
      return (
        <BankRequestErrorCard
          reason={errorReason}
          variant="embedded"
          onTryAgain={() => {
            setErrorReason(null);
            setPhase("review");
          }}
        />
      );
    }

    if ((phase === "review" || phase === "submitting") && preview && selectedAccount) {
      return (
        <div className="min-w-0 space-y-4">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Your billing account will be charged{" "}
            <span className="font-medium text-foreground type-finance-nums">
              {florin(preview.monthlyFee)}
            </span>{" "}
            now, then monthly.
          </p>

          <div className="min-w-0 space-y-3 border-y border-border/60 py-4 text-sm">
            <div className="flex min-w-0 justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">Current plan</span>
              <span className="min-w-0 truncate text-right font-medium">
                {COMMERCIAL_PLAN_LABELS[preview.currentPlan]}
              </span>
            </div>
            <div className="flex min-w-0 justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">New plan</span>
              <span className="min-w-0 truncate text-right font-medium">
                {COMMERCIAL_PLAN_LABELS[preview.targetPlan]}
              </span>
            </div>
            <div className="flex min-w-0 justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">Billing account</span>
              <span className="min-w-0 text-right">
                <span className="block truncate font-medium">{selectedAccount.accountName}</span>
                <span className="mt-0.5 block truncate font-mono text-[12px] text-muted-foreground">
                  {selectedAccount.accountNumber}
                </span>
              </span>
            </div>
            <div className="flex min-w-0 justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">Monthly fee</span>
              <span className="type-finance-nums">{florin(preview.monthlyFee)}</span>
            </div>
            <div className="flex min-w-0 justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">Next billing</span>
              <span className="min-w-0 truncate text-right text-[13px]">
                {formatActivityDateTime(preview.nextBillingDate)}
              </span>
            </div>
            <div className="flex min-w-0 justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">Available balance</span>
              <span className="type-finance-nums">
                {florin(selectedAccount.availableBalance)}
              </span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-w-0 space-y-4">
        {preview ? (
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Pro is{" "}
            <span className="font-medium text-foreground type-finance-nums">
              {florin(preview.monthlyFee)}
            </span>
            /month, billed to a business Alta account.
          </p>
        ) : null}

        <label className="block min-w-0">
          <span className={fieldLabel}>Billing account</span>
          <Select
            value={billingAccountId}
            onValueChange={setBillingAccountId}
            disabled={!preview?.billingAccounts.length}
          >
            <SelectTrigger className={`${inputClass} h-auto min-h-10`}>
              <SelectValue placeholder="Select billing account" />
            </SelectTrigger>
            <SelectContent className="max-w-[min(100vw-2rem,24rem)]">
              {preview?.billingAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id} className="min-w-0">
                  <BillingAccountOptionLabel account={account} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 break-words text-[11px] text-muted-foreground">
            {preview
              ? `First charge ${florin(preview.monthlyFee)} · Next billing ${formatActivityDateTime(preview.nextBillingDate)}`
              : null}
          </p>
        </label>

        {composeError ? <p className="text-sm text-destructive">{composeError}</p> : null}
      </div>
    );
  }

  const footer =
    phase === "success" || phase === "error" || loading ? null : (
      <form
        className="[&_button[type=submit]]:w-full sm:[&_button[type=submit]]:w-auto"
        onSubmit={(e) => {
          e.preventDefault();
          if (phase === "review" || phase === "submitting") void submitUpgrade();
          else goToReview();
        }}
      >
        {phase === "review" || phase === "submitting" ? (
          <BankActionFooter>
            <BankActionSecondaryButton
              disabled={phase === "submitting"}
              onClick={() => setPhase("details")}
            >
              Back
            </BankActionSecondaryButton>
            <BankRequestSubmitButton
              kind="commercial_pro_upgrade"
              submitting={phase === "submitting"}
              showContainer={false}
            />
          </BankActionFooter>
        ) : (
          <BankActionFooter>
            <BankActionSecondaryButton onClick={() => handleOpenChange(false)}>
              Cancel
            </BankActionSecondaryButton>
            <BankRequestSubmitButton
              kind="commercial_pro_upgrade"
              submitting={false}
              disabled={!preview?.billingAccounts.length || !preview.canPurchase}
              label="Review Upgrade"
              showContainer={false}
            />
          </BankActionFooter>
        )}
      </form>
    );

  return (
    <>
      {children({ open: () => void openPanel(), loading })}
      <ResponsiveBankAction
        open={open}
        onOpenChange={handleOpenChange}
        title={title}
        description={description}
        phase={phase}
        dirty={dirty}
        showBack={showBack}
        onBack={() => {
          if (phase === "error") {
            setErrorReason(null);
            setPhase("review");
            return;
          }
          setPhase("details");
        }}
        footer={footer}
        size="md"
        scrollResetKey={phase}
      >
        {renderBody()}
      </ResponsiveBankAction>
    </>
  );
}
