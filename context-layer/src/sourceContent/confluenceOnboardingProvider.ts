/**
 * Live Confluence onboarding-guidance source — the `html → parser → schema →
 * stepper` pipeline for the new-application onboarding journey.
 *
 * The onboarding page is an orientation hub: `<h1>` sections, each holding
 * `<h2>` sub-topics of prose, deeply nested lists, and typed links. The journey
 * is a flat, CHECKABLE task list — each actionable leaf a task with a verb-rule
 * ACTION button (Open / View / Contact), the way the retired page-properties
 * provider typed a list item's `<a href>`. So the mapping flattens by shape:
 *   - each `<h1>` becomes a STEP (its heading the step title; its intro prose
 *     the step description),
 *   - each `<h2>` becomes a task GROUP (its heading the label; its intro prose
 *     the group description), and
 *   - the link-bearing leaves beneath it — top-level `<li>`s of a list, and
 *     paragraphs that carry a link — each become a TASK. A task's title is its
 *     lead text (or the referenced page's title); its link becomes a typed
 *     `action` (external / tool / support by host, `mailto:` → contact, and a
 *     Confluence-page reference → a wiki title search, since storage carries no
 *     URL); and its nested content (sub-lists, further prose, images) is kept
 *     verbatim as the task's `detail` so nothing on the page is lost. Prose with
 *     NO link is CONTEXT — the step's or group's description, never a task.
 *
 * The governance metadata a prose page cannot carry (id, scenario, family,
 * objective, owner, destination, status, version) is an authored OVERLAY here —
 * dev=prod config, the same principle as the landing-zone topology — never
 * synthesized from the page nor faked into a properties table. The parser stays
 * a pure content function; the overlay supplies identity + governance.
 *
 * One source among several: the portal loader merges this with the guidance
 * store. Public-safe — no real page ids / credentials; all injected via config.
 */
import {
  GuidanceSchema,
  type Guidance,
  type GuidanceAction,
  type GuidanceActionType,
  type GuidanceBlock,
  type GuidanceListItem,
  type GuidanceSpan,
} from "@atlas/schema";
import { HTMLElement, Node, NodeType, parse } from "node-html-parser";
import type { FetchLike } from "../resolvers/resolverTypes";
import {
  fetchConfluenceStorageHtml,
  type ConfluenceLiveConfig,
} from "./confluenceCloudContentProvider";

export type ConfluenceOnboardingConfig = ConfluenceLiveConfig & {
  /** Page id of the onboarding journey authored in Confluence. */
  pageId: string;
};

export type ConfluenceOnboardingDeps = {
  fetch: FetchLike;
  /** Sink for a skipped (unreachable/non-conforming) page — defaults to no-op. */
  onSkip?: (skip: { pageId: string; reason: string }) => void;
};

/**
 * Authored governance overlay for the onboarding journey. Everything the prose
 * page cannot express lives here (dev=prod). Merged with the parsed steps to
 * form the manifest the schema validates. Fictional, public-safe.
 */
const ONBOARDING_OVERLAY = {
  id: "new-app-onboarding",
  title: "New Application Onboarding",
  scenario: "onboarding",
  family: "onboard",
  objective:
    "Get a new application team oriented onto the standard cloud platform — from foundational training and access through deployment, services, and support.",
  destination: {
    title: "Onboarded to the standard cloud platform",
    description:
      "The team has completed training, holds account access, and knows the deployment, services, and support paths.",
  },
  owner: { team: "Cloud Platform", support: "cloud-platform-support" },
  status: "published",
  version: "1.0.0",
  last_reviewed: "2026-06-30",
} as const;

/**
 * Parse the onboarding page's storage HTML + overlay into a guidance manifest
 * (snake_case, schema-shaped). Pure and fs-free — the golden test and the live
 * source both call it, so render/parse round-trips are asserted once.
 */
export function buildOnboardingManifest(html: string, baseUrl?: string): Record<string, unknown> {
  const steps = parseOnboardingPage(html, baseUrl).map((section) => ({
    id: section.id,
    title: section.title,
    ...(section.description ? { description: section.description } : {}),
    ...(section.groups.length > 0
      ? {
          groups: section.groups.map((group) => ({
            label: group.label,
            ...(group.description ? { description: group.description } : {}),
          })),
        }
      : {}),
    ...(section.tasks.length > 0 ? { tasks: section.tasks.map(serializeTask) } : {}),
  }));
  return { ...ONBOARDING_OVERLAY, steps };
}

