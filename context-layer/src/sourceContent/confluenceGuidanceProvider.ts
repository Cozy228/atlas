/**
 * Live Confluence guidance source — fetches SPECIFIC guidance pages by id and
 * parses each page's storage HTML into the flat `GuidanceSchema` manifest.
 *
 * Addressed by a configured page id, NOT a discovery crawl — the same shape as
 * availability / release-notes, because a guidance page is a known, authored
 * document, not a discovered set. Guidance as a whole is MULTI-SOURCE: the
 * onboarding journey is authored in Confluence and read here; other journeys
 * come from the guidance store (and may later be fetched from elsewhere, e.g.
 * GitHub). This is one source among several — the loader merges them.
 *
 * The authoring convention (what storage HTML the parser reads):
 *   1. A leading PAGE-PROPERTIES table (`<table>` of key/value rows) carries the
 *      strict metadata the schema requires: id, scenario, family, objective,
 *      owner team/support, status, version, last reviewed, destination title
 *      (+ optional destination description, applies-to.*, sources).
 *   2. Each `<h2>` after the table is a STEP (id = slug of the title). Under it:
 *        - the first non-"Why" `<p>` is the step description,
 *        - a `<p>` starting "Why…" is the step's `why`,
 *        - `<ul>/<ol>` items + `code` macros become tasks.
 *   3. A list item with an `<a href>` becomes a typed action (atlas_page for a
 *      relative path, tool_link for a known tool host, else external_link).
 *      A `code` macro becomes a copy_text task (its CDATA body is the payload).
 *      A "(required)" suffix marks a task required.
 *
 * Step kinds, decision branches, and a top-level renderer `type` are NOT modelled:
 * Confluence prose cannot carry them, so the journey stays flat and linear.
 *
 * Public-safe: no real page ids / credentials are baked in — all come from the
 * injected config. Server/Data Center is out of scope (Cloud only).
 */
import { GuidanceSchema, type Guidance } from "@atlas/schema";
import { parse, type HTMLElement } from "node-html-parser";
import type { FetchLike } from "../resolvers/resolverTypes";
import {
  confluenceAuthorization,
  type ConfluenceLiveConfig,
} from "./confluenceCloudContentProvider";

export type ConfluenceGuidanceConfig = ConfluenceLiveConfig & {
  /** Page ids of the guidance journeys authored in Confluence (e.g. onboarding). */
  pageIds: string[];
};

export type ConfluenceGuidanceDeps = {
  fetch: FetchLike;
  /** Sink for skipped (non-conforming/unreachable) pages — defaults to no-op. */
  onSkip?: (skip: { pageId: string; reason: string }) => void;
};

/** Build a guidance source that fetches each configured page id and parses it. */
export function createConfluenceGuidanceSource(
  config: ConfluenceGuidanceConfig,
  deps: ConfluenceGuidanceDeps,
): { load(): Promise<Guidance[]> } {
  const onSkip = deps.onSkip ?? (() => {});
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const authorization = confluenceAuthorization(config);

  async function fetchPage(pageId: string): Promise<{ title: string; html: string } | undefined> {
    const url = `${baseUrl}/wiki/api/v2/pages/${encodeURIComponent(pageId)}?body-format=storage`;
    try {
      const response = await deps.fetch(url, {
        method: "GET",
        headers: { Authorization: authorization, Accept: "application/json" },
      });
      if (!response.ok) {
        return undefined;
      }
      const page = (await response.json()) as ConfluencePageResponse;
      return { title: page.title ?? "", html: page.body?.storage?.value ?? "" };
    } catch {
      return undefined;
    }
  }

  return {
    async load(): Promise<Guidance[]> {
      const manifests: Guidance[] = [];
      const seen = new Set<string>();
      for (const pageId of config.pageIds) {
        const page = await fetchPage(pageId);
        if (!page) {
          onSkip({ pageId, reason: "guidance page unavailable" });
          continue;
        }
        const parsed = parseGuidancePage(page.title, page.html);
        if (!parsed.ok) {
          onSkip({ pageId, reason: parsed.reason });
          continue;
        }
        const validated = GuidanceSchema.safeParse(parsed.manifest);
        if (!validated.success) {
          onSkip({
            pageId,
            reason: validated.error.issues[0]?.message ?? "schema validation failed",
          });
          continue;
        }
        if (seen.has(validated.data.id)) {
          continue;
        }
        seen.add(validated.data.id);
        manifests.push(validated.data);
      }
      return manifests;
    },
  };
}

