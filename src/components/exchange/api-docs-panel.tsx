import { Card, Section } from "@/components/page-shell";
import { ApiEndpointCard } from "@/components/exchange/api-endpoint-card";
import {
  exchangeApiBaseUrl,
  exchangeApiConsumers,
  exchangeApiEndpoints,
} from "@/lib/exchange/api-docs";
import { maskApiKey, type ApiSession } from "@/lib/exchange/api-access";

export function ApiDocsPanel({
  session,
  onSignOut,
}: {
  session: ApiSession;
  onSignOut: () => void;
}) {
  return (
    <>
      <Card className="mb-10 flex flex-wrap items-center justify-between gap-4 border-gold/30 bg-gold/5">
        <div>
          <div className="type-meta">
            Authenticated
          </div>
          <div className="mt-1 font-medium">{session.organization}</div>
          <code className="mt-1 block font-mono text-[12px] text-muted-foreground">
            {maskApiKey(session.key)}
          </code>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-md border border-border px-4 py-2 text-[13px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          Sign out
        </button>
      </Card>

      <Card className="mb-10">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Documentation below is available to licensed API consumers only. Market data endpoints are
          not yet connected — responses are unavailable until Alta Exchange services are live.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Architecture">
          <Card>
            <pre className="overflow-x-auto font-mono text-[12px] leading-relaxed text-muted-foreground">
{`Alta Terminal / third-party brokerages
              ↓
      Alta Exchange API (HTTP)
              ↓
        Exchange data services`}
            </pre>
            <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
              First-party and third-party consumers share a single API surface. Alta Terminal — an Alta Exchange product — is a
              client, not the exchange itself. Licensed brokerages receive the same market data and
              listing endpoints under separate credentials.
            </p>
          </Card>
        </Section>

        <Section title="Base URL">
          <Card>
            <div className="type-meta">
              Production (planned)
            </div>
            <code className="mt-2 block break-all font-mono text-[14px] text-gold">
              {exchangeApiBaseUrl}
            </code>
            <div className="mt-6 type-meta">
              Your credentials
            </div>
            <div className="mt-2 rounded-md border border-border/60 bg-surface-2 px-3 py-2 font-mono text-[11px] text-foreground/90">
              Authorization: Bearer {session.key}
            </div>
          </Card>
        </Section>
      </div>

      <Section title="Authorized Consumers" className="mt-12">
        <div className="grid gap-4 md:grid-cols-3">
          {exchangeApiConsumers.map((c) => (
            <Card key={c.name}>
              <div className="font-medium">{c.name}</div>
              <div className="mt-1 text-[13px] text-muted-foreground">{c.role}</div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Endpoints" className="mt-12">
        <p className="mb-6 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Read-only market data endpoints. Order routing and execution APIs will be documented
          separately under a trading namespace.
        </p>
        <div className="space-y-4">
          {exchangeApiEndpoints.map((endpoint) => (
            <ApiEndpointCard
              key={endpoint.path}
              endpoint={endpoint}
              baseUrl={exchangeApiBaseUrl}
            />
          ))}
        </div>
      </Section>

      <Section title="SDK Import" className="mt-12">
        <Card>
          <div className="type-meta">
            TypeScript — unavailable until services are live
          </div>
          <pre className="mt-3 overflow-x-auto rounded-md border border-border/60 bg-surface-2 p-4 font-mono text-[12px] leading-relaxed text-foreground/90">
{`import { exchangeApi } from "@/lib/exchange/api";

const companies = exchangeApi.getCompanies();
const profile = exchangeApi.getCompany("NPC");
const stats = exchangeApi.getMarketStats();`}
          </pre>
        </Card>
      </Section>
    </>
  );
}
