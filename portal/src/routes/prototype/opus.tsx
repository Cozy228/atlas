/**
 * Layout route for the "opus" prototype namespace (/prototype/opus).
 *
 * The root route skips PortalShell for /prototype/*, so this layout owns the
 * entire chrome. The selected application is a validated `?app=` search param
 * shared by every child route, so direct URLs and back/forward behave.
 */
import { Outlet, createFileRoute } from "@tanstack/react-router";

import { ApplicationContext } from "@/components/prototype/opus/application-context";
import { DEFAULT_APPLICATION_ID, resolveApplication } from "@/components/prototype/opus/fixtures";
import { PrototypeShell } from "@/components/prototype/opus/shell";

export { useApplication } from "@/components/prototype/opus/application-context";

const APP_IDS = new Set(["pay-4821", "srch-2207"]);

function isAppId(value: unknown): value is string {
  return typeof value === "string" && APP_IDS.has(value);
}

export const Route = createFileRoute("/prototype/opus")({
  validateSearch: (search) => ({
    app: isAppId(search.app) ? search.app : DEFAULT_APPLICATION_ID,
  }),
  component: PrototypeLayout,
});

function PrototypeLayout() {
  const { app } = Route.useSearch();
  const application = resolveApplication(app);
  return (
    <PrototypeShell application={application}>
      <ApplicationContext.Provider value={application}>
        <Outlet />
      </ApplicationContext.Provider>
    </PrototypeShell>
  );
}
