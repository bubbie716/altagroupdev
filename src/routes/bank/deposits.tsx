import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { ProductCard } from "@/components/bank/product-card";
import { getDepositProducts } from "@/lib/bank/api";

export const Route = createFileRoute("/bank/deposits")({
  head: () => ({
    meta: [{ title: "Alta Bank Deposits — Alta Group" }],
  }),
  component: BankDeposits,
});

function BankDeposits() {
  const depositProducts = getDepositProducts();

  return (
    <PageShell
      eyebrow="Alta Bank · Deposits"
      title="Deposit Products"
      description="Florin-denominated deposit accounts from Alta Access through Private Negotiated CDs — the deposit platform for Newport."
    >
      <BankSubNav />

      <Section title="Product Suite">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {depositProducts.map((p) => (
            <ProductCard key={p.name} product={p} />
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
