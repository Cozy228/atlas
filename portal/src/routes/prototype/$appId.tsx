/**
 * Layout route for the app state (/prototype/$appId/*).
 *
 * Entering an application switches the shell to its app-state top bar (Ask
 * input centred, app switcher top-right) and grows the face rail on the left
 * (docs/app-centric-experience-architecture.md §3, §6d). Unknown ids 404 so the
 * dynamic segment never renders a fabricated application.
 */
import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";

import { APPLICATIONS, resolveApplication } from "@/components/prototype/atlas/fixtures";
import { AppShell } from "@/components/prototype/atlas/shell";

export const Route = createFileRoute("/prototype/$appId")({
  beforeLoad: ({ params }) => {
    if (!APPLICATIONS.some((application) => application.id === params.appId)) {
      throw notFound();
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const { appId } = Route.useParams();
  const application = resolveApplication(appId);
  return (
    <AppShell application={application}>
      <Outlet />
    </AppShell>
  );
}
