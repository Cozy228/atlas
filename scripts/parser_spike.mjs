#!/usr/bin/env node
/**
 * parser_spike.mjs — ONE-SHOT, THROWAWAY format probe for the Atlas parsers.
 *
 * WHAT THIS IS
 *   A disposable spike that hits the *live* sources behind Atlas's resolvers and
 *   re-implements each parser's exact logic inline, to answer, before/while
 *   writing the real parsers:
 *     1. Does the current parser logic resolve against live data?
 *     2. What is the real upstream FORMAT/STRUCTURE (so the parser is built for it)?
 *
 *   Fidelity:
 *     - Pure string parsers (slugify, terraform extractSectionText, parseMarkdownMatrix,
 *       renderStorageHtml + parseReleaseNotes) are copied VERBATIM from the TS.
 *     - Confluence storage HTML is parsed with the SAME library production uses
 *       (node-html-parser), so the nextElementSibling sibling-walk that
 *       extractSectionText relies on behaves identically — including its failure
 *       modes (e.g. headings wrapped in <ac:layout-cell> are NOT siblings of the
 *       following blocks, so the section collects empty). The skeleton output
 *       surfaces exactly that.
 *
 *   Parsers mirrored (1:1 with the TS):
 *     - confluence   : context-layer/src/sourceContent/confluenceCloudContentProvider.ts
 *     - terraform    : context-layer/src/sourceContent/terraformModuleContentProvider.ts
 *                      THIS PLATFORM IS TFC/TFE-ONLY (no GitHub-hosted modules). The live TS still
 *                      targets GitHub's README API (parseRepo forces github.com); TFE is an unfilled
 *                      TODO. This probe hits the registry module API (root.readme + inputs/outputs/
 *                      version) — its output is what should drive rewriting that provider.
 *     - policy       : context-layer/src/resolvers/policyDocumentResolver.ts  (clause-* ; Confluence-sourced;
 *                      MAY live on a SECOND Confluence site — per-target base override)
 *     - availability : context-layer/src/resolvers/availabilityMatrixResolver.ts  (markdown table; Confluence-sourced)
 *     - releaseNotes : context-layer/src/releaseNotes/{resolveReleaseNotes,parseReleaseNotes}.ts
 *                      (release-notes Confluence page -> renderStorageHtml -> parseReleaseNotes)
 *
 * OUTPUT CONTRACT  (this script lives in a PUBLIC gist)
 *   * NEVER prints source原文 (no titles, no section text, no cell values, no item text, no macro params).
 *   * Prints ONLY: HTTP status, pass/fail booleans, structural counts, byte/line
 *     lengths, format flags, sha1 fingerprints, and CONTENT-FREE structure
 *     skeletons (tag paths, tag sequences, generic Confluence macro type names,
 *     per-row cell counts). The locator-vs-heading comparison happens INSIDE this
 *     script; only the verdict escapes.
 *   * Tokens / URLs are placeholders — paste your own, do not commit them back.
 *
 * RUN  (Node 18+; one dependency)
 *   npm i node-html-parser
 *   node parser_spike.mjs --selfcheck       # offline: assert parser logic on fixtures
 *   node parser_spike.mjs confluence | terraform | policy | availability | releaseNotes | all
 */

import { createHash } from "node:crypto";
import { parse } from "node-html-parser";

// ---------------------------------------------------------------------------
// CONFIG — PASTE YOUR OWN. All placeholders; nothing here is public-safe to keep.
// ---------------------------------------------------------------------------

// Primary Confluence site. policy (and only policy, today) may live on a SECOND
// site — give that target its own `site: {...}` below. unset => this primary.
const CONFLUENCE = {
  baseUrl: "<CONFLUENCE_BASE_URL>", // e.g. https://your-site.atlassian.net  (NO trailing /wiki)
  email:   "<CONFLUENCE_EMAIL>",    // set => Basic(email:token); empty/placeholder => Bearer
  token:   "<CONFLUENCE_TOKEN>",
};

