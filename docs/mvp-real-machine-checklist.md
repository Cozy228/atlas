# MVP Real-Machine & Demo Checklist

Status as of 2026-06-24. This is the single place to track what is still **fixture
/ offline**, what needs to be **connected to a real backend** for the MVP, and the
**demo walkthrough** to verify each surface.

The platform runs **offline by default**: every live integration is gated behind
an environment variable. With no env set, all surfaces render from public-safe,
fictional fixtures. Setting the env vars flips the matching surface to live with
**no code change**.

---

## 1. Live-connection checklist (env-gated integrations)

Set these where the Context Layer runs (portal server / Lambda). All are optional;
each unlocks one surface.

| Integration | Env vars | Unlocks | Adapter |
|---|---|---|---|
| Confluence Cloud | `ATLAS_CONFLUENCE_BASE_URL`, `ATLAS_CONFLUENCE_TOKEN`, `ATLAS_CONFLUENCE_EMAIL` (email ⇒ Basic auth for a personal API token; else Bearer) | Live excerpts for `confluence-page` **and** `policy-document` sources | `context-layer/src/sourceContent/confluenceCloudContentProvider.ts` |
| Terraform / GitHub README | `ATLAS_TERRAFORM_TOKEN` (+ `ATLAS_TERRAFORM_BASE_URL`, default `api.github.com`) | Live excerpts for `terraform-module` sources | `context-layer/src/sourceContent/terraformModuleContentProvider.ts` |
| Release notes (live) | `ATLAS_RELEASE_NOTES_PAGE_ID` (+ the Confluence vars above) | `/whatsnew` releases fetched from the live Confluence page | `context-layer/src/releaseNotes/resolveReleaseNotes.ts` |
| Feedback store | `ATLAS_FEEDBACK_TABLE` (DynamoDB) | Persisted feedback (else in-memory) | `context-layer/src/services/contextBundleService.ts` |
| LLM (Ask Atlas) | `ATLAS_BEDROCK_MODEL_ID` (Bedrock) / RAI vars | Real grounded answers (else a simulated adapter echoes the first authoritative excerpt) | `portal/src/api/server/llmProvider.ts` |
| Content cache | `ATLAS_CACHE_VALKEY_URL` (optional) | Shared Valkey/Redis cache (else in-memory, 300s TTL) | `context-layer/src/sourceContent/sourceContentCache.ts` |

### Data conventions required for live resolution

The fixture registry (`data/*.yaml`) uses placeholder locations. For a source to
resolve **live**, its registry entry must follow these conventions:

- [ ] **Confluence source** — `location` = the Confluence **page id**; each anchor's
  `selector.locator` = the heading **slug** on that page.
- [ ] **Terraform source** — `location` = the GitHub repo (`github.com/owner/repo`);
  each anchor's `selector.locator` = `#heading-slug`.
- [ ] **Policy source** — ⚠️ currently modeled as S3 markdown (`location: s3://…`)
  with `clause-*` anchors (deliberate offline test fixtures, incl. one `broken`
  and one `restricted`). The resolver now has the Confluence live seam, but to
  serve policies live their sources must be repointed to a Confluence page id +
  heading-slug anchors. Until then policy stays offline even with Confluence env set.
- [ ] After repointing, confirm `observed_version` / fingerprint drift warnings
  behave (a stale fixture vs. a live newer version).

### Per-channel verification steps

- [ ] **Confluence**: open a `confluence-page` source detail (`/sources/$id`) → the
  "Key sections" should show the live section text + a working "open source" link
  back to the page anchor. Restricted pages return metadata only.
- [ ] **Terraform**: open a `terraform-module` source → README sections resolve.
- [ ] **Release notes**: with `ATLAS_RELEASE_NOTES_PAGE_ID` set, `/whatsnew`
  "Platform releases" reflects the live page (same shape as the YAML fixture).
- [ ] **ACL**: repeat a Confluence fetch as two different identities (Bearer tokens)
  → cache must not leak one identity's excerpt to another (key includes auth digest).
- [ ] **LLM**: Ask Atlas returns a grounded answer citing real excerpts, not the
  simulated echo.

---

## 2. Fixture inventory (what is still not real)

Legend — **Live path?**: ✅ flips live via env · ⚠️ partial / needs data repoint ·
❌ no live path (pure fixture, by design for MVP).

### Content & registry
- [ ] **Registry** `data/{sources,anchors,topics,source-topic-mappings}.yaml` — fictional
  sample seed. ❌ (the registry *is* the source of truth; entries are just fictional).
  Validated by `pnpm validate:registry`.
- [ ] **Offline excerpts** `context-layer/src/sourceContent/pilotSourceContent.ts` —
  canned excerpt text per source class, served when no live env. ✅ (Confluence/Terraform
  replace it) / ⚠️ (policy, availability-matrix have no live provider yet).
