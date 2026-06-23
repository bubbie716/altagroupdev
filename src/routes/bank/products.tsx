import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { ProductCard } from "@/components/bank/product-card";
import { getBankProducts } from "@/lib/bank/api";
import type { BankProductCategory } from "@/lib/bank/types";

export const Route = createFileRoute("/bank/products")({
  head: () => ({
    meta: [{ title: "Alta Bank Products — Alta Group" }],
  }),
  component: BankProducts,
});

const PRODUCT_SECTIONS: BankProductCategory[] = [
  "Retail Banking",
  "Business Banking",
  "Alta Private",
];

function BankProducts() {
  const products = getBankProducts();

  return (
    <PageShell
      eyebrow="Alta Bank · Products"
      title="Bank Products"
      description="Alta Bank's retail, business, and Alta Private deposit products — public banking for Newport, with invitation-only private tiers."
    >
      <BankSubNav />

      {PRODUCT_SECTIONS.map((section) => {
        const sectionProducts = products.filter((p) => p.category === section);
        if (sectionProducts.length === 0) return null;

        return (
          <Section key={section} title={section} className={section !== "Retail Banking" ? "mt-12" : undefined}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sectionProducts.map((p) => (
                <ProductCard key={p.name} product={p} />
              ))}
            </div>
          </Section>
        );
      })}
    </PageShell>
  );
}
