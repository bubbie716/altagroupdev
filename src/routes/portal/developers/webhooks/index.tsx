"use client";

import { useState, useTransition } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PortalPageHeader } from "@/components/ncc/portal/portal-shell";
import { NCC_WEBHOOK_EVENT_TYPES } from "@/lib/ncc/ncc-webhook-events";
import {
  createDeveloperWebhook,
  fetchDeveloperWebhooks,
} from "@/lib/ncc/ncc-developer.functions";

export const Route = createFileRoute("/portal/developers/webhooks/")({
  loader: () => fetchDeveloperWebhooks(),
  head: () => ({
    meta: [{ title: "Webhooks — NCC Institution Portal" }],
  }),
  component: WebhooksRoute,
});

function WebhooksRoute() {
  const initial = Route.useLoaderData();
  const [endpoints, setEndpoints] = useState(initial.endpoints);
  const [secretOnce, setSecretOnce] = useState<string | null>(null);
  const [name, setName] = useState("Primary webhook");
  const [url, setUrl] = useState("https://example.com/ncc/webhooks");
  const [environment, setEnvironment] = useState<"LIVE" | "TEST">("LIVE");
  const [events, setEvents] = useState<string[]>(["settlement.completed", "settlement.failed"]);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <PortalPageHeader
        eyebrow="Developers"
        title="Webhooks"
        description="Signed HTTPS deliveries for settlement lifecycle events. Secrets are encrypted at rest."
      />

      {secretOnce ? (
        <div className="mb-4 rounded-sm border border-[#fde68a] bg-[#fffbeb] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#92400e]">
            Copy signing secret now
          </div>
          <code className="mt-2 block break-all text-[12px] text-[#78350f]">{secretOnce}</code>
        </div>
      ) : null}

      <section className="mb-6 rounded-sm border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <h2 className="text-[13px] font-semibold">Create endpoint</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-[12px]">
            Name
            <input
              className="mt-1 w-full rounded-sm border border-[#d1d5db] px-2 py-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="text-[12px]">
            Environment
            <select
              className="mt-1 w-full rounded-sm border border-[#d1d5db] px-2 py-1.5"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as "LIVE" | "TEST")}
            >
              <option value="LIVE">LIVE</option>
              <option value="TEST">TEST</option>
            </select>
          </label>
          <label className="text-[12px] sm:col-span-2">
            HTTPS URL
            <input
              className="mt-1 w-full rounded-sm border border-[#d1d5db] px-2 py-1.5"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {NCC_WEBHOOK_EVENT_TYPES.map((event) => {
            const checked = events.includes(event);
            return (
              <label key={event} className="flex items-center gap-1 text-[11px]">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setEvents((prev) =>
                      checked ? prev.filter((e) => e !== event) : [...prev, event],
                    )
                  }
                />
                {event}
              </label>
            );
          })}
        </div>
        <button
          type="button"
          disabled={pending}
          className="mt-4 rounded-sm bg-[#0c4d32] px-3 py-1.5 text-[12px] font-medium text-white"
          onClick={() =>
            startTransition(async () => {
              const created = await createDeveloperWebhook({
                data: {
                  name,
                  url,
                  environment,
                  subscribedEvents: events,
                },
              });
              setSecretOnce(created.signingSecret);
              const next = await fetchDeveloperWebhooks();
              setEndpoints(next.endpoints);
            })
          }
        >
          Create endpoint
        </button>
      </section>

      <section className="rounded-sm border border-[#e5e7eb] bg-white shadow-sm">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-[#e5e7eb] bg-[#f9fafb] text-[10px] uppercase tracking-[0.12em] text-[#6b7280]">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {endpoints.map((row: (typeof endpoints)[number]) => (
              <tr key={row.id} className="border-b border-[#f3f4f6]">
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2 break-all text-[11px]">{row.url}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2 text-right">
                  <Link
                    to="/portal/developers/webhooks/$id"
                    params={{ id: row.id }}
                    className="text-[#0c4d32]"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
