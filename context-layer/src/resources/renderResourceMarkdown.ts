import type { ContextSection, MissingSection, ResourceContextResponse } from "@atlas/schema";

/**
 * Render a resource projection as the agent-facing Markdown representation
 * (proposal §11). This is a deterministic view of ONE live projection — no
 * model, no stored file. It always surfaces resolution state: per-Section
 * status, citations with their resolve time, and warnings; a failed Section
 * shows a warning, never stale content (§11.2), and an unregistered Section
 * shows a "missing data, not a negative answer" note (§11.3).
 *
 * The JSON and Markdown forms come from the SAME projection, so they can never
 * disagree (proposal §13.2).
 */
export function renderResourceMarkdown(response: ResourceContextResponse): string {
  const { resource, requestedSections, sections, missingSections, resolvedAt } = response;
  const missingBySection = new Map(missingSections.map((entry) => [entry.section, entry]));
  const lines: string[] = [];

  lines.push(`# ${resource.name}`, "");
  lines.push(`> Canonical resource: \`${resource.id}\``);
  lines.push(`> Generated from live Atlas source resolution at ${resolvedAt}.`);
  lines.push("> Atlas does not store or serve stale source excerpts.", "");

  for (const sectionId of requestedSections) {
    lines.push(`## ${humanize(sectionId)}`, "");
    const missing = missingBySection.get(sectionId);
    if (missing) {
      lines.push(emptySectionNote(sectionId, missing), "");
      continue;
    }
    const section = sections[sectionId];
    if (section) {
      renderSection(lines, section);
    }
  }

  lines.push("## Resolution summary", "");
  for (const sectionId of requestedSections) {
    const missing = missingBySection.get(sectionId);
    if (missing) {
      lines.push(`- \`${sectionId}\`: unresolved (${missing.code})`);
      continue;
    }
    const section = sections[sectionId];
    if (section) {
      const code = section.status === "available" ? undefined : section.warnings[0]?.code;
      lines.push(`- \`${sectionId}\`: ${section.status}${code ? ` (${code})` : ""}`);
    }
  }
  lines.push("");

  const base = baseFromResourceUrl(resource.resourceUrl);
  lines.push("## Machine-readable forms", "");
  lines.push(`- [JSON resource](${resource.resourceUrl})`);
  lines.push(`- [Atlas Agent OpenAPI](${base}/openapi.json)`);
  lines.push("");

  return lines.join("\n");
}

function renderSection(lines: string[], section: ContextSection): void {
  if (section.status === "unresolved") {
    const warning = section.warnings[0];
    lines.push(
      `> Warning (\`${warning?.code ?? "source_unavailable"}\`): the registered source could not be resolved at request time. No conclusion can be drawn from Atlas. This is missing data, not evidence of non-support.`,
      "",
    );
    return;
  }

  if (section.content) {
    lines.push(section.content, "");
  }

  for (const warning of section.warnings) {
    lines.push(`> Warning (\`${warning.code}\`): ${warning.message}`, "");
  }

  if (section.citations.length > 0) {
    lines.push("### Sources", "");
    for (const citation of section.citations) {
      lines.push(`- [${citation.title}](${citation.url})`);
      if (citation.anchor) {
        lines.push(`  - Anchor: \`${citation.anchor}\``);
      }
      lines.push(`  - Resolved at: \`${citation.resolvedAt}\``);
    }
    lines.push("");
  }
}

function emptySectionNote(sectionId: string, missing: MissingSection): string {
  return `Atlas has no registered ${sectionId} source for this resource (\`${missing.code}\`). This is missing data, not evidence of a negative answer.`;
}

function humanize(id: string): string {
  const spaced = id.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function baseFromResourceUrl(resourceUrl: string): string {
  const marker = "/api/resources";
  const index = resourceUrl.indexOf(marker);
  return index >= 0 ? resourceUrl.slice(0, index) : "";
}