/** An OnboardingTask → its schema-shaped object, recursively for sub-tasks. */
function serializeTask(task: OnboardingTask): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title,
    ...(task.group ? { group: task.group } : {}),
    ...(task.action ? { action: task.action } : {}),
    ...(task.detail && task.detail.length > 0 ? { detail: task.detail } : {}),
    ...(task.subtasks && task.subtasks.length > 0
      ? { subtasks: task.subtasks.map(serializeTask) }
      : {}),
  };
}

/** Build the onboarding guidance source: fetch the page, parse it, validate it. */
export function createOnboardingGuidanceSource(
  config: ConfluenceOnboardingConfig,
  deps: ConfluenceOnboardingDeps,
): { load(): Promise<Guidance[]> } {
  const onSkip = deps.onSkip ?? (() => {});
  return {
    async load(): Promise<Guidance[]> {
      const fetched = await fetchConfluenceStorageHtml(
        { fetch: deps.fetch },
        { token: config.token, baseUrl: config.baseUrl, email: config.email },
        config.pageId,
      );
      if (!fetched.ok) {
        onSkip({ pageId: config.pageId, reason: fetched.message });
        return [];
      }
      const manifest = buildOnboardingManifest(fetched.html, config.baseUrl);
      const validated = GuidanceSchema.safeParse(manifest);
      if (!validated.success) {
        onSkip({
          pageId: config.pageId,
          reason: validated.error.issues[0]?.message ?? "schema validation failed",
        });
        return [];
      }
      return [validated.data];
    },
  };
}

/* -------------------------------------------------------------------------- *
 * Parser — storage HTML → onboarding sections (h1 = step, h2 = group,          *
 * actionable leaves = tasks)                                                    */

export type OnboardingTask = {
  id: string;
  title: string;
  /** The `<h2>` sub-header this task sits under (absent for pre-`<h2>` leaves). */
  group?: string;
  /** The task's primary action (a Confluence ref links to a wiki title search). */
  action?: GuidanceAction;
  /** The leaf's non-actionable detail below the title (link-less sub-lists, prose). */
  detail?: GuidanceBlock[];
  /** Nested checkable sub-tasks — a source list's actionable items, recursively. */
  subtasks?: OnboardingTask[];
};
/** A `<h2>` sub-header: its label and any intro prose that describes the cluster. */
export type OnboardingGroup = { label: string; description?: string };
export type OnboardingSection = {
  id: string;
  title: string;
  /** The `<h1>` intro prose (context before the first task / `<h2>`). */
  description?: string;
  groups: OnboardingGroup[];
  tasks: OnboardingTask[];
};

/**
 * Walk the flat page: `<h1>` opens a step, `<h2>` opens a group, and beneath
 * them each LINK-BEARING leaf becomes a task — a list's top-level `<li>`s, and a
 * paragraph that carries a link (external, email, or a Confluence-page reference,
 * which links to a title search). Prose with NO link is context: it becomes the
 * step's or group's `description`, not a task. The leading TOC macro / empty
 * `<p>` before the first `<h1>` are skipped. `baseUrl` (the Confluence site)
 * builds absolute targets for page references; omit it in pure tests.
 */
