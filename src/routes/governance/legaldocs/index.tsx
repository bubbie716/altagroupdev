import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Section } from "@/components/page-shell";
import { LegalDocCard } from "@/components/governance/legal-doc-card";
import {
  legalDocCategoryOrder,
  legalDocsByCategory,
} from "@/lib/governance/legal-docs-catalog";

export const Route = createFileRoute("/governance/legaldocs/")({
  head: () => ({
    meta: [
      { title: "Legal Documents — Alta Group" },
      {
        name: "description",
        content:
          "Corporate governance charters, terms of service, privacy policy, banking agreements, exchange rules, and NCC operating documents for the Alta ecosystem.",
      },
    ],
  }),
  component: LegalDocsIndexPage,
});

function LegalDocsIndexPage() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="border-b border-border/60 pb-12"
      >
        <div className="type-eyebrow">Governance</div>
        <h1 className="mt-5 text-[clamp(3.25rem,6vw,5rem)] font-semibold leading-[0.96] tracking-[-0.02em]">
          Legal Documents
        </h1>
        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Published corporate governance, platform policies, subsidiary agreements, fee schedules,
          and product terms for Alta Group and its operating divisions.
        </p>
      </motion.div>

      <main className="py-12">
        {legalDocCategoryOrder.map((category, index) => {
          const docs = legalDocsByCategory[category];
          if (docs.length === 0) return null;

          return (
            <Section key={category} title={category} className={index > 0 ? "mt-12" : undefined}>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {docs.map((doc) => (
                  <LegalDocCard key={doc.id} doc={doc} />
                ))}
              </div>
            </Section>
          );
        })}
      </main>
    </>
  );
}
