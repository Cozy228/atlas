/**
 * Integration test setup — registers the Node-mode MSW server lifecycle so any
 * test that drives a live adapter through `globalThis.fetch` is answered from the
 * fixtures. Wired as a vitest `setupFiles` entry (runs in every test file).
 *
 * `onUnhandledRequest: 'bypass'` keeps unit tests untouched: they inject a
 * `FetchLike` fake and never reach `globalThis.fetch`, so MSW never sees them;
 * any genuinely un-mocked outbound fetch passes through rather than throwing.
 */
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