export function parseOnboardingPage(html: string, baseUrl?: string): OnboardingSection[] {
  const root = parse(html);
  const sections: OnboardingSection[] = [];
  const usedStepIds = new Set<string>();
  let current: OnboardingSection | null = null;
  let usedTaskIds = new Set<string>();
  let group: OnboardingGroup | undefined;
  let groupTaskCount = 0;

  // The first intro paragraph before a step's / group's first task describes it.
  const noteIntro = (text: string) => {
    if (!text || !current) return;
    if (group) {
      if (!group.description && groupTaskCount === 0) group.description = text;
    } else if (!current.description && current.tasks.length === 0) {
      current.description = text;
    }
  };

  for (const node of root.childNodes) {
    if (!isTag(node)) continue;
    const tag = tagName(node);
    if (tag === "h1") {
      const title = collapse(node.text);
      if (!title) continue;
      current = { id: uniqueId(slugify(title), usedStepIds), title, groups: [], tasks: [] };
      usedTaskIds = new Set();
      group = undefined;
      groupTaskCount = 0;
      sections.push(current);
      continue;
    }
    if (!current) continue; // content before the first <h1> (TOC, empty <p>)
    if (tag === "h2") {
      const label = collapse(node.text);
      group = label ? { label } : undefined;
      groupTaskCount = 0;
      if (group) current.groups.push(group);
      continue;
    }
    if (tag === "p") {
      const spans = inlineSpans(node);
      const linkSpan = spans.find((span) => span.link);
      const action = actionFromSpan(linkSpan, baseUrl);
      if (action) {
        const fullText = collapse(node.text);
        const title = titleFrom(fullText, linkSpan, group?.label, "link");
        // Keep the whole sentence as detail when it adds context beyond the title
        // (skip it when the title already IS the sentence — no point repeating).
        const hasProse = spans.some((span) => !span.link && span.text.trim().length > 0);
        const detail = hasProse && fullText !== title ? [{ kind: "prose", spans } as const] : [];
        current.tasks.push({
          id: uniqueId(slugify(title) || "task", usedTaskIds),
          title,
          ...(group ? { group: group.label } : {}),
          action,
          ...(detail.length > 0 ? { detail } : {}),
        });
        if (group) groupTaskCount += 1;
      } else {
        noteIntro(collapse(node.text)); // plain prose or a Confluence-ref → context
      }
      continue;
    }
    if (tag === "ul" || tag === "ol") {
      for (const li of directChildren(node, "li")) {
        current.tasks.push(taskFromListItem(li, group?.label, usedTaskIds, baseUrl));
        if (group) groupTaskCount += 1;
      }
    }
    // other nodes (sub-headings, images, stray macros) → ignored
  }

  // Drop an empty `<h2>` (neither a description nor any task under it).
  for (const section of sections) {
    const grouped = new Set(section.tasks.map((task) => task.group));
    section.groups = section.groups.filter((g) => g.description || grouped.has(g.label));
  }
  return sections;
}

/**
 * A `<li>` → a task node, mirroring the source list tree: its lead text is the
 * title, the link in its OWN lead the action, and its children split by shape —
 * a nested list that contains a link becomes checkable `subtasks` (recursively);
 * a link-less nested list (bare labels like group names) and any further prose
 * become non-actionable `detail`. Deep links belong to sub-tasks, not the parent.
 */
function taskFromListItem(
  li: HTMLElement,
  group: string | undefined,
  usedTaskIds: Set<string>,
  baseUrl: string | undefined,
): OnboardingTask {
  const lead: GuidanceSpan[] = [];
  const detail: GuidanceBlock[] = [];
  const subtasks: OnboardingTask[] = [];
  let leadDone = false;
  const inBody = () => leadDone || detail.length > 0 || subtasks.length > 0;

  for (const node of li.childNodes) {
    if (isText(node)) {
      if (!inBody() && node.text.trim()) lead.push({ text: node.text });
      continue;
    }
    if (!isTag(node)) continue;
    const tag = tagName(node);
    if (tag === "ul" || tag === "ol") {
      leadDone = true;
      if (listContainsLink(node)) {
        for (const sub of directChildren(node, "li")) {
          subtasks.push(taskFromListItem(sub, undefined, usedTaskIds, baseUrl));
        }
      } else {
        const block = listBlock(node, tag === "ol");
        if (block) detail.push(block);
      }
    } else if (tag === "ac:image") {
      leadDone = true;
      const img = imageBlock(node);
      if (img) detail.push(img);
    } else if (tag === "p") {
      if (!inBody()) {
        collectInline(node, lead);
        leadDone = true;
      } else {
        const spans = inlineSpans(node);
        if (spans.length > 0) detail.push({ kind: "prose", spans });
      }
    } else if (!inBody()) {
      collectInline(node, lead); // bare inline (a / ac:link / strong / …) → lead
    }
  }

  const leadSpans = normalizeSpans(lead);
  const linkSpan = leadSpans.find((span) => span.link); // OWN lead link only
  const title = titleFrom(
    collapse(leadSpans.map((s) => s.text).join(" ")),
    linkSpan,
    group,
    "lead",
  );
  const action = actionFromSpan(linkSpan, baseUrl);
  return {
    id: uniqueId(slugify(title) || "task", usedTaskIds),
    title,
    ...(group ? { group } : {}),
    ...(action ? { action } : {}),
    ...(detail.length > 0 ? { detail } : {}),
    ...(subtasks.length > 0 ? { subtasks } : {}),
  };
}

