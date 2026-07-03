# Developer Pain Points: Two DORA Reports + 2026 Field Data

**Date**: 2026-07-03
**Purpose**: Mine real developer pain points and identify the problems enterprises most need solved. No product positioning is presupposed.
**Method**:
1. Full read of both DORA reports — *DORA 2025 State of AI-assisted Software Development* (142 pages, ~5,000 practitioners surveyed, Oct 2025) and *DORA: The ROI of AI-assisted Software Development* (60 pages, Jan 2026). Source PDFs and extracted text are archived alongside this report (`dora-2025.pdf/.txt`, `dora-roi-2026.pdf/.txt`).
2. Four web-research passes (executed by Claude Sonnet subagents, synthesized into this document): ① 2025–2026 token-cost pain landscape (59 findings); ② enterprise AI-development pains across six threads (56 findings); ③ primary-source verification of the 10 weakest-evidence claims; ④ previously-missed surfaces (first-hand Reddit sentiment, AGENTS.md maintenance burden, agent non-determinism in CI).
3. Every number carries an evidence tier: **[SURVEY]** = structured questionnaire/study, **[TELEMETRY]** = vendor platform data (directionally useful, self-interested), **[ANECDOTE]** = single source. Where verification corrected a figure, the corrected figure is used.

---

## 1. One-sentence conclusion

**Writing code is no longer the bottleneck. What hurts enterprises most now is the downstream capacity to absorb AI-speed output — verification, context, stability, cost, and trust have all failed to keep up.** DORA names the phenomenon "localized pockets of productivity lost to downstream chaos," and offers a unifying explanation: **AI is a mirror and an amplifier, not a fixer** — it magnifies the strengths of high-performing organizations and the dysfunctions of struggling ones.

---

## 2. The six pain points enterprises most need solved (ranked)

### Pain #1: The Verification Tax — review is the new bottleneck, and it is getting worse

**Named by both DORA reports and repeatedly confirmed by independent 2026 telemetry.**

The DORA ROI report (p. 40) states it flatly: "**The most immediate barrier to ROI is the verification tax**" — the time developers spend reviewing AI outputs. The causal chain: low trust → every line second-guessed → the J-Curve dips deeper → the capacity that should have been freed gets consumed. The same report (p. 36, citing the Stanford AI Index) notes that raw inference costs fell **280x** between Nov 2022 and Oct 2024: "because the cost of querying models is approaching zero, the true financial burden of adoption has shifted to governance cost: managing the verification tax, adjusting workflows, and upskilling talent."

Field data (2026):
- Developers using AI complete 21% more tasks and merge 98% more PRs, but **PR size is up 154% and review time up 91%** (DX Q1 2026 impact report + Faros AI "Acceleration Whiplash," 22,000 developers / 4,000+ teams over two years of telemetry — the two vendors report identical figures, likely the same underlying dataset family; treat as one strong signal). [TELEMETRY]
- Faros: commit-to-production lead time **+480%**; **no measurable org-level DORA metric improvement**. [TELEMETRY]
- LinearB 2026 benchmarks (8.1M PRs, 4,800 orgs): agentic-AI PRs wait **5.3x longer** for review pickup than unassisted PRs (1,055 vs. 201 minutes at p75). [TELEMETRY]
- CircleCI 2026: feature-branch throughput +59% YoY while median main-branch throughput **fell** — the bottleneck moved from writing to merge-readiness. [TELEMETRY]
- Sonar State of Code 2026 (1,100+ devs): 38% say reviewing AI code takes more effort than reviewing a colleague's code; 95% spend effort reviewing/testing/correcting AI output. [SURVEY]
- The recurring framing: "A developer with AI tools can produce 5–6 PRs a day; a reviewer can still only handle the same number they always could." [ANECDOTE, widely repeated]

DORA's three official mitigations for the verification tax (ROI p. 33): invest in automated testing, use AI to assist code review, and **provide better context to the AI to improve initial code quality** — note the third item: it draws a causal arrow from Pain #2 to Pain #1.

