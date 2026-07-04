import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { Section } from "@/components/page-shell";
import { PaymentLinkForm } from "@/components/bank/payment-links/payment-link-form";
import { resolveBusinessOperatingAccountRedirect } from "@/lib/bank/business-account.functions";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/commercial/payment-links/new")({
  beforeLoad: authBeforeLoad,
  loader: async ({ location }) => {
    const companyId = new URLSearchParams(location.searchStr).get("companyId") ?? undefined;
    const resolved = await resolveBusinessOperatingAccountRedirect({ data: companyId ?? undefined });
    if (!resolved) {
      throw redirect({ to: "/bank/business" });
    }
    return { companyId: companyId ?? resolved.companyId };
  },
  head: () => ({ meta: [{ title: "New Payment Link — Alta Bank" }] }),
  component: NewPaymentLinkPage,
});

function NewPaymentLinkPage() {
  const { companyId } = Route.useLoaderData();

  return (
    <>
      <BankPageMeta eyebrow="Commercial Banking" title="New payment link" />
      <Link
        to="/bank/commercial/payment-links"
        search={{ companyId }}
        className="-ml-1 mb-6 inline-flex items-center gap-1.5 rounded-md px-1 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        Back to all payment links
      </Link>
      <Section title="Create payment link">
        <PaymentLinkForm companyId={companyId} />
      </Section>
    </>
  );
}
