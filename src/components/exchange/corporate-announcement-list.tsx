import { Card } from "@/components/page-shell";
import type { CorporateAnnouncement } from "@/lib/exchange/types";

export function CorporateAnnouncementList({
  announcements,
}: {
  announcements: CorporateAnnouncement[];
}) {
  if (announcements.length === 0) {
    return (
      <Card>
        <p className="text-[13px] text-muted-foreground">No corporate announcements published.</p>
      </Card>
    );
  }

  return (
    <Card className="!p-0">
      <ul>
        {announcements.map((a) => (
          <li key={a.id} className="border-b border-border/50 px-5 py-4 last:border-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">{a.date}</span>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
                  a.type === "financial"
                    ? "bg-gold/10 text-gold"
                    : "bg-surface-2 text-muted-foreground"
                }`}
              >
                {a.type === "financial" ? "Financial Update" : "Corporate"}
              </span>
            </div>
            <div className="mt-2 text-[15px] font-medium">{a.title}</div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{a.body}</p>
            {a.attachment && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-border/60 bg-surface-2/50 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                <span>{a.attachment.name}</span>
                <span className="text-muted-foreground/60">·</span>
                <span>{a.attachment.size}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
