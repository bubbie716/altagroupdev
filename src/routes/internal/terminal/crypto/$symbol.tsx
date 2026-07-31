import { createFileRoute, redirect } from "@tanstack/react-router";
import { TerminalCryptoAssetWorkspaceView } from "@/components/internal/workspace/terminal-crypto-asset-workspace-view";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { parseTerminalCryptoWorkspaceSearch } from "@/lib/internal/record-workspace-search";
import {
  fetchCryptoActivationReadinessFn,
  fetchCryptoOpsAssetWorkspaceFn,
  type CryptoOpsActorCapabilities,
} from "@/lib/terminal/crypto/crypto-ops.functions";
import type { CryptoOpsAssetWorkspace } from "@/lib/terminal/crypto/crypto-ops-read.service";
import type { ActivationReadinessResult } from "@/lib/terminal/crypto/crypto-activation-readiness.service";

export const Route = createFileRoute("/internal/terminal/crypto/$symbol")({
  validateSearch: (search: Record<string, unknown>) => parseTerminalCryptoWorkspaceSearch(search),
  loader: async ({ params }) => {
    const symbol = params.symbol.trim().toUpperCase();
    const result = await fetchCryptoOpsAssetWorkspaceFn({ data: symbol });
    if (!result.ok) {
      throw redirect({
        to: "/internal/terminal/crypto",
        search: (prev: Record<string, unknown>) =>
          normalizeInternalSearch({
            site: typeof prev.site === "string" ? prev.site : "terminal",
          }),
      });
    }
    let readiness: ActivationReadinessResult | null = null;
    if (
      result.workspace.status === "DRAFT" ||
      result.workspace.status === "HALTED" ||
      result.workspace.status === "REDEMPTION_ONLY"
    ) {
      const readinessRes = await fetchCryptoActivationReadinessFn({ data: symbol });
      if (readinessRes.ok) readiness = readinessRes.readiness;
    }
    return {
      workspace: result.workspace as CryptoOpsAssetWorkspace,
      capabilities: result.capabilities as CryptoOpsActorCapabilities,
      readiness,
    };
  },
  head: ({ loaderData, match }) => ({
    meta: [
      {
        title: internalDocumentTitle(
          loaderData?.workspace.symbol ?? "Crypto market",
          (match.search as { site?: string }).site ?? "terminal",
        ),
      },
    ],
  }),
  component: TerminalCryptoAssetRoute,
});

function TerminalCryptoAssetRoute() {
  const { workspace, capabilities, readiness } = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <TerminalCryptoAssetWorkspaceView
      workspace={workspace}
      capabilities={capabilities}
      readiness={readiness}
      search={search}
    />
  );
}
