import { createFileRoute } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { fetchBusinessAccountContextForModule } from "@/lib/bank/business-account.functions";
import { fetchUserBankAccountDetail } from "@/lib/bank/bank.functions";
import { canManageBusinessModule } from "@/lib/bank/business-account-access";
import { Route as AccountRoute } from "./route";

export const Route = createFileRoute("/bank/account/$accountId/settings")({
  loader: async ({ params }) => {
    const account = await fetchUserBankAccountDetail({ data: params.accountId });
    if (account.accountType === "business_operating") {
      await fetchBusinessAccountContextForModule({
        data: { accountId: params.accountId, module: "settings" },
      });
    }
    return null;
  },
  head: () => ({ meta: [{ title: "Settings — Account" }] }),
  component: AccountSettingsPage,
});

function AccountSettingsPage() {
  const { account, businessContext, isBusinessOperating } = AccountRoute.useLoaderData();
  const canManageSettings =
    !isBusinessOperating ||
    (businessContext && canManageBusinessModule(businessContext.role, "settings"));

  return (
    <Section title="Account settings">
      <Card className="!p-6">
        {isBusinessOperating ? (
          <>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Company ownership settings and representative management are handled through your
              company profile and the Representatives tab on this account.
            </p>
            {!canManageSettings && (
              <p className="mt-4 text-[13px] text-muted-foreground">
                Your role has view-only access to account settings. Contact a company owner for
                ownership changes.
              </p>
            )}
          </>
        ) : (
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Personal account preferences and notice settings will appear here in a future release.
            Account: {account.accountNumber}
          </p>
        )}
      </Card>
    </Section>
  );
}
