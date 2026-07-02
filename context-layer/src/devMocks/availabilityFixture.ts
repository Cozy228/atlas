/**
 * Dev/integration availability fixture (plan 021 G3) — the `awsf` landing zone's
 * availability data, hosted in the MSW source-space (NOT an in-code provider
 * seed). It is rendered into a Confluence storage-HTML page — in the real page
 * shape (Legend + At-a-glance summary + a region matrix table + an outpost matrix
 * table, statuses as `<ac:emoticon>` glyphs, services grouped by domain section)
 * — that the live `confluenceAvailabilityProvider` and the
 * `availabilityMatrixResolver` fetch + parse exactly like every other source
 * (single live path, 018 G1). Render and parse are inverses, so the grid
 * round-trips losslessly through the MSW fetch.
 *
 * The rendered page is the canonical MSW body; `availability.sample.html` at the
 * repo root is a committed snapshot of this exact output (kept in sync by
 * `availabilityFixture.test.ts`). Fictional and public-safe — real AWS region /
 * service names are public, but the product owner, outposts, and links are made
 * up; no company page is reconstructed.
 */
import type { Location, LocationAvailability, LocationStatus } from "@atlas/schema";

/** A service row as authored here (presentation + per-location status). Rendered
 *  into the page tables and parsed back into an `AvailabilityRecord`. The `id` is
 *  authored explicitly but must equal what the parser derives from `name` (the
 *  real page has no id column) — `availabilityFixture.test.ts` asserts the match. */
export type AvailabilityServiceFixture = {
  id: string;
  name: string;
  domain: string;
  iconKey: string;
  availability: Record<string, LocationAvailability>;
};

const av = (): LocationAvailability => ({ status: "available" });
const pl = (eta: string): LocationAvailability => ({ status: "planned", note: eta });

function svc(
  id: string,
  name: string,
  domain: string,
  iconKey: string,
  availability: Record<string, LocationAvailability>,
): AvailabilityServiceFixture {
  return { id, name, domain, iconKey, availability };
}

/** The `awsf` landing zone's regions + outposts (geography, fictional). Map
 *  coordinates are NOT authored here — the page carries no geography; they live
 *  in `LOCATION_GEO` and are joined on by id in the provider. */
export const AWSF_LOCATIONS: Location[] = [
  { id: "us-east-1", label: "US-East-1", sub: "North Virginia", kind: "region" },
  { id: "ca-central-1", label: "CA-Central-1", sub: "Canada Central", kind: "region" },
  { id: "gdc", label: "GDC", sub: "Primary Outpost", kind: "outpost" },
  { id: "dc16", label: "DC16", sub: "DR Outpost", kind: "outpost" },
  { id: "mt10", label: "MT10", sub: "Future DR Outpost", kind: "outpost" },
];

/** The `awsf` landing zone's service availability grid (fictional). A coherent
 *  ~18-service set spanning domains; every service here has a Terraform module in
 *  the registry fixture, so discovery binds a resource (no empty service shells).
 *  Each `name` is chosen so the parser's id derivation reproduces the `id`. */
