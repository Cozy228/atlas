# Source-class division for module docs, and where the seeded authority conflict lives

Status: accepted
Date: 2026-06-20

## Context

The hero slice governs three Services (S3, API Gateway, Textract) in the Federated Landing
Zone. Two open contracts (MVP-design §13 #3, #5) met here:

- **What a Terraform module Source actually serves.** Today `terraformModuleResolver` is
  offline; the pilot models a single module README with prose anchors
  (`textract-module-readme#private-subnet-usage`).
- **Where the one seeded authority conflict lives.** [ADR-0006](./0006-governed-honesty-model.md)
  requires one real conflict in the hero slice to prove "surface both, pick no side." The
  pilot implied it sat on S3 policy (current vs legacy).

Two realizations reshaped both:

1. A module's **registry metadata** (inputs/outputs/version/provider) and its **README
   prose** ("how to use it in a private subnet") are *different kinds of content* — and a
   platform team's **Confluence runbook** is a *third*, with a different owner and
   authority. Collapsing them loses provenance.
2. **A guardrail is single-truth and can only go stale, never conflict** (see
   [ADR-0006](./0006-governed-honesty-model.md) / CONTEXT). "Current vs legacy policy" is
   *supersession* (the legacy record is stale/deprecated), not a live conflict. A genuine
   authority conflict needs **two currently-valid sources with different owners**
   disagreeing on the same scope.

## Decision

**A Terraform module is two anchor kinds in one Source; Confluence is a separate Source;
the seeded conflict is two current, different-owner sources on one scope.**

1. **`terraform-module` Source reads both:**
   - **registry metadata** via a new **`module-field`** anchor kind (inputs/outputs/version),
     also feeding freshness/drift; and
   - **README prose** via the existing `markdown-heading` anchor (e.g. `private-subnet-usage`).
2. **Confluence is a distinct Source** for platform-team-authored runbooks
   (`confluence-section`). It is *not* forced to host module how-to prose; module READMEs
   keep their own.
3. **The seeded authority conflict** is **Textract private-subnet configuration**: the
   module README (module owner, current) and a platform Confluence runbook (platform team,
   current) give conflicting guidance on the same scope. Atlas surfaces both, flags the
   conflict, picks no side. The former `legacy-s3-policy` becomes a **stale/deprecated
   demo** (it proves supersession/review-decay), not a conflict.
4. **Guardrails carry no conflict.** They project a single policy-document Source; severity
   is a governance attribute on the source↔topic mapping (CONTEXT). Their only honesty
   signal is `stale_source`.

## Considered and rejected

- **Module = registry metadata only** (prose moved to Confluence): clean on paper, but
  erases the module owner's own how-to authority and breaks the existing
  `private-subnet-usage` citation. Rejected — README and runbook are different things, both
  worth reading.
- **Module README as a second, separate Source** (split metadata and README into two
  Sources): more source records to govern for one module, no provenance gain over two
  anchor kinds on one Source.
- **Conflict on S3 current-vs-legacy policy**: not a conflict — legacy is superseded
  (stale), single truth remains. Rejected per the guardrail single-truth rule.
- **No conflict in MVP**: loses the §3 "surface both" moat proof, the headline
  differentiator vs wiki/Backstage/Glean.

## Consequences

- New `module-field` anchor kind in `@atlas/schema`; `terraformModuleResolver` gains a
  registry-metadata path plus README prose; both public-safe / env-configured.
- The conflict pair moves to Textract (module README ⟷ Confluence runbook); `legacy-s3-policy`
  is relabeled a stale/deprecated example.
- `source-topic` mapping schema gains an optional `severity` (guardrail projection).
- TFE run/workspace **status** stays deferred (Dashboard secondary, §9) — out of this ADR.
