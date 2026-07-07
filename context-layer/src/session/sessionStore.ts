import type { IdentityClaims } from "../identity/claims";
import type { SessionConfig } from "../identity/entraConfig";

/**
 * BFF session store (WS1, R6). A PORT, not a Valkey-only implementation — cloned from the
 * `sourceContentCache` factory shape (`InMemory*` for tests + a Valkey adapter for prod,
 * selected by env). The memory adapter makes the E2 BFF round-trip locally provable with
 * ZERO tenant; the Valkey adapter is the prod composition (shares the cache cluster,
 * distinct keyspace).
 *
 * The record holds **id_token claims + refresh token ONLY** (locked decision 7) — there is
 * NO Context-API access token: the browser makes no outbound call to the in-process Context
 * layer, so there is nothing to bear a token. TTL tracks the token lifetime.
 */
export type SessionRecord = {
  /** id_token claims (decision 7). Mapped to {@link IdentityClaims} for the L2 factory. */
  claims: IdentityClaims;
  /** Entra refresh token for silent renewal (decision 7). NEVER an access token. */
  refreshToken?: string;
  /** Epoch ms the session was created (also the freshness clock for the revocation bound). */
  createdAt: number;
  /** Epoch ms the session expires (TTL = token lifetime). */
  expiresAt: number;
};

export interface SessionStore {
  get(sessionId: string): Promise<SessionRecord | undefined>;
  set(sessionId: string, record: SessionRecord, ttlSeconds: number): Promise<void>;
  destroy(sessionId: string): Promise<void>;
}

/**
 * In-memory session store with per-entry expiry — the test/dev adapter. Mirrors
 * `InMemoryContentCache`: a `Map` with lazy expiry on read. Per-instance (not shared across
 * tasks), which is why prod uses Valkey; for a single-process test/dev run it is exact.
 */
export class InMemorySessionStore implements SessionStore {
  private readonly store = new Map<string, { record: SessionRecord; expiresAt: number }>();
  private readonly now: () => number;

  constructor(options: { now?: () => number } = {}) {
    this.now = options.now ?? Date.now;
  }

  async get(sessionId: string): Promise<SessionRecord | undefined> {
    const entry = this.store.get(sessionId);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.store.delete(sessionId);
      return undefined;
    }
    return entry.record;
  }

  async set(sessionId: string, record: SessionRecord, ttlSeconds: number): Promise<void> {
    this.store.set(sessionId, { record, expiresAt: this.now() + ttlSeconds * 1000 });
  }

  async destroy(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }
}

/**
 * Select the session store from the environment, mirroring `createSourceContentCache`: a
 * Valkey adapter when a session Valkey URL is configured, otherwise the in-memory default.
 * Unlike the content cache there is NO resilient in-memory fallback — sessions must stay
 * consistent across Fargate tasks, so a Valkey outage fails hard rather than silently
 * splitting sessions per task. The Valkey client module is dynamic-imported so GLIDE only
 * loads when a URL is configured.
 */
export async function createSessionStore(
  env: Record<string, string | undefined>,
  config: SessionConfig,
): Promise<SessionStore> {
  if (config.valkeyUrl) {
    const { ValkeySessionStore } = await import("./valkeySessionStore");
    return new ValkeySessionStore({
      url: config.valkeyUrl,
      keyPrefix: "session:",
      username: env.CACHE_VALKEY_USERNAME,
      iamClusterName: env.CACHE_VALKEY_IAM_CLUSTER,
      region: env.AWS_REGION,
    });
  }
  return new InMemorySessionStore();
}

let sharedSessionStorePromise: Promise<SessionStore> | undefined;

/** One shared session store per process, memoized like `sharedCache`. */
export function sharedSessionStore(
  env: Record<string, string | undefined>,
  config: SessionConfig,
): Promise<SessionStore> {
  return (sharedSessionStorePromise ??= createSessionStore(env, config));
}
