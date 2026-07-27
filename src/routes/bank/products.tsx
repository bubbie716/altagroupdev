"use client";

import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import {
  BankOpenAccountAction,
  BankProductComparisonList,
} from "@/components/bank/bank-product-comparison";
import { useCreditDeskCustomerNav } from "@/hooks/use-credit-desk-nav";
import { getBankProducts } from "@/lib/bank/api";
import type { BankProductCategory } from "@/lib/bank/types";

export const Route = createFileRoute("/bank/products")({
  head: () => ({
    meta: [{ title: "Alta Bank Products — Alta Group" }],
  }),
  component: BankProducts,
});

const PRODUCT_SECTIONS: Array<{
  id: BankProductCategory;
  description: string;
  creditGate?: "altaCard" | "lending";
}> = [
  {
    id: "Retail Banking",
    description: "Everyday Florin deposit products for Newport citizens.",
  },
  {
    id: "Business Banking",
    description: "Treasury and operating accounts for verified Newport companies.",
  },
  {
    id: "Credit & Cards",
    description: "Revolving Alta Card credit lines for personal and business clients.",
    creditGate: "altaCard",
  },
  {
    id: "Lending",
    description: "Personal and business credit lines with manual underwriting.",
    creditGate: "lending",
  },
];

function BankProducts() {
  const products = getBankProducts();
  const creditDesk = useCreditDeskCustomerNav();

  const visibleSections = useMemo(
    () =>
      PRODUCT_SECTIONS.filter((section) => {
        if (section.creditGate === "altaCard") return creditDesk.showAltaCardNav;
        if (section.creditGate === "lending") return creditDesk.showLendingNav;
        return true;
      }),
    [creditDesk.showAltaCardNav, creditDesk.showLendingNav],
  );

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Products"
        title="Bank Products"
        description="Compare Alta Bank deposit, card, and lending products. Open or apply from a product’s details — existing accounts and credit products stay on their own pages."
        action={<BankOpenAccountAction />}
      />
      {visibleSections.map((section, index) => {
        const sectionProducts = products.filter((p) => p.category === section.id);
        if (sectionProducts.length === 0) return null;

        return (
          <Section
            key={section.id}
            title={section.id}
            className={index > 0 ? "mt-10" : undefined}
            action={
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {sectionProducts.length} {sectionProducts.length === 1 ? "product" : "products"}
              </span>
            }
          >
            <p className="-mt-2 mb-4 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              {section.description}
            </p>
            <BankProductComparisonList products={sectionProducts} />
          </Section>
        );
      })}
    </>
  );
}
