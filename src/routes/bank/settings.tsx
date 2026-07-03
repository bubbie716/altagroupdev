import { createFileRoute } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { BankSettingsForm } from "@/components/bank/bank-settings-form";
import { fetchUserBankSettings } from "@/lib/bank/bank-settings.functions";

export const Route = createFileRoute("/bank/settings")({
  loader: async () => fetchUserBankSettings(),
  head: () => ({
    meta: [{ title: "Settings — Alta Bank" }],
  }),
  component: BankSettingsPage,
});

function BankSettingsPage() {
  const settings = Route.useLoaderData();

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank"
        title="Settings"
        description="Alta Pay defaults and Discord notification preferences."
      />
      <BankSettingsForm initialSettings={settings} />
    </>
  );
}
