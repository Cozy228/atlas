import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/capabilities")({
  component: CapabilitiesLayout,
});

function CapabilitiesLayout() {
  return <Outlet />;
}