/** Whether an element contains any typed link anywhere in its subtree. */
function listContainsLink(el: HTMLElement): boolean {
  return firstLinkSpan(el) !== undefined;
}

/**
 * Pick a task title. `prefer` chooses whether the item's own text or the link's
 * anchor text wins when both read as labels; the other, then the group heading,
 * then any remaining text, are fallbacks. Always non-empty for the schema.
 */
function titleFrom(
  text: string,
  linkSpan: GuidanceSpan | undefined,
  group: string | undefined,
  prefer: "lead" | "link",
): string {
  const linkText = spanLabel(linkSpan);
  const textOk = Boolean(text) && !isWeakLabel(text);
  const linkOk = Boolean(linkText) && !isWeakLabel(linkText);
  const ordered =
    prefer === "link"
      ? [linkOk && linkText, group, textOk && text]
      : [textOk && text, linkOk && linkText, group];
  return (
    ordered.find((candidate): candidate is string => Boolean(candidate)) ||
    text ||
    linkText ||
    "Task"
  );
}

/** A weak, non-descriptive label — a bare URL or a pronoun-y anchor ("here"). */
function isWeakLabel(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t === "" || /^https?:\/\//.test(t) || /^(the\s+)?(here|there|this|link|this link)$/.test(t)
  );
}

/* -------------------------------------------------------------------------- *
 * Detail blocks — a leaf's full nested content (prose, sub-lists, links, images) */

/** Convert one content node into a block (or nothing). `<h1>`/`<h2>` never reach
 *  here — they are step / group boundaries handled in {@link parseOnboardingPage}. */
function blockFromNode(el: HTMLElement, tag: string): GuidanceBlock | null {
  if (/^h[3-6]$/.test(tag)) {
    const text = collapse(el.text);
    return text ? { kind: "heading", text } : null;
  }
  if (tag === "p") {
    const spans = inlineSpans(el);
    return spans.length > 0 ? { kind: "prose", spans } : null;
  }
  if (tag === "ul" || tag === "ol") return listBlock(el, tag === "ol");
  if (tag === "ac:image") return imageBlock(el);
  return null; // stray macro / unknown → dropped
}

/** A `<ul>`/`<ol>` → a list block; each direct `<li>` → an item (recursively). */
function listBlock(el: HTMLElement, ordered: boolean): GuidanceBlock | null {
  const items = directChildren(el, "li")
    .map(listItem)
    .filter((item): item is NonNullable<typeof item> => item !== null);
  return items.length > 0 ? { kind: "list", ordered, items } : null;
}

/**
 * A `<li>` → its lead inline text (`spans`) plus any nested blocks (sub-lists,
 * further paragraphs, an image). The first paragraph is the lead; everything
 * after is nested — so list nesting and prose are preserved.
 */
function listItem(li: HTMLElement): GuidanceListItem | null {
  const lead: GuidanceSpan[] = [];
  const blocks: GuidanceBlock[] = [];
  let leadDone = false;

  for (const node of li.childNodes) {
    if (isText(node)) {
      if (!leadDone && blocks.length === 0 && node.text.trim()) lead.push({ text: node.text });
      continue;
    }
    if (!isTag(node)) continue;
    const tag = tagName(node);
    if (tag === "ul" || tag === "ol") {
      const list = listBlock(node, tag === "ol");
      if (list) blocks.push(list);
    } else if (tag === "ac:image") {
      const img = imageBlock(node);
      if (img) blocks.push(img);
    } else if (tag === "p") {
      if (!leadDone && blocks.length === 0) {
        collectInline(node, lead);
        leadDone = true;
      } else {
        const spans = inlineSpans(node);
        if (spans.length > 0) blocks.push({ kind: "prose", spans });
      }
    } else if (blocks.length === 0) {
      collectInline(node, lead); // bare inline (a / ac:link / strong / …) → lead
    }
  }

  const spans = normalizeSpans(lead);
  if (spans.length === 0 && blocks.length === 0) return null;
  return { spans, ...(blocks.length > 0 ? { blocks } : {}) };
}

