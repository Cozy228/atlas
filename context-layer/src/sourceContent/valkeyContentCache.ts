import type { CachedResponse, SourceContentCache } from "./sourceContentCache.js";

/**
 * ElastiCache (Valkey) adapter for {@link SourceContentCache}
 * (docs/architecture/source-content-cache.md). Active only when
 * `ATLAS_CACHE_VALKEY_URL` is set; `@valkey/valkey-glide` is an OPTIONAL
 * dependency imported lazily, so the default install never pulls a Valkey
 * client (nor its platform-native binaries).
 */

/** A GLIDE `get` yields a string or Buffer (GlideString), or null on miss. */
type GlideString = string | { toString(): string };

/** The slice of the GLIDE `GlideClient` this adapter uses. */
type GlideClientLike = {
  get(key: string): Promise<GlideString | null>;
  set(
    key: string,
    value: string,
    options: { expiry: { type: unknown; count: number } },
  ): Promise<unknown>;
  close(): void;
};

/** The lazily-imported slice of `@valkey/valkey-glide`. */
type GlideModule = {
  GlideClient: {
    createClient(config: {
      addresses: { host: string; port: number }[];
      useTLS: boolean;
    }): Promise<GlideClientLike>;
  };
  TimeUnit: { Seconds: unknown };
};

export type ValkeyContentCacheInput = {
  /** `rediss://host:6379` — `rediss://` enables TLS (required by ElastiCache). */
  url: string;
  /** Injectable for tests; production constructs a GLIDE client lazily. */
  client?: GlideClientLike;
  /** Injectable for tests; production reads it off the lazy GLIDE import. */
  secondsUnit?: unknown;
};

export class ValkeyContentCache implements SourceContentCache {
  private readonly url: string;
  private client: GlideClientLike | undefined;
  private secondsUnit: unknown;

  constructor(input: ValkeyContentCacheInput) {
    this.url = input.url;
    this.client = input.client;
    this.secondsUnit = input.secondsUnit;
  }

  async get(key: string): Promise<CachedResponse | undefined> {
    const client = await this.connect();
    const raw = await client.get(key);
    if (raw === null) {
      return undefined;
    }
    try {
      return JSON.parse(raw.toString()) as CachedResponse;
    } catch {
      // A value we cannot parse is treated as a miss, never served as content.
      return undefined;
    }
  }

  async set(key: string, value: CachedResponse, ttlSeconds: number): Promise<void> {
    const client = await this.connect();
    await client.set(key, JSON.stringify(value), {
      expiry: { type: this.secondsUnit, count: ttlSeconds },
    });
  }

  private async connect(): Promise<GlideClientLike> {
    if (this.client) {
      return this.client;
    }
    // Non-literal specifier: `@valkey/valkey-glide` is optional and may be
    // absent, so this must not be a statically resolved import.
    const specifier = "@valkey/valkey-glide";
    let mod: GlideModule;
    try {
      mod = (await import(specifier)) as GlideModule;
    } catch {
      throw new Error(
        "ATLAS_CACHE_VALKEY_URL is set but the '@valkey/valkey-glide' package is not installed. " +
          "Run `pnpm add @valkey/valkey-glide` in context-layer to enable the Valkey cache adapter.",
      );
    }
    const { host, port, useTLS } = parseValkeyUrl(this.url);
    this.secondsUnit ??= mod.TimeUnit.Seconds;
    this.client = await mod.GlideClient.createClient({
      addresses: [{ host, port }],
      useTLS,
    });
    return this.client;
  }
}

/** Parse `rediss://host:6379` into GLIDE address + TLS flag. */
export function parseValkeyUrl(url: string): { host: string; port: number; useTLS: boolean } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    useTLS: parsed.protocol === "rediss:",
  };
}
