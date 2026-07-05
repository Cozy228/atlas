# DynamoDB Events Table

## Purpose

The `events` table stores the **durable, derived change feed** — the append-only
`ChangeEvent` stream the platform emits at each snapshot transition (Step 2, M1).
It is derived-but-durable data: unlike the Valkey snapshots (K=2 derivation cache,
M2), event history must survive cache loss and serve `since=<3 weeks ago>` reads,
so it lives in DynamoDB and is never recomputed. It is owned by the Context API
runtime and read through the governed `GET /api/changes` route (scoped by
`ctx.scope`) plus its Atom rendering; browser code never reads it directly.

The feed is **machine-derived and distinct from What's New (P31)**: What's New is
the editorial Confluence newsletter (`resolveReleaseNotes`), authored by humans;
this table is the automatic, cited, scoped "my changes" surface.

## Table

- Table name: provided by `EVENTS_TABLE`
- Primary key: `pk` string, `sk` string
- GSI: `gsi1` with `gsi1pk` string, `gsi1sk` string

## Item Shape

Each `ChangeEvent` is stored as one item:

| Attribute | Value |
|---|---|
| `pk` | `EVENT#<id>` (`id` is a content hash of the event's identity fields) |
| `sk` | `METADATA` |
| `gsi1pk` | `EVENT` (one constant, time-ordered partition) |
| `gsi1sk` | `<derivedAt>#<id>` (the `eventCursor` — sorts chronologically) |
| `id` | Content-hash idempotency id (`class`, `subject`, `object`, `from`→`to`, graph versions) |
| `class` | Closed `EventClass` (`service-added`, `available-in-added`, `module-version-changed`, …) |
| `subject` | The node the event is about (`{ kind, id }`) |
| `object` | The related node for edge/version events (LZ / guardrail / module), optional |
| `landingZoneIds` | The zones the subject touches — the scope-filter key |
| `from` / `to` | Value delta for `module-version-changed` (published versions), optional |
| `rootId` | The source root that witnessed the delta |
| `graphVersionFrom` / `graphVersionTo` | The two graph versions the transition spans |
| `derivedAt` | ISO timestamp the event was derived |

## Access Patterns

| Access pattern | Operation |
|---|---|
| Append an event | `PutItem` with `ConditionExpression: attribute_not_exists(pk)` — idempotent (M1): a re-derived event collides on its content-hash id and is a no-op |
| Read the feed incrementally | `Query` on `gsi1` where `gsi1pk = EVENT` (and `gsi1sk > :since` when a cursor is supplied), ordered by `derivedAt` |

**Append-only:** no update, no delete. The idempotent conditional put means
concurrent ECS tasks that re-derive the same transition (M10) never double the
feed. The single time-ordered `EVENT` partition suits the low change cadence
(A2); revisit only if event volume demands sharding by time bucket.

## Runtime Boundary

The repository implementation lives in
`context-layer/src/repositories/dynamoEventsRepository.ts`. The
`createEventsRepository` factory uses DynamoDB only when `EVENTS_TABLE` is set. In
**production without `EVENTS_TABLE` it throws at construction** — the durable
change feed must never silently land in memory where a task restart erases it
(mid-level §2). Local and test runs without the variable fall back to the
in-memory repository (the `DEV_MOCKS` seam is unchanged).
