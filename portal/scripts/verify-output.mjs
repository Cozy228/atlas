import { lstat, readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const portalRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = resolve(portalRoot, ".output");
const workspaceRoot = resolve(portalRoot, "..");

const performanceBudgets = {
  initialHomeRequests: 11,
  initialHomeTransferBytes: 170_000,
  // Route-level splitting can add lazy files while reducing the cold-home closure.
  // Keep a fragmentation guard, but judge the user-visible path by its own request
  // and transfer budgets instead of forcing unrelated routes into eager chunks.
  javascriptFiles: 60,
  javascriptTransferBytes: 500_000,
  stylesheetTransferBytes: 22_000,
};

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".json",
  ".map",
  ".md",
  ".mjs",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".webmanifest",
  ".xml",
  ".yaml",
  ".yml",
]);

const forbiddenPackageMatchers = [
  {
    label: "TanStack Start",
    matches: (name) =>
      name === "@tanstack/start" ||
      name === "@tanstack/react-start" ||
      name.startsWith("@tanstack/react-start-") ||
      name.startsWith("@tanstack/start-"),
  },
  {
    label: "Nitro",
    matches: (name) =>
      ["nitro", "nitropack", "h3", "rou3", "srvx", "unenv", "unstorage"].includes(name),
  },
  {
    label: "MSW",
    matches: (name) => name === "msw" || name.startsWith("@mswjs/"),
  },
];

const forbiddenIdentifiers = [
  {
    label: "TanStack Start",
    pattern: /@tanstack\/(?:react-start(?:-[a-z0-9-]+)?|start(?:-[a-z0-9-]+)?)|\bcreateServerFn\b/i,
  },
  {
    label: "Nitro",
    pattern:
      /\bnitro(?:pack)?\b|\bdefineNitroPlugin\b|\bdefineEventHandler\b|\buseNitroApp\b|\bH3Event\b|#nitro\b/i,
  },
  {
    label: "MSW",
    pattern:
      /@mswjs\/|\bmsw\/node\b|(?:^|[/\\])msw(?:[/\\.]|$)|mockServiceWorker|setupServer\s*\(/i,
  },
  {
    label: "devMocks",
    pattern: /@atlas\/context-layer\/devMocks|(?:^|[/\\])devMocks(?:[/\\]|$)|\bdevMocks\b/i,
  },
  { label: "DEV_MOCKS", pattern: /\bDEV_MOCKS\b|\bDEV_MOCK_LATENCY_MS\b/ },
];

export function findProductionExclusionViolations({
  entries,
  installedPackageNames,
  packageSections,
  workspaceRoots,
}) {
  const violations = [];

  for (const entry of entries) {
    if (entry.kind === "symlink") {
      violations.push(`${entry.path} is a forbidden symlink`);
      continue;
    }
    if (entry.kind === "special") {
      violations.push(`${entry.path} is a forbidden special filesystem entry`);
      continue;
    }

    const searchable = `${entry.path}\n${entry.content ?? ""}`;
    for (const { label, pattern } of forbiddenIdentifiers) {
      if (pattern.test(searchable)) {
        violations.push(`${entry.path} contains forbidden ${label} identifier`);
      }
    }

    if (
      entry.content &&
      workspaceRoots.some((root) =>
        [root, root.replaceAll("\\", "/")].some((candidate) =>
          entry.content.toLowerCase().includes(candidate.toLowerCase()),
        ),
      )
    ) {
      violations.push(`${entry.path} contains an absolute workspace path`);
    }
  }

  for (const [section, packages] of Object.entries(packageSections)) {
    for (const packageName of Object.keys(packages ?? {})) {
      const forbidden = forbiddenPackageMatchers.find(({ matches }) => matches(packageName));
      if (forbidden) {
        violations.push(`${section} declares forbidden ${forbidden.label} package ${packageName}`);
      }
    }
  }

  for (const packageName of installedPackageNames) {
    const forbidden = forbiddenPackageMatchers.find(({ matches }) => matches(packageName));
    if (forbidden) {
      violations.push(
        `portal/node_modules exposes forbidden ${forbidden.label} package ${packageName}`,
      );
    }
  }

  return [...new Set(violations)].sort();
}

export function findPerformanceBudgetViolations(performance, budgets = performanceBudgets) {
  const checks = [
    ["initial home JS requests", performance.initialHome.requestCount, budgets.initialHomeRequests],
    [
      "initial home JS transfer bytes",
      performance.initialHome.transferBytes,
      budgets.initialHomeTransferBytes,
    ],
    ["JavaScript files", performance.javascript.fileCount, budgets.javascriptFiles],
    [
      "all JavaScript transfer bytes",
      performance.javascript.transferBytes,
      budgets.javascriptTransferBytes,
    ],
    [
      "stylesheet transfer bytes",
      performance.stylesheets.transferBytes,
      budgets.stylesheetTransferBytes,
    ],
  ];
  return checks
    .filter(([, actual, maximum]) => actual > maximum)
    .map(([label, actual, maximum]) => `${label}: ${actual} exceeds budget ${maximum}`);
}

export async function verifyProductionOutput() {
  const packageJson = JSON.parse(await readFile(resolve(portalRoot, "package.json"), "utf8"));
  const [entries, installedPackageNames, buildMetadata] = await Promise.all([
    collectOutputEntries(outputRoot),
    listDirectPackageNames(resolve(portalRoot, "node_modules")),
    readFile(resolve(outputRoot, "BUILD_METADATA.json"), "utf8").then(JSON.parse),
  ]);
  const packageSections = Object.fromEntries(
    ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"].map(
      (section) => [section, packageJson[section]],
    ),
  );
  const violations = findProductionExclusionViolations({
    entries,
    installedPackageNames,
    packageSections,
    workspaceRoots: [
      portalRoot,
      resolve(workspaceRoot, "context-layer"),
      resolve(workspaceRoot, "packages"),
      resolve(workspaceRoot, "infra"),
      resolve(workspaceRoot, "plans"),
      resolve(workspaceRoot, "docs"),
    ],
  });
  violations.push(...findPerformanceBudgetViolations(buildMetadata.performance));

  if (violations.length > 0) {
    throw new Error(
      `Production output exclusion verification failed:\n${violations.map((item) => `- ${item}`).join("\n")}`,
    );
  }

  console.log(
    `Verified ${entries.length} production output entries: no forbidden reachability and performance budgets pass.`,
  );
}

async function collectOutputEntries(root) {
  const entries = [];

  async function visit(path) {
    const pathFromRoot = relative(root, path).split(sep).join("/") || ".";
    const stats = await lstat(path);
    if (stats.isSymbolicLink()) {
      entries.push({ kind: "symlink", path: pathFromRoot });
      return;
    }
    if (stats.isDirectory()) {
      for (const child of await readdir(path)) await visit(resolve(path, child));
      return;
    }
    if (!stats.isFile()) {
      entries.push({ kind: "special", path: pathFromRoot });
      return;
    }

    entries.push({
      kind: "file",
      path: pathFromRoot,
      content: textExtensions.has(extname(path).toLowerCase())
        ? await readFile(path, "utf8")
        : undefined,
    });
  }

  await visit(root);
  return entries;
}

async function listDirectPackageNames(nodeModulesRoot) {
  const names = [];
  for (const entry of await readdir(nodeModulesRoot, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (!entry.name.startsWith("@")) {
      names.push(entry.name);
      continue;
    }
    for (const scopedEntry of await readdir(resolve(nodeModulesRoot, entry.name))) {
      names.push(`${entry.name}/${scopedEntry}`);
    }
  }
  return names;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) await verifyProductionOutput();
