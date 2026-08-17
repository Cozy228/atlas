import { createFileRoute, redirect } from "@tanstack/react-router";

/** Namespace root redirects to the dashboard, preserving the app context. */
export const Route = createFileRoute("/prototype/kimi/")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/prototype/kimi/dashboard", search });
  },
});