### Pain #2: AI lacks organizational context — DORA's strongest empirically-confirmed amplifier gap, and its official "first investment"

The DORA 2025 AI Capabilities Model screened 15 candidate capabilities down to 7 that demonstrably amplify AI's benefits. **Two of the seven are data/context capabilities**:
- **AI-accessible internal data**: when present, AI's positive effect on individual effectiveness and code quality is significantly amplified. The report's own words: "if AI can't access internal company data, how useful can it really be?" (p. 55)
- **Healthy data ecosystems** (internal data that is high-quality, accessible, and unified): when present, AI's effect on organizational performance is amplified. (p. 54)

The ROI report (Jan 2026) promotes this to the **top of the investment roadmap** (pp. 43–44):
- Step 1, "**Build the context layer**" (CapEx): quality internal developer platform + healthy data ecosystem — "centralizing architectural standards and ensuring documentation is high fidelity and **machine readable**," with the goal of giving agents "a clear, standardized map of the organization's technical landscape." Direct quote: "In an agentic world, garbage in, garbage out refers to the context provided to the agent."
- Step 2, "Empower the human in the loop" (OpEx): two named capabilities — **trust in AI and context engineering**. Developers become "high-level orchestrators, providing agents with precise business context and maintaining rigorous oversight."
- The internal developer platform is redefined as "the **risk mitigator and the context provider** for AI agents" (p. 40): with a well-defined platform, agents "spend less time hallucinating architectural patterns."

Qualitative evidence (DORA 2025, p. 85): AI suggestions "frequently miss critical context, such as team conventions, architectural history, or past incidents," because that information is "buried in disparate systems and informal knowledge channels"; documentation rot means an agent can end up consuming "automated folklore."

Field and academic data (2026):
- **Positive**: arXiv:2601.20404 (Jan 2026; controlled experiment, 10 repos / 124 PRs): with an AGENTS.md present, median agent runtime **−28.64%** and output tokens **−16.58%**. [ACADEMIC, verified against primary source]
- **Negative (important nuance)**: arXiv:2602.11988 "AGENTbench" (ETH Zurich-affiliated, Feb 2026; 138 real-world Python tasks): **LLM-generated** AGENTS.md files *reduced* task success in 5 of 8 settings (−0.5 to −2 pp), added 2.45–3.92 extra steps per task, and raised inference cost 20–23% — because generated files merely duplicated what the agent could discover itself. **Human-written** context files improved success by ~4 points. [ACADEMIC] ⇒ Context earns its keep through *information gain*, not through a file's mere existence.
- Maintenance burden is a real pain but has no independent survey quantifying it yet: context files drift as codebases evolve; copies across CLAUDE.md / AGENTS.md / .cursorrules fall out of sync; "no automated way to detect staleness" (multiple independent practitioner guides converge). Community complaint: models effectively ignore CLAUDE.md content past ~200 lines. Claude Code's own repo has issue #34776 (Mar 2026, closed not-planned) documenting five failure modes of long-lived auto-memory: entries crowded out, contradictory corrections accumulating, no expiry, no priority tiers, no audit mechanism. [ANECDOTE / first-party issue]
- Stanford software-engineering productivity research (cited by DORA ROI p. 36): AI yields **35–40%** productivity gains on simple greenfield tasks but often **≤10%** on complex legacy brownfield code — which is precisely what most enterprise code is. Generic models help least on *your* old systems.

### Pain #3: Delivery instability — two consecutive years of "more AI, less stable"

DORA's most stubborn negative finding, two years running:
- 2024: for every 25% increase in AI adoption, delivery throughput −1.5%, delivery instability +7.2%.
- 2025: throughput flipped positive (adaptation happened), **but instability still rises with AI adoption**, with the second-largest effect size of all outcomes studied (after individual effectiveness).
- DORA explicitly tested the defense "isn't instability an acceptable price for speed?" — **no**. Instability's harm to product performance and burnout is *not* moderated by AI adoption; it eats the throughput gains. (2025, p. 41)
- The ROI report's own sample calculator models change-failure rate going **up** from 5% to 6% under AI, booking an "instability tax" of **−$344k/year**.

