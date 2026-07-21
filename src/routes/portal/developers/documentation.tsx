import { createFileRoute, Link } from "@tanstack/react-router";
import { PortalPageHeader } from "@/components/ncc/portal/portal-shell";

export const Route = createFileRoute("/portal/developers/documentation")({
  head: () => ({
    meta: [{ title: "API Documentation — NCC Institution Portal" }],
  }),
  component: DocumentationRoute,
});

function DocumentationRoute() {
  return (
    <div>
      <PortalPageHeader
        eyebrow="Developers"
        title="API Documentation"
        description="Institution API v1 — authentication, settlements, and signed webhooks."
      />
      <section className="space-y-4 rounded-sm border border-[#e5e7eb] bg-white p-5 text-[13px] leading-6 text-[#374151] shadow-sm">
        <p>
          Base URL: <code className="font-mono text-[12px]">/api/ncc/v1</code>
        </p>
        <p>
          Authorization:{" "}
          <code className="font-mono text-[12px]">
            Bearer ncc_live_&lt;prefix&gt;_&lt;secret&gt;
          </code>
        </p>
        <p>
          Settlement submissions require an{" "}
          <code className="font-mono text-[12px]">Idempotency-Key</code> header and a LIVE
          credential. The authenticated credential determines the sending institution — clients
          cannot override it.
        </p>
        <p>
          Payment addresses use routing number (institution) plus an opaque, institution-specific
          account identifier. Submit{" "}
          <code className="font-mono text-[12px]">sourceAccountNumber</code> and{" "}
          <code className="font-mono text-[12px]">destinationAccountNumber</code> (field names retained
          for v1; values are not a universal bank format). NCC does not require digits-only
          identifiers. Internal database IDs and legacy{" "}
          <code className="font-mono text-[12px]">*AccountReference</code> fields are rejected.
          Knowing an identifier never grants debit authority.
        </p>
        <p>
          Webhooks are signed with{" "}
          <code className="font-mono text-[12px]">
            HMAC-SHA256(secret, timestamp + &quot;.&quot; + rawBody)
          </code>{" "}
          and delivered with <code className="font-mono text-[12px]">NCC-Signature</code> headers.
          Payloads never include internal account references or full account numbers.
        </p>
        <p>
          Full engineering docs live in the repository under{" "}
          <code className="font-mono text-[12px]">docs/ncc/NCC_INSTITUTION_API.md</code> and{" "}
          <code className="font-mono text-[12px]">docs/ncc/NCC_SPRINT_4A_ACCOUNT_ADDRESSING_REPORT.md</code>.
        </p>
        <Link to="/portal/developers" className="inline-block text-[#0c4d32]">
          ← Back to Developers
        </Link>
      </section>
    </div>
  );
}