/** An `<ac:image>` → an image reference (the attachment is not fetched). */
function imageBlock(el: HTMLElement): GuidanceBlock | null {
  const attachment = findByTag(el, "ri:attachment");
  const filename = (attachment?.getAttribute("ri:filename") ?? "").trim();
  if (!filename) return null;
  const alt = (el.getAttribute("ac:alt") ?? "").trim();
  return { kind: "image", filename, ...(alt && alt !== filename ? { alt } : {}) };
}

/** The first typed link anywhere in an element (depth-first), text included. */
function firstLinkSpan(el: HTMLElement): GuidanceSpan | undefined {
  for (const node of el.childNodes) {
    if (!isTag(node)) continue;
    const tag = tagName(node);
    if (tag === "a") {
      const span = anchorSpan(node);
      if (span?.link) return span;
    } else if (tag === "ac:link") {
      const span = confluenceLinkSpan(node);
      if (span?.link) return span;
    } else {
      const nested = firstLinkSpan(node);
      if (nested) return nested;
    }
  }
  return undefined;
}

/**
 * A typed link → a verb-rule action, the way the retired page-properties parser
 * typed an `<a href>`: relative path → atlas_page, known tool/support host →
 * tool_link / support_link, `mailto:` → contact (support_link), else external.
 * A Confluence-internal page reference carries no URL in storage, so it links to
 * a title search on the wiki — a real, best-effort way to reach the named page.
 */
function actionFromSpan(
  span: GuidanceSpan | undefined,
  baseUrl: string | undefined,
): GuidanceAction | undefined {
  const link = span?.link;
  if (!link) return undefined;
  if (link.kind === "email") {
    return { type: "support_link", label: "Contact", target: `mailto:${link.address}` };
  }
  if (link.kind === "external") {
    const type = actionTypeForHref(link.url);
    return { type, label: ACTION_VERB[type], target: link.url };
  }
  return {
    type: "external_link",
    label: "Open",
    target: confluencePageSearchUrl(baseUrl, link.title),
  };
}

/** A wiki title-search URL for a referenced Confluence page (no id in storage). */
function confluencePageSearchUrl(baseUrl: string | undefined, title: string): string {
  const base = (baseUrl ?? "").replace(/\/+$/, "");
  return `${base}/wiki/search?text=${encodeURIComponent(title)}`;
}

/** The best human label of a span: a referenced page's title beats "here"-style
 *  anchor text; otherwise the anchor text itself. */
function spanLabel(span: GuidanceSpan | undefined): string {
  if (!span) return "";
  if (span.link?.kind === "confluence-page") return span.link.title;
  return collapse(span.text);
}

const ACTION_VERB: Record<GuidanceActionType, string> = {
  atlas_page: "View",
  external_link: "Open",
  tool_link: "Open",
  source_link: "View",
  support_link: "Contact",
  copy_text: "Copy",
};

/** Type an external href by shape/host, mirroring the retired guidance parser. */
function actionTypeForHref(href: string): GuidanceActionType {
  if (href.startsWith("/")) return "atlas_page";
  if (/(?:tfe|terraform|registry|harness|github|gitlab|jenkins)\b/i.test(href)) return "tool_link";
  if (/(?:slack|teams|servicedesk|jira|support)\b/i.test(href)) return "support_link";
  return "external_link";
}

/* -------------------------------------------------------------------------- *
 * Inline spans — text runs + typed links, formatting flattened                 */

/** Collect the inline spans of an element (paragraph or formatting wrapper). */
function inlineSpans(el: HTMLElement): GuidanceSpan[] {
  const spans: GuidanceSpan[] = [];
  collectInline(el, spans);
  return normalizeSpans(spans);
}

