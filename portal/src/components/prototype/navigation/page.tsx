import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Link } from "@tanstack/react-router";
import {
  IconArrowRight,
  IconArrowUpRight,
  IconBook,
  IconBox,
  IconChevronDown,
  IconCircleCheck,
  IconCompass,
  IconLayoutDashboard,
  IconLock,
  IconMenu2,
  IconSearch,
  IconStack2,
  IconTopologyStar,
  IconX,
} from "@tabler/icons-react";
import { LANDING_ZONES } from "@atlas/context-layer/landingZones";
import logo from "@/assets/logo.svg?url";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeProvider } from "@/lib/theme";
import { Route } from "@/routes/prototype/navigation";
import "./style.css";

const linkStyles: Record<string, string> = {
  "np-brand":
    "flex items-center gap-2.5 text-[15px] font-bold tracking-[-0.45px] [&_img]:size-6 max-[900px]:[&_span]:hidden max-[480px]:gap-0",
  "np-top-link":
    "relative flex h-16 items-center text-[13px] text-muted-foreground aria-[current=page]:font-semibold aria-[current=page]:text-foreground",
  "np-side-link":
    "relative mb-2 flex h-8 items-center gap-3 rounded-md px-4 text-[13px] text-muted-foreground hover:bg-secondary aria-[current=page]:bg-brand-tint aria-[current=page]:font-[550] aria-[current=page]:text-brand-ink",
  "np-return": "inline-flex h-8 items-center gap-2 rounded-md text-[13px] hover:bg-secondary",
  "np-enter":
    "inline-flex min-h-8 items-center gap-2 text-[13px] font-semibold whitespace-nowrap text-brand-ink hover:underline hover:underline-offset-4 max-[480px]:gap-1.5 max-[480px]:[&>svg]:hidden",
  "np-text-link":
    "inline-flex min-h-8 items-center gap-3 text-[13px] font-[550] text-brand-ink hover:underline hover:underline-offset-4",
};

const exploreItems = [
  { id: "overview", label: "Home" },
  { id: "availability", label: "Availability" },
  { id: "catalog", label: "Catalog" },
  { id: "onboarding", label: "Onboarding" },
  { id: "newsletter", label: "Newsletter" },
  { id: "support", label: "Support" },
];
const workItems = [
  { id: "overview", label: "Home", icon: IconLayoutDashboard },
  { id: "applications", label: "Applications", icon: IconBox },
  { id: "activity", label: "Activity", icon: IconTopologyStar },
];
const resources = [
  {
    title: "Run a container service",
    type: "Capability",
    section: "catalog",
    description: "A managed foundation for your application, from deployment to daily operations.",
    icon: IconBox,
  },
  {
    title: "Build with a managed database",
    type: "Capability",
    section: "catalog",
    description: "Choose a supported database with backups and recovery built in.",
    icon: IconStack2,
  },
  {
    title: "Prepare for production",
    type: "Guide",
    section: "onboarding",
    description: "Work through ownership, access and readiness before your first release.",
    icon: IconBook,
  },
  {
    title: "Resource naming and ownership",
    type: "Standard",
    section: "catalog",
    description: "Make every resource identifiable, discoverable and accountable.",
    icon: IconTopologyStar,
  },
];
const SESSION_KEY = "atlas-navigation-demo-session";

export function NavigationPreview() {
  return (
    <ThemeProvider>
      <Preview />
    </ThemeProvider>
  );
}

