import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveInternalLegacyDealRoomRedirect } from "@/lib/bank/lending.functions";

export const Route = createFileRoute("/internal/lending/deal-rooms/$dealRoomId")({
  beforeLoad: async ({ params }) => {
    const target = await resolveInternalLegacyDealRoomRedirect({ data: params.dealRoomId });
    throw redirect({
      to: target.to,
      params: target.params,
      search: target.search,
    });
  },
});
