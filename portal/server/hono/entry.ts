import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { startProductionPortal } from "./production";

const serverRoot = dirname(fileURLToPath(import.meta.url));
await startProductionPortal({ serverRoot });
