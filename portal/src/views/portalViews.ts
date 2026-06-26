import type { ContextBundleResponse } from "@atlas/schema";

export type FeedbackReason = "missing" | "stale" | "broken" | "unclear";

export type FeedbackPayload = {
  bundle_id: string;
  reason: FeedbackReason;
  message: string;
};

export function renderPortalHome(input: {
  services: ContextBundleResponse[];
  landingZones: ContextBundleResponse[];
}): string {
  return [
    "<main>",
    "<section><h1>Atlas Portal</h1></section>",
    `<section><h2>Find a platform service</h2>${input.services.map(renderBundleSummary).join("")}</section>`,
    `<section><h2>Choose a landing zone</h2>${input.landingZones.map(renderBundleSummary).join("")}</section>`,
    "<section><h2>Ask Atlas</h2><p>Ask with governed citations.</p></section>",
    "</main>",
  ].join("");
}

export function renderServiceDetail(bundle: ContextBundleResponse): string {
  return renderBundleDetail("Service", bundle);
}

export function renderLandingZoneNavigator(bundles: ContextBundleResponse[]): string {
  return `<main>${bundles.map((bundle) => renderBundleDetail("Landing Zone", bundle)).join("")}</main>`;
}

export function renderSourceLookup(bundle: ContextBundleResponse): string {
  const warnings = bundle.warnings
    .map((warning) => `<li>${escapeHtml(warning.code)}: ${escapeHtml(warning.message)}</li>`)
    .join("");

  return `<aside><h2>Source warnings</h2><ul>${warnings}</ul></aside>${renderBundleDetail("Source", bundle)}`;
}

export function buildFeedbackPayload(input: {
  bundleId: string;
  reason: FeedbackReason;
  message: string;
}): FeedbackPayload {
  return {
    bundle_id: input.bundleId,
    reason: input.reason,
    message: input.message,
  };
}

function renderBundleSummary(bundle: ContextBundleResponse): string {
  const firstSource = bundle.sources[0]?.source;
  return `<article><h3>${escapeHtml(displayName(bundle))}</h3><p>${escapeHtml(firstSource?.steward ?? "unknown owner")}</p></article>`;
}

function renderBundleDetail(label: string, bundle: ContextBundleResponse): string {
  const sources = bundle.sources
    .map(
      ({ source, excerpts }) =>
        `<article><h2>${escapeHtml(displayName(bundle))}</h2><p>${escapeHtml(label)}</p><dl><dt>Owner</dt><dd>${escapeHtml(source.steward)}</dd><dt>Authority</dt><dd>${escapeHtml(source.authority_level)}</dd><dt>Scope</dt><dd>${escapeHtml(source.authority_scope.join(", "))}</dd></dl>${renderTools(bundle)}${renderExcerpts(excerpts)}</article>`,
    )
    .join("");

  return `<main>${sources}</main>`;
}

function renderTools(bundle: ContextBundleResponse): string {
  return bundle.expansion_paths
    .map(
      (path) =>
        `<a href="#${escapeHtml(path.anchor_id ?? path.source_id)}">${escapeHtml(path.label)}</a>`,
    )
    .join("");
}

function renderExcerpts(excerpts: ContextBundleResponse["sources"][number]["excerpts"]): string {
  return excerpts
    .map(
      (excerpt) =>
        `<blockquote cite="${escapeHtml(excerpt.citation.location)}">${escapeHtml(excerpt.text)}</blockquote>`,
    )
    .join("");
}

function displayName(bundle: ContextBundleResponse): string {
  const topicId = bundle.request.topic_id ?? bundle.sources[0]?.source.title ?? "Atlas";
  return topicId
    .split("-")
    .map((word) =>
      word === "aws" || word === "api"
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
