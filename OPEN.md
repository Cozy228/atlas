# OPEN — one line per open item, greppable; swept by /gc

- product (owner ruling needed): post-Step-5 the UI has NO click-path to a policy detail page — catalog shows Services only, search excludes policies, only a policy page links policies (circular); route works by direct URL. Intended consequence of "policies fold onto services" or a gap? Dead code sits in `components/catalog/adopted.tsx` (`tab === "policies"` branch, PolicyCard, policy TableView). Found 2026-07-06 during e2e spec repair.
- graph: `SNAPSHOT_CAS_LUA` is mirrored by a fake in CI, never executed against a live Valkey — a Lua-side drift would not fail CI (accepted residual risk, Step-2 tails FIX 6; candidate for a live-Valkey integration test if infra allows).
- graph: snapshot-store degraded-fallback recovery (60s retry) is tested with injected clock/deps only; no chaos test against a real Valkey outage.
- lint: two pre-existing oxlint warnings in `briefs/assembleBrief.ts` + `sourceContent/confluenceOnboardingProvider.ts` (untouched, Step-4 vintage).
- step-2 deferred (by design, parent goal prompt): subscriptions + push delivery (Atom is the pull channel); A2 cadence measurement once the differ can replay source version history.
