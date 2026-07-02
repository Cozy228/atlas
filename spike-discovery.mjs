/**
 * Discovery spike (throwaway) — probe the REAL policy (Confluence security space)
 * and TFE (Terraform private registry) channels using the tokens in .env.local,
 * to answer: can we discover a LIST from each?
 *
 * Zero-dependency. Reads env from `portal/.env.local` (or $ENV_FILE). Prints the
 * exact URL + status + a compact summary per probe; never prints token values.
 *
 * Run from the repo root:   node spike-discovery.mjs
 * Delete when done — this is not part of the app.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* ── env loading ──────────────────────────────────────────────────────────── */

function loadEnvFile() {
  const candidates = [
    process.env.ENV_FILE,
    "portal/.env.local",
    ".env.local",
    "portal/.env",
  ].filter(Boolean);
  for (const rel of candidates) {
    const path = resolve(process.cwd(), rel);
    try {
      const text = readFileSync(path, "utf8");
      const env = {};
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.replace(/^\s*export\s+/, "").trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let val = line.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
      console.log(`[env] loaded ${Object.keys(env).length} vars from ${rel}\n`);
      return { ...env, ...process.env }; // real process.env wins (lets you override inline)
    } catch {
      /* try next candidate */
    }
  }
  console.log("[env] no env file found — relying on process.env only\n");
  return { ...process.env };
}

const env = loadEnvFile();
const get = (name) => {
  const v = env[name];
  return v && v.trim() ? v.trim() : undefined;
};
const has = (name) => Boolean(get(name));
const redact = (s) => (s ? `${s.slice(0, 3)}…(${s.length} chars)` : "(unset)");

function confluenceAuthorization({ token, email }) {
  if (email) return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
  return `Bearer ${token}`;
}

async function probe(label, url, headers) {
  console.log(`  → ${label}`);
  console.log(`    GET ${url}`);
  try {
    const res = await fetch(url, { method: "GET", headers });
    const bodyText = await res.text();
    let json;
    try {
      json = JSON.parse(bodyText);
    } catch {
      json = undefined;
    }
    console.log(`    status: ${res.status} ${res.statusText}`);
    return { ok: res.ok, status: res.status, json, bodyText };
  } catch (err) {
    console.log(`    NETWORK ERROR: ${err?.message ?? err}`);
    return { ok: false, status: 0, json: undefined, bodyText: "" };
  }
}

function snippet(text, n = 300) {
  return (text ?? "").replace(/\s+/g, " ").slice(0, n);
}

/* ── Policy probe (Confluence security space) ─────────────────────────────── */

