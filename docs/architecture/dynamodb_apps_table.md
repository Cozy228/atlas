# DynamoDB Apps Table

## Purpose

The `apps` table stores **self-declared APP records** — the consumer-state
situation entity (Step 3, P17): an APP's name, its landing-zone *set* (P26), its
declared services-in-use, and its provenance label. It is durable consumer state
(legitimately owned by Atlas, never Evidence), owned by the Context API runtime
and never read directly by browser code. Registration is an explicit act
(`POST /api/apps` or the Portal self-declare form); there is no upsert-on-read
(M11) — the routes are the only writers.

## Table

- Table name: provided by `APPS_TABLE`
- Primary key: `pk` string, `sk` string
- GSI: `gsi1` with `gsi1pk` string, `gsi1sk` string

## Item Shape

Each APP record is stored as one item:

| Attribute | Value |
|---|---|
| `pk` | `APP#<app_id>` |
| `sk` | `METADATA` |
| `gsi1pk` | `APP` (one constant partition — bounded consumer state) |
| `gsi1sk` | `DECLARED#<declaredAt>#<app_id>` |
| `id` | Server-generated APP id |
| `name` | Declared APP name |
| `landingZoneIds` | Declared landing-zone set (P26; at least one member) |
| `serviceSlugs` | Declared services-in-use (may be empty) |
| `origin` | `self-declared` (a registry adapter rewrites this in place later, P17) |
| `declaredAt` | ISO timestamp of registration |
| `updatedAt` | ISO timestamp of the last update |

## Access Patterns

| Access pattern | Operation |
|---|---|
| Register an APP | `PutItem` by full item |
| Read one APP | `GetItem` where `pk = APP#<id>` and `sk = METADATA` |
| Update an APP | `PutItem` of the merged record (partial update composed route-side) |
| List all APPs | `Query` on `gsi1` where `gsi1pk = APP` (single-partition, ordered by `declaredAt`) |

`list()` is a single-partition `Query`, not a `Scan`: consumer state is bounded,
and the constant `APP` partition keeps the listing cheap and ordered.

## Runtime Boundary

The repository implementation lives in
`context-layer/src/repositories/dynamoAppsRepository.ts`. The
`createAppsRepository` factory uses DynamoDB only when `APPS_TABLE` is set. In
**production without `APPS_TABLE` it throws at construction** — durable consumer
state must never silently land in memory (mid-level §2). Local and test runs
without the variable fall back to the in-memory repository (the `DEV_MOCKS` seam
is unchanged).
