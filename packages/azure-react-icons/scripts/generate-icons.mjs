import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";

const DOCS_URL = "https://learn.microsoft.com/en-us/azure/architecture/icons/";
const PACKAGE_ROOT = dirname(new URL(import.meta.url).pathname).replace(/\/scripts$/, "");
const SRC_DIR = join(PACKAGE_ROOT, "src");
const ICONS_DIR = join(SRC_DIR, "icons");

const docsHtml = await fetchText(DOCS_URL);
const zipUrl = findZipUrl(docsHtml);
const tmpDir = mkdtempSync(join(tmpdir(), "azure-icons-"));

try {
  const zipPath = join(tmpDir, "azure-icons.zip");
  await download(zipUrl, zipPath);
  execFileSync("unzip", ["-q", zipPath, "-d", tmpDir]);

  rmSync(ICONS_DIR, { force: true, recursive: true });
  mkdirSync(ICONS_DIR, { recursive: true });

  const svgFiles = (await walk(join(tmpDir, "Azure_Public_Service_Icons", "Icons")))
    .filter((filePath) => filePath.endsWith(".svg"))
    .sort();

  const baseNames = new Map();
  const entries = svgFiles.map((filePath) => {
    const parsed = parseSvgPath(filePath);
    const baseComponentName = toComponentName(parsed.category, parsed.serviceName);
    const count = baseNames.get(baseComponentName) ?? 0;
    baseNames.set(baseComponentName, count + 1);
    return { ...parsed, filePath, baseComponentName };
  });

  const duplicateNames = new Set(
    [...baseNames.entries()].filter(([, count]) => count > 1).map(([name]) => name),
  );

  const metadata = entries.map((entry) => {
    const componentName = duplicateNames.has(entry.baseComponentName)
      ? `${entry.baseComponentName}${entry.id}`
      : entry.baseComponentName;
    const svg = readFileSync(entry.filePath, "utf8");
    const componentSource = createComponentSource(componentName, svg);
    writeFileSync(join(ICONS_DIR, `${componentName}.tsx`), componentSource);
    return {
      componentName,
      category: entry.category,
      serviceName: entry.serviceName,
      sourcePath: relative(join(tmpDir, "Azure_Public_Service_Icons"), entry.filePath),
    };
  });

  writeFileSync(join(SRC_DIR, "metadata.ts"), createMetadataSource(metadata));
  writeFileSync(join(SRC_DIR, "index.ts"), createIndexSource(metadata));
  console.log(`Generated ${metadata.length} Azure icon components from ${zipUrl}`);
} finally {
  rmSync(tmpDir, { force: true, recursive: true });
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function findZipUrl(html) {
  const match = html.match(/https:\/\/arch-center\.azureedge\.net\/icons\/[^"]+\.zip/);
  if (!match) {
    throw new Error("Could not find Azure icon zip URL on Microsoft Learn page.");
  }
  return match[0];
}

async function download(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(outputPath, buffer);
}

async function walk(dir) {
  const dirents = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const path = join(dir, dirent.name);
      return dirent.isDirectory() ? walk(path) : path;
    }),
  );
  return files.flat();
}

function parseSvgPath(filePath) {
  const category = basename(dirname(filePath));
  const fileName = basename(filePath, ".svg");
  const match = fileName.match(/^(\d+)\s*-icon-[^-]+-(.+)$/);
  if (!match) {
    throw new Error(`Unexpected Azure icon file name: ${fileName}`);
  }
  return {
    id: match[1],
    category,
    serviceName: match[2],
  };
}

function toComponentName(category, serviceName) {
  return `Azure${toPascalCase(category)}${toPascalCase(serviceName)}`;
}

function toPascalCase(value) {
  return value
    .replace(/&/g, " and ")
    .replace(/\+/g, " ")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      const normalized = normalizeAcronym(part);
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join("");
}

function normalizeAcronym(value) {
  const acronyms = new Map([
    ["ai", "AI"],
    ["aks", "AKS"],
    ["api", "API"],
    ["apis", "APIs"],
    ["cdn", "CDN"],
    ["db", "DB"],
    ["dcs", "DCS"],
    ["dns", "DNS"],
    ["easm", "EASM"],
    ["fhir", "FHIR"],
    ["hd", "HD"],
    ["hdi", "HDI"],
    ["hmi", "HMI"],
    ["hpc", "HPC"],
    ["iot", "IoT"],
    ["ip", "IP"],
    ["json", "JSON"],
    ["netapp", "NetApp"],
    ["openai", "OpenAI"],
    ["qna", "QnA"],
    ["rtos", "RTOS"],
    ["scvmm", "SCVMM"],
    ["signalr", "SignalR"],
    ["sql", "SQL"],
    ["ssh", "SSH"],
    ["ssis", "SSIS"],
    ["vm", "VM"],
    ["vnet", "VNet"],
    ["vpn", "VPN"],
    ["waf", "WAF"],
  ]);
  return acronyms.get(value.toLowerCase()) ?? value.toLowerCase();
}

function createComponentSource(componentName, svg) {
  const root = svg.match(/^<svg\s+([^>]*)>([\s\S]*)<\/svg>\s*$/);
  if (!root) {
    throw new Error(`Could not parse SVG root for ${componentName}`);
  }
  const attrs = Object.fromEntries(
    [...root[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]),
  );
  const viewBox = attrs.viewBox ?? "0 0 18 18";
  const innerSvg = JSON.stringify(root[2]);

  return `import type { AzureIconProps } from "../types.js";

export default function ${componentName}({ size = 24, ...props }: AzureIconProps) {
  return (
    <svg
      {...props}
      width={size}
      height={size}
      viewBox=${JSON.stringify(viewBox)}
      xmlns="http://www.w3.org/2000/svg"
      dangerouslySetInnerHTML={{ __html: ${innerSvg} }}
    />
  );
}
`;
}

function createMetadataSource(metadata) {
  return `import type { AzureIconMetadata } from "./types.js";

export const azureIconMetadata = ${JSON.stringify(metadata, null, 2)} as const satisfies readonly AzureIconMetadata[];
`;
}

function createIndexSource(metadata) {
  const exports = metadata
    .map((entry) => `export { default as ${entry.componentName} } from "./icons/${entry.componentName}.js";`)
    .join("\n");

  return `${exports}
export { azureIconMetadata } from "./metadata.js";
export type { AzureIconMetadata, AzureIconProps } from "./types.js";
`;
}
