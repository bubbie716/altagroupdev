import { createFileRoute } from "@tanstack/react-router";
import { NccInstitutionsPage } from "@/components/ncc/ncc-institutions-page";

export const Route = createFileRoute("/institutions")({
  head: () => ({
    meta: [{ title: "Institutions — Newport Clearing Corporation" }],
  }),
  component: NccInstitutionsPage,
});
