# Runtime resolution uses an identity-agnostic Bearer pipe, not a per-user token model

Status: accepted

## Context

The runtime excerpt-resolution goal was originally framed as "resolve Confluence
excerpts using the **requesting user's** token, so Confluence's ACL enforces
per-user visibility." That framing assumed every consumer can supply a per-user
token. In practice the Context API has heterogeneous consumers — the Portal UI
(browser → server fn), user-side AI Agents/Skills, and other backend services —
and each has a completely different (and mostly unbuilt) story for obtaining a
per-user Confluence token. A browser cannot hold a Confluence token at all; a
service-to-service caller has no human user; per-user acquisition needs Atlassian
OAuth that does not yet exist.

## Decision

Atlas builds an **identity-agnostic Bearer pipe**: it reads an opaque bearer from
the `Authorization` header and threads it, unparsed and unpersisted, all the way
to Confluence. Confluence enforces ACL against whatever identity that token
represents. **Atlas does not decide whose identity it is** — that is each
consumer's responsibility, and acquiring a per-user token (Portal OAuth, Agent
config) is out of scope for this goal.

When no caller token is present, resolution falls back to a server-side,
**narrow-scoped** service token (`ATLAS_CONFLUENCE_TOKEN`, restricted to
broadly-readable pages so the fallback cannot leak content a user could not see).
If even that is absent, resolution falls back to the offline pilot map.

## Consequences

- The per-user ACL guarantee ("a user lacking access gets `restricted_source`,
  not content") holds **only for the identity in the supplied token**. Under the
  service-token fallback, visibility is service-level, not per-user. Documentation
  and the Definition of Done state this honestly.
- The `restricted_source` warning now has two origins under one code: a
  registry-declared restriction and a runtime ACL denial. See `CONTEXT.md`.
- The transport is built per-user-ready from day one. Wiring Atlassian OAuth later
  is purely a token-source change for one consumer; the pipe does not change.
- This reverses the goal prompt's original "Locked Decision" wording, which
  asserted a per-user token model. A reader who sees the code fall back to a
  service token should read this ADR rather than assume a regression.

## Considered and rejected

- **Pure per-user token (the original framing):** unbuildable now for most
  consumers and blocks the whole goal on OAuth work.
- **Single shared service token only (ignore caller identity):** simplest, but
  permanently discards per-user ACL and would force ripping out the per-user seam,
  to be rebuilt when OAuth lands.
