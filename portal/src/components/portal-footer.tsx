import { cn } from "@/lib/utils";

// Placeholder legal links — wire to real destinations when available.
const LEGAL_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "#", label: "Terms of use" },
  { href: "#", label: "Privacy policy" },
];

export function PortalFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background px-4 py-6 sm:px-8">
      <div
        className={cn(
          "flex flex-col gap-3 text-xs text-muted-foreground",
          "sm:flex-row sm:items-center sm:justify-between",
        )}
      >
        <p>© {year} Atlas. All rights reserved.</p>
        <nav aria-label="Legal" className="flex items-center gap-4">
          {LEGAL_LINKS.map((link) => (
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
