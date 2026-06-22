import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { ExchangeSubNav } from "@/components/exchange/exchange-sub-nav";
import { ApiAccessGate } from "@/components/exchange/api-access-gate";
import { ApiDocsPanel } from "@/components/exchange/api-docs-panel";
import {
  clearApiSession,
  readApiSession,
  type ApiSession,
} from "@/lib/exchange/api-access";

export const Route = createFileRoute("/exchange/api")({
  head: () => ({
    meta: [{ title: "Exchange API — Alta Exchange" }],
  }),
  component: ExchangeApi,
});

function ExchangeApi() {
  const [session, setSession] = useState<ApiSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(readApiSession());
    setReady(true);
  }, []);

  function handleSignOut() {
    clearApiSession();
    setSession(null);
  }

  if (!ready) return null;

  return (
    <PageShell
      eyebrow="Alta Exchange · Developer API"
      title="Exchange API"
      description={
        session
          ? "Licensed market data access for Alta Terminal, brokerages, and institutional integrations."
          : "Programmatic access to Alta Exchange market data. Credentials required."
      }
    >
      <ExchangeSubNav />

      {session ? (
        <ApiDocsPanel session={session} onSignOut={handleSignOut} />
      ) : (
        <div className="flex justify-center">
          <ApiAccessGate onAuthenticated={setSession} />
        </div>
      )}
    </PageShell>
  );
}
