import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/prototype/codex/")({
  beforeLoad: () => {
    throw redirect({ to: "/prototype/codex/dashboard" });
  },
});
