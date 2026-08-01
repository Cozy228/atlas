import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

export type StaticAssetRepresentation = {
  file: string;
  size: number;
  etag: string;
};

export type StaticAssetManifestEntry = {
  mime: string;
  cacheControl: string;
  lastModified: string;
  identity: StaticAssetRepresentation;
  br?: StaticAssetRepresentation;
  gzip?: StaticAssetRepresentation;
};

export type StaticAssetManifest = {
  version: 1;
  assets: Record<string, StaticAssetManifestEntry>;
};

export type StaticAssetService = {
  serve(request: Request, urlPath?: string): Promise<Response | undefined>;
};

type Encoding = "br" | "gzip" | "identity";
type ValidatedRepresentation = StaticAssetRepresentation & { absoluteFile: string };
type ValidatedEntry = Omit<StaticAssetManifestEntry, "identity" | "br" | "gzip"> & {
  identity: ValidatedRepresentation;
  br?: ValidatedRepresentation;
  gzip?: ValidatedRepresentation;
};

export async function loadStaticAssetService(options: {
  publicRoot: string;
  manifest: StaticAssetManifest;
}): Promise<StaticAssetService> {
  if (options.manifest.version !== 1) throw new Error("Unsupported static asset manifest version.");

  const publicRoot = resolve(options.publicRoot);
  const entries = new Map<string, ValidatedEntry>();
  for (const [urlPath, entry] of Object.entries(options.manifest.assets)) {
    if (!urlPath.startsWith("/") || urlPath.includes("?") || urlPath.includes("#")) {
      throw new Error(`Invalid static asset URL path: ${urlPath}`);
    }
    if (!entry.mime || !entry.cacheControl || !Number.isFinite(Date.parse(entry.lastModified))) {
      throw new Error(`Invalid static asset metadata: ${urlPath}`);
    }
    entries.set(urlPath, {
      ...entry,
      identity: await validateRepresentation(publicRoot, entry.identity),
      br: entry.br ? await validateRepresentation(publicRoot, entry.br) : undefined,
      gzip: entry.gzip ? await validateRepresentation(publicRoot, entry.gzip) : undefined,
    });
  }

  return {
    async serve(request, urlPath) {
      if (request.method !== "GET" && request.method !== "HEAD") return undefined;
      const entry = entries.get(urlPath ?? new URL(request.url).pathname);
      if (!entry) return undefined;

      const selected = selectRepresentation(entry, request.headers.get("accept-encoding"));
      if (!selected) {
        return new Response(request.method === "HEAD" ? null : "406 Not Acceptable", {
          status: 406,
          headers: entry.br || entry.gzip ? { vary: "Accept-Encoding" } : undefined,
        });
      }
      const { encoding, representation } = selected;
      const headers = representationHeaders(entry, encoding, representation);

      const ifNoneMatch = request.headers.get("if-none-match");
      if (
        (ifNoneMatch && etagMatches(ifNoneMatch, representation.etag)) ||
        (!ifNoneMatch &&
          notModifiedSince(request.headers.get("if-modified-since"), entry.lastModified))
      ) {
        headers.delete("content-length");
        return new Response(null, { status: 304, headers });
      }

      const rangeHeader = request.headers.get("range");
      if (rangeHeader) {
        const range = parseRange(rangeHeader, representation.size);
        if (!range) {
          headers.set("content-range", `bytes */${representation.size}`);
          headers.set("content-length", "0");
          return new Response(null, { status: 416, headers });
        }
        const bytes = await readFile(representation.absoluteFile);
        const body = bytes.subarray(range.start, range.end + 1);
        headers.set("content-range", `bytes ${range.start}-${range.end}/${representation.size}`);
        headers.set("content-length", String(body.byteLength));
        return new Response(request.method === "HEAD" ? null : body, { status: 206, headers });
      }

      if (request.method === "HEAD") return new Response(null, { headers });
      return new Response(await readFile(representation.absoluteFile), { headers });
    },
  };
}