Field data: Faros 2026 — bugs per developer **+54%** (vs. +9% a year earlier), production incidents per PR **tripled**, post-commit churn **+10x**. GitClear (211M lines): duplicated code blocks up **8x** in 2024; "moved" (refactored/reused) code fell below 10% share (−44% YoY); two-week churn rose from 3.1% (2020) to 5.7–7.9% (2024). [TELEMETRY]

DORA's conclusion: testing, deployment pipelines, rollback proficiency, and small batches are not obsolete in the AI era — they are **more existential than ever**. Strong version control (especially rollback fluency) and working in small batches are both in the seven-capability model, and small batches are one of the few capabilities that flip AI's neutral effect on friction into a *reduction*.

### Pain #4: Token cost overrun and unpredictability — the CFO-level pain that exploded in 2026, with no authoritative framework

The DORA reports are nearly blind here (the ROI calculator assumes **$80/user/year** of additional AI/API cost), while H1-2026 reality:
- Gartner (press release, Jun 24, 2026): nearly **1 in 4** tech leaders already spends **$200–500/developer/month** on AI coding; ~6% exceed $2,000. Prediction: **AI coding costs will surpass the average developer's salary by 2028**. Gartner also faults vendors for "lack[ing] transparency into how token consumption is calculated and billed." [SURVEY]
- Jellyfish telemetry: heavy-usage developers show ~2x productivity but ~10x token consumption; **per-developer token consumption grew 18.6x in nine months**. [TELEMETRY]
- Enterprise cases: Uber provisioned 5,000 engineers with Claude Code in Dec 2025 and **exhausted its full-year AI budget in four months** ($150–2,000/engineer/month); Microsoft cancelled most internal Claude Code licenses mid-2026, redirecting to Copilot CLI; Priceline disclosed a 4–5x jump in Cursor renewal cost. [NEWS — TechCrunch, Jun 2026]
- FinOps Foundation 2026: **98%** of organizations now actively manage AI spend (31% two years prior); "managing token costs" is practitioners' **#1 challenge**; AI budgets routinely overrun forecasts **2–3x**. [SURVEY]
- Goldman Sachs, *Decoding the Agentic Economy* (May 2026): global token consumption projected to grow **24x by 2030** (~120 quadrillion tokens/month), driven by always-on agents. [VERIFIED — consistently reported across financial press]
- Pricing turbulence and user backlash: Copilot (Jun 2026 usage-based switch; 10–50x bill increases for agentic-heavy users), Cursor (Jun 2025 overhaul, public apology + refunds), Windsurf (Mar 2026 overhaul), Codex (Apr 2026 switch to token pricing) — all four major tools re-priced within two years; predictability is the universal complaint. [NEWS/ANECDOTE mixed]
- Waste structure: ~**84%** of tokens in an agentic turn are tool output rather than reasoning (SWE-agent-style trace analysis); GitHub's official MCP server consumes **17,600 tokens** of tool-definition schema per request, and multiple servers stack past 30,000 before any work begins; MCP repo issue #2808 estimates ~1,000 tokens of standing overhead per loaded tool. [TELEMETRY / first-party issue] (Note: the widely-shared "42% of tokens are avoidable" traces back to one person's 4-day self-log; "62% is re-sent history" could not be traced to any source — neither is fit for external citation.)
- OpenAI's enterprise lead, verbatim: "Our conversations are never about capability anymore — now it's about visibility, auditability, token controls, and model efficiency."

**Structural read**: this pain is so new that even DORA (citations retrieved through Feb 2026) hadn't modeled it — enterprises face runaway cost with **no authoritative framework**, lacking both visibility (where consumption comes from) and control (how to cap it).

### Pain #5: The trust gap and the "almost right" tax — the more it's used, the less it's trusted