// TFC/TFE registry (this platform has no GitHub-hosted modules). A module version's
// README markdown lives at root.readme; inputs/outputs/version sit alongside it.
//   public  : https://registry.terraform.io/v1/modules/{ns}/{name}/{provider}[/{version}]
//   private : https://<host>/api/registry/v1/modules/{ns}/{name}/{provider}[/{version}]  (Bearer)
// A location may carry its own host (app.terraform.io/...); else TFE_BASE_URL is used.
const TFE_BASE_URL = "<TFE_BASE_URL>";   // e.g. https://app.terraform.io  (private) or https://registry.terraform.io (public)
const TFE_TOKEN    = "<TFE_TOKEN>";      // team/user token; placeholder => no auth header (public only)

// Per-parser probe targets. anchorLocator is what your registered Anchor pins.
const TARGETS = {
  confluence: {
    pageId: "<CONFLUENCE_PAGE_ID>",      // numeric id of a confluence-page source
    anchorLocator: "<heading-slug>",     // slug of the heading the anchor pins (NO leading #)
    // site: { baseUrl, email, token },  // optional: override the primary site
  },
  terraform: {
    // A TFC/TFE registry module address. Bare <namespace>/<name>/<provider> — the
    // host is NOT part of it; it comes from TFE_BASE_URL (deployment config).
    location: "acme/standard/aws",
    version: "",                          // optional; "" => latest version detail
    anchorLocator: "#usage",              // README-prose anchor (MUST start with #). module-field
                                          // (registry metadata) anchors are a different path — see NOTE.
  },
  policy: {
    pageId: "<POLICY_PAGE_ID>",           // the Confluence page that holds the policy
    anchorLocator: "clause-1",            // MUST start with clause- (TS isValidLocator)
    // policy is published on a DIFFERENT Confluence address — override here:
    site: {
      baseUrl: "<POLICY_CONFLUENCE_BASE_URL>",
      email:   "<POLICY_CONFLUENCE_EMAIL>",
      token:   "<POLICY_CONFLUENCE_TOKEN>",
    },
  },
  availability: {
    pageId: "<AVAILABILITY_PAGE_ID>",     // the Confluence page holding the region×service table
    service: "S3",                        // availability-cell selector axis (probe only)
    region: "us-east-1",
    // site: { baseUrl, email, token },   // optional: override the primary site
  },
  releaseNotes: {
    pageId: "<RELEASE_NOTES_PAGE_ID>",    // the release-notes Confluence page (ATLAS_RELEASE_NOTES_PAGE_ID)
    // site: { baseUrl, email, token },   // optional: override the primary site
  },
};

const SKELETON_SAMPLE = 12; // cap list lengths in skeleton output

// ===========================================================================
// VERBATIM from the TS — pure string ops, no DOM. Keep byte-identical to source.
// ===========================================================================

/** confluence + terraform slugify(). */
const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** terraform extractSectionText(markdown, slug) — verbatim logic. Returns string | undefined. */
function terraformExtractSectionText(markdown, slug) {
  if (!markdown.trim()) return undefined;
  const lines = markdown.split(/\r?\n/);
  const headingSlug = (line) => {
    const match = line.match(/^#{1,6}\s+(.*)$/);
    return match ? slugify(match[1]) : undefined;
  };
  let index = lines.findIndex((line) => headingSlug(line) === slug);
  if (index === -1) return undefined;
  const parts = [];
  for (index += 1; index < lines.length; index += 1) {
    if (headingSlug(lines[index]) !== undefined) break;
    parts.push(lines[index]);
  }
  const sectionText = parts.join("\n").trim();
  return sectionText.length > 0 ? sectionText : undefined;
}

/** availability parseMarkdownMatrix(raw) — verbatim logic. Returns {regions, services} | undefined. */
function parseMarkdownMatrix(raw) {
  const splitRow = (line) => {
    const inner = line.slice(1, line.endsWith("|") ? -1 : undefined);
    return inner.split("|").map((c) => c.trim());
  };
  const isSeparatorRow = (cells) => cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));

  const rows = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"))
    .map(splitRow);
  if (rows.length < 2) return undefined;

  const regions = rows[0].slice(1).filter((c) => c.length > 0);
  if (regions.length === 0) return undefined;

  const services = new Map();
  for (const cells of rows.slice(1)) {
    if (isSeparatorRow(cells)) continue;
    const service = cells[0]?.trim();
    if (!service) continue;
    const statuses = new Map();
    regions.forEach((region, i) => {
      const status = cells[i + 1]?.trim();
      if (status) statuses.set(region.toLowerCase(), status);
    });
    services.set(service.toLowerCase(), { service, statuses });
  }
  if (services.size === 0) return undefined;
  return { regions, services };
}