async function validateRepresentation(
  publicRoot: string,
  representation: StaticAssetRepresentation,
): Promise<ValidatedRepresentation> {
  if (
    !representation.file ||
    !Number.isSafeInteger(representation.size) ||
    representation.size < 0 ||
    !representation.etag
  ) {
    throw new Error("Invalid static asset representation metadata.");
  }
  const absoluteFile = resolve(publicRoot, representation.file);
  if (absoluteFile === publicRoot || !absoluteFile.startsWith(`${publicRoot}${sep}`)) {
    throw new Error(`Static asset representation escaped public root: ${representation.file}`);
  }
  const fileStat = await stat(absoluteFile);
  if (!fileStat.isFile() || fileStat.size !== representation.size) {
    throw new Error(
      `Static asset representation does not match its manifest: ${representation.file}`,
    );
  }
  return { ...representation, absoluteFile };
}

function selectRepresentation(
  entry: ValidatedEntry,
  acceptEncoding: string | null,
): { encoding: Encoding; representation: ValidatedRepresentation } | undefined {
  const quality = encodingQualities(acceptEncoding);
  const candidates: Array<{
    encoding: Encoding;
    representation: ValidatedRepresentation | undefined;
    quality: number;
    preference: number;
  }> = [
    { encoding: "br", representation: entry.br, quality: quality.br, preference: 3 },
    { encoding: "gzip", representation: entry.gzip, quality: quality.gzip, preference: 2 },
    {
      encoding: "identity",
      representation: entry.identity,
      quality: quality.identity,
      preference: 1,
    },
  ];
  const selected = candidates
    .filter((candidate) => candidate.representation && candidate.quality > 0)
    .sort((left, right) => right.quality - left.quality || right.preference - left.preference)[0];
  return selected?.representation
    ? { encoding: selected.encoding, representation: selected.representation }
    : undefined;
}

function encodingQualities(value: string | null): Record<Encoding, number> {
  if (!value) return { br: 0, gzip: 0, identity: 1 };
  const parsed = new Map<string, number>();
  for (const part of value.split(",")) {
    const [rawName, ...parameters] = part.trim().toLowerCase().split(";");
    if (!rawName) continue;
    const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
    const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
    parsed.set(rawName, Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0);
  }
  const wildcard = parsed.get("*");
  const qualityFor = (encoding: "br" | "gzip") => parsed.get(encoding) ?? wildcard ?? 0;
  return {
    br: qualityFor("br"),
    gzip: qualityFor("gzip"),
    identity: parsed.get("identity") ?? (wildcard === 0 ? 0 : 1),
  };
}

function representationHeaders(
  entry: ValidatedEntry,
  encoding: Encoding,
  representation: ValidatedRepresentation,
): Headers {
  const headers = new Headers({
    "accept-ranges": "bytes",
    "cache-control": entry.cacheControl,
    "content-length": String(representation.size),
    "content-type": entry.mime,
    etag: representation.etag,
    "last-modified": entry.lastModified,
  });
  if (entry.br || entry.gzip) headers.set("vary", "Accept-Encoding");
  if (encoding !== "identity") headers.set("content-encoding", encoding);
  return headers;
}

function etagMatches(value: string, etag: string): boolean {
  const comparable = (candidate: string) => candidate.trim().replace(/^W\//, "");
  return value
    .split(",")
    .some((candidate) => candidate.trim() === "*" || comparable(candidate) === etag);
}

function notModifiedSince(value: string | null, lastModified: string): boolean {
  if (!value) return false;
  const since = Date.parse(value);
  const modified = Date.parse(lastModified);
  return Number.isFinite(since) && Number.isFinite(modified) && modified <= since;
}

function parseRange(value: string, size: number): { start: number; end: number } | undefined {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || size === 0) return undefined;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return undefined;

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return undefined;
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(rawStart);
  const requestedEnd = rawEnd ? Number(rawEnd) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= size ||
    requestedEnd < start
  ) {
    return undefined;
  }
  return { start, end: Math.min(requestedEnd, size - 1) };
}
