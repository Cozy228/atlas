import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/landing-zones")({
  component: LandingZonesLayout,
});

function LandingZonesLayout() {
  return <Outlet />;
}