type ConfluencePageResponse = { title?: string; body?: { storage?: { value?: string } } };

/* -------------------------------------------------------------------------- *
 * Parser — storage HTML → snake_case guidance manifest                        */

export type GuidanceParse =
  | { ok: true; manifest: Record<string, unknown> }
  | { ok: false; reason: string };

const REQUIRED_META = [
  "id",
  "scenario",
  "family",
  "objective",
  "owner team",
  "owner support",
  "status",
  "version",
  "last reviewed",
  "destination title",
] as const;

/**
 * Parse one authored guidance page (its title + storage HTML) into a snake_case
 * manifest object. Returns a structured reason instead of throwing so the crawl
 * can skip a non-conforming page and keep the rest (honest gap).
 */
export function parseGuidancePage(title: string, html: string): GuidanceParse {
  const root = parse(html);

  const meta = readMetadataTable(root);
  if (!meta) {
    return { ok: false, reason: "missing leading metadata table" };
  }
  for (const key of REQUIRED_META) {
    if (!meta.get(key)) {
      return { ok: false, reason: `metadata missing "${key}"` };
    }
  }

  const steps = readSteps(root);
  if (steps.length === 0) {
    return { ok: false, reason: "no step headings (<h2>) found" };
  }

  const manifest: Record<string, unknown> = {
    id: meta.get("id"),
    title,
    scenario: meta.get("scenario"),
    family: meta.get("family"),
    objective: meta.get("objective"),
    destination: {
      title: meta.get("destination title"),
      ...(meta.get("destination description")
        ? { description: meta.get("destination description") }
        : {}),
    },
    owner: { team: meta.get("owner team"), support: meta.get("owner support") },
    status: meta.get("status"),
    version: meta.get("version"),
    last_reviewed: meta.get("last reviewed"),
    steps,
  };

  const appliesTo = buildAppliesTo(meta);
  if (appliesTo) {
    manifest.applies_to = appliesTo;
  }
  const sources = splitList(meta.get("sources"));
  if (sources.length > 0) {
    manifest.sources = sources;
  }

  return { ok: true, manifest };
}

/** First `<table>` → a normalized key/value map (lowercased, `_`/`:` → space). */
function readMetadataTable(root: HTMLElement): Map<string, string> | undefined {
  const table = root.querySelector("table");
  if (!table) {
    return undefined;
  }
  const map = new Map<string, string>();
  for (const row of table.querySelectorAll("tr")) {
    const cells = row.querySelectorAll("th, td");
    if (cells.length < 2) {
      continue;
    }
    const key = normalizeKey(cells[0]!.text);
    const value = cells[1]!.text.trim();
    if (key && value) {
      map.set(key, value);
    }
  }
  return map.size > 0 ? map : undefined;
}

function buildAppliesTo(meta: Map<string, string>): Record<string, string[]> | undefined {
  const services = splitList(meta.get("applies to services"));
  const landingZones = splitList(meta.get("applies to landing zones"));
  const securityPolicies = splitList(meta.get("applies to security policies"));
  const applies: Record<string, string[]> = {};
  if (services.length > 0) applies.services = services;
  if (landingZones.length > 0) applies.landing_zones = landingZones;
  if (securityPolicies.length > 0) applies.security_policies = securityPolicies;
  return Object.keys(applies).length > 0 ? applies : undefined;
}

/** Each `<h2>` → a flat step, content gathered from following siblings. */
function readSteps(root: HTMLElement): Record<string, unknown>[] {
  const steps: Record<string, unknown>[] = [];
  const usedStepIds = new Set<string>();
  for (const heading of root.querySelectorAll("h2")) {
    const stepTitle = heading.text.trim();
    if (!stepTitle) {
      continue;
    }
    const id = uniqueId(slugify(stepTitle), usedStepIds);
    const block = collectUntilNextHeading(heading);
    const step: Record<string, unknown> = { id, title: stepTitle };

    const description = block.paragraphs.find((p) => !isWhy(p));
    if (description) {
      step.description = description;
    }
    const why = block.paragraphs.find(isWhy);
    if (why) {
      step.why = stripWhy(why);
    }
    const tasks = buildTasks(block, id);
    if (tasks.length > 0) {
      step.tasks = tasks;
    }
    steps.push(step);
  }
  return steps;
}

