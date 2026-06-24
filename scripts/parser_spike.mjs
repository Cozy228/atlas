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
 *       following blocks, so the current mirror can collect empty sections).
 *
 *   Parsers mirrored (1:1 with the TS):
 *     - confluence   : context-layer/src/sourceContent/confluenceCloudContentProvider.ts
 *     - terraform    : context-layer/src/sourceContent/terraformModuleContentProvider.ts
 *                      THIS PLATFORM IS TFC/TFE-ONLY (no GitHub-hosted modules). The live TS still
 *                      targets GitHub's README API (parseRepo forces github.com); TFE is an unfilled
 *                      TODO. This probe hits the registry module API (root.readme + inputs/outputs/
 *                      version) — its output is what should drive rewriting that provider.
 *     - policy       : context-layer/src/resolvers/policyDocumentResolver.ts  (section/list ; Confluence-sourced;
 *                      MAY live on a SECOND Confluence site — per-target base override)
 *     - availability : context-layer/src/resolvers/availabilityMatrixResolver.ts  (markdown table; Confluence-sourced)
 *     - releaseNotes : context-layer/src/releaseNotes/{resolveReleaseNotes,parseReleaseNotes}.ts
 *                      (release-notes Confluence page -> renderStorageHtml -> parseReleaseNotes)
 *
 * OUTPUT  Focused JSON: current_mirror, candidate_method, candidate_result,
 *   remaining_gap, next_spike_focus, and the smallest source/shape facts needed
 *   to decide the next spike iteration.
 *   Tokens / URLs are placeholders — paste your own, do not commit them back.
 *
 * RUN  (Node 18+)
 *   npm i node-html-parser          # + undici  if you set HTTP_PROXY below
 *   node parser_spike.mjs --selfcheck       # offline: assert parser logic on fixtures
 *   node parser_spike.mjs confluence | terraform | policy | availability | releaseNotes | all
 */

import { createHash } from "node:crypto";
import { parse } from "node-html-parser";

// ---------------------------------------------------------------------------
// CONFIG — PASTE YOUR OWN. All placeholders; nothing here is public-safe to keep.
// ---------------------------------------------------------------------------

// Optional http(s) proxy for all fetches — corp egress. Placeholder/empty => direct.
// Needs `npm i undici` when set (handles http/https proxy, CONNECT, TLS). e.g. http://user:pass@proxy.corp:8080
// Corp TLS-intercept CA: run with NODE_EXTRA_CA_CERTS=/path/to/corp-ca.pem.
const HTTP_PROXY = "<HTTP_PROXY>";

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
    anchorLocator: "<policy-section-slug>", // heading/list locator used by the policy Anchor
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

const SKELETON_SAMPLE = 12; // cap internal structural probes.

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

/** Fence-aware ATX headings: ``` toggles a code block; '#' lines inside are NOT headings. */
function fenceAwareHeadings(markdown) {
  let inFence = false;
  const out = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (!inFence) {
      const m = line.match(/^#{1,6}\s+(.*)$/);
      if (m) out.push(m[1]);
    }
  }
  return out;
}

function markdownHeadings(markdown, fenceAware = false) {
  let inFence = false;
  const out = [];
  const lines = markdown.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (fenceAware && inFence) return;
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) out.push({ line: i + 1, level: m[1].length, text: m[2], slug: slugify(m[2]) });
  });
  return out;
}

