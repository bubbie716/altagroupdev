import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { fetchUserNotifications, markNotificationReadRecord } from "@/lib/bank/deal-room.functions";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function InternalNotificationsBell({ variant = "page" }: { variant?: "page" | "header" }) {
  const loadNotifications = useServerFn(fetchUserNotifications);
  const markRead = useServerFn(markNotificationReadRecord);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchUserNotifications>> | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !data) {
      setLoading(true);
      try {
        setData(await loadNotifications());
      } finally {
        setLoading(false);
      }
    }
  }

  async function onRead(id: string) {
    await markRead({ data: id });
    setData((prev) =>
      prev
        ? {
            ...prev,
            unreadCount: Math.max(0, prev.unreadCount - 1),
            items: prev.items.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
          }
        : prev,
    );
  }

  const unread = data?.unreadCount ?? 0;
  const isHeader = variant === "header";

  return (
    <div className={cn("relative shrink-0", !isHeader && "mb-4 flex justify-end")}>
      <button
        type="button"
        onClick={() => void toggle()}
        className={cn(
          "relative inline-flex items-center justify-center rounded border border-border bg-surface-1 text-muted-foreground transition-colors hover:text-foreground",
          isHeader ? "size-8" : "px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em]",
        )}
        aria-expanded={open}
        aria-label="Notifications"
      >
        {isHeader ? <Bell className="size-3.5" /> : "Notifications"}
        {unread > 0 && (
          <span
            className={cn(
              "absolute inline-flex min-w-[1rem] items-center justify-center rounded-full bg-gold/20 px-1 text-[9px] tabular-nums text-gold",
              isHeader ? "-right-1 -top-1" : "ml-2 static",
            )}
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-surface-1 shadow-lg">
          <div className="border-b border-border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            Notifications
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loading && (
              <SkeletonRegion className="px-3 py-3" label="Loading notifications">
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2 border-b border-border/40 pb-3 last:border-0">
                      <Skeleton className="h-3 w-[70%] rounded" />
                      <Skeleton className="h-2.5 w-[45%] rounded" />
                    </div>
                  ))}
                </div>
              </SkeletonRegion>
            )}
            {!loading && data && data.items.length === 0 && (
              <p className="px-3 py-5 text-center text-[12px] text-muted-foreground">No notifications yet.</p>
            )}
            {!loading &&
              data?.items.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "border-b border-border/60 px-3 py-2.5 last:border-b-0",
                    !n.readAt && "bg-gold/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium">{n.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{n.body}</p>
                      {n.linkUrl && (
                        <a
                          href={n.linkUrl}
                          className="mt-1 inline-block font-mono text-[9px] uppercase tracking-[0.14em] text-gold hover:underline"
                          onClick={() => {
                            if (!n.readAt) void onRead(n.id);
                            setOpen(false);
                          }}
                        >
                          View
                        </a>
                      )}
                    </div>
                    {!n.readAt && (
                      <button
                        type="button"
                        onClick={() => void onRead(n.id)}
                        className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
                      >
                        Read
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
