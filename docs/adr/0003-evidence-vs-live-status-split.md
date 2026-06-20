# Evidence flows through the consumer-neutral Context API with citations; live operational status is Portal-native and uncited

Status: accepted
Date: 2026-06-13

## Context

Atlas will surface read-only Terraform Enterprise (TFE) run/workspace status in a
Dashboard. Live status cannot be "cited at an anchor" — it is a different paradigm from
the governed-citation core. This reopened the long-unresolved boundary question (is the
Overview/Dashboard ops surface inside Atlas's boundary, or Backstage/Grafana territory?).

## Decision

Split data **by paradigm**:

1. **Evidence** — anything derived from a citable Source (Confluence excerpts, Terraform
   module docs, the Confluence-parsed availability matrix) flows through the
   **consumer-neutral Context API** and **always carries a Citation**.
2. **Operational status** — live TFE run/workspace state — is **Portal-native** (fetched
   by the Portal's own server routes, e.g. `portal/src/api/server/*`), **never enters the
   Context API**, and is **never presented as Evidence**.

Atlas surfaces read-only provisioning status **as an action pointer** (it links out to
TFE/Harness so the user acts there). Atlas **never executes provisioning** and **never
becomes a monitoring/metrics/incident platform** — no history, no trends, no alerting,
no incident management.

## Consequences

- The Context Layer stays pure: governed citation only.
- The Dashboard is a Portal feature, **not** part of the consumer-neutral contract;
  agents/MCP receive governed context, not the ops dashboard.
- **Availability** becomes a governed Context-API Source: parsed from a Confluence page,
  cached, returned with a Citation, and carrying the same `stale_source`/drift signals as
  any other Source (see `CONTEXT.md`). It is no longer a free-standing UI projection.
- Resolves the long-open Overview/ops boundary tension.
