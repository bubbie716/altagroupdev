import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { PageShell } from "@/components/page-shell";
import { DealStatusBadge } from "@/components/bank/deal-room/deal-room-bits";
import { DealRoomChat } from "@/components/bank/deal-room/deal-room-chat";
import { DealContextRail } from "@/components/bank/deal-room/deal-context-rail";
import { EmptyState } from "@/components/shared/empty-state";
import { getDealRoom } from "@/lib/bank/deal-rooms-mock";

export const Route = createFileRoute("/bank/lending/deal-rooms/$dealRoomId")({
  loader: ({ params }) => {
    const room = getDealRoom(params.dealRoomId);
    if (!room) throw notFound();
    return room;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.loanProduct} — Deal Room — Alta Bank`
          : "Deal Room — Alta Bank",
      },
    ],
  }),
  notFoundComponent: () => (
    <PageShell eyebrow="Alta Bank · Lending" title="Deal Room Not Found">
      <EmptyState
        tag="404"
        title="This deal room is not available"
        description="It may have been closed, archived, or is restricted to another counterparty."
        action={
          <Link
            to="/bank/lending/deal-rooms"
            className="rounded-md border border-border bg-surface-2 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground"
          >
            Back to Deal Rooms
          </Link>
        }
      />
    </PageShell>
  ),
  component: DealRoomDetailPage,
});

function DealRoomDetailPage() {
  const room = Route.useLoaderData();
  const [showContext, setShowContext] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-background">
      <SiteNav />

      <header className="border-b border-border bg-surface-1/80 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            to="/bank/lending/deal-rooms"
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
          >
            ← Deal rooms
          </Link>
          <span className="hidden h-4 w-px bg-border sm:inline" aria-hidden />
          <div className="flex min-w-0 flex-1 items-baseline gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {room.id}
            </span>
            <h1 className="truncate font-serif text-[18px] tracking-tight sm:text-[22px]">
              {room.loanProduct}
            </h1>
            <span className="hidden text-[12px] text-muted-foreground sm:inline">
              · {room.company ?? room.applicant}
            </span>
          </div>
          <DealStatusBadge status={room.status} />
          <button
            type="button"
            onClick={() => setShowContext(true)}
            className="rounded-md border border-border bg-surface-2/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground hover:bg-surface-2 lg:hidden"
          >
            Deal
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="flex min-h-0 flex-col">
          <DealRoomChat room={room} />
        </main>

        <aside className="hidden min-h-0 overflow-y-auto border-l border-border bg-surface-1/50 px-5 py-6 lg:block">
          <DealContextRail room={room} />
        </aside>
      </div>

      {showContext ? (
        <div className="fixed inset-0 z-50 flex flex-col lg:hidden">
          <button
            type="button"
            aria-label="Close deal context"
            onClick={() => setShowContext(false)}
            className="flex-1 bg-foreground/30 backdrop-blur-sm"
          />
          <div className="max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-background px-5 py-5 shadow-elevated">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-[18px] tracking-tight">Deal</h2>
              <button
                type="button"
                onClick={() => setShowContext(false)}
                className="rounded-md border border-border bg-surface-2/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground"
              >
                Close
              </button>
            </div>
            <DealContextRail room={room} />
          </div>
        </div>
      ) : null}
    </div>
  );
}