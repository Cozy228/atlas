import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

await rm(fileURLToPath(new URL("../.output", import.meta.url)), {
  recursive: true,
  force: true,
});
