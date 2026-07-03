# Task: Analyze Project Direction From Context Pack

You are a senior product-system strategist and technical design partner.

I will provide you with a Project Context Pack. Treat it as the primary factual source for the current
project state. Your task is not to repeat the pack, and not to assume the current direction is correct.
Your task is to help examine whether **Atlas** has a better path across product, architecture,
implementation, data flow, user experience, output quality, performance, maintainability, and long-term
evolution — with two lenses in mind: **optimize the existing design** (near-term) and **optimize the
mid-to-long-term product direction**.

> **How this fits the handoff.** This prompt is the **opening move** — it produces a one-shot
> *Direction Analysis* (explore the option space; do NOT converge). After I pick a direction from it,
> the ongoing work is governed by `FABLE-DESIGN-BRIEF.md` (design step → unified architecture). Read the
> brief too, but your deliverable *now* is the Direction Analysis below.

## Inputs & Grounding

- **Primary factual source: `PROJECT-CONTEXT-PACK.md`** (repo root). Ground every project claim in it and
  cite the section. Notable anchors:
  - **§9 (Positions Taken)** — the owner's most recent positions (2026-07-02). See the stance rule below.
  - **§6** — flagged code↔doc conflicts and open questions (newer-doc-wins rule applies).
  - **§7 + `docs/architecture/current-design-optimization-directions.md`** — future directions and
    optimization directions *already on the table* (governed-context seam under-use, durable-curation
    store, discovery cold-start, status ingest-vs-reference, doc drift, source-lifecycle automation,
    ADR-0012 APP-scope, agent-discovery redesign, API-gateway adoption gate, multi-LZ expansion). Use as
    raw material; do NOT treat as decided.
- **North star:** `docs/product/guideline.md` (information-centric, consolidate portals, cross-environment
  discoverability, Platform-as-a-Product). Domain language: `CONTEXT.md`. Authoritative product design:
  `docs/product/mvp-product-design.md`. Load-bearing ADRs: 0002 / 0003 / 0006 / 0013 / 0015 / 0017.
- Current goal: identify stronger product and system directions, especially around **high-level design
  and mid-level design**.
- Constraint: distinguish clearly between **facts** from the Context Pack, your **inferences**, and your
  **recommendations**.

## Stance on §9 (the owner's recent positions)

Treat §9 as **strong priors, not binding truth** — you may challenge any of them if the evidence supports
a better path, and this prompt explicitly invites that. **Three exceptions are firm** (do not relitigate;
design around them): **P1** — Atlas is ONE product whose invariant is *governed context at point-of-action*,
一体两面 (human Portal + agent API/MCP off the same governed data); **P2** — Atlas NEVER
provisions/deploys/triggers CICD (read-only context before an action); **P3** — the phase-now wedge is the
Human-first portal (external top-down mandate + guideline). Everything else in §9 (P4 status mechanism,
P5 moat framing, P6 multicloud sequencing) is challengeable prior.

## Project-specific guardrails (in addition to the Strict Rules)

- **Governed-honesty moat:** never present ungoverned/derived content as governed Evidence. Keep the
  ADR-0003 split explicit — **Evidence** (cited, via the Context API, carries provenance + freshness) vs
  **operational status** (live, uncited, a pointer to act elsewhere). Do not blur them. Every "Live/fresh/
  synced" claim must be wired to real data (PRODUCT.md design principle 5).
- **Platform vocabulary is sacred** (`CONTEXT.md`): *service / landing zone / anchor / authority level /
  guardrail / availability / resource `{kind}/{slug}`* are domain language — do not genericize or invent
  parallel terms.
- **Intended vs interim honesty:** the pack tags which components are intended design vs interim/scaffold
  (MSW mocks, in-memory feedback, single-LZ live, in-process seam). Never reason from an interim
  implementation as if it were the essential design.
- **Reply to the owner in Chinese; write all docs/code in English.**

## What I Want From You

Analyze the project from first principles, using the Context Pack as grounding.

Focus on these questions:

1. What is Atlas really trying to become?
2. Is the current product framing ("governed multicloud PE-context layer, human-first now") the strongest
   one, or are there alternative framings worth considering?
3. Are the current system boundaries (Portal ↔ Context API ↔ source systems) aligned with the direction?
4. Are there simpler, deeper, or more durable architectural shapes available?
5. Are there current implementation details accidentally steering the product direction (e.g. the
   in-process seam bypassing cache+Bearer; discovery running live per-boot; no durable curation store)?
6. Are there hidden constraints, assumptions, or historical decisions that may no longer apply?
7. Are there data/user/control flows that suggest a better abstraction or product model?
8. Which future/optimization directions already in the pack deserve sharper high-level or mid-level design?
9. What questions must be answered before a serious design decision?
10. What are the strongest 2-4 candidate paths forward, and what would each optimize for?

## Strict Rules

- Do not treat the current implementation as the correct design by default.
- Do not treat ADRs or historical decisions as binding truth (except the firm §9 exceptions P1/P2/P3).
- Do not invent project facts that are not in the Context Pack.
- If you infer something, mark it clearly as an inference.
- If the pack is missing a critical fact, mark it an open question instead of filling the gap.
- Do not produce a generic architecture review.
- Do not optimize only for code structure or performance. Consider product shape, user value, workflow,
  data model, output quality, operational complexity, and long-term direction.
- Do not immediately converge on one answer. Explore the option space first.

## Output Structure

# Direction Analysis

## 1. Current Project Reading
In your own words, grounded in the pack: what the product appears to be, what problem it solves, what the
system shape enables, what the current implementation may be biasing. Short.

## 2. Key Tensions
The main product / system / data / workflow / implementation tensions. For each: what it is, where it
comes from, why it matters, whether it is factual / inferred / unresolved.

## 3. Assumptions To Challenge
For each: the assumption, evidence from the pack, why it may deserve re-evaluation, what would confirm or
reject it.

## 4. Candidate Paths Forward
2-4 distinct paths. For each: name, core idea, what it optimizes for, what it gives up, product
implications, system/design implications, implementation implications, risks/unknowns, and what would
need to be true for it to be right. Do not rank unless evidence strongly supports it.

## 5. High-Level Design Questions
Product model, system shape, module boundaries, ownership, user workflow, data lifecycle, extensibility.

## 6. Mid-Level Design Questions
APIs, data structures, persistence, execution model, state ownership, integration boundaries, output
contracts, migration strategy, observability/validation.

## 7. Missing Information
Separate: missing product facts / technical facts / user-workflow facts / historical-or-constraint facts.

## 8. Recommended Discussion Agenda
A focused agenda for the next discussion that converges on direction without jumping into implementation.

## 9. Your Current Best Read
Only after exploring the option space: which path seems most promising and why, what could change your
mind, what decision should NOT be made yet. Be explicit about uncertainty.

## Style Requirements

- Be direct and specific. Use concrete tradeoffs, not vague statements.
- Avoid generic best practices unless tied to this project.
- Separate facts, inferences, and recommendations.
- Prefer structured bullets over long essays.
- Do not write code unless I explicitly ask for implementation details.