/** Walk childNodes, appending text/link runs; recurse through formatting tags. */
function collectInline(el: HTMLElement, out: GuidanceSpan[]): void {
  for (const node of el.childNodes) {
    if (isText(node)) {
      if (node.text) out.push({ text: node.text });
      continue;
    }
    if (!isTag(node)) continue;
    const tag = tagName(node);
    if (tag === "a") {
      const span = anchorSpan(node);
      if (span) out.push(span);
    } else if (tag === "ac:link") {
      const span = confluenceLinkSpan(node);
      if (span) out.push(span);
    } else if (tag === "ac:image" || tag === "br") {
      // Inline images / line breaks carry no inline text — skip (block-level
      // images are handled by blockFromNode).
    } else {
      // strong / u / em / span / … — drop the formatting, keep the content.
      collectInline(node, out);
    }
  }
}

/** An `<a href>` → an external or email link span (or plain text if no href). */
function anchorSpan(a: HTMLElement): GuidanceSpan | null {
  const href = (a.getAttribute("href") ?? "").trim();
  const text = collapse(a.text);
  const label = text || href;
  if (!label) return null;
  if (!href) return { text: label };
  if (/^mailto:/i.test(href)) {
    return { text: label, link: { kind: "email", address: href.replace(/^mailto:/i, "") } };
  }
  return { text: label, link: { kind: "external", url: href } };
}

/** An `<ac:link><ri:page>` → a confluence-page reference span (no URL). */
function confluenceLinkSpan(acLink: HTMLElement): GuidanceSpan | null {
  const page = findByTag(acLink, "ri:page");
  const title = (page?.getAttribute("ri:content-title") ?? "").trim();
  const space = (page?.getAttribute("ri:space-key") ?? "").trim();
  const body = findByTag(acLink, "ac:link-body");
  const text = collapse(body?.text ?? "") || title;
  if (!text) return null;
  if (!title) return { text }; // not a page ref (attachment/user/…) — plain text
  return { text, link: { kind: "confluence-page", title, ...(space ? { space } : {}) } };
}

/**
 * Normalize a span run: collapse internal whitespace, merge adjacent plain runs,
 * trim the outer edges, and drop empties — so links keep their exact display
 * text while surrounding prose reads as a clean sentence.
 */
function normalizeSpans(spans: GuidanceSpan[]): GuidanceSpan[] {
  const collapsed = spans.map((s) =>
    s.link ? { text: collapse(s.text), link: s.link } : { text: s.text.replace(/\s+/g, " ") },
  );
  const merged: GuidanceSpan[] = [];
  for (const span of collapsed) {
    const prev = merged[merged.length - 1];
    if (prev && !prev.link && !span.link) prev.text += span.text;
    else merged.push({ ...span });
  }
  const first = merged[0];
  if (first && !first.link) first.text = first.text.replace(/^\s+/, "");
  const last = merged[merged.length - 1];
  if (last && !last.link) last.text = last.text.replace(/\s+$/, "");
  return merged.filter((s) => s.text.length > 0);
}

/* -------------------------------------------------------------------------- *
 * Small DOM + string helpers                                                   */

function isTag(node: Node): node is HTMLElement {
  return node.nodeType === NodeType.ELEMENT_NODE;
}

function isText(node: Node): boolean {
  return node.nodeType === NodeType.TEXT_NODE;
}

function tagName(el: HTMLElement): string {
  return (el.rawTagName ?? "").toLowerCase();
}

/** Direct element children of `el` with the given (lowercased) tag name. */
function directChildren(el: HTMLElement, tag: string): HTMLElement[] {
  return el.childNodes.filter((n): n is HTMLElement => isTag(n) && tagName(n) === tag);
}

/** First descendant element with the given tag name (namespaced tags included). */
function findByTag(el: HTMLElement, tag: string): HTMLElement | undefined {
  for (const node of el.childNodes) {
    if (!isTag(node)) continue;
    if (tagName(node) === tag) return node;
    const nested = findByTag(node, tag);
    if (nested) return nested;
  }
  return undefined;
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueId(base: string, used: Set<string>): string {
  let candidate = base || "section";
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}
