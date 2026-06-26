# Hard gate — hero adoption journeys (S3 · API Gateway · Textract)

The MVP "done" bar for the consumer surface is a single end-to-end journey that a
consuming application (or its coding agent) can complete against the **local product
only**, without reading Atlas source. It is enforced across the three hero services —
**API Gateway, Amazon S3, AWS Textract** — so the whole hero slice clears the same bar.

Atlas stays a *grounded* context layer: every answer is a registered, cited Source
excerpt. It points to the authoritative Terraform module and hands back a cited starter
snippet — it never synthesizes bespoke Terraform. The Terraform always arrives **through
the terraform module integration** (the `terraform-module` Source resolved by the
terraform resolver), never as free text.

## The journey (and where each step is answered)

Examples below use `api-gateway`; substitute `aws-s3` or `aws-textract` for the others.

| Adopter question | Surface | What comes back |
| --- | --- | --- |
| Is there this service? | `GET /api/topics?query=api%20gateway`, MCP `atlas_search_service` | the `api-gateway` topic |
| How is it designed / how does it fit my app? | `GET /api/topics/api-gateway/context`, MCP `atlas_get_context_bundle` | cited excerpts from the module + integration/policy sources |
| Give me the Terraform | the same bundle (via the terraform module integration) | authoritative `apigateway-module-readme` with a cited `#terraform-starter` HCL snippet |
| Where's the user guide? | the service datasheet `/catalog/api-gateway` → **User guide** link (a topic `entry_tool`) | a link to the service's user guide (distinct from the adoption route) |
| What's the adoption guide? | Portal `/guidance/api-gateway-adoption`; `/catalog/api-gateway` → Application notes | governed `route`: understand fit → get terraform → wire/validate |
| Where is it available? | MCP `atlas_get_availability`, Portal `/availability` | per-region availability |

## Run it locally

```bash
pnpm --filter @atlas/portal dev      # http://localhost:3000

curl "http://localhost:3000/api/topics?query=api%20gateway"
curl "http://localhost:3000/api/topics/api-gateway/context?disclosure_level=2"
curl -X POST http://localhost:3000/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"atlas_get_context_bundle","arguments":{"query":"api gateway terraform"}}}'
```

In the Portal, open each service datasheet (`/catalog/api-gateway`, `/catalog/aws-s3`,
`/catalog/aws-textract`) — each shows the cited Terraform starter, a **User guide** link,
and the linked adoption guide — and the matching route under `/guidance`.

## CI gate

`packages/atlas-acceptance` asserts the journey end-to-end for **all three hero
services**: the service resolves, the Portal datasheet renders, the authoritative
terraform-module Source carries a cited starter snippet, a free-text terraform query
returns that service's module (and **not** an unrelated one), the datasheet exposes a
**User guide** link, and the adoption route exists and is wired to the topic. `pnpm test`
fails if any step regresses.

## Boundary (explicit)

"Write the specific Terraform for me" — bespoke generation from a natural-language app
description — is **out of scope** for this gate. Atlas returns the cited module + starter;
the consuming agent composes the final Terraform by filling in module inputs. Generative
IaC is a separate, later layer (it would extend the `ATLAS_ASK_LLM` synthesis path) and is
not part of the MVP done bar.
```
