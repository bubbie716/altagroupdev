import { createFileRoute } from "@tanstack/react-router";
import { FadeIn } from "@/components/ui/fade-in";
import { Section } from "@/components/page-shell";
import { LeadershipRoleCard } from "@/components/governance/leadership-card";
import {
  boardOfDirectors,
  divisionLeadership,
  executiveLeadership,
} from "@/lib/governance/content";
import { CorporatePageShell } from "@/components/site/corporate-page-shell";

export const Route = createFileRoute("/leadership/")({
  head: () => ({
    meta: [
      { title: "Leadership — Alta Group" },
      {
        name: "description",
        content: "Governance, executive leadership, and divisional oversight for Alta Group N.V.",
      },
    ],
  }),
  component: LeadershipPage,
});

function LeadershipPage() {
  return (
    <CorporatePageShell>
      <FadeIn className="border-b border-border/60 pb-12">
        <div className="type-eyebrow">Leadership</div>
        <h1 className="mt-5 text-[clamp(3.25rem,6vw,5rem)] font-semibold leading-[0.96] tracking-[-0.02em]">
          Leadership
        </h1>
        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Governance, executive leadership, and divisional oversight for Alta Group N.V.
        </p>
      </FadeIn>

      <main className="py-12">
        <Section title="Board of Directors">
          <div className="grid gap-4 md:grid-cols-3">
            {boardOfDirectors.map((role) => (
              <LeadershipRoleCard key={role.title} role={role} />
            ))}
          </div>
        </Section>

        <Section title="Executive Leadership" className="mt-12">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {executiveLeadership.map((role) => (
              <LeadershipRoleCard key={role.title} role={role} />
            ))}
          </div>
        </Section>

        {divisionLeadership.map((group) => (
          <Section key={group.division} title={group.sectionTitle} className="mt-12">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {group.roles.map((role) => (
                <LeadershipRoleCard key={`${group.division}-${role.title}`} role={role} />
              ))}
            </div>
          </Section>
        ))}
      </main>
    </CorporatePageShell>
  );
}
