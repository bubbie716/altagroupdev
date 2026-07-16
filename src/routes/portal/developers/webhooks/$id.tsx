"use client";

import { useTransition } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PortalPageHeader } from "@/components/ncc/portal/portal-shell";
import {
  fetchDeveloperWebhookDetail,
  redeliverDeveloperWebhook,
  rotateDeveloperWebhookSecret,
  sendDeveloperWebhookTest,
  setDeveloperWebhookStatus,
} from "@/lib/ncc/ncc-developer.functions";

export const Route = createFileRoute("/portal/developers/webhooks/$id")({
  loader: ({ params }) => fetchDeveloperWebhookDetail({ data: { endpointId: params.id } }),
  head: () => ({
    meta: [{ title: "Webhook Endpoint — NCC Institution Portal" }],
  }),
  component: WebhookDetailRoute,
});

function WebhookDetailRoute() {
  const data = Route.useLoaderData();
  const [pending, startTransition] = useTransition();
  const endpoint = data.endpoint;

  return (
    <div>
      <PortalPageHeader
        eyebrow="Webhooks"
        title={endpoint.name}
        description={endpoint.url}
        actions={
          <Link
            to="/portal/developers/webhooks"
            className="rounded-sm border border-[#e5e7eb] bg-white px-3 py-1.5 text-[12px]"
          >
            Back
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="rounded-sm border border-[#e5e7eb] px-3 py-1.5 text-[12px]"
          onClick={() =>
            startTransition(async () => {
              await sendDeveloperWebhookTest({ data: { endpointId: endpoint.id } });
              window.location.reload();
            })
          }
        >
          Send test
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-sm border border-[#e5e7eb] px-3 py-1.5 text-[12px]"
          onClick={() =>
            startTransition(async () => {
              const rotated = await rotateDeveloperWebhookSecret({
                data: { endpointId: endpoint.id },
              });
              window.prompt("Copy signing secret now", rotated.signingSecret);
            })
          }
        >
          Rotate secret
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-sm border border-[#e5e7eb] px-3 py-1.5 text-[12px]"
          onClick={() =>
            startTransition(async () => {
              await setDeveloperWebhookStatus({
                data: {
                  endpointId: endpoint.id,
                  status: endpoint.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                },
              });
              window.location.reload();
            })
          }
        >
          {endpoint.status === "ACTIVE" ? "Disable" : "Enable"}
        </button>
      </div>

      <section className="rounded-sm border border-[#e5e7eb] bg-white shadow-sm">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-[#e5e7eb] bg-[#f9fafb] text-[10px] uppercase tracking-[0.12em] text-[#6b7280]">
            <tr>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">HTTP</th>
              <th className="px-3 py-2">Attempts</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.deliveries.map((row: (typeof data.deliveries)[number]) => (
              <tr key={row.id} className="border-b border-[#f3f4f6]">
                <td className="px-3 py-2">{row.eventType}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">{row.responseStatus ?? "—"}</td>
                <td className="px-3 py-2">{row.attemptCount}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-[#0c4d32]"
                    onClick={() =>
                      startTransition(async () => {
                        await redeliverDeveloperWebhook({ data: { deliveryId: row.id } });
                        window.location.reload();
                      })
                    }
                  >
                    Redeliver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