// ===========================================================================
// VERBATIM release-notes parser — resolveReleaseNotes.renderStorageHtml() +
// parseReleaseNotes(). Storage HTML -> line format -> structured releases.
// (Types dropped for .mjs; logic byte-identical.)
// ===========================================================================
const RN_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const RN_TICKET = /\b([A-Z][A-Z0-9]+-\d+)\b/;
const RN_MONTHS = { january:"01",february:"02",march:"03",april:"04",may:"05",june:"06",july:"07",august:"08",september:"09",october:"10",november:"11",december:"12" };

/** resolveReleaseNotes.renderStorageHtml(html) — storage HTML to the line format parseReleaseNotes expects. */
function renderStorageHtml(html) {
  const root = parse(html);
  const lines = [];
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType !== 1) continue;
      const element = child;
      const t = (element.rawTagName ?? "").toLowerCase();
      if (t === "ol") {
        element.querySelectorAll("li").forEach((li, index) => { lines.push(`${index + 1}. ${rnCollapse(li.text)}`); });
      } else if (t === "ul") {
        element.querySelectorAll("li").forEach((li) => { lines.push(`• ${rnCollapse(li.text)}`); });
      } else if (/^h[1-6]$/.test(t) || t === "p") {
        const text = rnCollapse(element.text);
        if (text) lines.push(text);
      } else {
        walk(element);
      }
    }
  };
  walk(root);
  return lines.join("\n");
}
const rnCollapse = (text) => text.replace(/\s+/g, " ").trim();

function parseReleaseNotes(text) {
  return splitReleaseBlocks(text).map(parseOneRelease).filter((r) => r.items.length > 0 || r.changeRequest);
}
function splitReleaseBlocks(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let current = [];
  for (const line of lines) {
    if (/^\s*[•·]?\s*release notes\b/i.test(line) && current.length) { blocks.push(current.join("\n")); current = []; }
    current.push(line);
  }
  if (current.length) blocks.push(current.join("\n"));
  return blocks.length ? blocks : [text];
}
function parseOneRelease(block) {
  const lines = block.replace(/\r\n/g, "\n").split("\n").map(rnStripBullet);
  const items = [];
  let inScope = false;
  let category = "";
  for (const line of lines) {
    if (/^release scope:?$/i.test(line)) { inScope = true; continue; }
    if (!inScope) continue;
    if (/^for this release\b/i.test(line) || /^additional details:?$/i.test(line)) { inScope = false; continue; }
    const numbered = line.match(/^(\d+)\.\s*(.+)$/);
    if (numbered && category) { const { title, ticket } = rnSplitTicket(numbered[2]); items.push({ category, index: Number(numbered[1]), title, ticket }); continue; }
    const heading = line.match(/^([A-Za-z][A-Za-z0-9 /&-]*):$/);
    if (heading) category = heading[1].trim();
  }
  const changeRequest = block.match(/\b(CHG\d+)\b/)?.[1];
  const postedAt = rnParsePostedDate(block);
  return { id: rnReleaseId(postedAt, changeRequest, items), month: rnMonthLabel(postedAt), changeRequest, postedAt, items };
}
function rnReleaseId(postedAt, changeRequest, items) {
  const canonical = [postedAt ?? "", changeRequest ?? "", ...items.map((i) => i.ticket ?? i.title)].join("|");
  return `rel-${createHash("sha256").update(canonical).digest("hex").slice(0, 8)}`;
}
function rnMonthLabel(iso) {
  const match = iso?.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!match) return undefined;
  const name = RN_MONTH_NAMES[Number(match[2]) - 1];
  return name ? `${name} ${match[1]}` : undefined;
}
function rnSplitTicket(raw) {
  const ticket = raw.match(RN_TICKET)?.[1];
  const title = (ticket ? raw.replace(/\[?\s*[A-Z][A-Z0-9]+-\d+\s*\]?/, " ") : raw).replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
  return { title, ticket };
}
function rnParsePostedDate(text) {
  const match = text.match(/on\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})/i);
  if (!match) return undefined;
  const month = RN_MONTHS[match[2].toLowerCase()];
  return month ? `${match[3]}-${month}-${match[1].padStart(2, "0")}` : undefined;
}
function rnStripBullet(line) { return line.replace(/^[\s•·]+/, "").trim(); }

