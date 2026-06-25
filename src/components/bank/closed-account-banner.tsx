import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import { HideClosedAccountButton } from "@/components/bank/hide-closed-account-button";
import { useHiddenClosedAccounts } from "@/hooks/use-hidden-closed-accounts";

export function ClosedAccountBanner({ accountId }: { accountId: string }) {
  const navigate = useNavigate();
  const { hideAccount } = useHiddenClosedAccounts();

  return (
    <Card className="mb-8 border-border/80 bg-surface-2/30 !p-5">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        This account is closed. You can still review activity and statements here, or remove it from
        your dashboard overview.
      </p>
      <HideClosedAccountButton
        className="mt-3"
        onHide={() => {
          hideAccount(accountId);
          void navigate({ to: "/bank" });
        }}
      />
    </Card>
  );
}
