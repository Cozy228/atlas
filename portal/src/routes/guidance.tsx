import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/guidance")({
  component: GuidanceLayout,
});

function GuidanceLayout() {
  return <Outlet />;
}
