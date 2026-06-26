import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { fetchUserNotifications, markNotificationReadRecord } from "@/lib/bank/deal-room.functions";
import { cn } from "@/lib/utils";

export function InternalNotificationsBell() {
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

  return (
    <div className="relative mb-4 flex justify-end">
      <button
        type="button"
        onClick={() => void toggle()}
        className="relative rounded-md border border-border bg-surface-1 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        aria-expanded={open}
        aria-label="Notifications"
      >
        Notifications
        {unread > 0 && (
          <span className="ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-gold/20 px-1.5 py-0.5 text-[9px] tabular-nums text-gold">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface-1 shadow-lg">
          <div className="border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            In-app notifications
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">Loading…</p>}
            {!loading && data && data.items.length === 0 && (
              <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">No notifications yet.</p>
            )}
            {!loading &&
              data?.items.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "border-b border-border/60 px-4 py-3 last:border-b-0",
                    !n.readAt && "bg-gold/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">{n.title}</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">{n.body}</p>
                      {n.linkUrl && (
                        <a
                          href={n.linkUrl}
                          className="mt-1 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-gold hover:underline"
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
                        className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
                      >
                        Mark read
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
