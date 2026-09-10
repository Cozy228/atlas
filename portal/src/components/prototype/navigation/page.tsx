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
        className={className}
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
              className="np-active-indicator"
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
    <div className="nav-preview" data-view={workbench ? "workbench" : "explore"}>
      <a className="np-skip" href="#np-main">
        Skip to content
      </a>
      <header className="np-topbar" data-nav-header>
        <div className="np-identity">
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
          <nav className="np-explore-nav" aria-label="Explore navigation">
            {exploreItems.map((item, index) => (
              <span key={item.id} className={index > 3 ? "np-nav-secondary" : undefined}>
                {navLink("explore", item.id, item.label, "np-top-link")}
              </span>
            ))}
            <div className="np-more">
              <Popover open={moreOpen} onOpenChange={setMoreOpen}>
                <PopoverTrigger className="np-more-trigger">
                  More
                  <IconChevronDown size={12} />
                </PopoverTrigger>
                <PopoverContent align="start" className="np-more-menu">
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
            className="np-work-search"
            aria-label="Search the catalog"
            onClick={() => setSearchOpen(true)}
          >
            <IconSearch size={16} />
            <span>What are you looking for?</span>
            <kbd>⌘K</kbd>
          </button>
        )}
        <div className="np-tools">
          <Popover open={zoneOpen} onOpenChange={setZoneOpen}>
            <PopoverTrigger className="np-zone" aria-label={`Landing zone: ${zoneName}`}>
              <IconStack2 size={16} aria-hidden="true" />
              <span>{zoneName}</span>
              <IconChevronDown size={12} aria-hidden="true" />
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={16} className="np-zone-menu">
              <div className="np-zone-menu-heading">Landing zone</div>
              {LANDING_ZONES.map((item) => (
                <button
                  key={item.id}
                  className="np-zone-option"
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
          <span className="np-tools-divider" aria-hidden="true" />
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
              className="np-avatar"
              aria-label="Account menu"
              title="Account menu"
              onClick={() => setAccountOpen(true)}
            >
              JD
            </button>
          )}
          <button
            className="np-icon np-menu-button"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            <IconMenu2 size={20} />
          </button>
        </div>
      </header>

      <div className="np-body">
        {workbench && (
          <aside className="np-sidebar" data-nav-sidebar>
            <div className="np-sidebar-heading">WORKBENCH</div>
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
            <div className="np-sidebar-bottom">
              <IconCircleCheck size={16} />
              <div>
                Demo workspace<small>Fictional data · {zoneName}</small>
              </div>
            </div>
          </aside>
        )}

        <main id="np-main" className="np-main" tabIndex={-1}>
          {gated ? (
            <div className="np-signin" data-nav-panel>
              <IconLock size={28} stroke={1.5} />
              <p className="np-eyebrow">CLOUD DEVEX WORKBENCH</p>
              <h1 ref={titleRef} tabIndex={-1}>
                Your work starts here.
              </h1>
              <p>Sign in to access your applications and work in the {zoneName} landing zone.</p>
              <button
                className="np-primary"
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
            <div className="np-canvas np-explore-content">
              <div className="np-intro" data-nav-panel>
                <p className="np-eyebrow">
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
                <p className="np-lead">
                  {section === "overview"
                    ? "Find the right guidance, services, and evidence to build with confidence. Every claim links back to its source."
                    : `Browse ${section} for the ${zoneName} landing zone. Find the guidance you need before starting work.`}
                </p>
                {section === "overview" && (
                  <button
                    className="np-home-search"
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
              <div className="np-section-title">
                <h2>{section === "overview" ? "Browse by intent" : `Available in ${zoneName}`}</h2>
                <span>{visibleResources.length} resources</span>
              </div>
              {visibleResources.length === 0 && (
                <div className="np-section-preview" data-nav-panel>
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
                    className="np-text-link"
                  >
                    Open current page
                    <IconArrowUpRight size={16} />
                  </Link>
                </div>
              )}
              <div className="np-resource-grid">
                {visibleResources.map((resource) => (
                  <article className="np-resource" key={resource.title} data-nav-panel>
                    <div className="np-resource-meta">
                      <resource.icon size={24} stroke={1.4} />
                      <span>{resource.type}</span>
                    </div>
                    <h3>{resource.title}</h3>
                    <p>{resource.description}</p>
                    <button
                      className="np-text-link"
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
              <div className="np-bottom-note">
                <span>Built for informed decisions.</span>
                <span>Guidance, services and evidence for your landing zone.</span>
              </div>
            </div>
          ) : (
            <div className="np-canvas np-work-content">
              <div className="np-work-heading" data-nav-panel>
                <p className="np-eyebrow">
                  {zoneName.toUpperCase()} LANDING ZONE <span>/</span> YOUR WORKSPACE
                </p>
                <h1 ref={titleRef} tabIndex={-1}>
                  {section === "overview"
                    ? "Good morning, Jamie."
                    : workItems.find((item) => item.id === section)?.label}
                </h1>
                <p className="np-lead">
                  {section === "overview"
                    ? "Pick up where you left off, or find your next application."
                    : `Your ${section} in the ${zoneName} landing zone.`}
                </p>
              </div>
              {section !== "activity" && (
                <>
                  <div className="np-section-title">
                    <h2>Your applications</h2>
                    <span>2 applications</span>
                  </div>
                  <div className="np-app-list" data-nav-panel>
                    {[
                      `${zoneName.toLowerCase()}-storefront`,
                      `${zoneName.toLowerCase()}-inventory`,
                    ].map((app, index) => (
                      <div className="np-app-row" key={app}>
                        <span className="np-app-icon">
                          <IconBox size={21} stroke={1.5} />
                        </span>
                        <div>
                          <h3>{app}</h3>
                          <p>{index === 0 ? "Customer experience" : "Supply operations"}</p>
                        </div>
                        <span className="np-status">
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
                  <div className="np-section-title">
                    <h2>Recent activity</h2>
                    <span>Today</span>
                  </div>
                  <div className="np-activity" data-nav-panel>
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
              <div className="np-reference" data-nav-panel>
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
          <footer className="np-footer">
            <span>Cloud DevEx Portal</span>
            <span>Navigation preview · Fictional data</span>
            <span aria-live="polite">Landing zone: {zoneName}</span>
          </footer>
        </main>
      </div>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="np-dialog">
          <DialogTitle>Jamie Demo</DialogTitle>
          <DialogDescription>Demo session · {zoneName} landing zone</DialogDescription>
          <button className="np-dialog-button" onClick={signOut}>
            Sign out
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="np-dialog">
          <DialogTitle>Navigate the portal</DialogTitle>
          <DialogDescription>{zoneName} landing zone</DialogDescription>
          <nav className="np-mobile-nav" aria-label="Mobile navigation">
            {(workbench ? workItems : exploreItems).map((item) => (
              <div key={item.id}>
                {navLink(workbench ? "workbench" : "explore", item.id, item.label)}
              </div>
            ))}
          </nav>
          {signedIn && (
            <button className="np-dialog-button" onClick={signOut}>
              Sign out of demo session
            </button>
          )}
          <button
            className="np-dialog-button"
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
        <DialogContent className="np-dialog np-search-dialog">
          <DialogTitle>Search the catalog</DialogTitle>
          <DialogDescription>Public resources in the {zoneName} landing zone.</DialogDescription>
          <InputGroup className="np-search-field">
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
          <div className="np-results">
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