- DORA 2025: 90% use AI (+14.1% YoY), >80% perceive productivity gains, yet **30%** have little or no trust in AI-generated code (23% "a little" + 7% "not at all"); only 24% report high trust. DORA models trust as one of the three components of its AI-adoption factor (use / reliance / trust) — low trust directly suppresses adoption benefits. [SURVEY]
- Stack Overflow 2025 (published Dec 2025): adoption rose to 84% while **distrust of accuracy rose from 31% (2024) to 46% (2025)**; only 3% "highly trust" output. **66% cite "AI solutions that are almost right, but not quite" as the top frustration**; 45% say debugging AI code takes longer; 75% say "when I don't trust AI's answers" is the #1 reason they'd still consult a human. [SURVEY]
- Sonar 2026's "verification gap": **96%** don't fully trust the functional accuracy of AI code, but **only 48%** always verify before committing — while AI already accounts for **42%** of committed code (devs expect 65% by 2027). Of those who skip verification, 38% say it's because verifying takes longer than reviewing a colleague's code. [SURVEY]
- Perception vs. reality: the METR experiment (Jul 2025) — experienced open-source developers *slowed down 19%* by AI tools believed they had been sped up 20%. DORA 2025 cites this study in its main text. [EXPERIMENT]
- Security dimension (verified to primary source): Apiiro's analysis of tens of thousands of Fortune 50 repos — AI-assisted developers commit **3–4x** more, but monthly security findings rose from ~1,000 to 10,000+ (**10x**); privilege-escalation paths +322%, architectural design flaws +153%; in the same data, syntax errors fell 76% and logic bugs fell 60% (AI eliminates shallow errors while amplifying deep risk). Veracode: 45% of AI-generated samples across 100+ LLMs contained OWASP Top 10 vulnerabilities. [TELEMETRY/SURVEY]
- Skill-formation rupture (leading indicator): Anthropic research (Feb 2026) — developers relying on AI generation scored **17% lower** on comprehension tests for new libraries, with the largest gap on debugging questions; LeadDev 2025 — **54%** of engineering leaders plan to hire fewer juniors. DORA 2025's guest essay (Matt Beane) warns that when experts can self-serve, juniors lose the apprenticeship channel: "default AI usage patterns are delivering breakthrough productivity and blocking skill development for most devs." [STUDY/SURVEY]

What enterprises need is not "persuade people to trust AI more" — it is **making verification cheap and giving trust an evidentiary basis**.

### Pain #6: Missing AI stance and governance — DORA's strongest cultural amplifier, absent in practice

- The single strongest-evidence capability in DORA's model is a "**clear and communicated AI stance**": when present, AI's positive effects on individual effectiveness and organizational performance are amplified, and AI's neutral effect on friction turns into a *decrease* (one of only two capabilities that flip friction). Yet interviews show developers "routinely and consistently" don't know their organization's stance — producing both over-conservative users (afraid to use AI) and over-permissive ones (using it where they shouldn't). (2025, pp. 51–53)
- Shadow AI: **35%** of developers access AI coding tools via personal accounts (Sonar 2026); 82% of organizations discovered at least one unknown AI agent/workflow in the past year; only 12% apply the same security standards to AI code as to human code (while 93% already use AI code). [SURVEY]
- Governance maturity: 88% of AI-agent pilots never reach production; 63% of orgs can't enforce purpose limits on agents, 60% can't quickly terminate a misbehaving one; 78% of executives admit they couldn't pass an independent AI-governance audit within 90 days. [SURVEY, 2026 governance research family]
- Agent reliability is now a production-safety topic: the PocketOS incident (Apr 24, 2026 — a Cursor agent with an over-scoped Railway token deleted the production database and all backups in 9 seconds; 35,000+ online reactions) is the year's most-cited case, and a sandbox industry materialized in response (Cloudflare, Vercel, Modal, E2B all shipped agent sandboxes by early 2026). Anthropic's own April 23, 2026 postmortem confirmed a different failure mode: three overlapping product-layer changes caused ~6 weeks of silent quality degradation (default reasoning-effort downgrade, a caching bug, a verbosity prompt change — a measured 3% quality drop) — first-party proof that **platform/model version drift silently changes agent output**. [FIRST-PARTY/NEWS]

---

## 3. Additional findings from the full read (beyond the executive summaries)

