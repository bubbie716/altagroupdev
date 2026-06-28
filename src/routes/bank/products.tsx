import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { ProductCard } from "@/components/bank/product-card";
import { getBankProducts } from "@/lib/bank/api";
import type { BankProductCategory } from "@/lib/bank/types";

export const Route = createFileRoute("/bank/products")({
  head: () => ({
    meta: [{ title: "Alta Bank Products — Alta Group" }],
  }),
  component: BankProducts,
});

const PRODUCT_SECTIONS: Array<{ id: BankProductCategory; description: string }> = [
  {
    id: "Retail Banking",
    description: "Everyday Florin deposit products for Newport citizens.",
  },
  {
    id: "Business Banking",
    description: "Treasury and operating accounts for verified Newport companies.",
  },
  {
    id: "Alta Private",
    description: "Invitation-only private banking tiers for qualifying clients.",
  },
];

function BankProducts() {
  const products = getBankProducts();

  return (
    <>
      <BankPageMeta
      eyebrow="Alta Bank · Products"
      title="Bank Products"
      description="Alta Bank's retail, business, and Alta Private deposit products — public banking for Newport, with invitation-only private tiers."
     />
{PRODUCT_SECTIONS.map((section, index) => {
        const sectionProducts = products.filter((p) => p.category === section.id);
        if (sectionProducts.length === 0) return null;

        return (
          <Section
            key={section.id}
            title={section.id}
            className={index > 0 ? "mt-14" : undefined}
            action={
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {sectionProducts.length} {sectionProducts.length === 1 ? "product" : "products"}
              </span>
            }
          >
            <p className="-mt-2 mb-6 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              {section.description}
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sectionProducts.map((p) => (
                <ProductCard key={p.name} product={p} />
              ))}
            </div>
          </Section>
        );
      })}
    </>
  );
}