- [ ] **Availability matrix** — parametric resolver over governed markdown; no external
  fetch. ⚠️ (data is fixture; resolver is real).

### Newsletter (single source: `data/newsletter.yaml`)
The newsletter holds two entry kinds from **one file**:
- [ ] **Releases** (`releases:`) — ✅ live via `resolveReleaseNotes` (Confluence page id).
  Auto-wired in `portal/src/api/server/releaseNotes.ts`: with the Confluence env +
  `ATLAS_RELEASE_NOTES_PAGE_ID` set it serves the live page; otherwise it falls back
  to the YAML fixture. No code change to flip.
- [ ] **Announcements** (`announcements:`) — ❌ no live path yet; offline YAML only.
  Rendered as the `/whatsnew` broadsheet and the Home "What's new" ticker. **You will
  fill / curate these.** (Migrated here from the former hardcoded `CHANGES`; that
  duplicate source is deleted — there is now a single newsletter source.)

### Guidance (single source: `data/guidance/*.yaml`)
- [ ] **Guidance flows** — now codegen'd from YAML into `portal/src/lib/guidance.data.ts`
  (`pnpm gen:guidance`, runs in `build`). ❌ no live guidance backend. Only two real
  flows remain: `new-app-onboarding`, `api-gateway-adoption` (proto extras removed).
  Validated by `pnpm validate:guidance`.

### Home (`/`)
- [ ] **Intents** (`INTENTS`) — fictional, intentional copy. ❌ (static nav, fine).
- [ ] **Popular** (`POPULAR`) — fictional search suggestions. ❌ (intentional).
- [ ] **Recently viewed** — ✅ **real**: driven by this browser's click history
  (`localStorage`); renders nothing until you actually open things.
- [ ] **What's new ticker** — sourced from the newsletter announcements (see above).
- [ ] **Stats** (services / domains / regions) — ✅ **real**, from the availability projection.
- [ ] **Lifecycle / JourneyGrid** — static nav scaffolding. ❌ (intentional).

### Source detail (`/sources/$id`)
- [ ] **Key sections** — ✅ **real**: live-resolved excerpts from the context bundle
  (the former hardcoded `KEY_SECTIONS` demo is removed).
- [ ] **Revision history** — removed (was a projected demo log).

### Operations dashboard (`/overview`)
- [ ] `lib/ops.ts` (services, incidents, KPIs, pipelines, scans) — ❌ entirely demo,
  **labeled** with a "demo snapshot" badge + frozen timestamp. Out of MVP scope.

### Ask Atlas
- [ ] **Answers** — ✅ live via Bedrock/RAI; offline = simulated echo adapter.
- [ ] **Contact channels** (`/ask`) — ❌ fictional, derived from the owning team name.

---

## 3. MVP demo checklist (functional walkthrough)

Run offline (fixtures) unless a step calls for live env.

### Home `/`
- [ ] Stats show real counts from availability.
- [ ] "Recently viewed" is **empty on first load**; after opening a service/source it
  appears with real chips.
- [ ] "What's new" ticker scrolls the newsletter announcements; clicking lands on `/whatsnew`.

### Catalog `/catalog` → `/catalog/$topicId`
- [ ] Topic detail "References" lists registered sources with **real excerpts** (multiple
  per source at `disclosure_level: 2`), selection rationale, authority + freshness badges.
- [ ] A topic with no registered source shows the "claims unverifiable" empty state.

### Sources `/sources` → `/sources/$id`
- [ ] "Key sections" shows real resolved excerpts + "open source" links (offline = pilot
  fixtures; live = Confluence/Terraform).
- [ ] Restricted source shows metadata-only notice; no excerpt leakage.
- [ ] Freshness badge reflects review window; stale source warns.

### Guidance `/guidance` → `/guidance/$id`
- [ ] Index lists exactly the two real flows (no proto extras).
- [ ] Detail renders the stepper; each step's evidence rows show source title + badges
  on a plain background (no card), linking to the source detail.

### What's New `/whatsnew` and `/releases/$id`
- [ ] Broadsheet renders announcements (lead / secondary / today / earlier briefs + rail
  tally) — all from the newsletter announcements.
- [ ] "Platform releases" section lists releases grouped by month from the same file.
- [ ] Release brief title is a **date** (e.g. "11 Jun 2026"), not a CHG ticket.
- [ ] Release detail page renders categorized items; date-titled header; Jira links resolve.

### Ask Atlas
- [ ] Offline: returns a grounded simulated answer citing a real excerpt.
- [ ] Live (Bedrock/RAI): returns a real answer; every claim links to its source.

### Cross-cutting
- [ ] `pnpm -r lint` and `pnpm -r test` pass.
- [ ] `pnpm validate:registry` and `pnpm validate:guidance` pass.
- [ ] `pnpm --filter @atlas/portal build` succeeds (runs `gen:guidance` + `gen:agent-skills`).
- [ ] With live env set, at least one Confluence and one Terraform source resolve end-to-end.
