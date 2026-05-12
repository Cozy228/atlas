# DynamoDB Feedback Table

## Purpose

The V1 feedback table stores Portal feedback submitted against topics, sources, and anchors. It is owned by the Context API runtime and is not read directly by browser code.

## Table

- Table name: provided by `ATLAS_FEEDBACK_TABLE`
- Primary key: `pk` string, `sk` string
- GSI: `gsi1` with `gsi1pk` string, `gsi1sk` string

## Item Shape

Each feedback record is stored as one item:

| Attribute | Value |
|---|---|
| `pk` | `FEEDBACK#<feedback_id>` |
| `sk` | `METADATA` |
| `gsi1pk` | `TARGET#<target_type>#<target_id>` |
| `gsi1sk` | `SUBMITTED#<submitted_at>#<feedback_id>` |
| `id` | Shared feedback id |
| `target_type` | `topic`, `source`, or `anchor` |
| `target_id` | Shared target id |
| `feedback_type` | Shared feedback category |
| `message` | User-submitted feedback text |
| `submitted_at` | ISO timestamp |

## Access Patterns

| Access pattern | Operation |
|---|---|
| Create feedback | `PutItem` by full item |
| Read one feedback item | `GetItem` where `pk = FEEDBACK#<id>` and `sk = METADATA` |
| Review feedback for one target | `Query` on `gsi1` where `gsi1pk = TARGET#<target_type>#<target_id>` |
| Pilot/debug list | `Scan` filtered to `sk = METADATA`; not a primary product path |

## Runtime Boundary

The repository implementation lives in `context-layer/src/repositories/dynamoFeedbackRepository.ts`. The default Context API service uses DynamoDB only when `ATLAS_FEEDBACK_TABLE` is set; otherwise local and test runs continue to use the in-memory repository seeded from pilot data.
