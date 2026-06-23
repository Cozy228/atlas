import type { CachedResponse, SourceContentCache } from "./sourceContentCache.js";

/**
 * ElastiCache (Valkey) adapter for {@link SourceContentCache}
 * (docs/architecture/source-content-cache.md). Active only when
 * `ATLAS_CACHE_VALKEY_URL` is set; `iovalkey` is an OPTIONAL dependency imported
 * lazily, so the default install never pulls a Redis client. `valkey-glide` is
 * the upgrade path (IAM auth / topology discovery) behind this same seam.
 */

/** The slice of the `iovalkey`/`ioredis` client this adapter uses. */
type ValkeyClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttlSeconds: number): Promise<unknown>;
};

export type ValkeyContentCacheInput = {
  /** `rediss://host:6379` — `rediss://` enables TLS (required by ElastiCache). */
  url: string;
  /** Injectable for tests; production constructs an `iovalkey` client lazily. */
  client?: ValkeyClient;
};

export class ValkeyContentCache implements SourceContentCache {
  private readonly url: string;
  private client: ValkeyClient | undefined;

  constructor(input: ValkeyContentCacheInput) {
    this.url = input.url;
    this.client = input.client;
  }

  async get(key: string): Promise<CachedResponse | undefined> {
    const client = await this.connect();
    const raw = await client.get(key);
    if (raw === null) {
      return undefined;
    }
    try {
      return JSON.parse(raw) as CachedResponse;
    } catch {
      // A value we cannot parse is treated as a miss, never served as content.
      return undefined;
    }
  }

  async set(key: string, value: CachedResponse, ttlSeconds: number): Promise<void> {
    const client = await this.connect();
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  private async connect(): Promise<ValkeyClient> {
    if (this.client) {
      return this.client;
    }
    // Non-literal specifier: `iovalkey` is optional and may be absent, so this
    // must not be a statically resolved import.
    const specifier = "iovalkey";
    let mod: { default: new (url: string, options?: unknown) => ValkeyClient };
    try {
      mod = (await import(specifier)) as typeof mod;
    } catch {
      throw new Error(
        "ATLAS_CACHE_VALKEY_URL is set but the 'iovalkey' package is not installed. " +
          "Run `pnpm add iovalkey` in context-layer to enable the Valkey cache adapter.",
      );
    }
    const Client = mod.default;
    this.client = new Client(this.url, { lazyConnect: true });
    return this.client;
  }
}
