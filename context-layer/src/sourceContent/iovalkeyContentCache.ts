import type { CachedResponse, SourceContentCache } from "./sourceContentCache";

/**
 * Fallback ElastiCache (Valkey) adapter using the pure-JS `iovalkey`
 * (`ioredis` fork). GLIDE is the default (`valkeyContentCache.ts`); this exists
 * for runtimes where GLIDE's platform-native binaries are a problem. It is NOT
 * enabled by default — `createSourceContentCache` selects it only when
 * `CACHE_VALKEY_CLIENT=iovalkey`. `iovalkey` is an OPTIONAL dependency
 * imported lazily, so the default install never pulls it.
 */

/** The slice of the `iovalkey`/`ioredis` client this adapter uses. */
type ValkeyClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttlSeconds: number): Promise<unknown>;
};

export type IoValkeyContentCacheInput = {
  /** `rediss://host:6379` — `rediss://` enables TLS (required by ElastiCache). */
  url: string;
  /** Injectable for tests; production constructs an `iovalkey` client lazily. */
  client?: ValkeyClient;
};

export class IoValkeyContentCache implements SourceContentCache {
  private readonly url: string;
  private client: ValkeyClient | undefined;

  constructor(input: IoValkeyContentCacheInput) {
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
        "CACHE_VALKEY_CLIENT=iovalkey but the 'iovalkey' package is not installed. " +
          "Run `pnpm add iovalkey` in context-layer to use the iovalkey cache adapter.",
      );
    }
    const Client = mod.default;
    // `iovalkey` reads `rediss://` from the URL and enables TLS itself.
    this.client = new Client(this.url, { lazyConnect: true });
    return this.client;
  }
}
