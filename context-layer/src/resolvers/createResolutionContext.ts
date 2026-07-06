/**
 * The governance gate (implementation-plan Step 1, I2 + M11).
 *
 * `createResolutionContext` is the ONLY producer of a usable resolution
 * context in the whole system. It absorbs `cachedResolutionContext`'s role:
 * the process-shared source-content cache is wired into `fetch`, and `fetch`
 * stays late-bound (re-reads `globalThis.fetch` per call) so the dev/
 * integration MSW interceptor is always picked up. Every entry point — HTTP
 * router, Portal in-process client, Nitro `.md` route, MCP handler —
 * constructs through this factory; handler signatures take the branded type
 * required, so an ungoverned read is unrepresentable at the type level.
 *
 * Identity is an opaque caller Bearer (ADR-0001): threaded unparsed and
 * unpersisted into `ctx.token`, never interpreted. Scope arrives by value
 * (inline manifest declaration — never writes, M11) or by reference (`appId`
 * resolved through {@link AppDirectoryPort}); both-supplied disagreement
 * scopes by VALUE and appends a `scope_drift` warning; an unknown `appId`
 * yields a context with no app scope and a `scope_unresolved` warning.
 * Absent scope = anonymous unscoped context (open discovery posture).
 */
import type {
  FetchLike,
  ResolutionChannel,
  ResolutionContext,
  ResolverWarning,
} from "./resolverTypes";
import { withFetchLogging } from "../observability/logging";
import { cacheTtlSeconds, sharedCache, withCache } from "../sourceContent/sourceContentCache";
import { sharedAppsRepository } from "../repositories/appsRepositoryFactory";
import { createSelfDeclaredAppsAdapter } from "../repositories/selfDeclaredAppsAdapter";

/**
 * Module-private brand: NEVER exported (not from this module's public face
 * beyond the type below, and never from the package-root barrel). A
 * hand-written object literal cannot provide it, so the factory is the only
 * value-level producer of a {@link GovernedResolutionContext}. Spreading an
 * existing governed context preserves the brand — accepted, because
 * governance already happened at its construction.
 */
const governedContextBrand: unique symbol = Symbol("atlas.governedResolutionContext");

/**
 * A resolution context that provably passed through the factory. Carries the
 * vetted scope in the P26 set shape (`landingZoneIds[]` — an APP may span
 * zones across clouds) with its provenance (`origin`), plus the governance
 * warnings accumulated while vetting (`scope_drift`, `scope_unresolved`).
 */
export type GovernedResolutionContext = ResolutionContext & {
  readonly [governedContextBrand]: true;
  readonly warnings: ReadonlyArray<ResolverWarning>;
  /** The face that produced this context (Step 6, locked decision 2); always
   *  seated by the gate (default `"http"`), so it is non-optional once governed. */
  readonly channel: ResolutionChannel;
};

/**
 * How scope enters the gate (M11):
 * - `by-value`: the repo manifest's declaration inline — stateless, zero
 *   registration, and it NEVER writes (no upsert-on-read).
 * - `by-reference`: a durable `AppRecord` id, resolved via the directory port.
 * - `both`: the caller supplied the manifest value AND an `appId`. The factory
 *   scopes by the VALUE (the caller's own freshest declaration) and appends a
 *   `scope_drift` warning when the referenced record disagrees (M11 conflict
 *   rule). Represented as one flat member so the by-value fields stay verbatim.
 */
export type ScopeInput =
  | { kind: "by-value"; landingZones: string[]; services?: string[] }
  | { kind: "by-reference"; appId: string }
  | { kind: "both"; landingZones: string[]; services?: string[]; appId: string };

/**
 * Lookup-only directory of registered APPs (consumer state). By-reference
 * scope resolution reads through this port; a write is unrepresentable here
 * by construction (M11: by-value never writes — nothing writes in Step 1).
 * `selfDeclaredAppsAdapter` + DynamoDB arrive in Step 3.
 */
export interface AppDirectoryPort {
  /** Resolve an appId to its declared landing-zone set (P26), or null when unknown. */
  lookup(appId: string): Promise<{ landingZoneIds: string[] } | null>;
}

/**
 * The empty directory: always not-found. An unknown/unresolvable `appId` yields
 * a context with no app scope and a `scope_unresolved` warning (honest-empty).
 * Kept exported for callers/tests that want the empty directory; the factory
 * DEFAULT is now the self-declared adapter over the shared apps store (Step 3).
 */
export const nullAppDirectoryAdapter: AppDirectoryPort = {
  async lookup() {
    return null;
  },
};

/**
 * The process-shared default directory (Step 3): the self-declared adapter over
 * `sharedAppsRepository(env)`, memoized like `sharedCache` (first-env wins), so
 * by-reference scope resolves through the real consumer-state store. The
 * Entra-era `registryAppsAdapter` is a pure swap of this default over the same
 * port.
 */
let defaultAppDirectoryMemo: AppDirectoryPort | undefined;
function defaultAppDirectory(env: Record<string, string | undefined>): AppDirectoryPort {
  return (defaultAppDirectoryMemo ??= createSelfDeclaredAppsAdapter(sharedAppsRepository(env)));
}

