import { createFileRoute } from "@tanstack/react-router";
import { NccParticipationPage } from "@/components/ncc/ncc-participation-page";

export const Route = createFileRoute("/participation")({
  head: () => ({
    meta: [{ title: "Participation — Newport Clearing Corporation" }],
  }),
  component: NccParticipationPage,
});
