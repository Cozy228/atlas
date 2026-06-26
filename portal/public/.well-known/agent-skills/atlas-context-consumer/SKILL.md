---
name: atlas-context-consumer
description: Resolve governed, citation-backed platform context from Atlas (services, sources, regional availability) through the Context API bundle. Use when an agent needs an authoritative, sourced answer about a cloud platform service instead of guessing.
---

# Consuming Atlas context

Atlas is a governed context layer: it registers, validates, and serves
authoritative source excerpts with citations. Source systems remain the system
of record; Atlas never mirrors them durably.

Vocabulary (use these terms exactly):

- **Source** — a registered system-of-record document Atlas can cite,
  identified by `source_class`.
- **Anchor** — a registered, citable location within a Source.
- **Excerpt** — the text Atlas returns for an Anchor at request time, always
  paired with a Citation. Excerpts are ephemeral, resolved live.
- **Citation** — the provenance attached to an Excerpt: `source_id`,
  `anchor_id`, label, and location. An Excerpt without a Citation is never
  returned — never present one without the other.

## Steps

1. **Discover the service.** `GET /api/topics?query=<terms>` returns
   matching topics. Pick the topic whose `id` fits the question.
   (MCP alternative: `Atlas:atlas_search_service`.)
2. **Fetch the context bundle.** `GET /api/topics/{topic_id}/context` returns
   a `ContextBundleResponse`: `sources[]` (each with `excerpts[]`),
   `anchor_references[]`, `warnings[]`, and `expansion_paths[]`.
   (MCP alternative: `Atlas:atlas_get_context_bundle`.)
3. **Answer from the bundle only.** Surface each claim with its Citation
   (label + location). Do not add claims the bundle does not support.
4. **Honor warnings verbatim.** Relay every `warnings[]` entry to the user
   unchanged — especially `restricted_source` ("this Source exists but the
   caller's identity is not allowed to see its content") and `stale_source`
   ("the registered record may no longer match the live source of record").
   Do not hide, soften, or rephrase them.

## Example

Question: "Can AWS Textract run in a private subnet?"

```text
GET /api/topics?query=textract            -> topic id "aws-textract"
GET /api/topics/aws-textract/context      -> ContextBundleResponse
```

Each `sources[]` entry carries `excerpts[]` like:

```json
{
  "anchor_id": "private-subnet-usage",
  "text": "…",
  "citation": {
    "source_id": "textract-module-readme",
    "anchor_id": "private-subnet-usage",
    "label": "Private subnet usage",
    "location": "github.com/acme/terraform-aws-textract"
  }
}
```

Answer by quoting the Excerpt and citing "Private subnet usage,
github.com/acme/terraform-aws-textract". If `warnings[]` contains
`stale_source` for that source, say so in those words.

## Other reads

- `GET /api/sources?query=<terms>` — discover registered Sources.
- `GET /api/sources/{source_id}` — one Source's registry record.
- `GET /api/sources/{source_id}/content` — bundle scoped to one Source.
- The machine-readable contract is published at `/openapi.json`.

## Auth

Forward the caller's bearer token unchanged (`Authorization: Bearer <token>`);
Atlas threads it, unparsed, to the system of record, whose own ACL decides
what comes back. If no token is supplied, Atlas applies its narrow
service-token fallback. Never fabricate credentials, and never retry a
`restricted_source` outcome with invented tokens.
