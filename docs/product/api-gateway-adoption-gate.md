# Hard gate — API Gateway adoption journey

The MVP "done" bar for the consumer surface is a single end-to-end journey that a
consuming application (or its coding agent) can complete against the **local product
only**, without reading Atlas source. Atlas stays a *grounded* context layer: every
answer is a registered, cited Source excerpt. It points to the authoritative Terraform
module and hands back a cited starter snippet — it never synthesizes bespoke Terraform.

## The journey (and where each step is answered)

| Adopter question | Surface | What comes back |
| --- | --- | --- |
| Is there an API Gateway service? | `GET /api/topics?query=api%20gateway`, MCP `atlas_search_service` | the `api-gateway` topic |
| How is it designed / how does it fit my app? | `GET /api/topics/api-gateway/context`, MCP `atlas_get_context_bundle` | cited excerpts from the module + integration guide |
| Give me the Terraform | the same bundle | authoritative `apigateway-module-readme`, leading with a cited `#terraform-starter` HCL snippet |
| What's the adoption guide? | Portal `/guidance/api-gateway-adoption`; `/catalog/api-gateway` → Application notes | governed `route`: understand fit → get terraform → wire backend → validate |
| Where is it available? | MCP `atlas_get_availability`, Portal `/availability` | per-region availability |

## Run it locally

```bash
pnpm --filter @atlas/portal dev      # http://localhost:3000

curl "http://localhost:3000/api/topics?query=api%20gateway"
curl "http://localhost:3000/api/topics/api-gateway/context?disclosure_level=2"
curl -X POST http://localhost:3000/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"atlas_get_context_bundle","arguments":{"query":"api gateway terraform"}}}'
```

In the Portal, open `/catalog/api-gateway` (datasheet + cited Terraform starter + the
linked adoption guide) and `/guidance/api-gateway-adoption` (the governed route).

## CI gate

`packages/atlas-acceptance` asserts the journey end-to-end: the service resolves, the
Portal datasheet renders, the authoritative module leads with the cited starter snippet,
a free-text `api gateway terraform` query returns the API Gateway module (and **not**
Textract), and the adoption route exists and is wired to the topic. `pnpm test` fails if
any step regresses.

## Boundary (explicit)

"Write the specific Terraform for me" — bespoke generation from a natural-language app
description — is **out of scope** for this gate. Atlas returns the cited module + starter;
the consuming agent composes the final Terraform by filling in module inputs. Generative
IaC is a separate, later layer (it would extend the `ATLAS_ASK_LLM` synthesis path) and is
not part of the MVP done bar.
