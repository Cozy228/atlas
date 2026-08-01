import { Cluster } from "iovalkey";

import type { CachedResponse, SourceContentCache } from "./sourceContentCache";
import { createElastiCacheIamTokenProvider } from "./elasticacheIamToken";

const IAM_TOKEN_REFRESH_MS = 14 * 60_000;

type ClusterClient = {
  connect(): Promise<void>;
  disconnect(reconnect?: boolean): void;
  get(key: string): Promise<string | null>;
  quit(): Promise<unknown>;
  set(key: string, value: string, mode: "EX", ttlSeconds: number): Promise<unknown>;
};

type ClusterClientFactoryInput = {
  host: string;
  password: string;
  port: number;
  username: string;
};

export type ValkeyContentCacheInput = {
  cacheName: string;
  region: string;
  url: string;
  userId: string;
  clientFactory?: (input: ClusterClientFactoryInput) => Promise<ClusterClient>;
  now?: () => number;
  tokenProvider?: () => Promise<string>;
};

/** Shared Valkey cache backed by iovalkey's cluster-aware TLS client and IAM auth. */
export class ValkeyContentCache implements SourceContentCache {
  private readonly clientFactory: (input: ClusterClientFactoryInput) => Promise<ClusterClient>;
  private readonly host: string;
  private readonly now: () => number;
  private readonly port: number;
  private readonly tokenProvider: () => Promise<string>;
  private readonly userId: string;
  private connection: { client: ClusterClient; refreshAt: number } | undefined;
  private connectionPromise: Promise<ClusterClient> | undefined;

  constructor(input: ValkeyContentCacheInput) {
    const url = new URL(input.url);
    if (url.protocol !== "rediss:") {
      throw new Error("CACHE_VALKEY_URL must use rediss:// for ElastiCache IAM auth.");
    }
    this.host = url.hostname;
    this.port = url.port ? Number(url.port) : 6379;
    this.userId = input.userId;
    this.now = input.now ?? Date.now;
    this.tokenProvider =
      input.tokenProvider ??
      createElastiCacheIamTokenProvider({
        cacheName: input.cacheName,
        region: input.region,
        userId: input.userId,
      });
    this.clientFactory = input.clientFactory ?? createClusterClient;
  }

  async get(key: string): Promise<CachedResponse | undefined> {
    const raw = await (await this.connect()).get(key);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as CachedResponse;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: CachedResponse, ttlSeconds: number): Promise<void> {
    await (await this.connect()).set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async close(): Promise<void> {
    const pending = this.connectionPromise;
    this.connectionPromise = undefined;
    if (pending) await pending.catch(() => undefined);
    const connection = this.connection;
    this.connection = undefined;
    if (!connection) return;
    await closeClient(connection.client);
  }

  private async connect(): Promise<ClusterClient> {
    if (this.connection && this.now() < this.connection.refreshAt) {
      return this.connection.client;
    }
    if (!this.connectionPromise) {
      this.connectionPromise = this.rotate().finally(() => {
        this.connectionPromise = undefined;
      });
    }
    return this.connectionPromise;
  }

  private async rotate(): Promise<ClusterClient> {
    const password = await this.tokenProvider();
    const client = await this.clientFactory({
      host: this.host,
      password,
      port: this.port,
      username: this.userId,
    });
    const previous = this.connection;
    this.connection = { client, refreshAt: this.now() + IAM_TOKEN_REFRESH_MS };
    if (previous) await closeClient(previous.client);
    return client;
  }
}

async function createClusterClient(input: ClusterClientFactoryInput): Promise<ClusterClient> {
  const client = new Cluster([{ host: input.host, port: input.port }], {
    dnsLookup: (address, callback) => callback(null, address),
    lazyConnect: true,
    redisOptions: {
      password: input.password,
      tls: {},
      username: input.username,
    },
  }) as ClusterClient;
  await client.connect();
  return client;
}

async function closeClient(client: ClusterClient): Promise<void> {
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}
