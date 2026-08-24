import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/prototype/$appId/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/prototype/$appId/overview", params: { appId: params.appId } });
  },
});
