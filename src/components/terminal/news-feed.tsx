import { Card } from "@/components/page-shell";
import type { TerminalNewsItem } from "@/lib/terminal/api";

export function NewsFeed({ items }: { items: TerminalNewsItem[] }) {
  return (
    <Card className="!p-0">
      <ul>
        {items.map((n) => (
          <li key={n.headline} className="border-b border-border/50 px-5 py-4 last:border-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">
                {n.category}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">{n.date}</span>
              <span className="text-[11px] text-muted-foreground">· {n.source}</span>
            </div>
            <p className="mt-2 text-[14px] leading-snug">{n.headline}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
