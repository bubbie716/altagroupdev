"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { AltaCardRow } from "@/lib/bank/alta-card-types";
import type { AltaCardAutopayContext } from "@/lib/bank/alta-card-autopay-types";
import type { AltaCardReviewEligibility } from "@/lib/bank/alta-card-review-types";
import { ResponsiveBankAction } from "@/components/bank/actions/responsive-bank-action";
import { AltaCardAutopayPanel } from "@/components/bank/alta-card/alta-card-autopay-panel";
import { activateAltaCardRecord } from "@/lib/bank/alta-card.functions";
import {
  altaCardReviewDetailLink,
  altaCardReviewLink,
  altaCardStatementsLink,
} from "@/lib/bank/alta-card-navigation";
import { useCreditDeskCustomerNav } from "@/hooks/use-credit-desk-nav";
import { useBankActionLauncher } from "@/components/bank/actions/use-bank-action-launcher";
import { closeThenRun } from "@/lib/ui/close-then-run";
import { getUiLabAltaCardOverlay } from "@/lib/bank/ui-lab-alta-card-state";
import type { BankActionPhase } from "@/lib/bank/bank-action-flow";
import { cn } from "@/lib/utils";
import { useOptionalProductConsentAction } from "@/components/legal/product-consent-action-controller";
import { executeWithProductConsentResume } from "@/lib/legal/execute-with-product-consent";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";

type ManageView = "menu" | "autopay";

function ManageMenuItem({
  label,
  description,
  onClick,
  disabled,
  variant = "default",
}: {
  label: string;
  description?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "primary";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary"
          ? "border-foreground bg-foreground text-background hover:bg-foreground/90"
          : "border-border bg-surface-2/40 hover:bg-surface-2",
      )}
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.14em]">{label}</span>
      {description ? (
        <span
          className={cn(
            "mt-1 block text-[12px]",
            variant === "primary" ? "text-background/80" : "text-muted-foreground",
          )}
        >
          {description}
        </span>
      ) : null}
    </button>
  );
}

export function AltaCardManageSheet({
  card,
  reviewEligibility,
  autopayContext,
  open,
  onOpenChange,
  initialView = "menu",
}: {
  card: AltaCardRow;
  reviewEligibility?: AltaCardReviewEligibility | null;
  autopayContext?: AltaCardAutopayContext | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialView?: ManageView;
}) {
  const router = useRouter();
  const creditDeskNav = useCreditDeskCustomerNav();
  const { openAction } = useBankActionLauncher();
  const consentAction = useOptionalProductConsentAction();
  const [view, setView] = useState<ManageView>(initialView);
  const [autopayDirty, setAutopayDirty] = useState(false);
  const [autopayPhase, setAutopayPhase] = useState<BankActionPhase>("details");
  const [activateError, setActivateError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setView(initialView);
      setAutopayDirty(false);
      setAutopayPhase("details");
    }
  }, [open, initialView]);

  const activeReviewId = reviewEligibility?.activeReviewId ?? null;
  const canReview =
    card.status !== "closed" && (creditDeskNav.showApplyEntryPoints || !!activeReviewId);

  function closeSheet() {
    setAutopayDirty(false);
    setAutopayPhase("details");
    onOpenChange(false);
  }

  function navigateFromSheet(navigate: () => void) {
    closeThenRun(closeSheet, navigate);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setView(initialView);
      setAutopayDirty(false);
      setAutopayPhase("details");
      onOpenChange(true);
      return;
    }
    onOpenChange(false);
    setTimeout(() => {
      setView("menu");
      setAutopayDirty(false);
      setAutopayPhase("details");
    }, 320);
  }

  function goToMenu() {
    if (autopayPhase === "submitting") return;
    setView("menu");
    setAutopayDirty(false);
    setAutopayPhase("details");
  }

  const title = view === "autopay" ? "Autopay" : "Manage card";
  const description =
    view === "autopay" && autopayPhase !== "submitting" && autopayPhase !== "success"
      ? "Automatically pay your statement from an Alta Bank account on the payment due date."
      : view === "autopay"
        ? undefined
        : "Card settings and account tools.";
  const overlay = getUiLabAltaCardOverlay(card.id);
  const autopayOn =
    overlay?.autopayEnabled ?? autopayContext?.settings.enabled ?? false;
  const sheetPhase = view === "autopay" ? autopayPhase : "details";

  return (
    <ResponsiveBankAction
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      phase={sheetPhase}
      dirty={view === "autopay" && autopayDirty && sheetPhase !== "submitting" && sheetPhase !== "success"}
      size="md"
      showBack={view === "autopay" && sheetPhase !== "submitting" && sheetPhase !== "success"}
      onBack={goToMenu}
    >
      {view === "menu" ? (
        <div className="space-y-2">
          {card.status === "pending" ? (
            <ManageMenuItem
              label="Activate card"
              description="Activate your card to start using it."
              variant="primary"
              onClick={() => {
                void (async () => {
                  setActivateError(null);
                  try {
                    await executeWithProductConsentResume(async () => {
                      if (consentAction) {
                        await consentAction.requestConsent(["BANK", "ALTA_CARD"]);
                      }
                      return activateAltaCardRecord({ data: card.id });
                    }, consentAction);
                    closeSheet();
                    void router.invalidate();
                  } catch (err) {
                    setActivateError(formatCustomerActionError(err, "card_apply"));
                  }
                })();
              }}
            />
          ) : null}
          {activateError ? (
            <p className="px-1 text-[12px] text-destructive" role="alert">
              {activateError}
            </p>
          ) : null}

          {card.status === "active" ? (
            <ManageMenuItem
              label="Freeze card"
              description="Temporarily block new purchases and cash advances."
              onClick={() => {
                closeSheet();
                openAction("card-freeze", { cardId: card.id });
              }}
            />
          ) : null}

          {card.status === "frozen" ? (
            <ManageMenuItem
              label="Unfreeze card"
              description="Restore purchases and cash advances."
              variant="primary"
              onClick={() => {
                closeSheet();
                openAction("card-unfreeze", { cardId: card.id });
              }}
            />
          ) : null}

          {card.status !== "closed" ? (
            <ManageMenuItem
              label="Autopay"
              description={
                autopayOn
                  ? "Automatic payments are on."
                  : "Set up automatic payments."
              }
              onClick={() => setView("autopay")}
            />
          ) : null}

          <ManageMenuItem
            label="Statements"
            description="View and download past statements."
            onClick={() => {
              const link = altaCardStatementsLink(card);
              navigateFromSheet(() => {
                void router.navigate(link);
              });
            }}
          />

          <ManageMenuItem
            label="Account review"
            description={
              canReview
                ? "Request a limit or tier review."
                : "Not available for this card."
            }
            disabled={!canReview}
            onClick={() => {
              if (!canReview) return;
              const link =
                activeReviewId && !creditDeskNav.showApplyEntryPoints
                  ? altaCardReviewDetailLink(card, activeReviewId)
                  : altaCardReviewLink(card);
              navigateFromSheet(() => {
                void router.navigate(link);
              });
            }}
          />
        </div>
      ) : (
        <AltaCardAutopayPanel
          card={card}
          initialContext={autopayContext ?? undefined}
          onDirtyChange={setAutopayDirty}
          onPhaseChange={setAutopayPhase}
        />
      )}
    </ResponsiveBankAction>
  );
}
