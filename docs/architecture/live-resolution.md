# Live source resolution (Confluence + Terraform)

Atlas resolves a registered Anchor into a cited Excerpt at request time. By
default this is **offline**: the pilot content provider returns fictional,
public-safe text. Set the environment variables below to resolve against a
**real** Confluence site and Terraform module host instead. Offline stays the
default — live activates only when the relevant variables are present, so no key
is needed for local/dogfood runs.

Nothing is persisted. Excerpts are fetched per request and thrown away; the
caller's identity (for Confluence) governs what comes back.

## Environment variables

### Confluence (Cloud)

| Variable | Purpose |
| --- | --- |
| `ATLAS_CONFLUENCE_BASE_URL` | Site base, e.g. `https://your-org.atlassian.net` |
| `ATLAS_CONFLUENCE_EMAIL` | Atlassian account email. **When set, auth is Basic** (`email:token`) — required for a **personal API token**. |
| `ATLAS_CONFLUENCE_TOKEN` | The token. Personal API token (with email → Basic) or an OAuth/PAT bearer (no email → Bearer). |

A per-request `Authorization: Bearer <token>` header on the API call is also
threaded through as the caller identity and takes precedence over
`ATLAS_CONFLUENCE_TOKEN`, so Confluence's own ACL governs the result.

A Confluence Source's `location` must be the **page id** (not a display URL);
the anchor `selector.locator` must be the target heading slug (lower-kebab of the
heading text). Server / Data Center is not covered yet (TODO behind the same seam).

### Terraform module (GitHub)

| Variable | Purpose |
| --- | --- |
| `ATLAS_TERRAFORM_TOKEN` | Service token (e.g. a GitHub PAT). Its presence enables live resolution. |
| `ATLAS_TERRAFORM_BASE_URL` | API base; defaults to `https://api.github.com` (override for GitHub Enterprise). |

As with Confluence, a per-request `Authorization: Bearer <token>` takes
precedence over `ATLAS_TERRAFORM_TOKEN`, so the module README is fetched under
the caller's own TFE/Terraform identity when one is supplied.

A Terraform Source's `location` must be the module repo, e.g.
`github.com/example/terraform-aws-s3`; the anchor `selector.locator` is the README
heading slug prefixed with `#`, e.g. `#terraform-starter`. Private Terraform
Cloud / Enterprise registries are a future adapter behind the same seam (TODO).

## Run a real test

1. Register a Source whose `location` is a real page id / repo, with an anchor
   whose locator matches a real heading (add it to `data/*.yaml`, or point at an
   existing real page/repo).
2. Export the variables for the integration you are testing, then start the app:

   ```bash
   export ATLAS_CONFLUENCE_BASE_URL="https://your-org.atlassian.net"
   export ATLAS_CONFLUENCE_EMAIL="you@your-org.com"
   export ATLAS_CONFLUENCE_TOKEN="<your-personal-api-token>"
   export ATLAS_TERRAFORM_TOKEN="<your-github-pat>"
   pnpm --filter @atlas/portal dev
   ```

3. Fetch the bundle and confirm the excerpt came from the live source (its
   `citation.location` points at the real page/README):

   ```bash
   curl "http://localhost:3000/api/topics/<topic-id>/context?disclosure_level=2"
   ```

   A `restricted_source` warning means the identity was denied (Confluence ACL or
   GitHub auth); `source_unavailable` means the page/repo was not found at request
   time; `broken_anchor` means the heading could not be located in the live source.

> Do not commit tokens. Export them in your shell (or a local, git-ignored env
> file); Atlas reads them from the environment and never persists them.
