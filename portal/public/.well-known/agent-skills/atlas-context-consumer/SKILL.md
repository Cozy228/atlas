---
name: atlas-context-consumer
description: Resolve governed, citation-backed platform context from Atlas (services, security policies, sources, regional availability) through the resource Context API. Use when an agent needs an authoritative, sourced answer about a cloud platform service instead of guessing.
---

# Consuming Atlas context

Atlas is a governed context layer: it discovers, validates, and serves
authoritative source excerpts with citations. Source systems remain the system
of record; Atlas never mirrors them durably.

Vocabulary (use these terms exactly):

- **Resource** — the unit Atlas answers about, addressed by a canonical
  `{kind}/{slug}` id (e.g. `service/aws/textract`, `guardrail/public-access-controls`).
- **Source** — a registered system-of-record document Atlas can cite,
  identified by `source_class`.
- **Section** — a coarse, named slice of a Resource's governed context
  (`overview`, `network`, `examples`, `enforced-controls`, …), live-resolved
  from Sources at request time.
- **Citation** — the provenance attached to resolved content: `sourceId`,
  `title`, `url`, an optional located `anchor`, and `resolvedAt`. Content is
  never returned without its Citation — never present one without the other.

## Steps

1. **Discover the resource.** `GET /api/resources?query=<terms>` returns
   matching resources; pick the one whose canonical `id` (`{kind}/{slug}`) fits
   the question. Browse the full inventory with `GET /api/resources/catalog`.
   (MCP alternative: `Atlas:atlas_search_service`.)
2. **Read its context.** `GET /api/resources/{kind}/{slug}` returns a
   `ResourceContextResponse`: `sections` (each with live `content`,
   `citations[]`, and `warnings[]`), `references[]` (reference-only discovery
   links), and `missingSections[]` (honest gaps). Append `Accept: text/markdown`
   for a rendered datasheet. (MCP alternative: `Atlas:atlas_get_resource_context`.)
3. **Answer from cited content only.** Surface each claim with its Citation
   (title + location). Do not add claims the sections do not support; an empty
   `sections` map means no governed context, not a negative answer.
4. **Honor warnings verbatim.** Relay every `warnings[]` entry to the user
   unchanged — especially `restricted_source` ("this Source exists but the
   caller's identity is not allowed to see its content") and `stale_source`
   ("the registered record may no longer match the live source of record").
   Do not hide, soften, or rephrase them.

## Example

Question: "Can AWS Textract run in a private subnet?"

```text
GET /api/resources?query=textract            -> resource id "service/aws/textract"
GET /api/resources/service/aws/textract      -> ResourceContextResponse
```

Each resolved Section carries `content` and `citations[]` like:

```json
{
  "status": "available",
  "content": "…",
  "citations": [
    {
      "sourceId": "textract-module-readme",
      "title": "Textract Module README",
      "url": "github.com/acme/terraform-aws-textract",
      "anchor": "private-subnet-usage",
      "resolvedAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

Answer by quoting the Section content and citing "Textract Module README,
github.com/acme/terraform-aws-textract". If `warnings[]` contains
`stale_source` for that source, say so in those words.

## Other reads

- `GET /api/resources/catalog` — the full discovered catalog (services + security policies).
- `GET /api/sources?query=<terms>` — discover registered Sources.
- `GET /api/sources/{source_id}` — one Source's registry record.
- The machine-readable contract is published at `/openapi.json`.

## Auth

Forward the caller's bearer token unchanged (`Authorization: Bearer <token>`);
Atlas threads it, unparsed, to the system of record, whose own ACL decides
what comes back. If no token is supplied, Atlas applies its narrow
service-token fallback. Never fabricate credentials, and never retry a
`restricted_source` outcome with invented tokens.
