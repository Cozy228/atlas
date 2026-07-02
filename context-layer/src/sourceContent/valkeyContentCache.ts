import { GlideClient, TimeUnit } from "@valkey/valkey-glide";

import type { CachedResponse, SourceContentCache } from "./sourceContentCache";

/**
 * ElastiCache (Valkey) adapter for {@link SourceContentCache}
 * (docs/architecture/source-content-cache.md). Selected only when
 * `CACHE_VALKEY_URL` is set. `@valkey/valkey-glide` is a hard dependency,
 * statically imported so the bundler traces it (and its platform-native
 * binary) into the server output. A backend outage is not handled here — the
 * adapter throws, and `ResilientContentCache` degrades to the in-memory
 * fallback one layer up.
 */

/** A GLIDE `get` yields a string or Buffer (GlideString), or null on miss. */
type GlideString = string | { toString(): string };

/** The slice of the GLIDE client this adapter uses (also the injectable test shape). */
type GlideClientLike = {
  get(key: string): Promise<GlideString | null>;
  set(
    key: string,
    value: string,
    options: { expiry: { type: unknown; count: number } },
  ): Promise<unknown>;
  close(): void;
};

export type ValkeyContentCacheInput = {
  /** `rediss://host:6379` — `rediss://` enables TLS (required by ElastiCache). */
  url: string;
  /** Injectable for tests; production constructs a GLIDE client on first use. */
  client?: GlideClientLike;
  /** Injectable for tests; production defaults to GLIDE's seconds TimeUnit. */
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
    const { host, port, useTLS } = parseValkeyUrl(this.url);
    this.secondsUnit ??= TimeUnit.Seconds;
    this.client = (await GlideClient.createClient({
      addresses: [{ host, port }],
      useTLS,
    })) as GlideClientLike;
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
