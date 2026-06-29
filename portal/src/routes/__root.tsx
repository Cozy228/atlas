import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";

import { getDataMode } from "@/api/server/dataMode";
import { PortalShell } from "@/components/portal-shell";
import { themeInitScript } from "@/lib/theme-script";
import globalsCss from "@/styles/globals.css?url";
// Preload the latin Inter Variable file so the brand font is discovered in the
// first HTML response instead of only after globals.css parses — one fewer serial
// hop before text paints in-brand (swap is on, so this trims the swap-in delay).
import interLatinWoff2 from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";

// Toasts only matter once one fires; keep sonner out of the entry chunk and
// mount the Toaster after hydration so it never blocks first paint.
const Toaster = lazy(() => import("@/components/ui/sonner").then((m) => ({ default: m.Toaster })));

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
    links: [
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: interLatinWoff2,
        crossOrigin: "anonymous",
      },
      { rel: "stylesheet", href: globalsCss },
      // Agent-discovery hints mirrored into <head> so a body-only reader (not
      // just a client that inspects response `Link` headers) finds the surface.
      { rel: "llms-txt", type: "text/plain", href: "/llms.txt" },
      { rel: "service-desc", type: "application/openapi+json", href: "/openapi.json" },
      { rel: "api-catalog", type: "application/linkset+json", href: "/.well-known/api-catalog" },
      { rel: "ai-catalog", type: "application/json", href: "/.well-known/ai-catalog.json" },
      {
        rel: "agent-skills",
        type: "application/json",
        href: "/.well-known/agent-skills/index.json",
      },
      { rel: "mcp-server", href: "/mcp" },
      { rel: "sitemap", type: "application/xml", href: "/sitemap.xml" },
    ],
  }),
  // Dev-only data-mode signal for the top-nav badge (plan 026 WU-B). Resolved
  // server-side from the same predicate that gates the MSW boot; serialized into
  // the SSR payload so server and client render the badge identically.
  loader: async () => ({ dataMode: await getDataMode() }),
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
        The topic, source, or path you followed is not registered in the Context API. Browse the
        catalog, guidance, or sources to find what you need, or report the gap from the feedback
        form on any detail page.
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
  const { dataMode } = Route.useLoaderData();
  // Defer mounting the Toaster (and fetching the sonner chunk) until after the
  // initial client render.
  const [showToaster, setShowToaster] = useState(false);
  useEffect(() => setShowToaster(true), []);
  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <PortalShell dataMode={dataMode}>
          <Outlet />
        </PortalShell>
        {showToaster ? (
          <Suspense fallback={null}>
            <Toaster />
          </Suspense>
        ) : null}
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
