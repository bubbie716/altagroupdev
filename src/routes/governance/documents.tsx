import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Section, Card } from "@/components/page-shell";
import { governanceDocuments } from "@/lib/governance/content";

export const Route = createFileRoute("/governance/documents")({
  head: () => ({
    meta: [
      { title: "Governance Documents — Alta Group" },
      {
        name: "description",
        content: "Corporate documents, policies, and operating standards for Alta Group N.V.",
      },
    ],
  }),
  component: GovernanceDocuments,
});

function GovernanceDocuments() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="border-b border-border/60 pb-12"
      >
        <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-gold">
          Governance
        </div>
        <h1 className="mt-5 text-[clamp(3.25rem,6vw,5rem)] font-semibold leading-[0.96] tracking-[-0.02em]">
          Governance Documents
        </h1>
        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Corporate documents, policies, and operating standards.
        </p>
      </motion.div>

      <main className="py-12">
        <Section title="Document library">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {governanceDocuments.map((doc) => (
              <Card key={doc.title} className="flex h-full flex-col">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Policy
                </div>
                <div className="mt-4 text-lg font-semibold tracking-tight">{doc.title}</div>
                <p className="mt-3 flex-1 text-[13px] leading-relaxed text-muted-foreground">
                  {doc.description}
                </p>
                <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
                  Coming Soon
                </div>
              </Card>
            ))}
          </div>
        </Section>
      </main>
    </>
  );
}
