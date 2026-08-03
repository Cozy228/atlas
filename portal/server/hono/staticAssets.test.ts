import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  loadStaticAssetService,
  type StaticAssetManifest,
  type StaticAssetService,
} from "./staticAssets";

const lastModified = "Sat, 01 Aug 2026 10:00:00 GMT";
const identity = Buffer.from("0123456789");
const gzip = Buffer.from("gzip-bytes");
const br = Buffer.from("br-bytes");

describe("manifest-backed static assets", () => {
  let publicRoot: string;
  let service: StaticAssetService;

  beforeEach(async () => {
    publicRoot = await mkdtemp(resolve(tmpdir(), "atlas-static-"));
    await Promise.all([
      writeFile(resolve(publicRoot, "app.js"), identity),
      writeFile(resolve(publicRoot, "app.js.gz"), gzip),
      writeFile(resolve(publicRoot, "app.js.br"), br),
    ]);
    service = await loadStaticAssetService({ publicRoot, manifest: manifest() });
  });

  afterEach(async () => {
    await rm(publicRoot, { recursive: true, force: true });
  });

  it("serves exact manifest entries and leaves missing or non-read requests unmatched", async () => {
    const response = await service.serve(request("/app.js"));

    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe(identity.toString());
    expect(response?.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(response?.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response?.headers.get("accept-ranges")).toBe("bytes");
    expect(response?.headers.get("content-length")).toBe(String(identity.byteLength));
    expect(response?.headers.get("vary")).toBe("Accept-Encoding");
    await expect(service.serve(request("/missing.js"))).resolves.toBeUndefined();
    await expect(service.serve(request("/app.js", {}, "POST"))).resolves.toBeUndefined();
  });

  it("negotiates q-values before the br, gzip, identity server preference", async () => {
    const preferredBr = await service.serve(request("/app.js", { "accept-encoding": "gzip, br" }));
    const preferredGzipByQuality = await service.serve(
      request("/app.js", { "accept-encoding": "br;q=0.4, gzip;q=0.8, identity;q=0.2" }),
    );
    const preferredIdentityByQuality = await service.serve(
      request("/app.js", { "accept-encoding": "br;q=0.4, gzip;q=0.3" }),
    );
    const wildcard = await service.serve(request("/app.js", { "accept-encoding": "*" }));
    const unacceptable = await service.serve(
      request("/app.js", { "accept-encoding": "br;q=0, gzip;q=0, identity;q=0" }),
    );

    expect(preferredBr?.headers.get("content-encoding")).toBe("br");
    expect(await preferredBr?.text()).toBe(br.toString());
    expect(preferredGzipByQuality?.headers.get("content-encoding")).toBe("gzip");
    expect(preferredIdentityByQuality?.headers.get("content-encoding")).toBeNull();
    expect(wildcard?.headers.get("content-encoding")).toBe("br");
    expect(unacceptable?.status).toBe(406);
  });

  it("preserves representation metadata for HEAD and conditional 304 responses", async () => {
    const head = await service.serve(request("/app.js", { "accept-encoding": "gzip" }, "HEAD"));
    const byEtag = await service.serve(
      request("/app.js", {
        "accept-encoding": "gzip",
        "if-none-match": 'W/"gzip-etag"',
      }),
    );
    const byDate = await service.serve(request("/app.js", { "if-modified-since": lastModified }));
    const etagPrecedence = await service.serve(
      request("/app.js", {
        "if-none-match": '"different"',
        "if-modified-since": "Sun, 02 Aug 2026 10:00:00 GMT",
      }),
    );

    expect(head?.status).toBe(200);
    expect(head?.headers.get("content-encoding")).toBe("gzip");
    expect(head?.headers.get("etag")).toBe('"gzip-etag"');
    expect(head?.headers.get("content-length")).toBe(String(gzip.byteLength));
    expect(await head?.text()).toBe("");
    expect(byEtag?.status).toBe(304);
    expect(byEtag?.headers.get("content-length")).toBeNull();
    expect(byEtag?.headers.get("content-encoding")).toBe("gzip");
    expect(byDate?.status).toBe(304);
    expect(etagPrecedence?.status).toBe(200);
  });

  it.each([
    ["bytes=2-5", "2345", "bytes 2-5/10"],
    ["bytes=7-", "789", "bytes 7-9/10"],
    ["bytes=-3", "789", "bytes 7-9/10"],
    ["bytes=8-99", "89", "bytes 8-9/10"],
  ])("serves a single %s range", async (range, body, contentRange) => {
    const response = await service.serve(request("/app.js", { range }));

    expect(response?.status).toBe(206);
    expect(await response?.text()).toBe(body);
    expect(response?.headers.get("content-range")).toBe(contentRange);
    expect(response?.headers.get("content-length")).toBe(String(body.length));
  });

  it.each(["bytes=", "bytes=20-30", "bytes=5-2", "bytes=-0", "bytes=0-1,3-4"])(
    "rejects invalid or multi-range %s",
    async (range) => {
      const response = await service.serve(request("/app.js", { range }));

      expect(response?.status).toBe(416);
      expect(response?.headers.get("content-range")).toBe("bytes */10");
      expect(response?.headers.get("content-length")).toBe("0");
    },
  );

  it("uses an override lookup path for SPA document fallback", async () => {
    const response = await service.serve(request("/catalog"), "/app.js");
    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe(identity.toString());
  });

  it("rejects files that escape the public root or disagree with manifest sizes", async () => {
    const escaped = manifest();
    escaped.assets["/app.js"].identity.file = "../outside.js";
    await expect(loadStaticAssetService({ publicRoot, manifest: escaped })).rejects.toThrow(
      /escaped public root/,
    );

    const wrongSize = manifest();
    wrongSize.assets["/app.js"].identity.size += 1;
    await expect(loadStaticAssetService({ publicRoot, manifest: wrongSize })).rejects.toThrow(
      /does not match its manifest/,
    );
  });
});

function manifest(): StaticAssetManifest {
  return {
    version: 1,
    assets: {
      "/app.js": {
        mime: "text/javascript; charset=utf-8",
        cacheControl: "public, max-age=31536000, immutable",
        lastModified,
        identity: { file: "app.js", size: identity.byteLength, etag: '"identity-etag"' },
        gzip: { file: "app.js.gz", size: gzip.byteLength, etag: '"gzip-etag"' },
        br: { file: "app.js.br", size: br.byteLength, etag: '"br-etag"' },
      },
    },
  };
}

function request(path: string, headers: HeadersInit = {}, method = "GET"): Request {
  return new Request(`http://portal.test${path}`, { method, headers });
}
