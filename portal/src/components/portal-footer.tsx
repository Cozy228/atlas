import { cn } from "@/lib/utils";

/**
 * Footer links. The machine-readable entry points (OpenAPI, llms.txt, capability
 * catalog, a resource example) sit here as plain links alongside the legal ones —
 * body-visible so a crawling / blind agent still discovers them via their href,
 * without a dedicated section competing with the page content. The two resource
 * links are EXAMPLES of the generic `/api/resources/{kind}/{slug}` route (resolve
 * a name via searchResources), not fixed routes — hence the "(example)" label.
 */
const FOOTER_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/openapi.json", label: "OpenAPI" },
  { href: "/llms.txt", label: "llms.txt" },
  { href: "/.well-known/ai-catalog.json", label: "Capability catalog" },
  { href: "/api/resources/service/aws/textract", label: "Resource JSON (example)" },
  { href: "/resources/service/aws/textract.md", label: "Resource Markdown (example)" },
  { href: "#", label: "Terms of use" },
  { href: "#", label: "Privacy policy" },
];

export function PortalFooter() {
  const year = new Date().getFullYear();

  return (
    <footer data-fab-dismiss className="border-t border-border bg-background px-4 py-6 sm:px-8">
      <div
        className={cn(
          "flex flex-col gap-3 text-xs text-muted-foreground",
          "sm:flex-row sm:items-center sm:justify-between",
        )}
      >
        <p>© {year} Atlas. All rights reserved.</p>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={cn(
                "rounded-sm transition-colors hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