export type CreateResolutionContextInput = {
  /**
   * Opaque caller identity (ADR-0001): `bearer` is threaded unparsed and
   * unpersisted into `ctx.token`. Entra later arrives as a richer identity
   * input here — not a redesign. No raw principal field ever rides the ctx.
   */
  identity?: { bearer?: string };
  /** Scope declaration; absent = anonymous unscoped context. */
  scope?: ScopeInput;
  /** Environment for cache configuration; defaults to the process env. */
  env?: Record<string, string | undefined>;
  /** By-reference resolution port; defaults to {@link nullAppDirectoryAdapter}. */
  appDirectory?: AppDirectoryPort;
  /** The producing face (Step 6, locked decision 2); defaults to `"http"`. */
  channel?: ResolutionChannel;
};

/**
 * Build the one governed resolution context (see module doc for the full
 * contract). Async because the process-shared content cache is selected from
 * the environment (Valkey when configured, in-memory otherwise).
 */
export async function createResolutionContext(
  input: CreateResolutionContextInput = {},
): Promise<GovernedResolutionContext> {
  const env = input.env ?? readProcessEnv();

  // Absorb `cachedResolutionContext`'s role: a late-bound fetch (re-reads
  // `globalThis.fetch` per call so the dev/integration MSW interceptor is always
  // picked up) wrapped by the process-shared content cache.
  const cache = await sharedCache(env);
  const fetch = withCache(lateBoundFetch(), cache, cacheTtlSeconds(env));

  const vetted = await vetScope(input.scope, input.appDirectory ?? defaultAppDirectory(env));

  const governed: GovernedResolutionContext = {
    // Opaque caller Bearer (ADR-0001): threaded unparsed, never interpreted.
    token: input.identity?.bearer,
    fetch,
    scope: vetted.scope,
    warnings: vetted.warnings,
    // Face attribution for the honesty instruments (Step 6, locked decision 2).
    channel: input.channel ?? "http",
    [governedContextBrand]: true,
  };
  return governed;
}

/** The vetted scope + the governance warnings accrued while vetting it. */
type VettedScope = {
  scope: GovernedResolutionContext["scope"];
  warnings: ResolverWarning[];
};

/**
 * Vet an incoming {@link ScopeInput} into the seated P26 scope (M11):
 * - by-value: the caller's declaration is seated verbatim; the directory is
 *   NEVER consulted (a by-value read never writes and never looks up).
 * - by-reference: resolved through the port; unknown ⇒ no app scope +
 *   `scope_unresolved`.
 * - both: the value wins (`origin: "by-value"`); the reference is a lookup-only
 *   reconciliation — `scope_drift` when the resolved set disagrees,
 *   `scope_unresolved` when the reference does not resolve at all.
 * - absent: an anonymous unscoped context (open discovery posture).
 */
async function vetScope(
  scope: ScopeInput | undefined,
  appDirectory: AppDirectoryPort,
): Promise<VettedScope> {
  if (!scope) {
    return { scope: undefined, warnings: [] };
  }

  if (scope.kind === "by-value") {
    return {
      scope: { landingZoneIds: scope.landingZones, origin: "by-value" },
      warnings: [],
    };
  }

  if (scope.kind === "by-reference") {
    const resolved = await appDirectory.lookup(scope.appId);
    if (!resolved) {
      return {
        scope: undefined,
        warnings: [
          {
            code: "scope_unresolved",
            message: `AppRecord '${scope.appId}' could not be resolved; no app scope was seated.`,
          },
        ],
      };
    }
    return {
      scope: {
        landingZoneIds: resolved.landingZoneIds,
        appId: scope.appId,
        origin: "by-reference",
      },
      warnings: [],
    };
  }

  // both: the caller supplied the manifest value AND an appId. The value wins;
  // the reference is a read-only reconciliation.
  const resolved = await appDirectory.lookup(scope.appId);
  const seated: GovernedResolutionContext["scope"] = {
    landingZoneIds: scope.landingZones,
    origin: "by-value",
  };
  if (!resolved) {
    return {
      scope: seated,
      warnings: [
        {
          code: "scope_unresolved",
          message: `AppRecord '${scope.appId}' could not be resolved; the by-value declaration stands.`,
        },
      ],
    };
  }
  if (!sameSet(scope.landingZones, resolved.landingZoneIds)) {
    return {
      scope: seated,
      warnings: [
        {
          code: "scope_drift",
          message: `AppRecord '${scope.appId}' declares [${resolved.landingZoneIds.join(", ")}] but the by-value scope declares [${scope.landingZones.join(", ")}]; the by-value declaration wins.`,
        },
      ],
    };
  }
  return { scope: seated, warnings: [] };
}

/** Order-insensitive set equality over landing-zone id lists. */
function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const seen = new Set(a);
  return b.every((id) => seen.has(id));
}

/**
 * A late-bound `FetchLike`: re-reads `globalThis.fetch` on every call rather
 * than capturing it once, so the dev/integration MSW interceptor (which patches
 * `globalThis.fetch` when its server starts) is always picked up. In prod this
 * is the real `globalThis.fetch`.
 */
function lateBoundFetch(): FetchLike {
  return withFetchLogging(
    (input, init) => globalThis.fetch(input, init as RequestInit) as ReturnType<FetchLike>,
  );
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}