function Preview() {
  const reduceMotion = useReducedMotion();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [signedIn, setSignedIn] = useState(() => sessionStorage.getItem(SESSION_KEY) === "active");
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const workbench = search.view === "workbench" && signedIn;
  const gated = search.view === "workbench" && !signedIn;
  const zone = LANDING_ZONES.find((item) => item.id === search.zone) ?? LANDING_ZONES[0];
  const zoneName = zone.name;
  const section =
    (workbench ? workItems : exploreItems).find((item) => item.id === search.section)?.id ??
    "overview";

  useEffect(() => {
    titleRef.current?.focus();
  }, [search.view, search.section, signedIn]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function destination(view: string, nextSection = "overview") {
    return { view, section: nextSection, zone: search.zone };
  }

  function signOut() {
    sessionStorage.removeItem(SESSION_KEY);
    setSignedIn(false);
    setMenuOpen(false);
    setAccountOpen(false);
    void navigate({ search: destination("explore") });
  }

  function navLink(view: string, id: string, children: ReactNode, className?: string) {
    return (
      <Link
        to="/prototype/navigation"
        search={destination(view, id)}
        className={className ? `${className} ${linkStyles[className] ?? ""}` : undefined}
        aria-current={search.view === view && section === id ? "page" : undefined}
        aria-label={className === "np-brand" ? "Cloud DevEx Portal home" : undefined}
        onClick={() => {
          setMenuOpen(false);
          setMoreOpen(false);
        }}
      >
        {children}
        {(className === "np-top-link" || className === "np-side-link") &&
          search.view === view &&
          section === id && (
            <motion.span
              aria-hidden="true"
              className={`np-active-indicator pointer-events-none absolute bg-brand ${className === "np-top-link" ? "inset-x-0 bottom-0 h-0.5" : "inset-y-2 left-0 w-0.5"}`}
              layoutId={className}
              transition={
                reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }
              }
            />
          )}
      </Link>
    );
  }

  const visibleResources = resources.filter(
    (resource) => section === "overview" || resource.section === section,
  );
  const results = resources.filter((resource) =>
    `${resource.title} ${resource.description}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div
      className="nav-preview group/nav min-h-dvh bg-background font-sans text-sm text-foreground tabular-nums [font-feature-settings:'tnum'] [&_*]:box-border [&_button]:cursor-pointer [&_select]:cursor-pointer [&_h1:focus]:outline-none [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-[3px] [&_a:focus-visible]:ring-ring/50 [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-[3px] [&_button:focus-visible]:ring-ring/50"
      data-view={workbench ? "workbench" : "explore"}
    >
      <a className="np-skip fixed -top-16 z-60 bg-card p-3 focus:top-2" href="#np-main">
        Skip to content
      </a>
      <header
        className="np-topbar sticky top-0 z-30 flex h-16 items-center gap-6 bg-background px-8 shadow-[inset_0_-1px_var(--border)] min-[1281px]:grid min-[1281px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] max-[1080px]:gap-4 max-[480px]:gap-2 max-[480px]:px-4"
        data-nav-header
      >
        <div className="np-identity flex shrink-0 items-center gap-4 max-[480px]:gap-2">
          {navLink(
            workbench ? "workbench" : "explore",
            "overview",
            <>
              <img src={logo} alt="" />
              <span>Cloud DevEx Portal</span>
            </>,
            "np-brand",
          )}
        </div>
        {!workbench && (
          <nav
            className="np-explore-nav flex h-16 items-center gap-4 max-[1280px]:hidden"
            aria-label="Explore navigation"
          >
            {exploreItems.map((item, index) => (
              <span key={item.id} className={index > 3 ? "np-nav-secondary" : undefined}>
                {navLink("explore", item.id, item.label, "np-top-link")}
              </span>
            ))}
            <div className="np-more hidden">
              <Popover open={moreOpen} onOpenChange={setMoreOpen}>
                <PopoverTrigger className="np-more-trigger flex h-8 items-center gap-1.5 text-[13px] text-muted-foreground">
                  More
                  <IconChevronDown size={12} />
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="np-more-menu w-48 [&_a]:block [&_a]:rounded-md [&_a]:p-2 [&_a:hover]:bg-secondary [&_a[aria-current]]:font-semibold [&_a[aria-current]]:text-brand-ink"
                >
                  {exploreItems.slice(4).map((item) => (
                    <div key={item.id}>{navLink("explore", item.id, item.label)}</div>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
          </nav>
        )}
        {workbench && (
          <button
            className="np-work-search m-0 flex h-10 w-96 items-center gap-3 rounded border border-border bg-card px-4 text-left text-[13px] text-muted-foreground [&_kbd]:ml-auto [&_kbd]:border [&_kbd]:border-border [&_kbd]:px-1 [&_kbd]:py-0.5 [&_kbd]:text-[11px] max-[1080px]:w-60 max-[900px]:w-8 max-[900px]:justify-center max-[900px]:p-0 max-[900px]:[&_span]:hidden max-[900px]:[&_kbd]:hidden max-[480px]:hidden"
            aria-label="Search the catalog"
            onClick={() => setSearchOpen(true)}
          >
            <IconSearch size={16} />
            <span>What are you looking for?</span>
            <kbd>⌘K</kbd>
          </button>
        )}
        <div className="np-tools ml-auto flex shrink-0 items-center gap-4 min-[1281px]:justify-self-end max-[480px]:gap-1.5">
          <Popover open={zoneOpen} onOpenChange={setZoneOpen}>
            <PopoverTrigger
              className="np-zone flex h-8 items-center gap-2 bg-transparent p-0 text-[13px] whitespace-nowrap text-muted-foreground hover:text-foreground data-popup-open:text-foreground [&>svg]:shrink-0 max-[480px]:max-w-32 max-[480px]:gap-1 max-[480px]:text-xs max-[480px]:[&>span]:truncate max-[480px]:[&>svg:first-child]:hidden"
              aria-label={`Landing zone: ${zoneName}`}
            >
              <IconStack2 size={16} aria-hidden="true" />
              <span>{zoneName}</span>
              <IconChevronDown size={12} aria-hidden="true" />
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={16} className="np-zone-menu w-64 gap-1 rounded">
              <div className="np-zone-menu-heading p-2 text-xs text-muted-foreground">
                Landing zone
              </div>
              {LANDING_ZONES.map((item) => (
                <button
                  key={item.id}
                  className="np-zone-option flex min-h-10 w-full items-center justify-between rounded-md p-2 text-left hover:bg-secondary aria-pressed:bg-secondary [&>svg]:text-brand-ink"
                  aria-pressed={item.id === search.zone}
                  onClick={() => {
                    setZoneOpen(false);
                    void navigate({ search: { ...search, zone: item.id } });
                  }}
                >
                  <span>{item.name}</span>
                  {item.id === search.zone && <IconCircleCheck size={16} aria-hidden="true" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <span
            className="np-tools-divider h-4 w-px bg-border max-[480px]:hidden"
            aria-hidden="true"
          />
          {workbench
            ? navLink(
                "explore",
                "overview",
                <>
                  <IconCompass size={16} />
                  <span>Explore</span>
                </>,
                "np-return",
              )
            : navLink(
                "workbench",
                "overview",
                <>
                  <span>Workbench</span>
                  <IconArrowRight size={15} />
                </>,
                "np-enter",
              )}
          {signedIn && (
            <button
              className="np-avatar size-8 rounded-full border border-border bg-secondary text-[11px] font-[650] max-[480px]:hidden"
              aria-label="Account menu"
              title="Account menu"
              onClick={() => setAccountOpen(true)}
            >
              JD
            </button>
          )}
          <button
            className="np-icon size-8 place-items-center rounded-md hover:bg-secondary np-menu-button hidden max-[1080px]:grid max-[1280px]:group-data-[view=explore]/nav:grid"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            <IconMenu2 size={20} />
          </button>
        </div>
      </header>

      <div className="np-body flex min-h-[calc(100dvh-64px)]">
        {workbench && (
          <aside
            className="np-sidebar sticky top-16 flex h-[calc(100dvh-64px)] w-56 shrink-0 flex-col bg-card px-4 pt-8 shadow-[inset_-1px_0_var(--border)] max-[760px]:hidden"
            data-nav-sidebar
          >
            <div className="np-sidebar-heading h-8 pl-4 text-[10px] font-semibold tracking-[0.1em] text-muted-foreground">
              WORKBENCH
            </div>
            <nav aria-label="Workbench navigation">
              {workItems.map((item) => (
                <div key={item.id}>
                  {navLink(
                    "workbench",
                    item.id,
                    <>
                      <item.icon size={17} />
                      {item.label}
                    </>,
                    "np-side-link",
                  )}
                </div>
              ))}
            </nav>
            <div className="np-sidebar-bottom mt-auto flex min-h-24 items-center gap-3 p-4 text-xs shadow-[inset_0_1px_var(--border)] [&_small]:block [&_small]:text-[10px] [&_small]:leading-6 [&_small]:text-muted-foreground">
              <IconCircleCheck size={16} />
              <div>
                Demo workspace<small>Fictional data · {zoneName}</small>
              </div>
            </div>
          </aside>
        )}

        <main id="np-main" className="np-main flex min-w-0 flex-1 flex-col" tabIndex={-1}>
          {gated ? (
            <div
              className="np-signin mx-auto my-24 flex w-[min(544px,calc(100%_-_64px))] flex-col items-start gap-4 bg-card p-8 shadow-[inset_0_0_0_1px_var(--border)] [&_h1]:text-[32px] [&_h1]:leading-10 [&_h1]:tracking-[-1px] [&>p:not(.np-eyebrow)]:text-[15px] [&>p:not(.np-eyebrow)]:leading-6 [&>p:not(.np-eyebrow)]:text-muted-foreground [&_small]:text-[11px] [&_small]:leading-6 [&_small]:text-muted-foreground max-[480px]:my-8 max-[480px]:w-[calc(100%_-_32px)] max-[480px]:p-6"
              data-nav-panel
            >
              <IconLock size={28} stroke={1.5} />
              <p className="np-eyebrow text-[11px] leading-8 font-semibold tracking-[0.09em] text-muted-foreground [&_span]:px-2 [&_span]:text-border">
                CLOUD DEVEX WORKBENCH
              </p>
              <h1 ref={titleRef} tabIndex={-1}>
                Your work starts here.
              </h1>
              <p>Sign in to access your applications and work in the {zoneName} landing zone.</p>
              <button
                className="np-primary inline-flex min-h-8 items-center justify-center gap-3 rounded-md bg-brand px-3.5 text-[13px] font-[550] text-brand-foreground hover:bg-primary"
                onClick={() => {
                  sessionStorage.setItem(SESSION_KEY, "active");
                  setSignedIn(true);
                }}
              >
                Continue with demo account
                <IconArrowRight size={16} />
              </button>
              {navLink("explore", "overview", "Back to Explore", "np-text-link")}
              <small>Navigation preview. No credentials or real account required.</small>
            </div>
          ) : !workbench ? (
            <div className="np-canvas mx-auto w-[min(1120px,round(down,calc(100%_-_64px),32px))] max-[480px]:w-[round(down,calc(100%_-_32px),32px)] np-explore-content">
              <div
                className="np-intro min-h-[352px] pt-16 pb-8 text-center [&_h1]:my-4 [&_h1]:text-[40px] [&_h1]:leading-[48px] [&_h1]:font-bold [&_h1]:tracking-[-1.2px] [&>.np-lead]:mx-auto [&>.np-text-link]:mt-6 max-[760px]:pt-8 max-[760px]:[&_h1]:text-4xl max-[760px]:[&_h1]:leading-10 max-[480px]:[&_h1]:text-[30px] max-[480px]:[&_h1]:leading-9"
                data-nav-panel
              >
                <p className="np-eyebrow text-[11px] leading-8 font-semibold tracking-[0.09em] text-muted-foreground [&_span]:px-2 [&_span]:text-border">
                  CLOUD DEVEX PORTAL <span>/</span> {zoneName.toUpperCase()} LANDING ZONE
                </p>
                <h1 ref={titleRef} tabIndex={-1}>
                  {section === "overview" ? (
                    <>
                      Welcome to the
                      <br />
                      Cloud DevEx Portal
                    </>
                  ) : (
                    exploreItems.find((item) => item.id === section)?.label
                  )}
                </h1>
                <p className="np-lead max-w-[560px] text-[15px] leading-6 text-muted-foreground">
                  {section === "overview"
                    ? "Find the right guidance, services, and evidence to build with confidence. Every claim links back to its source."
                    : `Browse ${section} for the ${zoneName} landing zone. Find the guidance you need before starting work.`}
                </p>
                {section === "overview" && (
                  <button
                    className="np-home-search mx-auto mt-6 mb-4 flex h-12 w-[min(608px,100%)] items-center gap-3 rounded border border-border bg-card px-4 text-left text-muted-foreground [&_kbd]:ml-auto [&_kbd]:border [&_kbd]:border-border [&_kbd]:px-1 [&_kbd]:py-0.5 [&_kbd]:text-[11px]"
                    onClick={() => {
                      setQuery("");
                      setSearchOpen(true);
                    }}
                  >
                    <IconSearch size={18} />
                    <span>What are you looking for?</span>
                    <kbd>⌘K</kbd>
                  </button>
                )}
              </div>
              <div className="np-section-title flex h-16 items-center justify-between gap-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-[-0.3px] [&>span]:text-xs [&>span]:text-muted-foreground">
                <h2>{section === "overview" ? "Browse by intent" : `Available in ${zoneName}`}</h2>
                <span>{visibleResources.length} resources</span>
              </div>
              {visibleResources.length === 0 && (
                <div
                  className="np-section-preview border border-border bg-card p-8 leading-6"
                  data-nav-panel
                >
                  <h3>{exploreItems.find((item) => item.id === section)?.label}</h3>
                  <p>
                    This navigation preview uses the Home page's existing sections. Open the current
                    page to browse its full content.
                  </p>
                  <Link
                    to={
                      section === "newsletter"
                        ? "/whatsnew"
                        : section === "support"
                          ? "/support"
                          : "/availability"
                    }
                    className="np-text-link inline-flex min-h-8 items-center gap-3 text-[13px] font-[550] text-brand-ink hover:underline hover:underline-offset-4"
                  >
                    Open current page
                    <IconArrowUpRight size={16} />
                  </Link>
                </div>
              )}
              <div className="np-resource-grid flex flex-col bg-card">
                {visibleResources.map((resource) => (
                  <article
                    className="np-resource grid min-h-32 grid-cols-[128px_256px_1fr_144px] items-center gap-6 px-8 py-6 shadow-[inset_0_-1px_var(--border)] first:shadow-[inset_0_1px_var(--border),inset_0_-1px_var(--border)] [&_h3]:text-[15px] [&_h3]:leading-6 [&_h3]:font-semibold [&_p]:mt-2 [&_p]:max-w-[400px] [&_p]:leading-6 [&_p]:text-muted-foreground [&_.np-text-link]:mt-2 min-[761px]:max-[1400px]:grid-cols-[96px_1fr_1fr] min-[761px]:max-[1400px]:gap-4 min-[761px]:max-[1400px]:[&>.np-text-link]:col-start-2 max-[760px]:flex max-[760px]:min-h-56 max-[760px]:flex-col max-[760px]:items-start max-[760px]:gap-2 max-[480px]:px-6"
                    key={resource.title}
                    data-nav-panel
                  >
                    <div className="np-resource-meta mb-4 flex h-8 items-center justify-between [&_span]:text-[11px] [&_span]:text-muted-foreground">
                      <resource.icon size={24} stroke={1.4} />
                      <span>{resource.type}</span>
                    </div>
                    <h3>{resource.title}</h3>
                    <p>{resource.description}</p>
                    <button
                      className="np-text-link inline-flex min-h-8 items-center gap-3 text-[13px] font-[550] text-brand-ink hover:underline hover:underline-offset-4"
                      onClick={() => {
                        setQuery(resource.title);
                        setSearchOpen(true);
                      }}
                    >
                      Read overview
                      <IconArrowUpRight size={16} />
                    </button>
                  </article>
                ))}
              </div>
              <div className="np-bottom-note flex min-h-24 items-center justify-between gap-4 text-xs text-muted-foreground [&>span:first-child]:text-foreground max-[760px]:flex-col max-[760px]:items-start max-[760px]:justify-center max-[760px]:gap-2">
                <span>Built for informed decisions.</span>
                <span>Guidance, services and evidence for your landing zone.</span>
              </div>
            </div>
          ) : (
            <div className="np-canvas mx-auto w-[min(1120px,round(down,calc(100%_-_64px),32px))] max-[480px]:w-[round(down,calc(100%_-_32px),32px)] np-work-content pb-16">
              <div
                className="np-work-heading min-h-56 pt-16 [&_h1]:my-2 [&_h1]:text-[32px] [&_h1]:leading-[48px] [&_h1]:font-[550] [&_h1]:tracking-[-1px] max-[760px]:pt-8"
                data-nav-panel
              >
                <p className="np-eyebrow text-[11px] leading-8 font-semibold tracking-[0.09em] text-muted-foreground [&_span]:px-2 [&_span]:text-border">
                  {zoneName.toUpperCase()} LANDING ZONE <span>/</span> YOUR WORKSPACE
                </p>
                <h1 ref={titleRef} tabIndex={-1}>
                  {section === "overview"
                    ? "Good morning, Jamie."
                    : workItems.find((item) => item.id === section)?.label}
                </h1>
                <p className="np-lead max-w-[560px] text-[15px] leading-6 text-muted-foreground">
                  {section === "overview"
                    ? "Pick up where you left off, or find your next application."
                    : `Your ${section} in the ${zoneName} landing zone.`}
                </p>
              </div>
              {section !== "activity" && (
                <>
                  <div className="np-section-title flex h-16 items-center justify-between gap-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-[-0.3px] [&>span]:text-xs [&>span]:text-muted-foreground">
                    <h2>Your applications</h2>
                    <span>2 applications</span>
                  </div>
                  <div
                    className="np-app-list bg-card shadow-[inset_0_0_0_1px_var(--border)]"
                    data-nav-panel
                  >
                    {[
                      `${zoneName.toLowerCase()}-storefront`,
                      `${zoneName.toLowerCase()}-inventory`,
                    ].map((app, index) => (
                      <div
                        className="np-app-row flex h-24 items-center gap-4 px-8 py-4 not-first:shadow-[inset_0_1px_var(--border)] [&_h3]:text-[15px] [&_h3]:leading-6 [&_h3]:font-semibold [&_p]:text-[13px] [&_p]:leading-6 [&_p]:text-muted-foreground max-[480px]:gap-2 max-[480px]:px-4"
                        key={app}
                      >
                        <span className="np-app-icon grid size-8 place-items-center max-[480px]:hidden">
                          <IconBox size={21} stroke={1.5} />
                        </span>
                        <div>
                          <h3>{app}</h3>
                          <p>{index === 0 ? "Customer experience" : "Supply operations"}</p>
                        </div>
                        <span className="np-status ml-auto flex items-center gap-1.5 text-xs">
                          <IconCircleCheck size={15} />
                          Ready
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {section !== "applications" && (
                <>
                  <div className="np-section-title flex h-16 items-center justify-between gap-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-[-0.3px] [&>span]:text-xs [&>span]:text-muted-foreground">
                    <h2>Recent activity</h2>
                    <span>Today</span>
                  </div>
                  <div
                    className="np-activity flex min-h-32 items-center gap-6 bg-card px-8 py-6 shadow-[inset_0_0_0_1px_var(--border)] [&>svg]:shrink-0 [&>span]:ml-auto [&>span]:text-[11px] [&>span]:whitespace-nowrap [&>span]:text-muted-foreground [&_h3]:text-[15px] [&_h3]:leading-6 [&_h3]:font-semibold [&_p]:text-[13px] [&_p]:leading-6 [&_p]:text-muted-foreground max-[760px]:[&>span]:hidden max-[480px]:gap-3 max-[480px]:px-4"
                    data-nav-panel
                  >
                    <IconCircleCheck size={20} />
                    <div>
                      <h3>Workspace ready</h3>
                      <p>
                        Your demo workspace is available in {zoneName}. Switch landing zones above
                        to explore another workspace.
                      </p>
                    </div>
                    <span>Just now</span>
                  </div>
                </>
              )}
              <div
                className="np-reference mt-8 flex min-h-32 items-center gap-6 py-6 [&_h2]:text-sm [&_h2]:leading-6 [&_h2]:font-semibold [&_p]:text-[13px] [&_p]:leading-6 [&_p]:text-muted-foreground [&>a]:ml-auto [&>a]:whitespace-nowrap max-[760px]:flex-wrap max-[760px]:gap-4 max-[760px]:[&>a]:ml-[38px]"
                data-nav-panel
              >
                <IconBook size={22} />
                <div>
                  <h2>Looking for a starting point?</h2>
                  <p>Explore capabilities and guidance without leaving your account.</p>
                </div>
                {navLink(
                  "explore",
                  "onboarding",
                  <>
                    Open guides
                    <IconArrowUpRight size={16} />
                  </>,
                  "np-text-link",
                )}
              </div>
            </div>
          )}
          <footer className="np-footer mt-auto flex min-h-16 items-center justify-between gap-4 px-8 py-4 text-[11px] text-muted-foreground shadow-[inset_0_1px_var(--border)] [&>span:first-child]:font-[650] [&>span:first-child]:text-foreground max-[480px]:flex-wrap max-[480px]:px-4 max-[480px]:[&>span:nth-child(2)]:hidden">
            <span>Cloud DevEx Portal</span>
            <span>Navigation preview · Fictional data</span>
            <span aria-live="polite">Landing zone: {zoneName}</span>
          </footer>
        </main>
      </div>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="np-dialog font-sans">
          <DialogTitle>Jamie Demo</DialogTitle>
          <DialogDescription>Demo session · {zoneName} landing zone</DialogDescription>
          <button className="np-dialog-button flex min-h-10 items-center gap-3" onClick={signOut}>
            Sign out
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="np-dialog font-sans">
          <DialogTitle>Navigate the portal</DialogTitle>
          <DialogDescription>{zoneName} landing zone</DialogDescription>
          <nav
            className="np-mobile-nav [&_a]:block [&_a]:rounded-md [&_a]:px-2 [&_a]:py-3 [&_a[aria-current]]:bg-brand-tint [&_a[aria-current]]:text-brand-ink"
            aria-label="Mobile navigation"
          >
            {(workbench ? workItems : exploreItems).map((item) => (
              <div key={item.id}>
                {navLink(workbench ? "workbench" : "explore", item.id, item.label)}
              </div>
            ))}
          </nav>
          {signedIn && (
            <button className="np-dialog-button flex min-h-10 items-center gap-3" onClick={signOut}>
              Sign out of demo session
            </button>
          )}
          <button
            className="np-dialog-button flex min-h-10 items-center gap-3"
            onClick={() => {
              setMenuOpen(false);
              setSearchOpen(true);
            }}
          >
            <IconSearch size={16} />
            Search the catalog
          </button>
        </DialogContent>
      </Dialog>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="np-dialog font-sans np-search-dialog w-[min(640px,calc(100%_-_32px))] max-w-[640px]">
          <DialogTitle>Search the catalog</DialogTitle>
          <DialogDescription>Public resources in the {zoneName} landing zone.</DialogDescription>
          <InputGroup className="np-search-field h-12">
            <InputGroupAddon>
              <IconSearch size={18} />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Search resources"
              placeholder="Find a capability, standard or guide…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                >
                  <IconX size={16} />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <div className="np-results max-h-[55dvh] overflow-y-auto [&_article]:border-b [&_article]:border-border [&_article]:px-2 [&_article]:py-4 [&_article>span]:text-[11px] [&_article>span]:text-muted-foreground [&_h3]:text-[15px] [&_h3]:leading-6 [&_h3]:font-semibold [&_p]:text-[13px] [&_p]:leading-6 [&_p]:text-muted-foreground [&_a]:mt-2 [&_a]:inline-flex [&_a]:items-center [&_a]:gap-2 [&_a]:text-brand-ink">
            {results.map((resource) => (
              <article key={resource.title}>
                <span>{resource.type}</span>
                <h3>{resource.title}</h3>
                <p>{resource.description}</p>
                <Link
                  to="/prototype/navigation"
                  search={destination("explore", resource.section)}
                  onClick={() => setSearchOpen(false)}
                >
                  Browse {resource.section}
                  <IconArrowRight size={14} />
                </Link>
              </article>
            ))}
            {results.length === 0 && (
              <p role="status">No resources found. Try “container” or “production”.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
