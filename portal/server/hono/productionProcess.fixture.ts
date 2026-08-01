import { startProductionPortal } from "./production";

const serverRoot = process.env.ATLAS_TEST_SERVER_ROOT;
if (!serverRoot) throw new Error("ATLAS_TEST_SERVER_ROOT is required.");

await startProductionPortal({ serverRoot });