export const AWSF_SERVICES: AvailabilityServiceFixture[] = [
  svc("s3", "Amazon S3", "Storage", "S3", { "us-east-1": av(), "ca-central-1": av() }),
  svc("efs", "Elastic File System (EFS)", "Storage", "EFS", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("ec2", "EC2", "Compute", "EC2", {
    "us-east-1": av(),
    "ca-central-1": av(),
    gdc: pl("05/30/2026"),
    dc16: pl("07/31/2026"),
    mt10: pl("TBD"),
  }),
  svc("lambda", "AWS Lambda", "Compute", "LAM", { "us-east-1": av(), "ca-central-1": av() }),
  svc("eks", "Elastic Kubernetes Service (EKS)", "Containers", "EKS", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("ecs-fargate", "ECS Fargate", "Containers", "ECS", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("aurora", "Amazon Aurora", "Database", "PG", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("dynamodb", "DynamoDB", "Database", "DDB", {}),
  svc("kinesis", "Kinesis", "Analytics", "KIN", { "us-east-1": av(), "ca-central-1": av() }),
  svc("sqs", "Simple Queue Service (SQS)", "App Integration", "SQS", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("sns", "Simple Notification Service (SNS)", "App Integration", "SNS", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("api-gateway", "API Gateway", "App Integration", "APG", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("eventbridge", "EventBridge", "App Integration", "EVB", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("bedrock", "Amazon Bedrock", "AI Services", "BDR", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("textract", "Amazon Textract", "AI Services", "TEX", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("elb", "Elastic Load Balancing (ELB)", "Networking", "ELB", {
    gdc: pl("06/30/2026"),
    dc16: pl("06/30/2026"),
    mt10: pl("TBD"),
  }),
  svc("cloudwatch", "CloudWatch", "Operations", "CW", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("kms", "Key Management Service (KMS)", "Security", "KMS", {}),
];

/** The fictional Confluence page id the `awsf` availability page is served at. */
export const DEV_AVAILABILITY_PAGE_ID_AWSF = "200001";

/** Per-status emoticon identity (the glyph, never `ac:name`, carries meaning). */
const EMOTICON: Record<LocationStatus, { name: string; short: string; fallback: string }> = {
  available: { name: "tick", short: ":check_mark:", fallback: ":check_mark:" },
  interim: { name: "blue-star", short: ":emo:", fallback: ":emo:" },
  planned: { name: "blue-star", short: ":arrow_upper_right:", fallback: "↗️" },
  "not-planned": { name: "blue-star", short: ":regional_indicator_x:", fallback: "❌" },
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function emoticon(status: LocationStatus): string {
  const e = EMOTICON[status];
  return `<ac:emoticon ac:name="${e.name}" ac:emoji-shortname="${e.short}" ac:emoji-fallback="${e.fallback}" />`;
}

/** A status cell: the emoticon glyph + optional trailing note (empty ⇒ not-planned). */
function statusCell(entry: LocationAvailability | undefined): string {
  if (!entry) {
    return `<td><p style="text-align: center"></p></td>`;
  }
  const note = entry.note ? ` ${escapeHtml(entry.note)}` : "";
  return `<td><p style="text-align: center">${emoticon(entry.status)}${note}</p></td>`;
}

/** A service name cell: a Confluence page link whose body is the display name. */
function serviceCell(name: string): string {
  return (
    `<td><p><ac:link>` +
    `<ri:page ri:content-title="${escapeHtml(name)} Service Catalog" />` +
    `<ac:link-body>${escapeHtml(name)}</ac:link-body>` +
    `</ac:link></p></td>`
  );
}

/**
 * Render one matrix table: a `Regions` / `Outposts` header row (label + one
 * location column per `cols` entry), a `Landing Zones` tier row, then the
 * services grouped by domain — each group led by a `colspan` section header.
 */
function renderMatrix(
  headerLabel: string,
  cols: Location[],
  services: AvailabilityServiceFixture[],
): string {
  const colspan = cols.length + 1;
  const colgroup = `<colgroup>${"<col />".repeat(colspan)}</colgroup>`;

  const headerRow =
    `<tr><td data-highlight-colour="#f4f5f7"><h2><strong>${escapeHtml(headerLabel)}</strong></h2></td>` +
    cols
      .map(
        (c) =>
          `<td data-highlight-colour="#f4f5f7"><p style="text-align: center"><strong>${escapeHtml(
            `${c.label} (${c.sub})`,
          )}</strong></p></td>`,
      )
      .join("") +
    `</tr>`;

  const landingZonesRow =
    `<tr><td data-highlight-colour="#f4f5f7"><h2>🏠 Landing Zones</h2></td>` +
    cols
      .map(
        () =>
          `<td data-highlight-colour="#f4f5f7"><p style="text-align: center">${emoticon(
            "available",
          )} L3 - L5</p></td>`,
      )
      .join("") +
    `</tr>`;

  let body = "";
  let domain: string | undefined;
  for (const service of services) {
    if (service.domain !== domain) {
      domain = service.domain;
      // Real page shape: the domain heading sits in the first cell, the remaining
      // location cells are left blank (NOT a colspan) — all band-highlighted.
      body +=
        `<tr><td data-highlight-colour="#e6fcff">` +
        `<h2><strong><span style="color: rgb(7, 71, 166)">■ </span><span>${escapeHtml(
          domain,
        )}</span></strong></h2></td>` +
        cols
          .map(
            () =>
              `<td data-highlight-colour="#e6fcff"><p style="text-align: center">&nbsp;</p></td>`,
          )
          .join("") +
        `</tr>`;
    }
    body +=
      `<tr>${serviceCell(service.name)}` +
      cols.map((c) => statusCell(service.availability[c.id])).join("") +
      `</tr>`;
  }

  return `<table data-layout="center">${colgroup}<tbody>${headerRow}${landingZonesRow}${body}</tbody></table>`;
}

/** At-a-glance counts (decorative; the parser skips this table — no region header). */
function renderAtAGlance(services: AvailabilityServiceFixture[]): string {
  const has = (s: AvailabilityServiceFixture, status: LocationStatus): boolean =>
    Object.values(s.availability).some((entry) => entry.status === status);
  const total = services.length;
  const available = services.filter((s) => has(s, "available")).length;
  const interim = services.filter((s) => has(s, "interim")).length;
  const future = services.filter((s) => has(s, "planned")).length;

  const th = (t: string): string => `<th><p>${t}</p></th>`;
  const td = (v: string): string => `<td><p><strong>${v}</strong></p></td>`;
  return (
    `<p>📊 At-a-glance</p>` +
    `<table data-layout="align-start"><tbody>` +
    `<tr>${th("🧩 Total Services")}${th("✅ Available")}${th("🟠 Interim Capability")}${th(
      "🔵 Future Availability",
    )}</tr>` +
    `<tr>${td(String(total))}${td(String(available))}${td(interim ? String(interim) : "NA")}${td(
      String(future),
    )}</tr>` +
    `</tbody></table>`
  );
}

const LEGEND =
  `<p style="text-align: center"><strong><u>Legend</u></strong> ` +
  `${emoticon("available")}= Available ` +
  `${emoticon("interim")}= Interim Capability ` +
  `${emoticon("planned")}= Future availability ` +
  `${emoticon("not-planned")}= Not planned</p>`;

const NOTE =
  `<p style="text-align: center"><em>STT standard Modernization levels and Landing Zone ` +
  `definitions referenced below can be located via this </em>` +
  `<a href="https://example.com/standards/modernization-and-landing-zones"><em><u>link</u></em></a></p>`;

const PRODUCT_OWNER = `<p style="text-align: center"><strong>Product Owner: Dana Okonkwo</strong></p>`;

/**
 * Render the `awsf` availability data into Confluence storage HTML in the real
 * page shape: Legend, At-a-glance, a region matrix table and an outpost matrix
 * table (services grouped by domain, statuses as emoticons). The provider +
 * matrix resolver parse these back — render and parse are inverses.
 */
export function renderAvailabilityPageStorage(
  locations: Location[] = AWSF_LOCATIONS,
  services: AvailabilityServiceFixture[] = AWSF_SERVICES,
): string {
  const regions = locations.filter((l) => l.kind === "region");
  const outposts = locations.filter((l) => l.kind === "outpost");
  return [
    LEGEND,
    renderAtAGlance(services),
    NOTE,
    PRODUCT_OWNER,
    renderMatrix("🌏 Regions", regions, services),
    ...(outposts.length ? [renderMatrix("🖥️ Outposts", outposts, services)] : []),
  ].join("\n");
}