type StepBlock = {
  paragraphs: string[];
  lists: HTMLElement[];
  codes: { title?: string; text: string }[];
};

/** Walk siblings after a heading until the next heading, bucketing block kinds. */
function collectUntilNextHeading(heading: HTMLElement): StepBlock {
  const block: StepBlock = { paragraphs: [], lists: [], codes: [] };
  let node: HTMLElement | null = heading.nextElementSibling;
  while (node && !isHeading(node)) {
    const tag = (node.rawTagName ?? "").toLowerCase();
    if (tag === "p") {
      const text = node.text.trim();
      if (text) {
        block.paragraphs.push(text);
      }
    } else if (tag === "ul" || tag === "ol") {
      block.lists.push(node);
    } else if (tag === "ac:structured-macro" && node.getAttribute("ac:name") === "code") {
      block.codes.push(readCodeMacro(node));
    }
    node = node.nextElementSibling;
  }
  return block;
}

/** List items (→ tasks/actions) followed by code macros (→ copy_text tasks). */
function buildTasks(block: StepBlock, stepId: string): Record<string, unknown>[] {
  const tasks: Record<string, unknown>[] = [];
  const usedTaskIds = new Set<string>();
  const pushTask = (title: string, extra: Record<string, unknown>) => {
    const id = uniqueId(slugify(title) || `${stepId}-task`, usedTaskIds);
    tasks.push({ id, title, ...extra });
  };

  for (const list of block.lists) {
    for (const item of list.querySelectorAll("li")) {
      const rawTitle = item.text.trim();
      if (!rawTitle) {
        continue;
      }
      const required = /\(required\)\s*$/i.test(rawTitle);
      const title = rawTitle.replace(/\s*\(required\)\s*$/i, "").trim();
      const anchor = item.querySelector("a");
      const href = anchor?.getAttribute("href")?.trim();
      const extra: Record<string, unknown> = {};
      if (required) {
        extra.required = true;
      }
      if (href) {
        extra.action = {
          type: actionTypeForHref(href),
          label: anchor!.text.trim() || title,
          target: href,
        };
      }
      pushTask(title, extra);
    }
  }

  for (const code of block.codes) {
    const label = code.title?.trim() || "Copy snippet";
    pushTask(label, {
      action: { type: "copy_text", label, text: code.text },
    });
  }

  return tasks;
}

/** Read a `code` macro: optional `title` parameter + the CDATA plain-text body. */
function readCodeMacro(macro: HTMLElement): { title?: string; text: string } {
  let title: string | undefined;
  let text = "";
  for (const el of macro.querySelectorAll("*")) {
    const tag = (el.rawTagName ?? "").toLowerCase();
    if (tag === "ac:parameter" && el.getAttribute("ac:name") === "title") {
      title = el.text.trim();
    } else if (tag === "ac:plain-text-body") {
      text = stripCdata(el.text);
    }
  }
  return { title, text };
}

/* -------------------------------------------------------------------------- *
 * Helpers                                                                     */

function actionTypeForHref(href: string): string {
  if (href.startsWith("/")) {
    return "atlas_page";
  }
  if (/(?:tfe|terraform|registry|harness|github|gitlab|jenkins)\b/i.test(href)) {
    return "tool_link";
  }
  if (/(?:slack|teams|servicedesk|jira|support)\b/i.test(href)) {
    return "support_link";
  }
  return "external_link";
}

function isHeading(node: HTMLElement): boolean {
  return /^h[1-6]$/i.test(node.rawTagName ?? "");
}

function isWhy(paragraph: string): boolean {
  return /^why\b/i.test(paragraph);
}

function stripWhy(paragraph: string): string {
  return paragraph.replace(/^why(\s+it\s+matters)?\s*[:\-—]?\s*/i, "").trim();
}

function stripCdata(value: string): string {
  return value
    .trim()
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "");
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[_:]/g, " ").replace(/\s+/g, " ").trim();
}

function splitList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueId(base: string, used: Set<string>): string {
  let candidate = base || "item";
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}
