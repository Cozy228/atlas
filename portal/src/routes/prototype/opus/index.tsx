import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/prototype/opus/")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/prototype/opus/dashboard", search });
  },
});
