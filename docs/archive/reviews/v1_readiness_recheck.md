# Atlas V1 Readiness Re-Check

## Current Judgment

Atlas is now close to a V1 pilot loop, but it is not yet AWS-deployable V1.

The previous hard review is partially stale. Several earlier code-fixable blockers have been fixed: Portal is now a real TanStack Start app, feedback uses the shared contract, Ask Atlas validates citations server-side, Portal has a production start path, and the seed file line-limit violation has been removed.

The runtime code boundaries that were missing in the previous re-check have now been added. The remaining blockers are deployment wiring and AWS verification:

- Publish the Portal Lambda container image and Context API zip artifact.
- Wire API Gateway HTTP API routes to the Portal and Context API Lambda targets.
- Create the DynamoDB feedback table and IAM policy.
- Configure Bedrock or RAI credentials in the Portal runtime.
- Run deployed smoke tests against AWS endpoints.

## Fixed Since The Previous Review

| Area | Current status | Evidence |
|---|---|---|
| Portal runtime | Fixed | TanStack Start routes exist under `portal/src/routes`; production `build` emits Nitro `.output/server/index.mjs`; `start` can serve the built Portal. |
| Portal container package | Fixed | `portal/Dockerfile` builds a Lambda Web Adapter image from the Nitro output. |
| Feedback contract | Fixed | Shared `FeedbackSubmissionSchema` and `FeedbackResponseSchema` exist; Portal feedback submits `target_type`, `target_id`, `feedback_type`, and `message`. |
| Feedback route shape | Fixed in code | `context-layer/src/api/feedbackRoute.ts` validates the shared contract, checks target existence, and writes through the configured feedback repository. |
| Ask Atlas grounding | Fixed for pilot | Portal server-side Ask Atlas obtains a context bundle and strips uncited claims before display. |
| Portal first-consumer boundary | Improved | Browser code calls TanStack server functions; server code owns Context API and LLM boundaries. |
| File size constraint | Fixed | `context-layer/src/seeds/pilotRegistry.ts` is under 500 lines after splitting feedback seed data. |
| Context API Lambda boundary | Fixed in code | `context-layer/src/lambda/handler.ts` maps API Gateway HTTP API events through `handleHttpRequest`. |
| Portal fetch Context API client | Fixed in code | `portal/src/api/server/httpContextApiClient.ts` is selected when `ATLAS_CONTEXT_API_BASE_URL` is configured. |
| Feedback persistence | Fixed in code | `DynamoFeedbackRepository` persists feedback when `ATLAS_FEEDBACK_TABLE` is configured; local/test remain in-memory. |
| Bedrock and RAI providers | Fixed in code | `portal/src/api/server/llmProvider.ts` selects Bedrock, RAI OpenAI-compatible, or simulated local mode. |

## Remaining V1 Blockers

### 1. Infrastructure Wiring

The infra package still expresses architecture as a typed plan. V1 deployment needs concrete artifacts and wiring:

- Portal Lambda container image.
- Context API zip Lambda artifact.
- API Gateway HTTP API routes for Portal and `/api/*`.
- DynamoDB table and IAM policy for feedback persistence.
- Bedrock invoke permissions for the Portal Lambda.
- Runtime environment variables for `ATLAS_CONTEXT_API_BASE_URL`, `ATLAS_FEEDBACK_TABLE`, and the selected LLM provider.

### 2. Deployed Runtime Verification

The local code path is covered, but AWS still needs deployed verification:

- Context API Lambda returns valid JSON for `/topics`, `/sources`, `/context-bundle`, and `/feedback`.
- Portal Lambda can call the deployed Context API over HTTP.
- Feedback records are written to DynamoDB with the documented key shape.
- Ask Atlas can invoke Bedrock or RAI without leaking credentials to browser bundles.

## Non-Blockers For V1 Pilot

Real source-system fetchers are no longer treated as V1 blockers for this pilot.

The V1 pilot may continue using the local request-time source content provider as a demo provider, as long as docs and UI do not claim that real Terraform, Confluence, or policy systems are being fetched in production. Real Git, Confluence, and policy document fetchers remain post-V1 work.

## Updated Readiness Summary

| Capability | Status | V1 action |
|---|---|---|
| Shared schema contract | Ready | Keep contract-first tests. |
| TanStack Start Portal | Ready for pilot | Configure `ATLAS_CONTEXT_API_BASE_URL` in deployed runtime. |
| Portal container image | Ready for pilot | Wire to AWS Lambda container deployment. |
| Ask Atlas citation validation | Ready for pilot | Configure Bedrock or RAI in AWS runtime. |
| Feedback API contract | Ready for pilot | Create DynamoDB table and IAM policy. |
| Context API HTTP surface | Ready in code | Package and wire Context API Lambda. |
| DynamoDB persistence | Ready in code | Create table from documented key design. |
| Real source fetchers | Post-V1 | Document as limitation, not blocker. |
| Cloud deployment | Incomplete | Add artifact packaging and route wiring. |

## Recommended Next Batch

1. Add infra resources for the Context API Lambda zip artifact, HTTP API routes, DynamoDB feedback table, and IAM.
2. Add CI packaging steps for the Portal container image and Context API `tsdown` artifact.
3. Run AWS deployed smoke tests for Context API, Portal-to-Context API, feedback persistence, and the selected LLM provider.
