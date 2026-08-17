import { Outlet, createFileRoute } from "@tanstack/react-router";

import { CodexPrototypeShell } from "@/components/prototype/codex/shell";

export const Route = createFileRoute("/prototype/codex")({
  component: CodexPrototypeRoute,
});

function CodexPrototypeRoute() {
  return (
    <CodexPrototypeShell>
      <Outlet />
    </CodexPrototypeShell>
  );
}