### 3.1 Seven team profiles: 38% of teams live in a "pain profile"
DORA 2025 (pp. 15–18) clusters teams into seven archetypes: Foundational challenges (10%; struggling on all fronts, high burnout), Legacy bottleneck (11%; firefighting driven by unstable systems), Constrained by process (17%; stable systems but inefficient process — high burnout, low impact, "a treadmill"), High impact/low cadence (7%; strong output with high friction and instability — "speed without stability is unsustainable"), Stable and methodical (15%), Pragmatic performers (20%), Harmonious high-achievers (20%). **The first three (38%) are the group most endangered by the amplifier effect** — AI magnifies their existing dysfunction. The last two (40%) are empirical proof that the speed-vs-stability trade-off is a myth.

### 3.2 Platform engineering: the on/off switch for AI value
- Platform adoption is at 90%; 76% of orgs have at least one dedicated platform team; 29% run multiple platforms — the leadership challenge has shifted from "have a platform" to "govern a platform of platforms."
- **The key interaction effect (p. 71)**: with low platform quality, AI adoption's effect on organizational performance is **negligible**; with high quality, it is strong and positive. "An investment in AI without a corresponding investment in high-quality platforms is unlikely to yield significant returns at the organizational level."
- The experience gap: technical capabilities (reliability, security) score well while "acting on feedback" and "task automation" lag — platforms are typically built tech-first, experience-later, and "until the user experience is addressed, the platform's full value remains unrealized."
- Counterintuitive: high-quality platforms *increase* friction for heavy AI users (guardrails blocking inappropriate use); DORA judges this an acceptable net-positive.

### 3.3 Value stream management: "from local to systemic"
VSM (visualizing and improving flow from idea to customer) is confirmed to amplify AI's impact on organizational performance. The canonical application: if mapping reveals code review as the constraint, **apply AI to improve the review process itself** rather than using AI to generate more code that worsens the bottleneck. This is DORA's methodological answer to "where should AI be applied first."

### 3.4 Dissecting the ROI model (appendix calculator, 500-FTE example)
- **95% of modeled value is reclaimed developer time** ($11.0M of $11.6M, at ~1 hour/day saved); revenue from extra features is only $0.99M; the instability tax is **−$344k** (their own assumption: CFR 5%→6%). In DORA's own model, AI's calculable value ≈ developer time, and the delivery-quality line item is net negative.
- The J-Curve "tuition": a 15% productivity dip × 3 months = **$3.3M**, nearly matching hard tooling costs ($5.065M); total first-year investment $8.365M, ROI 39%, payback ~8 months.
- Explicitly anti-layoff: freed capacity should be reinvested ("free headcount"); replacing a developer costs 1.5–2x annual salary.
- Self-acknowledged limits: "all models are wrong"; and its token-cost assumption ($80/user/year) is off by 30–75x versus 2026 field data ($200–500/user/month) — the report's citations end Feb 2026, just before the cost explosion.

### 3.5 Other DORA data points worth recording
- The median developer interacts with AI **2 hours per workday** (a quarter of an 8-hour day). Top task: writing new code (71% of those who code), then literature reviews (68%), modifying existing code (66%).
- Agent mode is still a minority: **61% never** use agentic AI (survey window Jun–Jul 2025) — mainstream enterprise interaction remains chat + completion; the agentic wave is early.
- Friction and burnout are completely immune to AI (no statistical relationship, two years running). Friction doesn't vanish — it **relocates**: from manual grind to "prompt iteration, result vetting, and assessing code that looks remarkably similar to correct code." Perceived capacity gains invite higher output expectations (work intensification); interviewees explicitly reported tightened deadlines.
- Psychology: AI adoption correlates with *authentic pride* (mediated by more time on valuable work); 78% certainty that AI does not diminish psychological ownership of code (with a notable 21% probability that it does); no measurable effect on meaning of work, need for cognition, or workplace connection.
- UC Berkeley eye-tracking study (guest essay): during interpretive tasks developers gave AI chat <1% of visual attention (vs. ~19% on mechanical tasks) — in deep-understanding contexts developers actively ignore AI, suggesting AI support must match the cognitive nature of the task.
- Metrics chapter: self-reported and logs-based data each carry bias — "logs-based metrics are objective" is a named misconception; for the AI era, extend existing frameworks (e.g., add suggestion-acceptance rate, trust) rather than replacing them.

