import {
  type GlideClusterClientConfiguration,
  GlideClusterClient,
  type ServerCredentials,
  ServiceType,
  TimeUnit,
} from "@valkey/valkey-glide";

import type { CachedResponse, SourceContentCache } from "./sourceContentCache";
import { parseValkeyUrl } from "./valkeyUrl";

/**
 * ElastiCache (Valkey) adapter for {@link SourceContentCache}
 * (docs/architecture/source-content-cache.md). Selected only when
 * `CACHE_VALKEY_URL` is set. `@valkey/valkey-glide` is a hard dependency,
 * statically imported so the bundler traces it (and its platform-native
 * binary) into the server output. The client runs in cluster mode
 * (`GlideClusterClient`) to match a clustered ElastiCache endpoint.
 *
 * Authentication: when the ElastiCache IAM inputs (username + cluster + region)
 * are all present the adapter connects with GLIDE's IAM credentials — GLIDE
 * generates and refreshes the auth token itself (every 300s), so no AWS SDK is
 * pulled in and no token is managed here. Absent any of them it falls back to
 * an unauthenticated connection (backward-compatible). `iamConfig` and a static
 * `password` are mutually exclusive; only IAM is wired.
 *
 * A backend outage is not handled here — the adapter throws, and
 * `ResilientContentCache` degrades to the in-memory fallback one layer up.
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

/** Factory for the cluster client; injectable so tests can assert the config. */
type CreateClusterClient = (config: GlideClusterClientConfiguration) => Promise<GlideClientLike>;

/** ElastiCache IAM auth triple — enabled only when all three are supplied. */
type IamAuth = { username: string; clusterName: string; region: string };

export type ValkeyContentCacheInput = {
  /** `rediss://host:6379` — `rediss://` enables TLS (required by ElastiCache). */
  url: string;
  /** RBAC username for IAM AUTH; IAM is enabled only with all three IAM fields. */
  username?: string;
  /** ElastiCache cluster name for IAM token generation. */
  iamClusterName?: string;
  /** AWS region of the cluster (from `AWS_REGION`). */
  region?: string;
  /** Injectable for tests; production constructs a GLIDE client on first use. */
  client?: GlideClientLike;
  /** Injectable for tests; production defaults to GLIDE's seconds TimeUnit. */
  secondsUnit?: unknown;
  /** Injectable for tests; production uses `GlideClusterClient.createClient`. */
  createClient?: CreateClusterClient;
};

const defaultCreateClient: CreateClusterClient = async (config) =>
  (await GlideClusterClient.createClient(config)) as GlideClientLike;

export class ValkeyContentCache implements SourceContentCache {
  private readonly url: string;
  private readonly iam: IamAuth | undefined;
  private readonly createClient: CreateClusterClient;
  private client: GlideClientLike | undefined;
  private secondsUnit: unknown;

  constructor(input: ValkeyContentCacheInput) {
    this.url = input.url;
    this.iam =
      input.username && input.iamClusterName && input.region
        ? { username: input.username, clusterName: input.iamClusterName, region: input.region }
        : undefined;
    this.createClient = input.createClient ?? defaultCreateClient;
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
    const credentials = this.iamCredentials();
    const config: GlideClusterClientConfiguration = {
      addresses: [{ host, port }],
      // ElastiCache IAM AUTH mandates in-transit encryption — force TLS on when
      // IAM is enabled even if the URL uses redis://.
      useTLS: useTLS || credentials !== undefined,
    };
    if (credentials) {
      config.credentials = credentials;
    }
    this.client = await this.createClient(config);
    return this.client;
  }

  /** IAM credentials when the auth triple is present; GLIDE mints/refreshes the token. */
  private iamCredentials(): ServerCredentials | undefined {
    if (!this.iam) {
      return undefined;
    }
    return {
      username: this.iam.username,
      iamConfig: {
        clusterName: this.iam.clusterName,
        service: ServiceType.Elasticache,
        region: this.iam.region,
      },
    };
  }
}

// `parseValkeyUrl` now lives in `./valkeyUrl` (so the snapshot client can reuse it
// without pinning this GLIDE-importing module into the static graph). Re-exported
// here for back-compat with existing importers.
export { parseValkeyUrl } from "./valkeyUrl";
