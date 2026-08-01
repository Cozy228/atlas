import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { startPortalServer } from "./server";
import { loadStaticAssetService, type StaticAssetManifest } from "./staticAssets";

const serverRoot = dirname(fileURLToPath(import.meta.url));
const outputRoot = resolve(serverRoot, "..");
const publicRoot = resolve(outputRoot, "public");
const manifest = JSON.parse(
  await readFile(resolve(serverRoot, "assets-manifest.json"), "utf8"),
) as StaticAssetManifest;
const staticAssets = await loadStaticAssetService({ publicRoot, manifest });

startPortalServer({
  serveStaticAsset: (request) => staticAssets.serve(request),
  renderSpaDocument: async (request) => {
    const response = await staticAssets.serve(request, "/index.html");
    if (!response) throw new Error("The SPA document is missing from the asset manifest.");
    return response;
  },
});