// ===========================================================================
// DOM probe — same node-html-parser production uses. Content-free outputs only.
// ===========================================================================
const fp = (value) => createHash("sha1").update(value).digest("hex").slice(0, 8);
const tag = (el) => (el?.rawTagName || "").toLowerCase();
const isHeading = (el) => /^h[1-6]$/i.test(tag(el));

/** Ancestor tag chain above a node (content-free). Reveals layout wrappers. */
function tagPath(node) {
  const parts = [];
  let n = node?.parentNode;
  while (n && tag(n)) {
    parts.unshift(tag(n));
    n = n.parentNode;
  }
  return parts.join(">");
}

/**
 * FAITHFUL extractSectionText sibling-walk: collect nextElementSibling until the
 * next heading. Returns the text LENGTH (never the text) plus the sibling tag
 * sequence — the structure a clause/section parser must reason about.
 */
function siblingSection(headingEl) {
  let n = headingEl.nextElementSibling;
  let len = 0;
  const tags = [];
  while (n && !isHeading(n)) {
    const t = n.text.trim();
    if (t) len += t.length;
    tags.push(tag(n));
    n = n.nextElementSibling;
  }
  return { len, tags };
}

function probeDom(html) {
  const root = parse(html);
  const headingEls = root.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const headings = headingEls.map((el) => {
    const sec = siblingSection(el);
    return {
      level: Number(tag(el)[1]),
      slug: slugify(el.text),
      path: tagPath(el),            // ancestor chain — non-empty/non-"body" => wrapped
      wrapped: tagPath(el) !== "" && !/^(html>)?(body)?$/.test(tagPath(el)),
      section_sibling_text_len: sec.len,
      section_sibling_tags: sec.tags.slice(0, SKELETON_SAMPLE),
    };
  });

  const macros = root.querySelectorAll("ac\\:structured-macro");
  const macroNames = [...new Set(macros.map((m) => m.getAttribute("ac:name")).filter(Boolean))];

  const tables = root.querySelectorAll("table").map((tbl) => {
    const rows = tbl.querySelectorAll("tr").map((tr) => {
      const cells = tr.querySelectorAll("td, th");
      return { cellCount: cells.length, allTh: cells.length > 0 && cells.every((c) => tag(c) === "th") };
    });
    return rows;
  });

  return {
    headings,
    macroNames,
    ordered_list_count: root.querySelectorAll("ol").length,
    unordered_list_count: root.querySelectorAll("ul").length,
    list_item_count: root.querySelectorAll("li").length,
    top_level_block_tags: root.childNodes.filter((n) => tag(n)).map(tag).slice(0, SKELETON_SAMPLE),
    tables,
  };
}

/** Mirror availabilityMatrixResolver's expectation: HTML <table> -> markdown pipes. */
function htmlTableToMarkdown(tableEl) {
  const rows = tableEl.querySelectorAll("tr").map((tr) =>
    tr.querySelectorAll("td, th").map((c) => c.text.replace(/\s+/g, " ").trim().replace(/\|/g, "\\|")),
  );
  if (!rows.length) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r) => [...r, ...Array(width - r.length).fill("")];
  const out = ["| " + pad(rows[0]).join(" | ") + " |", "| " + Array(width).fill("---").join(" | ") + " |"];
  for (const r of rows.slice(1)) out.push("| " + pad(r).join(" | ") + " |");
  return out.join("\n");
}

// ===========================================================================
// Network
// ===========================================================================
async function httpGet(url, headers) {
  try {
    const r = await fetch(url, { method: "GET", headers });
    return { status: r.status, body: await r.text() };
  } catch (e) {
    process.stderr.write(`  ! network error: ${e.message}\n`);
    return { status: 0, body: "" };
  }
}

