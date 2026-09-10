import { createFileRoute } from "@tanstack/react-router";
import { NavigationPreview } from "@/components/prototype/navigation/page";

export const Route = createFileRoute("/prototype/navigation")({
  head: () => ({ meta: [{ title: "Cloud DevEx Portal · Navigation preview" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    view: search.view === "workbench" ? "workbench" : "explore",
    section: typeof search.section === "string" ? search.section : "overview",
    zone: search.zone === "awsc" || search.zone === "azure" ? search.zone : "awsf",
  }),
  component: NavigationPreview,
});
