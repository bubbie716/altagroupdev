import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { TerminalPageMeta } from "@/components/terminal/terminal-layout";
import { EmptyPortfolioState } from "@/components/data/empty-portfolio-state";
import { getTerminalDescription } from "@/lib/terminal/api";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/terminal/")({
  beforeLoad: authBeforeLoad,
  head: () => ({
    meta: [
      { title: "Alta Terminal — Invest Like the 1%" },
      { name: "description", content: getTerminalDescription() },
    ],
  }),
  component: TerminalHome,
});

function TerminalHome() {
  const terminalDescription = getTerminalDescription();

  // #region agent log
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const data = {
      href: window.location.href,
      host: window.location.host,
      pathname: window.location.pathname,
      hasOAuthCode: params.has("code"),
      hasOAuthState: params.has("state"),
      hasHandoff: params.has("handoff"),
      hasError: params.has("error"),
      redirectParam: params.get("redirect"),
    };
    fetch("http://127.0.0.1:7929/ingest/900968cf-7850-40f1-892f-1e344d1892dd", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "49e5fc" },
      body: JSON.stringify({
        sessionId: "49e5fc",
        runId: "pre-fix",
        hypothesisId: "A_B",
        location: "routes/terminal/index.tsx:TerminalHome",
        message: "Terminal home mounted after navigation",
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    console.error("[alta-debug-49e5fc] terminal-home", data);
  }, []);
  // #endregion

  return (
    <>
      <TerminalPageMeta title="Invest Like the 1%" description={terminalDescription} />
      <EmptyPortfolioState
        title="No portfolio connected yet."
        description="Holdings, performance, and market tools will appear here once Alta Terminal portfolio services are connected to your account."
      />
    </>
  );
}
