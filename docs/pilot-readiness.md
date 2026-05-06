# Atlas V1 Pilot Readiness

## Acceptance Scope

Atlas V1 is pilot scope. It proves the full product loop for registered cloud platform knowledge:

1. Source Registry
2. Authority Mapping
3. Locator Resolution
4. Context Bundle API
5. Portal Presentation
6. Ask Atlas cited answer

## Automated Acceptance

Run:

```sh
pnpm --filter @atlas/acceptance test
```

Covered scenarios:

- Capability Discovery: `aws-textract`
- Landing Zone Navigation: `central-landing-zone`
- Ask Atlas cited answer for private subnet Textract usage
- Visible warning states for restricted, broken, and missing evidence

## Manual Pilot Checklist

- Confirm capability cards show source steward, authority level, source link, and expansion paths.
- Confirm landing zone pages show guardrail excerpts from registered sources.
- Confirm restricted sources are visible as restricted, not silently hidden.
- Confirm broken anchors show a warning and do not fail the entire context response.
- Confirm Ask Atlas strips or rejects uncited claims before display.
- Confirm missing topics show that no registered authoritative source was found.

## Known Limitations

- Pilot data is seed-driven; there is no admin UI in V1.
- Source content is represented by local request-time source providers for pilot validation.
- Portal rendering is covered by HTML rendering tests, not browser end-to-end tests.
- Infrastructure is represented as a typed deployable plan; cloud deployment is not executed in this repo.
- Ask Atlas uses an adapter contract in tests; no model provider credentials are committed.

## Post-V1 Backlog

- Add real source-system clients for Terraform repositories, Confluence, and policy document storage.
- Add organizational authentication and access propagation.
- Add production deployment pipelines around the infra plan.
- Add browser interaction tests once Portal routes are wired to deployed runtime endpoints.
