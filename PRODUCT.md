# Product

## Register

product

## Users

Every engineer at the company — from platform engineers writing Terraform to backend and
full-stack developers deploying services — plus occasional technical PMs and EMs who need
to understand platform decisions without deep infrastructure knowledge.

Context: engineers open Atlas mid-task. They are in flow and need a fast, reliable answer:
which capability to adopt, whether a service is available in their region, whether a design
choice is approved policy. They are not browsing for inspiration; they have a specific
question and a deadline.

## Product Purpose

Atlas Portal is the authoritative self-service catalog for the company's cloud platform.
It maps platform capabilities to their owners, approved sources, and entry tools; surfaces
regional availability projections; and provides AI-assisted answers grounded exclusively
in registered, authoritative context.

Success looks like: an engineer opens Atlas, gets a confident answer in under two minutes,
and trusts that answer enough to act on it — because every claim links back to its source.

## Brand Personality

Authoritative, precise, calm. Atlas presents platform knowledge with the confidence of
institutional documentation — not chatty, not apologetic, never hedged beyond what the
data actually requires. It speaks to engineers as peers.

## Anti-references

- Generic SaaS dashboards: cream backgrounds, purple gradients, glowing cards, AI-generated
  aesthetic. Atlas is a tool, not a product landing page.
- Legacy enterprise systems: heavy blue-grey palettes, accordion-nested tables, sidebar
  navigation that buries everything three levels deep.
- DevRel marketing pages: large hero sections, flashy scroll effects, animation that
  compensates for thin content. Atlas earns attention through information density and source
  integrity, not visual spectacle.

## Design Principles

1. **Evidence before confidence.** Every authoritative claim surfaces its source. UI that
   implies certainty without citation is an anti-pattern.
2. **Density is a feature.** Engineers navigate at speed. Whitespace exists for rhythm,
   not to pad scanty content. Complex information should be complex; clarity comes from
   structure, not reduction.
3. **Platform vocabulary is sacred.** Labels like "capability", "landing zone", "anchor",
   "authority level" are domain language. Never soften or genericize them for assumed
   non-technical readers.
4. **Calmness under load.** Degraded states, stale sources, broken anchors, and missing
   availability are expected conditions. The UI communicates them without alarm — a warning
   that disrupts the workflow is worse than silence.
5. **Ship-state honesty.** Indicators that claim "Live" or "Synced" must be wired to real
   data. Decorative freshness signals corrode trust faster than showing nothing.

## Accessibility & Inclusion

WCAG 2.1 AA. Support `prefers-reduced-motion` for existing animated elements (theme
toggle, ping indicators). Full keyboard operability for navigation, search, and the Ask
Atlas chat interface.
