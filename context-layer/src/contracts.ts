import type { ResourceContextResponse } from "@atlas/schema";

/**
 * The Context Layer's agent-facing read contract (ADR-0013): a live Resource
 * projection of external Sources. This replaces the retired `ContextBundle`
 * response (plan 019) — there is one core read, projected into many views.
 */
export type ContextLayerContract = ResourceContextResponse;