async function spikePolicy() {
  console.log("═══ POLICY · Confluence security space ═══");
  const baseUrl = (get("CONFLUENCE_SECURITY_BASE_URL") ?? get("CONFLUENCE_BASE_URL") ?? "").replace(/\/+$/, "");
  const token = get("CONFLUENCE_SECURITY_TOKEN") ?? get("CONFLUENCE_TOKEN");
  const email = get("CONFLUENCE_SECURITY_EMAIL") ?? get("CONFLUENCE_EMAIL");
  const spaceKey = get("CONFLUENCE_SECURITY_SPACE_KEY");

  console.log(`  baseUrl:  ${baseUrl || "(unset)"}`);
  console.log(`  email:    ${email ?? "(unset → Bearer auth)"}`);
  console.log(`  token:    ${redact(token)}`);
  console.log(`  spaceKey: ${spaceKey ?? "(unset)"}`);
  console.log(`  auth:     ${email ? "Basic (email:token)" : "Bearer"}`);

  if (!baseUrl || !token || !spaceKey) {
    console.log("  ✗ missing baseUrl / token / spaceKey — cannot probe.\n");
    return;
  }
  const headers = { Authorization: confluenceAuthorization({ token, email }), Accept: "application/json" };

  // 1) the exact query discoverGuardrails uses today (v1 CQL search).
  const cql = `space = ${spaceKey} AND type = page`;
  const v1Url = `${baseUrl}/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=25`;
  const r1 = await probe("v1 content/search (what the app uses)", v1Url, headers);
  if (r1.json) {
    const results = r1.json.results ?? [];
    console.log(`    totalSize: ${r1.json.totalSize ?? "?"} · results returned: ${results.length}`);
    results.slice(0, 10).forEach((res, i) => {
      const title = res.title ?? res.content?.title;
      const webui = res._links?.webui ?? res.content?._links?.webui;
      const idFromWebui = webui?.match(/\/pages\/(\d+)/)?.[1];
      const idFromContent = res.content?.id ?? res.id;
      console.log(
        `      [${i}] title=${JSON.stringify(title)} webui=${JSON.stringify(webui)}`,
      );
      console.log(
        `           pageId(regex /pages/\\d+)=${idFromWebui ?? "✗ NO MATCH"}  content.id=${idFromContent ?? "-"}`,
      );
    });
    if (results.length === 0) console.log(`    body: ${snippet(r1.bodyText)}`);
  } else if (!r1.ok) {
    console.log(`    body: ${snippet(r1.bodyText)}`);
  }

  // 2) v2 pages API (newer Confluence Cloud) — does the space resolve there?
  const v2Url = `${baseUrl}/api/v2/spaces?keys=${encodeURIComponent(spaceKey)}`;
  const r2 = await probe("v2 spaces lookup (sanity: does the space key resolve?)", v2Url, headers);
  if (r2.json?.results) {
    console.log(`    spaces matched: ${r2.json.results.length} → ${r2.json.results.map((s) => `${s.key}#${s.id}`).join(", ") || "(none)"}`);
  } else if (!r2.ok) {
    console.log(`    body: ${snippet(r2.bodyText)}`);
  }
  console.log("");
}

/* ── TFE probe (private module registry LIST) ─────────────────────────────── */

function parseModuleUrl(url) {
  // e.g. https://tfe-prod.company.com/app/ABC/registry/modules/private/ABC/secrets_mgr/aws/2.0.0
  const m = url?.match(/\/app\/([^/]+)\/registry\/modules\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)(?:\/([^/?#]+))?/);
  if (!m) return undefined;
  return { org: m[1], registry: m[2], namespace: m[3], name: m[4], provider: m[5], version: m[6] };
}

async function spikeTfe() {
  console.log("═══ TFE · Terraform private module registry ═══");
  const baseUrl = (get("TERRAFORM_BASE_URL") ?? "").replace(/\/+$/, "");
  const token = get("TERRAFORM_TOKEN");
  const sample = parseModuleUrl(get("TERRAFORM_SAMPLE_MODULE_URL"));
  const org = get("TERRAFORM_ORG") ?? sample?.org;
  const namespace = get("TERRAFORM_NAMESPACE") ?? sample?.namespace ?? org;

  console.log(`  baseUrl:   ${baseUrl || "(unset)"}`);
  console.log(`  token:     ${redact(token)}`);
  console.log(`  org:       ${org ?? "(unset — set TERRAFORM_ORG or TERRAFORM_SAMPLE_MODULE_URL)"}`);
  console.log(`  namespace: ${namespace ?? "(unset)"}`);
  if (sample) console.log(`  sample:    ${sample.namespace}/${sample.name}/${sample.provider}@${sample.version ?? "?"}`);

  if (!baseUrl || !token) {
    console.log("  ✗ missing baseUrl / token — cannot probe.\n");
    return;
  }
  const jsonHeaders = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const vndHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/vnd.api+json" };

  // 1) v2 JSON:API — list ALL private modules in the org (the reliable enumerator).
  if (org) {
    const v2 = await probe(
      "v2 list org registry-modules",
      `${baseUrl}/api/v2/organizations/${encodeURIComponent(org)}/registry-modules?page%5Bsize%5D=20`,
      vndHeaders,
    );
    if (v2.json?.data) {
      console.log(`    modules: ${v2.json.data.length}${v2.json.meta?.pagination ? ` of ${v2.json.meta.pagination["total-count"]}` : ""}`);
      v2.json.data.slice(0, 12).forEach((d, i) => {
        const a = d.attributes ?? {};
        console.log(`      [${i}] ${a.namespace ?? "?"}/${a.name ?? "?"}/${a.provider ?? "?"}  (registry=${a["registry-name"] ?? "?"})`);
      });
    } else if (!v2.ok) {
      console.log(`    body: ${snippet(v2.bodyText)}`);
    }
  }

  // 2) v1 registry API — list modules for the namespace (terraform-native).
  if (namespace) {
    const v1 = await probe(
      "v1 list modules by namespace",
      `${baseUrl}/api/registry/v1/modules/${encodeURIComponent(namespace)}?limit=20`,
      jsonHeaders,
    );
    if (v1.json?.modules) {
      console.log(`    modules: ${v1.json.modules.length}`);
      v1.json.modules.slice(0, 12).forEach((mod, i) => {
        console.log(`      [${i}] ${mod.namespace}/${mod.name}/${mod.provider}  v${mod.version ?? "?"}`);
      });
    } else if (!v1.ok) {
      console.log(`    body: ${snippet(v1.bodyText)}`);
    }
  }

  // 3) v1 single-module detail — does root.readme come back? (backs section binding)
  if (sample) {
    const detail = await probe(
      "v1 single module detail (readme present?)",
      `${baseUrl}/api/registry/v1/modules/${sample.namespace}/${sample.name}/${sample.provider}`,
      jsonHeaders,
    );
    if (detail.json) {
      const readme = detail.json.root?.readme;
      console.log(`    version: ${detail.json.version ?? "?"} · root.readme: ${readme ? `${readme.length} chars` : "✗ ABSENT"}`);
    } else if (!detail.ok) {
      console.log(`    body: ${snippet(detail.bodyText)}`);
    }
  }
  console.log("");
}

/* ── run ──────────────────────────────────────────────────────────────────── */

await spikePolicy();
await spikeTfe();
console.log("Done. (Delete spike-discovery.mjs when finished.)");
