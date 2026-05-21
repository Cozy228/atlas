import type { ReactNode } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";

import { PortalShell } from "@/components/portal-shell";
import { Toaster } from "@/components/ui/sonner";
import { themeInitScript } from "@/lib/theme-script";
import globalsCss from "@/styles/globals.css?url";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { name: "color-scheme", content: "light dark" },
      {
        name: "description",
        content: "Atlas Portal: governed cloud platform context for application teams.",
      },
      { title: "Atlas Portal" },
    ],
    links: [{ rel: "stylesheet", href: globalsCss }],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-6 py-16">
      <span className="font-mono text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        404 · not in registry
      </span>
      <h1 className="type-heading font-semibold tracking-[-0.03em] text-foreground">
        Atlas could not resolve that record.
      </h1>
      <p className="text-sm leading-[1.6] text-muted-foreground">
        The topic, source, or path you followed is not registered in the Context API. Browse
        the catalog, guidance, or sources to find what you need, or report the gap from the
        feedback form on any detail page.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Back to home
        </Link>
        <Link
          to="/availability"
          className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
        >
          Browse availability
        </Link>
      </div>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <PortalShell>
          <Outlet />
        </PortalShell>
        <Toaster />
      </QueryClientProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script>{themeInitScript}</script>
      </head>
      <body>
        <div id="app">{children}</div>
        <Scripts />
      </body>
    </html>
  );
}
