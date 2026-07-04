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
import type { ResolutionContext } from "./resolverTypes";

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
  readonly scope?: {
    landingZoneIds?: string[];
    appId?: string;
    origin?: "by-value" | "by-reference";
  };
  readonly warnings: ReadonlyArray<{ code: string; message: string }>;
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
 * Step-1 adapter: always not-found. An unknown/unresolvable `appId` yields a
 * context with no app scope and a `scope_unresolved` warning (honest-empty).
 */
export const nullAppDirectoryAdapter: AppDirectoryPort = {
  async lookup() {
    return null;
  },
};

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
};

/**
 * Build the one governed resolution context (see module doc for the full
 * contract). Async because the process-shared content cache is selected from
 * the environment (Valkey when configured, in-memory otherwise).
 */
export async function createResolutionContext(
  input: CreateResolutionContextInput = {},
): Promise<GovernedResolutionContext> {
  void input;
  // Batch 0 skeleton: the contract above is frozen by the D1–D9 test suite;
  // behavior lands in Batch 1.
  throw new Error("unimplemented");
}
