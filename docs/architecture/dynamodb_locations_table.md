# DynamoDB Locations Table

## Purpose

The `locations` table stores **self-registered operational-location pointers** —
the consumer-state registration entity (Step 7, M3): where an APP's things live
(`{ system, kind, url }`), scoped to an owning APP, with a provenance label. It is
durable consumer state (legitimately owned by Atlas, never Evidence), owned by the
Context API runtime and never read directly by browser code. Registration is an
explicit act (`POST /api/locations` or the Portal registration form); there is no
upsert-on-read (M11) — the routes are the only writers.

**No secret, no value.** A location record is a POINTER only. It never carries a
`token`/`secret` (a token in a registration would be a secret store + SSRF proxy at
once — structural invalidity), and it never stores a fetched status VALUE: the
status board is aggregation-at-read (P24, ADR-0003) with no durable store, no
history, no alerting. The `url` is a human link; value fetching goes through the
owning adapter's allowlisted base, never the registered `url`.

## Table

- Table name: provided by `LOCATIONS_TABLE`
- Primary key: `pk` string, `sk` string
- GSI: `gsi1` with `gsi1pk` string, `gsi1sk` string

## Item Shape

Each location record is stored as one item:

| Attribute | Value |
|---|---|
| `pk` | `LOC#<location_id>` |
| `sk` | `METADATA` |
| `gsi1pk` | `APP#<app_id>` (a per-APP partition — locations are scoped to an APP) |
| `gsi1sk` | `REGISTERED#<registeredAt>#<location_id>` |
| `id` | Server-generated location id |
| `appId` | The owning APP (from the request scope, never the body) |
| `system` | Owning system (e.g. `tfe`, `observatory`) |
| `kind` | Location kind (`workspace`/`pipeline`/`logs`/`dashboard`/`runbook`) |
| `url` | Human link to the location (never the value-fetch channel) |
| `discoveredFrom` | Provenance label (`registration` for self-service) |
| `registeredAt` | ISO timestamp of registration |

## Access Patterns

| Access pattern | Operation |
|---|---|
| Register a location | `PutItem` by full item |
| Read one location | `GetItem` where `pk = LOC#<id>` and `sk = METADATA` |
| List an APP's locations | `Query` on `gsi1` where `gsi1pk = APP#<app_id>` (single-partition, ordered by `registeredAt`) |
| Remove a location | `DeleteItem` where `pk = LOC#<id>` and `sk = METADATA` |

`listByApp()` is a single-partition `Query`, not a `Scan`: consumer state is
bounded, and the per-APP `gsi1` partition keeps each APP's listing cheap and
ordered. Unlike the apps table's one constant `APP` partition, locations partition
`gsi1` per APP because they are always read scoped to one APP.

## Runtime Boundary

The repository implementation lives in
`context-layer/src/repositories/dynamoLocationsRepository.ts`. The
`createLocationsRepository` factory uses DynamoDB only when `LOCATIONS_TABLE` is
set. In **production without `LOCATIONS_TABLE` it throws at construction** —
durable consumer state must never silently land in memory (mid-level §2). Local
and test runs without the variable fall back to the in-memory repository (the
`DEV_MOCKS` seam is unchanged).
