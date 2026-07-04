# The Atlas App Manifest (`atlas.app.yaml`)

## Purpose

The app manifest is how a consuming team **anchors their situation in their own
repository** (P21). It is a minimal, identity-free declaration — the APP's name,
its landing-zone *set*, and the services it uses — that an agent reads from the
working directory and passes to Atlas **by value**, with zero registration
(M11). The Portal self-declare form is the fallback for situations without a
repo; the manifest is the primary, version-controlled anchor.

An agent bootstraps from `atlas.app.yaml`; **PR review is the maintenance
surface**. Atlas never writes to a team repo.

## File

- **Name:** `atlas.app.yaml`
- **Location:** the consuming repository's root.

> The name is `atlas.app.yaml`, not `atlas.yaml` — the latter is reserved for a
> different concern (see `source-lifecycle-design.md`).

## Fields

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | The APP's display name. |
| `landingZones` | yes | The landing-zone **set** the APP deploys into (at least one; P26). An LZ id already carries its cloud identity, so a set may span clouds. |
| `services` | no | The services-in-use (service slugs, e.g. `aws/textract`). |
| `appId` | no | The registered APP id, written back **by the team** after an explicit registration (see below). |

The field names deliberately match the by-value scope vocabulary the Context API
already accepts (`landingZones` / `services`).

## Example

```yaml
# atlas.app.yaml — fictional, public-safe example
name: Orion Checkout
landingZones:
  - awsf
  - azure
services:
  - aws/textract
  - aws/s3
# appId is added by the team after registering (optional):
# appId: app-orion-checkout
```

## The two flows

### By value (zero registration — the default)

An agent reads `atlas.app.yaml` and passes `landingZones` / `services` inline on
the request (`?landingZones=awsf,azure`). This is **stateless**: it seats the
scope for that request and **never writes** to Atlas. This is all most situations
ever need.

### By reference (after explicit registration)

If a team wants durable consumer state (a persistent "my APP" view, and — later —
subscriptions), they register explicitly, either through the Portal self-declare
form or `POST /api/apps`. Registration returns a server-generated `appId`. The
team then **commits that `appId` back into `atlas.app.yaml` themselves** (the PR
is the review surface). From then on the agent may scope by reference
(`?appId=app-orion-checkout`).

When a request carries both an inline declaration and an `appId` that disagree,
Atlas scopes by the **manifest value** (the caller's own freshest declaration)
and returns a `scope_drift` warning — honest, and it nudges the sync.

## Provenance

An APP declared this way is always labeled `self-declared` and is **never
presented as discovered** — it is consumer state, not platform Evidence. A future
registry adapter may upgrade the record's `origin` in place (P17) without
changing this manifest.
