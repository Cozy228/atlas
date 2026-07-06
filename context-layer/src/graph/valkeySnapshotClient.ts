/**
 * Valkey clients for {@link ValkeySnapshotStore} (Step-2 tail, M2/M10). Mirrors
 * the content-cache adapter split exactly: GLIDE is the default; `iovalkey` is
 * an opt-in fallback (`CACHE_VALKEY_CLIENT=iovalkey`). Both share the EXISTING
 * Valkey env (`CACHE_VALKEY_URL`, `CACHE_VALKEY_CLIENT`, `CACHE_VALKEY_USERNAME`,
 * `CACHE_VALKEY_IAM_CLUSTER`, `AWS_REGION`) — no new env vars, no new infra.
 *
 * This module is dynamic-imported by the factory ONLY when a Valkey URL is set,
 * so the native GLIDE binary never loads on the in-memory path. The scripted CAS
 * (`SNAPSHOT_CAS_LUA`) is invoked here; the store orchestrates JSON + the roots
 * index on top of it.
 */
import {
  type GlideClusterClientConfiguration,
  GlideClusterClient,
  Script,
  type ServerCredentials,
  ServiceType,
} from "@valkey/valkey-glide";

import { parseValkeyUrl } from "../sourceContent/valkeyUrl";
import { SNAPSHOT_CAS_LUA, type SnapshotClient } from "./valkeySnapshotStore";

/** A GLIDE `get` yields a string or Buffer (GlideString), or null on miss. */
type GlideString = string | { toString(): string };

/** The slice of the GLIDE cluster client the snapshot store uses (also the
 *  injectable test shape). */
type GlideClientLike = {
  get(key: string): Promise<GlideString | null>;
  invokeScript(
    script: Script,
    options?: { keys?: GlideString[]; args?: GlideString[] },
  ): Promise<unknown>;
  smembers(key: string): Promise<Set<GlideString>>;
  close(): void;
};

/** Factory for the cluster client; injectable so tests can assert the config. */
type CreateClusterClient = (config: GlideClusterClientConfiguration) => Promise<GlideClientLike>;

/** ElastiCache IAM auth triple — enabled only when all three are supplied. */
type IamAuth = { username: string; clusterName: string; region: string };

export type GlideSnapshotClientInput = {
  /** `rediss://host:6379` — `rediss://` enables TLS (required by ElastiCache). */
  url: string;
  /** RBAC username for IAM AUTH; IAM is enabled only with all three IAM fields. */
  username?: string;
  /** ElastiCache cluster name for IAM token generation. */
  iamClusterName?: string;
  /** AWS region of the cluster (from `AWS_REGION`). */
  region?: string;
  /** Injectable for tests; production connects a GLIDE client eagerly. */
  createClient?: CreateClusterClient;
};

const defaultCreateClient: CreateClusterClient = async (config) =>
  (await GlideClusterClient.createClient(config)) as GlideClientLike;

/**
 * GLIDE-backed snapshot client. The connection is established EAGERLY at
 * construction (decision 5): a bad endpoint throws here so the factory can fall
 * back to in-memory with a loud log, rather than degrading per-op.
 */
export class GlideSnapshotClient implements SnapshotClient {
  private readonly client: GlideClientLike;
  private readonly script: Script;

  private constructor(client: GlideClientLike) {
    this.client = client;
    // One long-lived script per client (reused across every CAS); a single
    // never-released script is acceptable for a process-lifetime store.
    this.script = new Script(SNAPSHOT_CAS_LUA);
  }

  static async connect(input: GlideSnapshotClientInput): Promise<GlideSnapshotClient> {
    const create = input.createClient ?? defaultCreateClient;
    const { host, port, useTLS } = parseValkeyUrl(input.url);
    const iam: IamAuth | undefined =
      input.username && input.iamClusterName && input.region
        ? { username: input.username, clusterName: input.iamClusterName, region: input.region }
        : undefined;
    const credentials = iamCredentials(iam);
    const config: GlideClusterClientConfiguration = {
      addresses: [{ host, port }],
      // ElastiCache IAM AUTH mandates in-transit encryption — force TLS on when
      // IAM is enabled even if the URL uses redis://.
      useTLS: useTLS || credentials !== undefined,
    };
    if (credentials) {
      config.credentials = credentials;
    }
    return new GlideSnapshotClient(await create(config));
  }

