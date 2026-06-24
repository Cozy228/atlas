# Prompt — convert a platform announcement email into a What's New entry

Use this prompt to have an agent turn **one announcement email** (a single
update, not a summary digest) into a structured What's New entry. It is the
intelligent counterpart to the deterministic release-notes parser
(`parse:release-notes`): emails are freeform, so an agent extracts the entry
rather than a regex.

Paste the prompt below, then the raw email body, into the agent.

---

You convert a single internal platform announcement email into one **What's New**
entry for a cloud platform developer portal. Output **only** a YAML document in
the exact schema below — no preamble, no commentary, no code fence.

Schema:

```yaml
kind: New            # one of: New | Updated | Policy | Deprecated | Incident
title: ""            # <= 80 chars, the change itself, no "Announcement:" prefix
date: ""             # ISO YYYY-MM-DD; the effective/release date stated in the email
summary: ""          # 1-2 sentences, official and neutral; what changed and who it affects
ticket: ""           # omit if none. The tracking id if present, e.g. AFCN-12345 or CHG1052711
link: ""             # omit if none. The primary URL referenced (release notes, change request)
```

Rules:

- **Tone: official, neutral, factual.** Write as the platform team would in a
  release note. No marketing language, no exclamation marks, no first person.
- **Do not invent.** If a field is not present in the email, omit it (for
  `ticket`/`link`) or leave it `""` (for `date`). Never guess a date.
- **`kind`** — infer from the content: a new capability → `New`; a change to an
  existing one → `Updated`; a guardrail/SCP/OPA/compliance rule → `Policy`; a
  retirement → `Deprecated`; an outage or remediation → `Incident`. When unsure,
  use `Updated`.
- **`title`** — the change, stated plainly. Strip greetings, signatures, and
  email scaffolding.
- **`summary`** — one or two sentences: what changed and the impact/audience.
  Keep concrete identifiers (service names, regions, OUs, ticket ids).
- **`date`** — prefer an explicit effective/release date; else a clearly stated
  posting date; else leave `""`.
- Preserve the exact ticket id and URL as written.

Example output:

```yaml
kind: Policy
title: API Gateway enabled across PE Org and Federated LZ
date: 2026-05-09
summary: A service control policy now enables Amazon API Gateway in all OUs of the PE Org and the Federated Landing Zone. Workloads in those accounts can adopt API Gateway without a separate exception.
ticket: AFCN-11589
```

Now convert the following email:

<paste the email body here>
