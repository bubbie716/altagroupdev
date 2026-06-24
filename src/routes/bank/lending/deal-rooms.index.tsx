import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { LendingSubNav } from "@/components/bank/lending-sub-nav";
import { DealRoomCard } from "@/components/bank/deal-room/deal-room-bits";
import { EmptyState } from "@/components/shared/empty-state";
import { MOCK_DEAL_ROOMS } from "@/lib/bank/deal-rooms-mock";

export const Route = createFileRoute("/bank/lending/deal-rooms/")({
  head: () => ({
    meta: [
      { title: "Secure Deal Rooms — Alta Bank" },
      {
        name: "description",
        content: "Active credit negotiations between Alta Bank applicants and the credit desk.",
      },
    ],
  }),
  component: DealRoomDirectoryPage,
});

function DealRoomDirectoryPage() {
  const rooms = MOCK_DEAL_ROOMS;

  return (
    <PageShell
      eyebrow="Alta Bank · Lending"
      title="Secure Deal Rooms"
      description="Confidential workspaces between you, your representatives, and the Alta credit desk. Every active facility under negotiation lives here."
    >
      <BankSubNav />
      <LendingSubNav />

      <Section>
        {rooms.length === 0 ? (
          <EmptyState
            tag="No active rooms"
            title="No Active Deal Rooms"
            description="When you submit a credit application, a deal room is created for you and your assigned officer. All negotiation, term sheets, and contract activity will appear here."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rooms.map((room) => (
              <DealRoomCard
                key={room.id}
                room={room}
                href={`/bank/lending/deal-rooms/${room.id}`}
              />
            ))}
          </div>
        )}
      </Section>
    </PageShell>
  );
}