function confluenceAuth(site) {
  if (site.email && !site.email.startsWith("<")) {
    const basic = Buffer.from(`${site.email}:${site.token}`).toString("base64");
    return { Authorization: `Basic ${basic}`, Accept: "application/json" };
  }
  return { Authorization: `Bearer ${site.token}`, Accept: "application/json" };
}

const statusVerdict = (status) =>
  status === 401 || status === 403
    ? { warning_code: "restricted_source" }
    : status === 404
      ? { warning_code: "source_unavailable", reason: "not_found" }
      : { warning_code: "source_unavailable", reason: `http_${status}` };

/** Mirror fetchConfluenceStorageHtml(): v2 pages endpoint, storage body-format. Base is per-site. */
async function fetchConfluenceStorage(pageId, site = CONFLUENCE) {
  const base = site.baseUrl.replace(/\/+$/, "");
  const url = `${base}/wiki/api/v2/pages/${encodeURIComponent(pageId)}?body-format=storage`;
  const { status, body } = await httpGet(url, confluenceAuth(site));
  if (status !== 200) return { status, html: "", meta: statusVerdict(status) };
  const page = JSON.parse(body || "{}");
  const html = page?.body?.storage?.value ?? "";
  return { status, html, meta: { version: page?.version?.number, has_storage_body: Boolean(html), html_bytes: Buffer.byteLength(html) } };
}

// ---- terraform: TFC/TFE registry module fetch (no GitHub path on this platform) ----

/** Parse a registry module address <host?>/<namespace>/<name>/<provider>. */
function parseRegistryLocation(location) {
  const clean = location.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const parts = clean.split("/");
  if (parts.length === 3) return { host: "", namespace: parts[0], name: parts[1], provider: parts[2] };
  if (parts.length >= 4) return { host: parts[0], namespace: parts[1], name: parts[2], provider: parts[3] };
  return undefined;
}

/**
 * TFC/TFE registry module version detail. README is root.readme; the same payload
 * carries root.inputs / root.outputs / version — the module-field (ADR-0010) axes.
 */
async function fetchRegistryModule(route, version) {
  const raw = route.host ? `https://${route.host}` : TFE_BASE_URL;
  const base = raw.replace(/\/+$/, "");
  const isPublic = /registry\.terraform\.io/.test(base);
  const apiRoot = isPublic ? `${base}/v1/modules` : `${base}/api/registry/v1/modules`;
  const path = `${route.namespace}/${route.name}/${route.provider}`;
  const url = `${apiRoot}/${path}${version ? `/${version}` : ""}`;
  const headers = { Accept: "application/json" };
  if (TFE_TOKEN && !TFE_TOKEN.startsWith("<")) headers.Authorization = `Bearer ${TFE_TOKEN}`;
  const { status, body } = await httpGet(url, headers);
  const registry = isPublic ? "public" : "private";
  if (status !== 200) return { status, registry };
  const mod = JSON.parse(body || "{}");
  const root = mod?.root ?? {};
  return {
    status, registry,
    markdown: typeof root.readme === "string" ? root.readme : "",
    readme_field: "root.readme",
    resolved_version: mod?.version,
    submodule_count: Array.isArray(mod?.submodules) ? mod.submodules.length : 0,
    input_count: Array.isArray(root.inputs) ? root.inputs.length : 0,
    output_count: Array.isArray(root.outputs) ? root.outputs.length : 0,
    provider_count: Array.isArray(mod?.providers) ? mod.providers.length : 0,
  };
}

