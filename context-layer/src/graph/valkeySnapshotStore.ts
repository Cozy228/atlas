/**
 * `ValkeySnapshotStore` (Step-2 tail, M2/M10 prod hardening) — the durable
 * per-root snapshot store over the EXISTING Valkey store (no new infra — it
 * shares the content-cache keyspace/env). One key per independently-failing
 * source root: `discovery:{<envHash>}:<rootId>`, value = the JSON of the root's
 * `SnapshotPair` (K=2 retention is inherent in the pair). NO TTL — a cold start
 * must serve from the snapshot across restarts. The `{<envHash>}` braces are a
 * Valkey hash tag: the pair key and the roots index (`discovery:{<envHash>}:roots`)
 * share the same hash tag ⇒ the same cluster slot ⇒ a multi-key CAS+index script
 * is legal.
 *
 * This module is the transport-agnostic orchestrator: it takes a thin
 * {@link SnapshotClient} port and owns the JSON (de)serialization, the roots
 * index, and the safe-value degradation. The concrete GLIDE / iovalkey clients
 * (with the scripted CAS) live in `valkeySnapshotClient.ts`, dynamic-imported by
 * the factory only when a Valkey URL is configured — so the common in-memory
 * path never loads the native GLIDE binary, and this file is unit-testable with
 * a fake client (no live Valkey in CI).
 *
 * One clock (ADR-0013 §6): the snapshot's `resolvedAt` is provenance only;
 * staleness is recomputed at read time by `freshness.ts`, never stored here.
 */
import { logger, serializeError } from "../observability/logging";
import type { SnapshotPair } from "./graphTypes";
import { type SnapshotStore } from "./snapshotStore";

const log = logger("graph");

/**
 * The narrow Valkey surface the store needs, so the GLIDE and iovalkey clients
 * differ ONLY in their transport (mirrors the content-cache adapter split). The
 * CAS is server-side and ATOMICALLY swaps the pair key AND records the root in
 * the index in ONE script — the two keys share a hash tag ⇒ the same cluster
 * slot ⇒ the multi-key script is legal, and `readAll` never sees a root that is
 * readable by key but missing from the index (no SADD-lost window). `readAll`
 * needs no cluster SCAN.
 */
export interface SnapshotClient {
  /** Raw GET of one root's JSON pair (`null` when the root is cold). */
  get(key: string): Promise<string | null>;
  /**
   * Atomic, server-side compare-and-swap (M10). Swaps `key` to `nextValue` AND
   * `SADD`s `rootId` into `indexKey` — in ONE script — only when the stored
   * pair's pending identity equals `expectedPendingId` (`""` for a cold/absent
   * root). Returns whether this writer won. `key` and `indexKey` share a hash
   * tag ⇒ the same slot ⇒ the multi-key write is cluster-safe. The atomic index
   * write closes the crash-between-SET-and-SADD window that could hide a root
   * from `readAll` until its next won CAS.
   */
  casSwap(
    key: string,
    indexKey: string,
    expectedPendingId: string,
    nextValue: string,
    rootId: string,
  ): Promise<boolean>;
  /** Every root id recorded in the index set. */
  listRoots(indexKey: string): Promise<string[]>;
}

export class ValkeySnapshotStore implements SnapshotStore {
  constructor(
    private readonly client: SnapshotClient,
    /** `discovery:{<envHash>}` — the per-env keyspace prefix (braces = hash tag). */
    private readonly prefix: string,
  ) {}

  private rootKey(rootId: string): string {
    return `${this.prefix}:${rootId}`;
  }

  private indexKey(): string {
    return `${this.prefix}:roots`;
  }

  async read(rootId: string): Promise<SnapshotPair> {
    try {
      const raw = await this.client.get(this.rootKey(rootId));
      if (!raw) {
        return {};
      }
      return JSON.parse(raw) as SnapshotPair;
    } catch (error) {
      // A runtime read failure degrades to the SAFE value (cold) — never a hidden
      // second store, which would split-brain the CAS (decision 5).
      log.error(
        { rootId, err: serializeError(error) },
        `snapshot store: read failed for root '${rootId}' — serving cold`,
      );
      return {};
    }
  }

  async readAll(): Promise<Map<string, SnapshotPair>> {
    let rootIds: string[];
    try {
      rootIds = await this.client.listRoots(this.indexKey());
    } catch (error) {
      log.error(
        { err: serializeError(error) },
        "snapshot store: roots index read failed — serving empty graph",
      );
      return new Map();
    }
    const pairs = new Map<string, SnapshotPair>();
    for (const rootId of rootIds) {
      // `read` already degrades to `{}` on a per-key failure; keep the entry so a
      // known root that momentarily fails still reads as cold, not absent.
      pairs.set(rootId, await this.read(rootId));
    }
    return pairs;
  }

  async compareAndSwap(
    rootId: string,
    expectedPendingId: string | undefined,
    next: SnapshotPair,
  ): Promise<boolean> {
    try {
      // The pair SET and the roots-index SADD happen ATOMICALLY inside the
      // script (both keys share a hash tag ⇒ one slot), so a won CAS can never
      // leave a root readable-by-key but invisible to `readAll`.
      return await this.client.casSwap(
        this.rootKey(rootId),
        this.indexKey(),
        expectedPendingId ?? "",
        JSON.stringify(next),
        rootId,
      );
    } catch (error) {
      // A runtime CAS failure returns the SAFE value (lost the swap) — the loser
      // discards its derived events, never a memory fallback (decision 5).
      log.error(
        { rootId, err: serializeError(error) },
        `snapshot store: CAS failed for root '${rootId}' — treated as lost`,
      );
      return false;
    }
  }
}

/**
 * The multi-key Lua CAS both clients invoke (GLIDE `invokeScript` / iovalkey
 * `eval`). It computes the stored pair's pending identity server-side with the
 * SAME `${contractVersion}@${resolvedAt}` formula as `pendingId()` and, on an
 * exact match, ATOMICALLY sets the pair AND `SADD`s the root into the index — so
 * two concurrent ECS tasks never emit conflicting baselines AND a won CAS is
 * never visible by key while missing from `readAll`. `KEYS[1]` = the pair key,
 * `KEYS[2]` = the roots index key (same hash tag ⇒ same slot). `ARGV[1]` = the
 * expected pending id (`""` = cold), `ARGV[2]` = the next JSON pair, `ARGV[3]` =
 * the root id. Returns `1` on a win, `0` on a loss.
 */
export const SNAPSHOT_CAS_LUA = `
local cur = redis.call('GET', KEYS[1])
local expected = ARGV[1]
local nextVal = ARGV[2]
local rootId = ARGV[3]
local curPending = ''
if cur then
  local ok, decoded = pcall(cjson.decode, cur)
  if ok and type(decoded) == 'table' and type(decoded.pending) == 'table' then
    curPending = tostring(decoded.pending.contractVersion) .. '@' .. tostring(decoded.pending.resolvedAt)
  end
end
if curPending == expected then
  redis.call('SET', KEYS[1], nextVal)
  redis.call('SADD', KEYS[2], rootId)
  return 1
end
return 0
`;
