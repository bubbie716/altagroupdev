import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
import { TerminalSubNav } from "@/components/terminal/terminal-sub-nav";
import { NewsFeed } from "@/components/terminal/news-feed";
import { getTerminalNews } from "@/lib/terminal/api";

const categories = ["All", "Market", "Company", "Exchange", "Bank", "Macro"] as const;

export const Route = createFileRoute("/terminal/news")({
  head: () => ({
    meta: [{ title: "Market News — Alta Terminal" }],
  }),
  component: TerminalNews,
});

function TerminalNews() {
  const terminalNews = getTerminalNews();

  return (
    <PageShell
      eyebrow="Alta Terminal · News"
      title="Market News"
      description="Market updates, company announcements, exchange notices, and macro headlines — simulated feed."
    >
      <TerminalSubNav />

      {categories.map((cat, i) => (
        <Section
          key={cat}
          title={cat === "All" ? "All Headlines" : cat}
          className={i > 0 ? "mt-12" : undefined}
        >
          <NewsFeed
            items={
              cat === "All" ? terminalNews : terminalNews.filter((n) => n.category === cat)
            }
          />
        </Section>
      ))}
    </PageShell>
  );
}