// ===========================================================================
// Per-parser probes  (skeleton always included for the HTML-sourced ones)
// ===========================================================================
async function probeConfluence() {
  const t = TARGETS.confluence;
  const { status, html, meta } = await fetchConfluenceStorage(t.pageId, t.site ?? CONFLUENCE);
  if (status !== 200) return { parser: "confluence", http: status, ...meta };
  const dom = probeDom(html);
  const match = dom.headings.find((h) => h.slug === t.anchorLocator);
  return {
    parser: "confluence", http: status, ...meta,
    isValidLocator: Boolean(t.anchorLocator) && !t.anchorLocator.startsWith("#"),
    heading_count: dom.headings.length,
    heading_slug_fingerprints: dom.headings.slice(0, 25).map((h) => fp(h.slug)),
    macro_type_names: dom.macroNames,
    table_count: dom.tables.length,
    locator_matched: Boolean(match),
    matched_level: match?.level ?? null,
    section_text_len: match?.section_sibling_text_len ?? 0,
    resolves: Boolean(match) && match.section_sibling_text_len > 0,
    skeleton: {
      top_level_block_tags: dom.top_level_block_tags,
      heading_paths: dom.headings.slice(0, SKELETON_SAMPLE).map((h) => ({ level: h.level, path: h.path, wrapped: h.wrapped, sec_len: h.section_sibling_text_len })),
      any_heading_wrapped: dom.headings.some((h) => h.wrapped), // true => sibling-walk likely collects empty sections
    },
  };
}

