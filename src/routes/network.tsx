import { createFileRoute } from "@tanstack/react-router";
import { NccNetworkPage } from "@/components/ncc/ncc-network-page";

export const Route = createFileRoute("/network")({
  head: () => ({
    meta: [{ title: "Network — Newport Clearing Corporation" }],
  }),
  component: NccNetworkPage,
});
