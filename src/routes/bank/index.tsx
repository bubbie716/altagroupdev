import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { PageShell, Section, Card } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { getBankDescription, getMarketingSections } from "@/lib/bank/api";

export const Route = createFileRoute("/bank/")({
  head: () => ({
    meta: [
      { title: "Alta Bank — Bank Like the 1%" },
      { name: "description", content: getBankDescription() },
    ],
  }),
  component: BankHome,
});

function BankHome() {
  const bankDescription = getBankDescription();
  const bankMarketingSections = getMarketingSections();

  return (
    <PageShell eyebrow="Alta Bank" title="Bank Like the 1%" description={bankDescription}>
      <BankSubNav />

      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
        {bankMarketingSections.map((s, i) => (
          <Link
            key={s.title}
            to={s.to}
            className="group flex flex-col bg-surface-1 p-7 transition-colors hover:bg-surface-2"
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="flex h-full flex-col"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Alta Bank
                </span>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-all group-hover:text-gold" />
              </div>
              <h3 className="mt-8 text-xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-3 flex-1 text-[13.5px] leading-relaxed text-muted-foreground">{s.desc}</p>
            </motion.div>
          </Link>
        ))}
      </div>

      <Section title="Open an Account" className="mt-16">
        <Card className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-semibold tracking-tight">New to Newport? Start with Alta Access.</div>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
              Alta Bank is Newport's full-service financial institution — open to citizens, businesses,
              and institutions. New citizens begin with Alta Access; established clients upgrade to
              Alta Checking, Reserve, and beyond.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Link
              to="/bank/deposits"
              className="rounded-md border border-border px-5 py-3 text-center text-[13px] font-medium tracking-wide"
            >
              View Deposits
            </Link>
            <Link
              to="/bank/dashboard"
              className="rounded-md bg-foreground px-5 py-3 text-center text-[13px] font-medium tracking-wide text-background"
            >
              Financial Position
            </Link>
          </div>
        </Card>
      </Section>
    </PageShell>
  );
}
