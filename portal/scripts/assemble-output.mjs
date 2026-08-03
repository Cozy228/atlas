import { createHash } from "node:crypto";
import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { brotliCompress, constants, gzip } from "node:zlib";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const compressBrotli = promisify(brotliCompress);
const compressGzip = promisify(gzip);
const portalRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = resolve(portalRoot, ".output");
const publicRoot = resolve(outputRoot, "public");
const serverRoot = resolve(outputRoot, "server");
const viteManifestPath = resolve(publicRoot, ".vite/manifest.json");
const compressionThreshold = 1024;

const mimeByExtension = new Map([
  [".avif", "image/avif"],
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".otf", "font/otf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".ttf", "font/ttf"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function outputRelativePath(filePath) {
  const path = relative(publicRoot, filePath);
  invariant(
    path !== "" && path !== ".." && !path.startsWith(`..${sep}`),
    "Asset escaped public root.",
  );
  return path.split(sep).join("/");
}

function urlPath(file) {
  return `/${file.split("/").map(encodeURIComponent).join("/")}`;
}

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(filePath)));
    else if (entry.isFile()) files.push(filePath);
  }
  return files;
}

function viteOwnedFiles(viteManifest) {
  const files = new Set();
  for (const entry of Object.values(viteManifest)) {
    files.add(entry.file);
    for (const css of entry.css ?? []) files.add(css);
    for (const asset of entry.assets ?? []) files.add(asset);
  }
  return files;
}

function staticDependencyFiles(viteManifest, roots) {
  const files = new Set();
  const visited = new Set();
  const visit = (key) => {
    if (visited.has(key)) return;
    visited.add(key);
    const entry = viteManifest[key];
    invariant(entry, `Missing Vite manifest entry: ${key}`);
    if (entry.file.endsWith(".js")) files.add(entry.file);
    for (const dependency of entry.imports ?? []) visit(dependency);
  };
  for (const root of roots) visit(root);
  return [...files].sort();
}

function transferSize(entry) {
  return entry.gzip?.size ?? entry.identity.size;
}

function performanceMetadata(viteManifest, assets) {
  const entryKey = Object.keys(viteManifest).find((key) => viteManifest[key].isEntry);
  const homeKey = Object.keys(viteManifest).find((key) =>
    key.startsWith("src/routes/index.tsx?tsr-split=component"),
  );
  invariant(entryKey && homeKey, "Entry or home route is absent from the Vite manifest.");
  const initialHomeFiles = staticDependencyFiles(viteManifest, [entryKey, homeKey]);
  const initialHomeBytes = initialHomeFiles.reduce((sum, file) => {
    const entry = assets[urlPath(file)];
    invariant(entry, `Initial-home asset is absent from the static manifest: ${file}`);
    return sum + transferSize(entry);
  }, 0);
  const javascript = Object.values(assets).filter((entry) =>
    entry.mime.startsWith("text/javascript"),
  );
  const stylesheets = Object.values(assets).filter((entry) => entry.mime.startsWith("text/css"));
  return {
    initialHome: {
      files: initialHomeFiles,
      requestCount: initialHomeFiles.length,
      transferBytes: initialHomeBytes,
    },
    javascript: {
      fileCount: javascript.length,
      transferBytes: javascript.reduce((sum, entry) => sum + transferSize(entry), 0),
    },
    stylesheets: {
      fileCount: stylesheets.length,
      transferBytes: stylesheets.reduce((sum, entry) => sum + transferSize(entry), 0),
    },
  };
}

function etag(bytes) {
  return `"sha256-${createHash("sha256").update(bytes).digest("base64url")}"`;
}

function isCompressible(mime) {
  return (
    mime.startsWith("text/") ||
    mime.startsWith("application/json") ||
    mime.startsWith("application/manifest+json") ||
    mime.startsWith("application/xml") ||
    mime.startsWith("image/svg+xml")
  );
}

function representation(file, bytes) {
  return { file, size: bytes.byteLength, etag: etag(bytes) };
}

async function main() {
  const viteManifest = JSON.parse(await readFile(viteManifestPath, "utf8"));
  const immutableFiles = viteOwnedFiles(viteManifest);
  await rm(resolve(publicRoot, ".vite"), { recursive: true, force: true });

  const assets = {};
  const publicFiles = (await listFiles(publicRoot)).sort();
  for (const filePath of publicFiles) {
    if (filePath.endsWith(".br") || filePath.endsWith(".gz")) continue;
    const file = outputRelativePath(filePath);
    const mime = mimeByExtension.get(extname(file).toLowerCase()) ?? "application/octet-stream";
    const bytes = await readFile(filePath);
    const fileStat = await stat(filePath);
    const entry = {
      mime,
      cacheControl: immutableFiles.has(file)
        ? "public, max-age=31536000, immutable"
        : "public, max-age=0, must-revalidate",
      lastModified: fileStat.mtime.toUTCString(),
      identity: representation(file, bytes),
    };

    if (bytes.byteLength > compressionThreshold && isCompressible(mime)) {
      const [brBytes, gzipBytes] = await Promise.all([
        compressBrotli(bytes, {
          params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
        }),
        compressGzip(bytes, { level: constants.Z_BEST_COMPRESSION }),
      ]);
      await Promise.all([
        writeFile(`${filePath}.br`, brBytes),
        writeFile(`${filePath}.gz`, gzipBytes),
      ]);
      entry.br = representation(`${file}.br`, brBytes);
      entry.gzip = representation(`${file}.gz`, gzipBytes);
    }

    const assetUrlPath = urlPath(file);
    invariant(!assets[assetUrlPath], `Duplicate public URL path: ${assetUrlPath}`);
    assets[assetUrlPath] = entry;
  }

  const manifest = { version: 1, assets };
  await writeFile(
    resolve(serverRoot, "assets-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeFile(
    resolve(outputRoot, "BUILD_METADATA.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        builtAt: new Date().toISOString(),
        node: process.versions.node,
        artifact: "atlas-hono-router-spa",
        performance: performanceMetadata(viteManifest, assets),
      },
      null,
      2,
    )}\n`,
  );
}

await main();
