/**
 * Layout route for the "kimi" prototype namespace (/prototype/kimi).
 *
 * The prototype renders its own shell (the root route skips PortalShell for
 * /prototype/*). The selected application is a validated `?app=` search param
 * shared by every route in the namespace, so direct URLs and back/forward
 * behave. The scoped theme loads with this layout's chunk.
 */
import { Outlet, createFileRoute } from "@tanstack/react-router";

import { DEFAULT_APP_ID, isAppId } from "@/components/prototype/kimi/fixtures";
import { PrototypeShell } from "@/components/prototype/kimi/shell";

import "@/components/prototype/kimi/theme.css";

export const Route = createFileRoute("/prototype/kimi")({
  validateSearch: (search) => ({
    app: isAppId(search.app) ? search.app : DEFAULT_APP_ID,
  }),
  component: PrototypeLayout,
});

function PrototypeLayout() {
  return (
    <PrototypeShell>
      <Outlet />
    </PrototypeShell>
  );
}