function markdownExtractSectionTextLevelAware(markdown, slug) {
  if (!markdown.trim()) return undefined;
  const lines = markdown.split(/\r?\n/);
  const headings = markdownHeadings(markdown, true);
  const match = headings.find((h) => h.slug === slug);
  if (!match) return undefined;
  const next = headings.find((h) => h.line > match.line && h.level <= match.level);
  const sectionText = lines.slice(match.line, next ? next.line - 1 : undefined).join("\n").trim();
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
// release-notes parser — renderStorageHtml() + parseReleaseNotes(), from the TS.
// ONE proposed fix under test: scope sentinel "release scope" -> "nature of changes"
// (the real page's marker). Validate live here, then port back to parseReleaseNotes.ts.
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
    if (/nature of changes/i.test(line)) { inScope = true; continue; }
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

function renderStorageHtmlCandidate(html) {
  const root = parse(html);
  const lines = [];
  const push = (text, prefix = "") => {
    const collapsed = rnCollapse(text);
    if (collapsed) lines.push(`${prefix}${collapsed}`);
  };
  const walk = (node) => {
    for (const child of elementChildren(node)) {
      const t = tag(child);
      if (t === "ol" || t === "ul") {
        renderList(child, t === "ol");
      } else if (/^h[1-6]$/.test(t) || t === "p") {
        push(child.text);
      } else {
        walk(child);
      }
    }
  };
  const renderList = (list, ordered) => {
    directChildren(list, "li").forEach((li, index) => {
      push(directTextWithoutNestedLists(li), ordered ? `${index + 1}. ` : "• ");
      for (const nested of directChildren(li).filter((el) => tag(el) === "ol" || tag(el) === "ul")) {
        renderList(nested, tag(nested) === "ol");
      }
    });
  };
  walk(root);
  return lines.join("\n");
}

function parseReleaseNotesCandidate(text) {
  return splitReleaseBlocks(text).map(parseOneReleaseCandidate).filter((r) => r.items.length > 0 || r.changeRequest);
}

function parseOneReleaseCandidate(block) {
  const lines = block.replace(/\r\n/g, "\n").split("\n").map(rnStripBullet);
  const items = [];
  let inScope = false;
  let category = "";
  for (const rawLine of lines) {
    let line = rawLine;
    const scope = line.match(/^(?:release scope|nature of changes):?\s*(.*)$/i);
    if (scope) {
      inScope = true;
      line = scope[1].trim();
      if (!line) continue;
    }
    if (!inScope) continue;
    if (/^for this release\b/i.test(line) || /^additional details:?$/i.test(line)) {
      inScope = false;
      continue;
    }

    const numbered = line.match(/^(\d+)\.\s*(.+)$/);
    const index = numbered ? Number(numbered[1]) : items.length + 1;
    const body = numbered ? numbered[2].trim() : line;

    const categoryOnly = body.match(/^([A-Za-z][A-Za-z0-9 /&-]*):$/);
    if (categoryOnly && looksReleaseCategory(categoryOnly[1])) {
      category = categoryOnly[1].trim();
      continue;
    }

    if (numbered && category) {
      const { title, ticket } = rnSplitTicket(body);
      items.push({ category, index, title, ticket });
      continue;
    }

    const categoryAndItem = body.match(/^([A-Za-z][A-Za-z0-9 /&-]*):\s*(.+)$/);
    if (categoryAndItem && looksReleaseCategory(categoryAndItem[1])) {
      category = categoryAndItem[1].trim();
      const { title, ticket } = rnSplitTicket(categoryAndItem[2]);
      if (title) items.push({ category, index, title, ticket });
    }
  }
  const changeRequest = block.match(/\b(CHG\d+)\b/)?.[1];
  const postedAt = rnParsePostedDate(block);
  return { id: rnReleaseId(postedAt, changeRequest, items), month: rnMonthLabel(postedAt), changeRequest, postedAt, items };
}

function looksReleaseCategory(value) {
  const v = value.trim();
  if (/^(compute|non-compute|foundation|foundations|operations?|security|networking|storage|database|analytics|migration|application integration|ai services?)$/i.test(v)) {
    return true;
  }
  return v.length > 4 && !/^[A-Z0-9]{2,5}$/.test(v);
}

/**
 * Content-free gate diagnostics for parseOneRelease: which sentinels fire against
 * the rendered page (counts only — never the line text). scope counts the real
 * marker "nature of changes"; scope==0 => no scope region found; scope>0 but
 * item_count 0 => category/numbered issue. Normalization matches the parser.
 */
function rnGateProbe(rendered) {
  const lines = rendered.split("\n").map(rnStripBullet);
  return {
    scope_line_hits: lines.filter((l) => /(?:release scope|nature of changes)/i.test(l)).length,
    category_line_hits: lines.filter((l) => /^(?:\d+\.\s*)?[A-Za-z][A-Za-z0-9 /&-]*:$/.test(l)).length,
    numbered_line_hits: lines.filter((l) => /^\d+\.\s*.+$/.test(l)).length,
  };
}

// ===========================================================================
// DOM probe — same node-html-parser production uses. Content-free outputs only.
// ===========================================================================
const sample = (text, max = 200) => (text ? String(text).replace(/\s+/g, " ").trim().slice(0, max) : undefined);
const tag = (el) => (el?.rawTagName || "").toLowerCase();
const isHeading = (el) => /^h[1-6]$/i.test(tag(el));
const headingLevel = (el) => (isHeading(el) ? Number(tag(el)[1]) : undefined);

function elementChildren(node) {
  return node?.childNodes?.filter((child) => child.nodeType === 1) ?? [];
}

function directChildren(node, tagName) {
  return elementChildren(node).filter((child) => !tagName || tag(child) === tagName);
}

function directTextWithoutNestedLists(el) {
  return rnCollapse(
    (el?.childNodes ?? [])
      .filter((child) => !(child.nodeType === 1 && (tag(child) === "ol" || tag(child) === "ul")))
      .map((child) => child.text ?? child.rawText ?? "")
      .join(" "),
  );
}

function candidateLocators(entries, locator, max = 8) {
  const wanted = normalizeLocator(locator);
  return entries
    .filter((entry) => entry.locator)
    .map((entry) => {
      const got = normalizeLocator(entry.locator);
      const exact = got === wanted;
      const contains = wanted && got && (got.includes(wanted) || wanted.includes(got));
      return {
        ...entry,
        exact,
        contains,
        distance: wanted && got ? levenshtein(wanted, got) : 999,
      };
    })
    .sort((a, b) => Number(b.exact) - Number(a.exact) || Number(b.contains) - Number(a.contains) || a.distance - b.distance)
    .slice(0, max);
}

// Compare in the parser's slug space, not just lowercase: "#Module Usage" and
// "module-usage" MUST collate equal. This is the locator fix the real resolvers
// need — slugify the anchor before matching heading slugs (confluence/terraform/
// policy all fail today only because they compare a raw locator to a slug).
function normalizeLocator(value) {
  return slugify(String(value ?? ""));
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

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
  const nodes = siblingSectionNodes(headingEl, false);
  let len = 0;
  const tags = [];
  for (const n of nodes) {
    const t = n.text.trim();
    if (t) len += t.length;
    tags.push(tag(n));
  }
  return { len, tags };
}

function siblingSectionLevelAware(headingEl) {
  const nodes = siblingSectionNodes(headingEl, true);
  let len = 0;
  const tags = [];
  for (const n of nodes) {
    const t = n.text.trim();
    if (t) len += t.length;
    tags.push(tag(n));
  }
  return { len, tags };
}

function siblingSectionNodes(headingEl, levelAware) {
  const currentLevel = headingLevel(headingEl);
  const nodes = [];
  let n = headingEl.nextElementSibling;
  while (n) {
    if (isHeading(n)) {
      if (!levelAware || headingLevel(n) <= currentLevel) break;
    }
    nodes.push(n);
    n = n.nextElementSibling;
  }
  return nodes;
}

function probeDom(html) {
  const root = parse(html);
  const headingEls = root.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const headings = headingEls.map((el) => {
    const sec = siblingSection(el);
    const levelSec = siblingSectionLevelAware(el);
    return {
      level: Number(tag(el)[1]),
      slug: slugify(el.text),
      text: el.text,
      path: tagPath(el),            // ancestor chain — non-empty/non-"body" => wrapped
      wrapped: tagPath(el) !== "" && !/^(html>)?(body)?$/.test(tagPath(el)),
      section_sibling_text_len: sec.len,
      section_sibling_tags: sec.tags.slice(0, SKELETON_SAMPLE),
      section_level_aware_text_len: levelSec.len,
      section_level_aware_tags: levelSec.tags.slice(0, SKELETON_SAMPLE),
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

function parseAvailabilityHtmlTable(tableEl) {
  if (!tableEl) return undefined;
  const rowEls = tableEl.querySelectorAll("tr");
  const rows = rowEls.map((tr) => tr.querySelectorAll("td, th"));
  const headerIndex = rows.findIndex((cells) => cells.length > 1);
  if (headerIndex === -1) return undefined;
  const header = rows[headerIndex];
  const regions = header.slice(1).map((cell) => {
    const label = rnCollapse(cell.text);
    return { label, key: normalizeRegionKey(label) };
  }).filter((region) => region.key);
  if (!regions.length) return undefined;

  const services = new Map();
  const skipped = [];
  for (const cells of rows.slice(headerIndex + 1)) {
    if (!cells.length) continue;
    const service = rnCollapse(cells[0]?.text ?? "");
    if (!service) continue;
    const parsedCells = regions.map((region, i) => ({ region, cell: parseAvailabilityStatusCell(cells[i + 1]) }));
    const statuses = new Map();
    for (const parsed of parsedCells) {
      if (parsed.cell?.status) statuses.set(parsed.region.key, parsed.cell);
    }
    if (!statuses.size) {
      skipped.push({ service, cell_count: cells.length, reason: "no_status_cells" });
      continue;
    }
    services.set(service.toLowerCase(), { service, statuses });
  }
  return { regions, services, skipped };
}

function parseAvailabilityStatusCell(cell) {
  if (!cell) return undefined;
  const text = rnCollapse(cell.text);
  const html = cell.innerHTML ?? "";
  const emoticons = cell.querySelectorAll("ac\\:emoticon").map((e) => e.getAttribute("ac:name")).filter(Boolean);
  const macroNames = cell.querySelectorAll("ac\\:structured-macro").map((m) => m.getAttribute("ac:name")).filter(Boolean);
  const statusMacroTitles = cell
    .querySelectorAll("ac\\:parameter")
    .filter((p) => p.getAttribute("ac:name") === "title")
    .map((p) => rnCollapse(p.text))
    .filter(Boolean);
  const haystack = [text, html, ...emoticons, ...macroNames, ...statusMacroTitles].join(" ").toLowerCase();
  const note = text.match(/\b(?:\d{1,2}\/\d{1,2}\/\d{2,4}|tbd)\b/i)?.[0];
  if (/\btick\b|check_mark|✅|available/.test(haystack)) return { status: "available", note, source: "tick_or_text" };
  if (/blue-star|:emo:|interim/.test(haystack)) return { status: "interim", note, source: "emoticon_or_text" };
  if (/↗|future|planned/.test(haystack) || note) return { status: "planned", note, source: "future_or_date" };
  if (/^x$/i.test(text) || /not[- ]?planned/.test(haystack)) return { status: "not-planned", note, source: "text" };
  return undefined;
}

function normalizeRegionKey(label) {
  const code = String(label ?? "").match(/[a-z]{2}-[a-z]+-\d/i)?.[0];
  return code ? code.toLowerCase() : slugify(label);
}

function policyCandidates(html, locator) {
  const root = parse(html);
  const headingEls = root.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const allLists = root.querySelectorAll("ol, ul");
  const tocLists = allLists.filter((list) => looksLikeTocList(list, headingEls));
  const tocSet = new Set(tocLists);
  const sections = headingEls.map((heading, index) => {
    const nodes = siblingSectionNodes(heading, true);
    const sectionLists = [];
    for (const node of nodes) {
      if (tag(node) === "ol" || tag(node) === "ul") sectionLists.push(node);
      sectionLists.push(...node.querySelectorAll("ol, ul"));
    }
    return {
      index: index + 1,
      locator: slugify(heading.text),
      level: headingLevel(heading),
      sample_heading: sample(heading.text),
      current_len: siblingSection(heading).len,
      level_aware_len: siblingSectionLevelAware(heading).len,
      list_count: sectionLists.filter((list) => !tocSet.has(list)).length,
      item_count: sectionLists.filter((list) => !tocSet.has(list)).reduce((sum, list) => sum + directChildren(list, "li").length, 0),
    };
  });

  const listItems = [];
  for (const section of sections) {
    const heading = headingEls[section.index - 1];
    const nodes = siblingSectionNodes(heading, true);
    let itemIndex = 0;
    for (const node of nodes) {
      const lists = [
        ...(tag(node) === "ol" || tag(node) === "ul" ? [node] : []),
        ...node.querySelectorAll("ol, ul"),
      ].filter((list) => !tocSet.has(list));
      for (const list of lists) {
        directChildren(list, "li").forEach((li) => {
          itemIndex += 1;
          const base = section.locator;
          listItems.push({
            locator: `${base}#item-${itemIndex}`,
            alt_locator: `${base}-${itemIndex}`,
            section: base,
            index: itemIndex,
            sample_text: sample(directTextWithoutNestedLists(li)),
          });
        });
      }
    }
  }

  const locatorEntries = [
    ...sections.map((s) => ({ locator: s.locator, kind: "heading", sample_text: s.sample_heading })),
    ...listItems.map((i) => ({ locator: i.locator, kind: "list_item", sample_text: i.sample_text })),
    ...listItems.map((i) => ({ locator: i.alt_locator, kind: "list_item_alt", sample_text: i.sample_text })),
  ];

  return {
    possible_toc_list_count: tocLists.length,
    section_candidates: sections,
    list_item_candidates: listItems,
    locator_matches_section_candidate: locatorEntries.some((entry) => normalizeLocator(entry.locator) === normalizeLocator(locator)),
    nearest_locator_candidates: candidateLocators(locatorEntries, locator),
  };
}

function looksLikeTocList(list, headingEls) {
  const items = directChildren(list, "li").map((li) => slugify(directTextWithoutNestedLists(li))).filter(Boolean);
  if (items.length < 3) return false;
  const headingSlugs = new Set(headingEls.map((heading) => slugify(heading.text)));
  const hits = items.filter((item) => headingSlugs.has(item)).length;
  return hits >= Math.min(3, items.length);
}

function bestCandidate(entries, locator) {
  const best = candidateLocators(entries, locator, 1)[0];
  if (!best) return undefined;
  return {
    locator: best.locator,
    kind: best.kind,
    text: best.sample_text,
    line: best.line,
    level: best.level,
    current_len: best.current_len,
    level_aware_len: best.level_aware_len,
    distance: best.distance,
    exact: best.exact,
    contains: best.contains,
  };
}

function summarizeGate(gate) {
  return `scope=${gate.scope_line_hits}, category=${gate.category_line_hits}, numbered=${gate.numbered_line_hits}`;
}

function releaseSummary(rendered, releases) {
  const gate = rnGateProbe(rendered);
  const firstItem = releases.flatMap((r) => r.items)[0];
  return {
    lines: rendered.split("\n").length,
    blocks: releases.length,
    total_items: releases.reduce((sum, r) => sum + r.items.length, 0),
    gate: summarizeGate(gate),
    first_item: firstItem ? {
      category: firstItem.category,
      title: sample(firstItem.title),
      ticket: firstItem.ticket,
    } : undefined,
    first_change_request: releases.find((r) => r.changeRequest)?.changeRequest,
    first_posted_at: releases.find((r) => r.postedAt)?.postedAt,
  };
}

// ===========================================================================
// Network
// ===========================================================================
// Outbound proxy: Node's GLOBAL fetch does NOT honor a `dispatcher` option (and its
// built-in undici is a different instance than the npm one, so setGlobalDispatcher on the
// installed undici wouldn't reach it either). So when a proxy is set we call the installed
// undici's OWN fetch with a ProxyAgent dispatcher — that pairing is guaranteed to use it.
// Imported lazily so the probe (and --selfcheck) need undici ONLY when HTTP_PROXY is set.
let proxyFetch;
if (HTTP_PROXY && !HTTP_PROXY.startsWith("<")) {
  const undici = await import("undici");
  const dispatcher = new undici.ProxyAgent(HTTP_PROXY);
  proxyFetch = (url, init) => undici.fetch(url, { ...init, dispatcher });
}

async function httpGet(url, headers) {
  try {
    const doFetch = proxyFetch ?? fetch;
    const r = await doFetch(url, { method: "GET", headers });
    return { status: r.status, body: await r.text() };
  } catch (e) {
    process.stderr.write(`  ! network error: ${e.code ? e.code + " " : ""}${e.message}\n`);
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
// Per-parser probes. Output is intentionally short: one current mirror, one candidate, one next focus.
// ===========================================================================
async function probeConfluence() {
  const t = TARGETS.confluence;
  const { status, html, meta } = await fetchConfluenceStorage(t.pageId, t.site ?? CONFLUENCE);
  if (status !== 200) return { parser: "confluence", http: status, ...meta };
  const dom = probeDom(html);
  const match = dom.headings.find((h) => h.slug === t.anchorLocator);
  // candidate = the proposed fix: slugify the locator before matching.
  const normalizedMatch = dom.headings.find((h) => h.slug === normalizeLocator(t.anchorLocator));
  const matchedEl = parse(html)
    .querySelectorAll("h1, h2, h3, h4, h5, h6")
    .find((el) => slugify(el.text) === normalizeLocator(t.anchorLocator));
  const candidateSectionSample = matchedEl
    ? sample(siblingSectionNodes(matchedEl, true).map((n) => n.text).join(" "))
    : undefined;
  const headingCandidates = dom.headings.map((h) => ({
    locator: h.slug,
    level: h.level,
    sample_text: sample(h.text),
    current_len: h.section_sibling_text_len,
    level_aware_len: h.section_level_aware_text_len,
  }));
  const best = bestCandidate(headingCandidates, t.anchorLocator);
  return {
    parser: "confluence",
    source: { http: status, version: meta.version, html_bytes: meta.html_bytes },
    target: { locator: t.anchorLocator, valid_shape: Boolean(t.anchorLocator) && !t.anchorLocator.startsWith("#") },
    current_mirror: {
      locator_matched: Boolean(match),
      section_text_len: match?.section_sibling_text_len ?? 0,
      resolves: Boolean(match) && match.section_sibling_text_len > 0,
    },
    candidate_method: "slugify the anchor locator before matching, then stop the section at a same-or-higher heading (level-aware)",
    candidate_result: {
      locator_matched: Boolean(normalizedMatch),
      section_text_len: normalizedMatch?.section_level_aware_text_len ?? 0,
      resolves: Boolean(normalizedMatch) && normalizedMatch.section_level_aware_text_len > 0,
      section_sample: candidateSectionSample, // drop once chapter text is confirmed
    },
    shape: { heading_count: dom.headings.length, wrapped_heading_count: dom.headings.filter((h) => h.wrapped).length },
    best_locator_candidate: best,
    remaining_gap: normalizedMatch ? (normalizedMatch.section_level_aware_text_len > 0 ? "slugified locator resolves; current parser fails only for lack of slugify" : "locator matches but section text is still empty") : "target locator does not match any heading slug even after slugify",
    next_spike_focus: normalizedMatch ? "confirm section_sample is the intended chapter" : "compare target locator to best heading candidate; the page target may be wrong",
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
  const slug = locator.replace(/^#/, "");                 // current TS: strips # only, NOT slugified
  const candidateSlug = slugify(slug);                    // proposed fix: slugify the locator -> "Module Usage" => "module-usage"
  const section = valid ? terraformExtractSectionText(markdown, slug) : undefined;
  const slugs = markdown.split(/\r?\n/).map((l) => l.match(/^#{1,6}\s+(.*)$/)).filter(Boolean).map((m) => slugify(m[1]));
  const realHeadings = markdownHeadings(markdown, true);
  const sectionLevelAware = valid ? markdownExtractSectionTextLevelAware(markdown, candidateSlug) : undefined;
  const headingCandidates = realHeadings.map((h) => ({ locator: `#${h.slug}`, line: h.line, level: h.level, sample_text: sample(h.text) }));
  const best = bestCandidate(headingCandidates, locator);
  return {
    parser: "terraform",
    source: { http: mod.status, registry: mod.registry, readme_field: mod.readme_field, version: mod.resolved_version, markdown_bytes: Buffer.byteLength(markdown) },
    target: { locator, valid_shape: valid },
    current_mirror: {
      locator_matched: section !== undefined || slugs.includes(slug),
      section_text_len: section ? section.length : 0,
      resolves: section !== undefined,
    },
    candidate_method: "slugify the anchor locator before matching, then level-aware section boundary",
    candidate_result: {
      locator_matched: realHeadings.some((h) => h.slug === candidateSlug),
      section_text_len: sectionLevelAware ? sectionLevelAware.length : 0,
      resolves: sectionLevelAware !== undefined,
      section_sample: sectionLevelAware ? sample(sectionLevelAware) : undefined, // drop once confirmed
    },
    shape: { heading_count: slugs.length, submodule_count: mod.submodule_count, inputs: mod.input_count, outputs: mod.output_count, providers: mod.provider_count },
    best_locator_candidate: best,
    remaining_gap: sectionLevelAware ? "slugified locator resolves; current parser fails only for lack of slugify" : realHeadings.some((h) => h.slug === candidateSlug) ? "locator matches but candidate section is empty" : "target locator does not match README headings even after slugify",
    next_spike_focus: sectionLevelAware ? "confirm section_sample is the intended anchor scope" : "verify target locator against best heading candidate",
  };
}

/**
 * Policy is sourced from Confluence — possibly a DIFFERENT site (TARGETS.policy.site).
 * Probe heading/list sections directly; do not assume clause-* locator names.
 */
async function probePolicy() {
  const t = TARGETS.policy;
  const { status, html, meta } = await fetchConfluenceStorage(t.pageId, t.site ?? CONFLUENCE);
  if (status !== 200) return { parser: "policy", http: status, used_second_site: Boolean(t.site), ...meta };
  const dom = probeDom(html);
  const root = parse(html);
  const olItemCounts = root.querySelectorAll("ol").map((ol) => ol.querySelectorAll("li").length);
  const slugs = dom.headings.map((h) => h.slug);
  const candidates = policyCandidates(html, t.anchorLocator);
  const best = candidates.nearest_locator_candidates[0];
  const bestSectionWithItems = candidates.section_candidates.find((section) => section.item_count > 0);
  return {
    parser: "policy",
    source: { http: status, version: meta.version, html_bytes: meta.html_bytes, used_second_site: Boolean(t.site) },
    target: { locator: t.anchorLocator, valid_shape: Boolean(t.anchorLocator) && !t.anchorLocator.startsWith("<") },
    current_mirror: {
      heading_slug_matched: slugs.includes(t.anchorLocator),
      sibling_section_available: Boolean(dom.headings.find((h) => h.slug === t.anchorLocator)?.section_sibling_text_len),
    },
    candidate_method: "heading sections plus non-TOC ordered-list items; no clause-* assumption",
    candidate_result: {
      locator_matched: candidates.locator_matches_section_candidate,
      section_count: candidates.section_candidates.length,
      list_item_count: candidates.list_item_candidates.length,
      possible_toc_list_count: candidates.possible_toc_list_count,
    },
    shape: {
      heading_count: slugs.length,
      ordered_list_count: dom.ordered_list_count,
      list_item_count: dom.list_item_count,
      first_ol_item_count: olItemCounts[0] ?? 0,
      macro_names: dom.macroNames.join(", "),
    },
    best_locator_candidate: best ? {
      locator: best.locator,
      kind: best.kind,
      text: best.sample_text,
      distance: best.distance,
      exact: best.exact,
      contains: best.contains,
    } : undefined,
    first_section_with_items: bestSectionWithItems ? {
      locator: bestSectionWithItems.locator,
      heading: bestSectionWithItems.sample_heading,
      item_count: bestSectionWithItems.item_count,
      // first items of that section — confirm they are real policy clauses, not TOC/nav. Drop once confirmed.
      sample_items: candidates.list_item_candidates
        .filter((i) => i.section === bestSectionWithItems.locator)
        .slice(0, 3)
        .map((i) => i.sample_text),
    } : undefined,
    remaining_gap: candidates.locator_matches_section_candidate ? "candidate locator resolves" : "target locator does not match heading/list candidates",
    next_spike_focus: candidates.locator_matches_section_candidate ? "sample the matched policy section/list item text" : "verify locator naming against best section/list candidate",
  };
}

/**
 * Availability source is a Confluence page (HTML <table>), but the live TS parser
 * (parseMarkdownMatrix) expects a MARKDOWN pipe table. Proves the gap, measures
 * the table, and compares markdown-bridge vs direct HTML-table parsing.
 */
async function probeAvailability() {
  const t = TARGETS.availability;
  const { status, html, meta } = await fetchConfluenceStorage(t.pageId, t.site ?? CONFLUENCE);
  if (status !== 200) return { parser: "availability", http: status, ...meta };
  const root = parse(html);
  const tableEls = root.querySelectorAll("table");

  const biggestEl = tableEls.length
    ? tableEls.reduce((a, b) => (b.querySelectorAll("tr").length > a.querySelectorAll("tr").length ? b : a), tableEls[0])
    : undefined;
  const bridged = biggestEl ? parseMarkdownMatrix(htmlTableToMarkdown(biggestEl)) : undefined;
  const direct = parseAvailabilityHtmlTable(biggestEl);
  const dataCells = biggestEl ? biggestEl.querySelectorAll("td") : [];
  const bridgeRow = bridged?.services.get((t.service || "").toLowerCase());
  const bridgeRegionKey = (t.region || "").toLowerCase();
  const directRow = direct?.services.get((t.service || "").toLowerCase());
  const directRegion = normalizeRegionKey(t.region || "");
  const directCell = directRow?.statuses.get(directRegion);
  // For every distinct emoticon marker, what status does parseAvailabilityStatusCell give it?
  // This is the open question ("verify mapping across non-tick markers"): each marker should
  // map to exactly one status, and no marker cell should land in UNMAPPED.
  const markerStatus = {};
  let unmappedMarkerCells = 0;
  let unmappedMarkerSample;
  for (const td of dataCells) {
    const names = td.querySelectorAll("ac\\:emoticon").map((e) => e.getAttribute("ac:name")).filter(Boolean);
    if (!names.length) continue;
    const mapped = parseAvailabilityStatusCell(td)?.status ?? "UNMAPPED";
    for (const n of names) {
      const byStatus = (markerStatus[n] ??= {});
      byStatus[mapped] = (byStatus[mapped] ?? 0) + 1;
    }
    if (mapped === "UNMAPPED") { unmappedMarkerCells += 1; unmappedMarkerSample ??= sample(td.innerHTML); }
  }

  return {
    parser: "availability",
    source: { http: status, version: meta.version, html_bytes: meta.html_bytes },
    target: { service: t.service, region: t.region, normalized_region: directRegion },
    // markdown bridge is settled-broken: it structurally parses but the emoticon cells
    // collapse to empty text, so it keeps no status. Two booleans document why we abandoned it.
    current_mirror: {
      bridge_parses: bridged !== undefined,
      bridge_keeps_status: Boolean(bridgeRow?.statuses.has(bridgeRegionKey)),
    },
    candidate_method: "parse Confluence HTML table directly: normalize region header, skip category rows, map ac:emoticon/text to status",
    candidate_result: {
      parses: direct !== undefined,
      service_count: direct?.services.size ?? 0,
      skipped_empty_or_group_rows: direct?.skipped.length ?? 0,
      probe_service_present: Boolean(directRow),
      probe_cell_status: directCell?.status,
      probe_cell_note: directCell?.note,
      marker_status: markerStatus,                 // {tick:{available:N}, "blue-star":{...}} — confirm each marker's semantics
      unmapped_marker_cells: unmappedMarkerCells,  // >0 means a status marker we don't recognize yet
      unmapped_marker_sample: unmappedMarkerSample,
    },
    shape: {
      html_table_count: tableEls.length,
      status_cells_with_emoticon: dataCells.filter((td) => td.querySelector("ac\\:emoticon")).length,
    },
    remaining_gap: directCell ? "candidate resolves target cell" : directRow ? "candidate finds service but not target region/status" : "candidate does not find target service",
    next_spike_focus: unmappedMarkerCells > 0 ? "define status for the unmapped marker(s) in marker_status" : directCell ? "confirm blue-star semantics with product (interim?), then this parser is done" : "sample unmatched target row/header enough to refine normalization",
  };
}

/**
 * Release notes are a Confluence page resolved through the SAME storage channel,
 * then renderStorageHtml() -> parseReleaseNotes(). This probe runs that whole
 * pipeline live and compares the current renderer/parser with the candidate renderer/parser.
 */
async function probeReleaseNotes() {
  const t = TARGETS.releaseNotes;
  const { status, html, meta } = await fetchConfluenceStorage(t.pageId, t.site ?? CONFLUENCE);
  if (status !== 200) return { parser: "releaseNotes", http: status, ...meta };
  const rendered = renderStorageHtml(html);
  const releases = parseReleaseNotes(rendered);
  const candidateRendered = renderStorageHtmlCandidate(html);
  const candidateReleases = parseReleaseNotesCandidate(candidateRendered);
  const dom = probeDom(html);
  const current = releaseSummary(rendered, releases);
  const candidate = releaseSummary(candidateRendered, candidateReleases);
  // The first_item {category:"Non-Compute", title:"Compute"} looks like a category/item
  // boundary miss. Show the raw rendered lines of the first scope region next to the first
  // few parsed items so the next round can SEE whether "Compute" lost its colon / got numbered.
  // Drop this whole block once boundaries are confirmed.
  const candLines = candidateRendered.split("\n");
  const scopeStart = candLines.findIndex((l) => /nature of changes/i.test(l));
  const boundary_probe = {
    scope_lines: scopeStart >= 0 ? candLines.slice(scopeStart, scopeStart + 12).map((l) => sample(l, 90)) : [],
    first_items: candidateReleases.flatMap((r) => r.items).slice(0, 4).map((i) => ({ category: i.category, title: sample(i.title, 60), ticket: i.ticket })),
  };
  return {
    parser: "releaseNotes",
    source: { http: status, version: meta.version, html_bytes: meta.html_bytes },
    current_mirror: current,
    candidate_method: "render direct list-item text before nested lists, then parse Release Scope/Nature of Changes with category+item tolerance",
    candidate_result: candidate,
    boundary_probe,
    shape: {
      storage_ordered_lists: dom.ordered_list_count,
      storage_list_items: dom.list_item_count,
      wrapped_heading_count: dom.headings.filter((h) => h.wrapped).length,
    },
    remaining_gap: candidate.total_items > 0 ? "candidate extracts items, but check boundary_probe: first_items may show a category parsed as an item" : current.gate !== candidate.gate ? "candidate changes render gates but still extracts no items" : "candidate still has no item extraction",
    next_spike_focus: candidate.total_items > 0 ? "read boundary_probe.scope_lines vs first_items to fix the category/item rule (colon-less or numbered category)" : "sample first candidate-rendered block around Nature of Changes and first list",
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
  ok(fenceAwareHeadings("# Real\n```\n# fake\n```\n## Also").length === 2, "terraform: fence-aware headings skip code fences");
  ok(markdownExtractSectionTextLevelAware("# T\n## Usage\nx\n### Child\ny\n## Inputs\nz", "usage").includes("### Child"), "terraform: level-aware section includes child headings");

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
  const liveLikeTable = parse('<table><tr><td>Service</td><td>US-EAST-1 (North Virginia)</td></tr><tr><td>Storage</td><td></td></tr><tr><td>S3</td><td><ac:emoticon ac:name="tick"/></td></tr></table>').querySelector("table");
  const direct = parseAvailabilityHtmlTable(liveLikeTable);
  ok(direct.services.size === 1 && direct.skipped.length === 1, "availability: direct parser skips group rows");
  ok(direct.services.get("s3").statuses.get("us-east-1").status === "available", "availability: direct parser maps tick + normalized region");

  // releaseNotes: storage HTML -> renderStorageHtml -> parseReleaseNotes
  const relHtml = "<h2>Release Notes</h2><p>Nature of Changes</p><p>Compute:</p>" +
    "<ol><li>Upgrade the runtime PLAT-1574</li></ol><p>Posted on 12th May, 2026 CHG1052711</p>";
  const rels = parseReleaseNotes(renderStorageHtml(relHtml));
  ok(rels.length === 1 && rels[0].items.length === 1, "release parses one item");
  ok(rels[0].items[0].ticket === "PLAT-1574", "release ticket extracted");
  ok(rels[0].changeRequest === "CHG1052711" && rels[0].postedAt === "2026-05-12", "release CHG + date extracted");
  const g = rnGateProbe(renderStorageHtml(relHtml));
  ok(g.scope_line_hits === 1 && g.category_line_hits === 1 && g.numbered_line_hits === 1, "gate probe regexes track parseOneRelease sentinels");
  const nestedRelHtml = "<h2>Release Notes</h2><p>Nature of Changes</p><ol><li>Non-Compute:<ol><li>SCP: enable thing PLAT-200</li></ol></li></ol>";
  const candidateRels = parseReleaseNotesCandidate(renderStorageHtmlCandidate(nestedRelHtml));
  ok(candidateRels[0].items.length === 1 && candidateRels[0].items[0].category === "Non-Compute", "release candidate parses nested category list");

  // --samples DOM ops (network-only in probes) must not throw on representative fragments
  ok(probeDom("<h2>Hi</h2>").headings[0].text === "Hi", "probeDom exposes raw heading text for samples");
  const cellHtml = '<table><tr><td>S3</td><td><ac:structured-macro ac:name="status"><ac:parameter ac:name="title">Available</ac:parameter></ac:structured-macro></td></tr></table>';
  const mc = parse(cellHtml).querySelectorAll("td").find((td) => td.querySelector("ac\\:structured-macro"));
  ok(mc && /status/.test(mc.innerHTML), "samples: macro status cell located via querySelectorAll().find + innerHTML");
  ok(Boolean(parse("<ol><li>a</li></ol>").querySelector("ol, ul")), "samples: comma selector resolves first list");
  const policyHtml = "<ac:layout><ac:layout-cell><h1>Summary</h1><ol><li>Summary</li><li>Scope</li><li>Baselines</li></ol><h1>Scope</h1><p>scope text</p><h1>Baselines:</h1><p>intro</p><ol><li>First rule</li><li>Second rule</li></ol></ac:layout-cell></ac:layout>";
  const pc = policyCandidates(policyHtml, "baselines#item-1");
  ok(pc.possible_toc_list_count === 1 && pc.locator_matches_section_candidate, "policy: section/list candidates do not assume clause-*");

  console.log("selfcheck: OK");
  return 0;
}

// ===========================================================================
async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--selfcheck")) return selfcheck();
  const which = argv.find((a) => a in PROBES) || "all";
  const names = which === "all" ? Object.keys(PROBES) : [which];
  const out = {};
  for (const name of names) {
    try {
      out[name] = await PROBES[name]();
    } catch (e) {
      out[name] = { parser: name, spike_error: String(e?.message || e) };
    }
  }
  console.log(JSON.stringify(out, (_k, val) => (val instanceof Map ? `Map(${val.size})` : val)));
  return 0;
}

process.exit(await main());
