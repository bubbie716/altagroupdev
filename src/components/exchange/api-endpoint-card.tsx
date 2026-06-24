import { Card } from "@/components/page-shell";
import type { ApiEndpoint } from "@/lib/exchange/api-docs";

export function ApiEndpointCard({ endpoint, baseUrl }: { endpoint: ApiEndpoint; baseUrl: string }) {
  return (
    <Card className="!p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-5 py-3">
        <span className="rounded bg-[var(--success)]/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--success)]">
          {endpoint.method}
        </span>
        <code className="font-mono text-[13px] text-foreground">
          {baseUrl}
          {endpoint.path}
        </code>
      </div>
      <div className="space-y-3 px-5 py-4">
        <p className="text-[14px] leading-relaxed text-muted-foreground">{endpoint.summary}</p>
        {endpoint.params && (
          <div>
            <div className="type-meta">
              Parameters
            </div>
            <p className="mt-1 font-mono text-[12px] text-foreground/80">{endpoint.params}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-6 border-t border-border/40 pt-3">
          <div>
            <div className="type-meta">
              Mock function
            </div>
            <code className="mt-1 block font-mono text-[12px] text-gold">{endpoint.mockFn}</code>
          </div>
          <div>
            <div className="type-meta">
              Response
            </div>
            <code className="mt-1 block font-mono text-[12px] text-foreground/80">{endpoint.response}</code>
          </div>
        </div>
      </div>
    </Card>
  );
}