---

## 4. Evidence reliability: verification results

The 10 most widely-circulated weak claims were traced to primary sources (Jul 2026):

| Claim | Verdict | Correction |
|---|---|---|
| AGENTS.md → agent runtime −29% / output −17% | **CONFIRMED** | Actual: −28.64% / −16.58%, arXiv:2601.20404 (10 repos / 124 PRs) |
| "84% of companies fail at agent documentation" | **MISQUOTED** | Author's arithmetic on an uncited "16%" stat; no study behind it |
| Sherlock Forensics "92% of AI codebases have critical vulns / avg 8.3" | PARTIALLY CONFIRMED | Real report, but sample is "dozens of apps," no confidence intervals, publisher sells audits (COI) |
| Fortune 50: 3–4x commits / 10x security findings | **CONFIRMED** | Source is Apiiro (not Veracode/Cycode); same data shows syntax errors −76%, logic bugs −60% |
| "Vibe coding: 1.7x bugs / 2.25x logic errors" | **MISQUOTED** | CodeRabbit 470-PR study: 1.7x total issues correct; logic issues ~1.75x, not 2.25x |
| "67% of enterprise AI deployments fail compliance audits" | **UNVERIFIABLE** | No source anywhere in the chain; likely fabricated marketing stat |
| "42% of agent tokens spent on avoidable operations" | PARTIALLY CONFIRMED | One developer's 4-day self-log (21M tokens), not a formal study |
| "62% of billed tokens are re-sent history" | **UNVERIFIABLE** | Figure absent from the cited pages; likely conflated with an unrelated stat |
| Perplexity CTO "72% context tax," dropping MCP | PARTIALLY CONFIRMED | The MCP move is real (Ask 2026, Mar 11, 2026); the "72%" has no primary transcript — outlets vary 40–72% |
| Goldman Sachs "token usage 24x by 2030" | **CONFIRMED** | *Decoding the Agentic Economy*; consistent across financial press |

**Usage rules**: CONFIRMED items may be cited externally; PARTIALLY CONFIRMED only with caveats; MISQUOTED/UNVERIFIABLE must not be used. Two same-source risks to remember: DX and Faros's "91%/154%" figures appear to share a dataset family; the "agents burn 10–100x more tokens than chat" multiplier is a converging industry estimate with no single rigorous study behind it.

---

## 5. Coverage and remaining gaps

**Covered**: both DORA reports in full; English-language field data across seven surfaces (token cost, review bottleneck, code quality, context, trust, governance, agent reliability); primary-source verification of 10 weak claims; supplementary passes on Reddit sentiment, AGENTS.md maintenance burden, and CI non-determinism.

**Remaining gaps (worth closing before external publication or investment decisions)**:
1. First-hand Reddit threads (WebFetch is blocked on reddit.com; sentiment was reconstructed from aggregators quoting specific threads; upvote counts unverified).
2. Two circulating figures — "70% of leaders name non-determinism as the #1 production-readiness barrier" and "evaluation/observability gaps at 64%" — could not be traced to any named survey. **Do not cite.**
3. The solution landscape ("who is already building against each pain") was deliberately out of scope for this pass.

---

## 6. Archived files

| File | Description |
|---|---|
| `dora-2025.pdf` | DORA 2025 State of AI-assisted Software Development, 142-page original (v2025.2) |
| `dora-2025.txt` | Full-text extraction of the above (pdf-parse) |
| `dora-roi-2026.pdf` | DORA: The ROI of AI-assisted Software Development, 60-page original (v2026.1) |
| `dora-roi-2026.txt` | Full-text extraction of the above |
| `dora-developer-pain-analysis-2026.md` | This report (synthesis; incorporates all four subagent research passes) |
| `dora-developer-pain-analysis-2026.zh.md` | Chinese edition of this analysis (includes an additional China-market section) |
