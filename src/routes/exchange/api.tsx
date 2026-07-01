"use client";

import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ExchangePageMeta } from "@/components/exchange/exchange-page-layout";
import { ApiAccessGate } from "@/components/exchange/api-access-gate";
import { ApiDocsPanel } from "@/components/exchange/api-docs-panel";
import { clearApiSession, readApiSession, type ApiSession } from "@/lib/exchange/api-access";

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

  return (
    <>
      <ExchangePageMeta
        eyebrow="Alta Exchange · Developer API"
        title="Exchange API"
        description="Licensed market data access for Alta Exchange Terminal, brokerages, and institutional integrations."
      />
      {!ready ? null : session ? (
        <ApiDocsPanel session={session} onSignOut={handleSignOut} />
      ) : (
        <ApiAccessGate onAuthenticated={setSession} />
      )}
    </>
  );
}
