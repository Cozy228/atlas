# OPEN — one line per open item, greppable; swept by /gc

- e2e: `a11y.spec.ts` policy-detail + `core-journey.spec.ts` fail at HEAD — Step 5 catalog demotion removed the "Security policies" tab the specs still click; specs need rewriting against the new front doors (pre-existing, found 2026-07-06 during Step-2 tails full-suite run).
- graph: `SNAPSHOT_CAS_LUA` is mirrored by a fake in CI, never executed against a live Valkey — a Lua-side drift would not fail CI (accepted residual risk, Step-2 tails FIX 6; candidate for a live-Valkey integration test if infra allows).
- graph: snapshot-store degraded-fallback recovery (60s retry) is tested with injected clock/deps only; no chaos test against a real Valkey outage.
- lint: two pre-existing oxlint warnings in `briefs/assembleBrief.ts` + `sourceContent/confluenceOnboardingProvider.ts` (untouched, Step-4 vintage).
- step-2 deferred (by design, parent goal prompt): subscriptions + push delivery (Atom is the pull channel); A2 cadence measurement once the differ can replay source version history.