async function probeTerraform() {
  const t = TARGETS.terraform;
  const route = parseRegistryLocation(t.location);
  if (!route) return { parser: "terraform", error: "location is not <host?>/<namespace>/<name>/<provider>" };

  const mod = await fetchRegistryModule(route, t.version);
  if (mod.status !== 200) return { parser: "terraform", registry: mod.registry, http: mod.status, ...statusVerdict(mod.status) };

  const markdown = mod.markdown;
  const locator = t.anchorLocator;
  const valid = locator.startsWith("#"); // TS isValidLocator for terraform
  const slug = locator.replace(/^#/, "");
  const section = valid ? terraformExtractSectionText(markdown, slug) : undefined;
  const slugs = markdown.split(/\r?\n/).map((l) => l.match(/^#{1,6}\s+(.*)$/)).filter(Boolean).map((m) => slugify(m[1]));
  return {
    parser: "terraform",
    registry: mod.registry,                  // public | private
    http: mod.status,
    readme_field: mod.readme_field,          // proves README is at root.readme, NOT a GitHub blob
    resolved_version: mod.resolved_version,
    submodule_count: mod.submodule_count,
    isValidLocator: valid,
    markdown_bytes: Buffer.byteLength(markdown),
    has_readme: markdown.length > 0,
    heading_count: slugs.length,
    heading_slug_fingerprints: slugs.slice(0, 25).map(fp),
    locator_matched: section !== undefined || slugs.includes(slug),
    section_text_len: section ? section.length : 0,
    resolves: section !== undefined,
    // module-field path (ADR-0010 registry metadata) shares this payload — content-free axes:
    module_field_axes: { inputs: mod.input_count, outputs: mod.output_count, providers: mod.provider_count },
  };
}

/**
 * Policy is sourced from Confluence — possibly a DIFFERENT site (TARGETS.policy.site).
 * The live TS resolver has no Confluence->clause parser yet; the skeleton reveals
 * HOW clauses are delimited so one can be designed (headings? <ol><li>? macros?).
 */
async function probePolicy() {
  const t = TARGETS.policy;
  const { status, html, meta } = await fetchConfluenceStorage(t.pageId, t.site ?? CONFLUENCE);
  if (status !== 200) return { parser: "policy", http: status, used_second_site: Boolean(t.site), ...meta };
  const dom = probeDom(html);
  const slugs = dom.headings.map((h) => h.slug);
  const clauseLike = slugs.filter((s) => /^(clause|section|\d+)-/.test(s) || /^\d+$/.test(s));
  return {
    parser: "policy", http: status, used_second_site: Boolean(t.site), ...meta,
    isValidLocator: t.anchorLocator.startsWith("clause-"),
    heading_count: slugs.length,
    headings_with_leading_number: slugs.filter((s) => /^\d/.test(s)).length,
    clause_like_heading_count: clauseLike.length,
    locator_matches_a_heading: slugs.includes(t.anchorLocator),
    NOTE: "no Confluence->clause parser exists yet; skeleton below informs its design",
    skeleton: {
      top_level_block_tags: dom.top_level_block_tags,
      macro_type_names: dom.macroNames,
      ordered_list_count: dom.ordered_list_count,
      unordered_list_count: dom.unordered_list_count,
      list_item_count: dom.list_item_count,
      heading_blocks: dom.headings.slice(0, SKELETON_SAMPLE).map((h) => ({ level: h.level, path: h.path, follows: h.section_sibling_tags })),
    },
  };
}

/**
 * Availability source is a Confluence page (HTML <table>), but the live TS parser
 * (parseMarkdownMatrix) expects a MARKDOWN pipe table. Proves the gap, measures
 * the table, and shows the row skeleton (cell counts, header-is-th).
 */
async function probeAvailability() {
  const t = TARGETS.availability;
  const { status, html, meta } = await fetchConfluenceStorage(t.pageId, t.site ?? CONFLUENCE);
  if (status !== 200) return { parser: "availability", http: status, ...meta };
  const root = parse(html);
  const tableEls = root.querySelectorAll("table");
  const dom = probeDom(html);

  const rawAttempt = parseMarkdownMatrix(html); // expected undefined (html != markdown pipes)
  const biggestEl = tableEls.reduce((a, b) => (b.querySelectorAll("tr").length > a.querySelectorAll("tr").length ? b : a), tableEls[0]);
  const bridged = biggestEl ? parseMarkdownMatrix(htmlTableToMarkdown(biggestEl)) : undefined;

  const verdict = {
    parser: "availability", http: status, ...meta,
    html_table_count: tableEls.length,
    parse_raw_html_succeeds: rawAttempt !== undefined,                 // gap proof: should be false
    "parse_after_html->md_bridge_succeeds": bridged !== undefined,     // should be true
    skeleton: {
      biggest_table_rows: dom.tables.length ? dom.tables.reduce((a, b) => (b.length > a.length ? b : a)).map((r) => r.cellCount) : [],
      header_row_is_th: dom.tables.length ? dom.tables.reduce((a, b) => (b.length > a.length ? b : a))[0]?.allTh ?? false : false,
    },
  };
  if (bridged) {
    verdict.region_count = bridged.regions.length;
    verdict.service_count = bridged.services.size;
    verdict.region_fingerprints = bridged.regions.map(fp);
    const row = bridged.services.get((t.service || "").toLowerCase());
    verdict.probe_service_present = Boolean(row);
    verdict.probe_cell_has_status = Boolean(row && row.statuses.has((t.region || "").toLowerCase())); // flag only, not value
  }
  return verdict;
}

/**
 * Release notes are a Confluence page resolved through the SAME storage channel,
 * then renderStorageHtml() -> parseReleaseNotes(). This probe runs that whole
 * pipeline live and emits only counts/flags/fingerprints — never item text.
 */
async function probeReleaseNotes() {
  const t = TARGETS.releaseNotes;
  const { status, html, meta } = await fetchConfluenceStorage(t.pageId, t.site ?? CONFLUENCE);
  if (status !== 200) return { parser: "releaseNotes", http: status, ...meta };
  const rendered = renderStorageHtml(html);
  const releases = parseReleaseNotes(rendered);
  const dom = probeDom(html);
  return {
    parser: "releaseNotes", http: status, ...meta,
    rendered_line_count: rendered.split("\n").length,
    release_block_count: releases.length,
    releases_resolve: releases.length > 0,
    per_release: releases.slice(0, SKELETON_SAMPLE).map((r) => ({
      item_count: r.items.length,
      category_count: new Set(r.items.map((i) => i.category)).size,
      ticketed_items: r.items.filter((i) => i.ticket).length,
      has_change_request: Boolean(r.changeRequest),
      has_posted_date: Boolean(r.postedAt),
      id_fp: fp(r.id),
    })),
    skeleton: {
      top_level_block_tags: dom.top_level_block_tags,
      ordered_list_count: dom.ordered_list_count,
      list_item_count: dom.list_item_count,
      any_heading_wrapped: dom.headings.some((h) => h.wrapped),
    },
  };
}

const PROBES = { confluence: probeConfluence, terraform: probeTerraform, policy: probePolicy, availability: probeAvailability, releaseNotes: probeReleaseNotes };

// ===========================================================================
// Offline self-check — one runnable check. No token, no network.
// ===========================================================================
function selfcheck() {
  const ok = (cond, msg) => { if (!cond) { throw new Error("selfcheck FAIL: " + msg); } };

  ok(slugify("Usage Guide!") === "usage-guide", "slugify basic");
  ok(slugify("  --Foo Bar-- ") === "foo-bar", "slugify edges");

  // confluence: flat headings resolve; section non-empty via sibling walk
  const flat = probeDom("<h2>Usage Guide</h2><p>do the thing</p><h2>Next</h2>");
  const m1 = flat.headings.find((h) => h.slug === "usage-guide");
  ok(m1 && m1.section_sibling_text_len > 0, "confluence flat resolves");
  ok(!flat.headings.some((h) => h.wrapped), "flat headings not wrapped");

  // confluence FAILURE MODE: heading wrapped in ac:layout-cell -> section sibling-walk empty
  const wrapped = probeDom("<ac:layout><ac:layout-cell><h2>Usage Guide</h2></ac:layout-cell>" +
    "<ac:layout-cell><p>do the thing</p></ac:layout-cell></ac:layout>");
  const m2 = wrapped.headings.find((h) => h.slug === "usage-guide");
  ok(m2 && m2.wrapped, "wrapped heading detected");
  ok(m2 && m2.section_sibling_text_len === 0, "wrapped heading collects empty section (gap exposed)");

  // terraform: verbatim extract; needs markdown heading
  ok(terraformExtractSectionText("# T\n## Usage\nterraform init\n## Inputs\n", "usage") !== undefined, "terraform resolves");
  ok(terraformExtractSectionText("## Usage\nx", "missing") === undefined, "terraform miss");

  // terraform: registry location parse (host-qualified and bare)
  const reg = parseRegistryLocation("app.terraform.io/acme/standard/aws");
  ok(reg && reg.host === "app.terraform.io" && reg.namespace === "acme" && reg.provider === "aws", "registry location w/ host");
  const bare = parseRegistryLocation("acme/standard/aws");
  ok(bare && bare.host === "" && bare.name === "standard", "bare registry location (host => TFE_BASE_URL)");

  // availability: raw html fails, bridged html-table parses
  const html = "<table><tr><th>Service</th><th>us-east-1</th><th>eu-west-1</th></tr>" +
    "<tr><td>S3</td><td>available</td><td>not-planned</td></tr></table>";
  ok(parseMarkdownMatrix(html) === undefined, "raw html must NOT parse as markdown");
  const tbl = parse(html).querySelector("table");
  const matrix = parseMarkdownMatrix(htmlTableToMarkdown(tbl));
  ok(matrix && matrix.regions.join(",") === "us-east-1,eu-west-1", "bridged regions");
  ok(matrix.services.get("s3").statuses.get("us-east-1") === "available", "bridged cell");

  // releaseNotes: storage HTML -> renderStorageHtml -> parseReleaseNotes
  const relHtml = "<h2>Release Notes</h2><p>Release Scope:</p><p>Compute:</p>" +
    "<ol><li>Upgrade the runtime PLAT-1574</li></ol><p>Posted on 12th May, 2026 CHG1052711</p>";
  const rels = parseReleaseNotes(renderStorageHtml(relHtml));
  ok(rels.length === 1 && rels[0].items.length === 1, "release parses one item");
  ok(rels[0].items[0].ticket === "PLAT-1574", "release ticket extracted");
  ok(rels[0].changeRequest === "CHG1052711" && rels[0].postedAt === "2026-05-12", "release CHG + date extracted");

  console.log("selfcheck: OK");
  return 0;
}

// ===========================================================================
async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--selfcheck")) return selfcheck();
  const which = argv.find((a) => a in PROBES) || "all";
  const names = which === "all" ? Object.keys(PROBES) : [which];
  for (const name of names) {
    console.log(`\n=== ${name} ===`);
    try {
      const v = await PROBES[name]();
      console.log(JSON.stringify(v, (_k, val) => (val instanceof Map ? `Map(${val.size})` : val), 2));
    } catch (e) {
      console.log(JSON.stringify({ parser: name, spike_error: String(e?.message || e) }, null, 2));
    }
  }
  return 0;
}

process.exit(await main());
