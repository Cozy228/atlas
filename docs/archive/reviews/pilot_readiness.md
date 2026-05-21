# Atlas V1 Pilot Readiness

## Acceptance Scope

Atlas V1 is pilot scope. It proves the full product loop for registered cloud platform knowledge:

1. Source Registry
2. Authority Mapping
3. Locator Resolution
4. Context Bundle API
5. Portal Presentation
6. Ask Atlas cited answer
7. Feedback capture and persistence

## Automated Acceptance

Run:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @atlas/portal build
pnpm --filter @atlas/context-layer build:lambda
```

Covered scenarios today:

- Capability Discovery: `aws-textract`
- Landing Zone Navigation: `central-landing-zone`
- Ask Atlas cited answer for private subnet Textract usage
- Visible warning states for restricted, broken, and missing evidence
- Shared feedback request/response contract
- Context API HTTP adapter and Lambda handler
- Fetch-based Portal Context API client with local in-process fallback
- DynamoDB feedback repository selected by `ATLAS_FEEDBACK_TABLE`
- Ask Atlas provider selection for Bedrock, RAI, and local simulated mode

Required before AWS pilot:

- Build and publish the Portal Lambda container image.
- Build and publish the Context API zip Lambda artifact from `context-layer/dist/lambda/handler.mjs`.
- Wire API Gateway HTTP API routes to Portal and Context API Lambda targets.
- Create the DynamoDB feedback table and grant Context API write/query permissions.
- Grant Portal runtime Bedrock invoke permissions and configure either Bedrock or RAI credentials.

## Manual Pilot Checklist

- Confirm capability cards show source steward, authority level, source link, and expansion paths.
- Confirm landing zone pages show guardrail excerpts from registered sources.
- Confirm restricted sources are visible as restricted, not silently hidden.
- Confirm broken anchors show a warning and do not fail the entire context response.
- Confirm Ask Atlas strips or rejects uncited claims before display.
- Confirm missing topics show that no registered authoritative source was found.
- Confirm feedback submitted from Portal is persisted in DynamoDB.
- Confirm deployed Portal does not include source-system, DynamoDB, Bedrock, or RAI credentials in browser bundles.

## Known Limitations

- Pilot data is seed-driven; there is no admin UI in V1.
- Real Terraform, Confluence, and policy document fetchers are post-V1. The pilot uses registered metadata plus a local request-time demo source content provider.
- Infrastructure is still being wired from typed plan to deployable AWS artifacts and IAM policies.
- Ask Atlas uses server-side provider credentials only; no model provider credentials are committed.

## Post-V1 Backlog

- Add real source-system clients for Terraform repositories, Confluence, and policy document storage.
- Add organizational authentication and access propagation.
- Add browser interaction tests against deployed runtime endpoints.
- Add source-owner workflows for reviewing missing, stale, broken, and unclear feedback.
