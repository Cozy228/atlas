import {
  type GlideClusterClientConfiguration,
  GlideClusterClient,
  type ServerCredentials,
  ServiceType,
  TimeUnit,
} from "@valkey/valkey-glide";

import { parseValkeyUrl } from "../sourceContent/valkeyUrl";
import type { SessionRecord, SessionStore } from "./sessionStore";

/**
 * ElastiCache (Valkey) adapter for {@link SessionStore} — the prod session store (WS1/WS6).
 * Mirrors `ValkeyContentCache`'s client setup (cluster client, ElastiCache IAM auth when
 * the triple is present, TLS forced under IAM), adding a `del` for logout's local session
 * destruction. Keys are namespaced (`session:` by default) into a distinct keyspace on the
 * shared cache cluster.
 *
 * A backend outage is NOT masked here (unlike the content cache): the adapter throws, and
 * the composition fails hard — sessions must not silently split across tasks.
 */

type GlideString = string | { toString(): string };

type GlideClientLike = {
  get(key: string): Promise<GlideString | null>;
  set(
    key: string,
    value: string,
    options: { expiry: { type: unknown; count: number } },
  ): Promise<unknown>;
  del(keys: string[]): Promise<unknown>;
  close(): void;
};

type CreateClusterClient = (config: GlideClusterClientConfiguration) => Promise<GlideClientLike>;

type IamAuth = { username: string; clusterName: string; region: string };

export type ValkeySessionStoreInput = {
  url: string;
  keyPrefix?: string;
  username?: string;
  iamClusterName?: string;
  region?: string;
  client?: GlideClientLike;
  secondsUnit?: unknown;
  createClient?: CreateClusterClient;
};

const defaultCreateClient: CreateClusterClient = async (config) =>
  (await GlideClusterClient.createClient(config)) as GlideClientLike;

export class ValkeySessionStore implements SessionStore {
  private readonly url: string;
  private readonly keyPrefix: string;
  private readonly iam: IamAuth | undefined;
  private readonly createClient: CreateClusterClient;
  private client: GlideClientLike | undefined;
  private secondsUnit: unknown;

  constructor(input: ValkeySessionStoreInput) {
    this.url = input.url;
    this.keyPrefix = input.keyPrefix ?? "session:";
    this.iam =
      input.username && input.iamClusterName && input.region
        ? { username: input.username, clusterName: input.iamClusterName, region: input.region }
        : undefined;
    this.createClient = input.createClient ?? defaultCreateClient;
    this.client = input.client;
    this.secondsUnit = input.secondsUnit;
  }

  async get(sessionId: string): Promise<SessionRecord | undefined> {
    const client = await this.connect();
    const raw = await client.get(this.keyPrefix + sessionId);
    if (raw === null) {
      return undefined;
    }
    try {
      return JSON.parse(raw.toString()) as SessionRecord;
    } catch {
      return undefined;
    }
  }

  async set(sessionId: string, record: SessionRecord, ttlSeconds: number): Promise<void> {
    const client = await this.connect();
    await client.set(this.keyPrefix + sessionId, JSON.stringify(record), {
      expiry: { type: this.secondsUnit, count: ttlSeconds },
    });
  }

  async destroy(sessionId: string): Promise<void> {
    const client = await this.connect();
    await client.del([this.keyPrefix + sessionId]);
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
      useTLS: useTLS || credentials !== undefined,
    };
    if (credentials) {
      config.credentials = credentials;
    }
    this.client = await this.createClient(config);
    return this.client;
  }

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
