/**
 * Prototype `opus` — fixture entry point
 * ======================================
 * Two fictional applications, one golden path, deterministic timestamps. The
 * surfaces read from here and nowhere else; there is no backend behind this
 * prototype and no live system is contacted.
 */
import { APP_REFUND_API } from "./app-refund-api";
import { APP_SEARCH_INDEXER } from "./app-search-indexer";
import type { Application } from "./types";

export { APP_REFUND_API, APP_SEARCH_INDEXER };
export const APPLICATIONS: ReadonlyArray<Application> = [APP_REFUND_API, APP_SEARCH_INDEXER];

/** The application the prototype opens on: the one mid-journey with a failure. */
export const DEFAULT_APPLICATION_ID = APP_REFUND_API.id;

/** Resolves an application id from a URL, falling back to the default. */
export function resolveApplication(id: string | undefined): Application {
  return APPLICATIONS.find((app) => app.id === id) ?? APP_REFUND_API;
}

export * from "./clock";
export * from "./derive";
export * from "./phases";
export * from "./systems";
export type * from "./types";
