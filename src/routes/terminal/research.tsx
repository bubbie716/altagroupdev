import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
import { TerminalSubNav } from "@/components/terminal/terminal-sub-nav";
import { ResearchCard } from "@/components/terminal/research-card";
import { getTerminalResearch } from "@/lib/terminal/api";
import type { TerminalResearchItem } from "@/lib/terminal/api";

const filters = ["All", "Company Reports", "Market Notes", "Filings", "IPO Prospectuses", "Economic Reports"];

function matchesFilter(item: TerminalResearchItem, filter: string) {
  if (filter === "All") return true;
  if (filter === "Company Reports") return item.category.includes("Company") || item.category.includes("Report");
  if (filter === "Market Notes") return item.category.includes("Market") || item.category.includes("Commentary");
  if (filter === "Filings") return item.category.includes("Filing");
  if (filter === "IPO Prospectuses") return item.category.includes("Prospectus") || item.category.includes("IPO");
  if (filter === "Economic Reports") return item.category.includes("Economic");
  return true;
}

export const Route = createFileRoute("/terminal/research")({
  head: () => ({
    meta: [{ title: "Research — Alta Terminal" }],
  }),
  component: TerminalResearch,
});

function TerminalResearch() {
  const terminalResearch = getTerminalResearch();

  return (
    <PageShell
      eyebrow="Alta Terminal · Research"
      title="Research"
      description="Company reports, market notes, exchange filings, and economic research — simulated document library."
    >
      <TerminalSubNav />

      <div className="mb-8 flex flex-wrap gap-2">
        {filters.map((f, i) => (
          <button
            key={f}
            type="button"
            className={`rounded-md px-3 py-1.5 text-[12px] tracking-wide ${
              i === 0 ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
        <input
          type="search"
          placeholder="Search research…"
          className="ml-auto w-full max-w-xs rounded-md border border-border bg-surface-2/50 px-3 py-1.5 text-sm text-muted-foreground md:w-64"
          disabled
        />
      </div>

      <Section title="Research Library">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {terminalResearch.filter((r) => matchesFilter(r, "All")).map((r) => (
            <ResearchCard key={r.title} title={r.title} category={r.category} date={r.date} issuer={r.issuer} />
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
