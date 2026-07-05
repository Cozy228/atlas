import { InMemorySnapshotStore, type SnapshotStore } from "./snapshotStore";

/**
 * The process-shared snapshot store (Step 2, M2/M10), memoized like `sharedCache`
 * / `sharedEventsRepository` (module scope, first-env wins) so the discovery
 * snapshot pass (write) and any reader resolve THIS instance.
 *
 * ⚠️ SCOPED GAP (flagged for the reviewer): this ships the in-memory store in all
 * environments. The design (M2/M10) puts snapshots in the EXISTING Valkey store
 * keyed `discovery:<envHash>:<rootId>` so (a) cold start serves from a warm
 * snapshot across restarts and (b) concurrent ECS tasks share one CAS baseline.
 * A `ValkeySnapshotStore` over the GLIDE client — with a Lua/transaction CAS for
 * strict cross-task atomicity and a prefix SCAN for `readAll` — is the
 * prod-hardening follow-up. In-memory keeps the store PER-TASK (each task
 * re-discovers on cold start and derives its own transitions); the events store
 * is durable + idempotent (M1), so cross-task duplicate derivation collapses on
 * the content-hash id even without the Valkey CAS. The D1/D6 CAS SEMANTICS are
 * proven against `InMemorySnapshotStore`; swapping the adapter is a pure port
 * substitution behind {@link SnapshotStore}.
 */
let sharedStore: SnapshotStore | undefined;

export function sharedSnapshotStore(_env: Record<string, string | undefined>): SnapshotStore {
  return (sharedStore ??= new InMemorySnapshotStore());
}