  async get(key: string): Promise<string | null> {
    const raw = await this.client.get(key);
    return raw === null ? null : raw.toString();
  }

  async casSwap(
    key: string,
    indexKey: string,
    expectedPendingId: string,
    nextValue: string,
    rootId: string,
  ): Promise<boolean> {
    const result = await this.client.invokeScript(this.script, {
      keys: [key, indexKey],
      args: [expectedPendingId, nextValue, rootId],
    });
    return Number(result) === 1;
  }

  async listRoots(indexKey: string): Promise<string[]> {
    const members = await this.client.smembers(indexKey);
    return Array.from(members, (member) => member.toString());
  }
}

/** IAM credentials when the auth triple is present; GLIDE mints/refreshes the token. */
function iamCredentials(iam: IamAuth | undefined): ServerCredentials | undefined {
  if (!iam) {
    return undefined;
  }
  return {
    username: iam.username,
    iamConfig: {
      clusterName: iam.clusterName,
      service: ServiceType.Elasticache,
      region: iam.region,
    },
  };
}

/** The slice of the `iovalkey`/`ioredis` client the snapshot store uses. */
type IoValkeyClient = {
  get(key: string): Promise<string | null>;
  eval(script: string, numKeys: number, ...keysAndArgs: string[]): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
  connect(): Promise<void>;
};

/**
 * `iovalkey`-backed snapshot client (the `CACHE_VALKEY_CLIENT=iovalkey` fallback,
 * mirroring `IoValkeyContentCache`). `iovalkey` is an optional dependency
 * imported lazily; the connection is established eagerly so a bad endpoint falls
 * back at construction like the GLIDE path.
 */
export class IoValkeySnapshotClient implements SnapshotClient {
  private constructor(private readonly client: IoValkeyClient) {}

  static async connect(url: string, injected?: IoValkeyClient): Promise<IoValkeySnapshotClient> {
    if (injected) {
      return new IoValkeySnapshotClient(injected);
    }
    // Non-literal specifier: `iovalkey` is optional and may be absent, so this
    // must not be a statically resolved import.
    const specifier = "iovalkey";
    let mod: { default: new (url: string, options?: unknown) => IoValkeyClient };
    try {
      mod = (await import(specifier)) as typeof mod;
    } catch {
      throw new Error(
        "CACHE_VALKEY_CLIENT=iovalkey but the 'iovalkey' package is not installed. " +
          "Run `pnpm add iovalkey` in context-layer to use the iovalkey snapshot adapter.",
      );
    }
    const Client = mod.default;
    const client = new Client(url, { lazyConnect: true });
    await client.connect();
    return new IoValkeySnapshotClient(client);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async casSwap(
    key: string,
    indexKey: string,
    expectedPendingId: string,
    nextValue: string,
    rootId: string,
  ): Promise<boolean> {
    const result = await this.client.eval(
      SNAPSHOT_CAS_LUA,
      2,
      key,
      indexKey,
      expectedPendingId,
      nextValue,
      rootId,
    );
    return Number(result) === 1;
  }

  async listRoots(indexKey: string): Promise<string[]> {
    return this.client.smembers(indexKey);
  }
}

export type CreateSnapshotClientDeps = {
  /** Injectable GLIDE cluster-client factory (tests). */
  createClient?: CreateClusterClient;
  /** Injectable iovalkey client (tests). */
  ioClient?: IoValkeyClient;
};

/**
 * Select and CONNECT the snapshot client from the environment, mirroring
 * `createValkeyCache`: GLIDE by default, `iovalkey` on the opt-in switch. Throws
 * on a connection failure so the factory degrades to in-memory (decision 5).
 */
export async function createSnapshotClient(
  env: Record<string, string | undefined>,
  url: string,
  deps: CreateSnapshotClientDeps = {},
): Promise<SnapshotClient> {
  if (env.CACHE_VALKEY_CLIENT === "iovalkey") {
    return IoValkeySnapshotClient.connect(url, deps.ioClient);
  }
  return GlideSnapshotClient.connect({
    url,
    username: env.CACHE_VALKEY_USERNAME,
    iamClusterName: env.CACHE_VALKEY_IAM_CLUSTER,
    region: env.AWS_REGION,
    createClient: deps.createClient,
  });
}
