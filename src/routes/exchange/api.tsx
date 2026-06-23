import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { ExchangeSubNav } from "@/components/exchange/exchange-sub-nav";
import { ApiDocsPanel } from "@/components/exchange/api-docs-panel";
import { developerBeforeLoad } from "@/lib/auth/guards";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { ApiSession } from "@/lib/exchange/api-access";

export const Route = createFileRoute("/exchange/api")({
  beforeLoad: developerBeforeLoad,
  head: () => ({
    meta: [{ title: "Exchange API — Alta Exchange" }],
  }),
  component: ExchangeApi,
});

function developerSession(user: NonNullable<ReturnType<typeof useCurrentUser>>): ApiSession {
  return {
    organization: user.discordUsername,
    key: `alta_dev_${user.id.slice(0, 8)}`,
  };
}

function ExchangeApi() {
  const user = useCurrentUser();
  if (!user) return null;

  const session = developerSession(user);

  return (
    <PageShell
      eyebrow="Alta Exchange · Developer API"
      title="Exchange API"
      description="Licensed market data access for Alta Terminal, brokerages, and institutional integrations."
    >
      <ExchangeSubNav />
      <ApiDocsPanel session={session} onSignOut={() => {}} />
    </PageShell>
  );
}
