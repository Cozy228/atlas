/**
 * Registry assembler: the `Registry` port is the OUTPUT of discovery, not the
 * `data/*.yaml` seed. Given the discovered services + guardrails (and a feedback
 * repository), it populates the generic in-memory Source repository with the
 * derived Sources the Resource sections cite. The catalog reads discovered
 * Resources directly, so no topic/mapping tables are assembled here.
 */
import type { Registry } from "../registry/registry";
import type { FeedbackRepository } from "../repositories/feedbackRepository";
import { InMemorySourceRepository } from "../repositories/sourceRepository";
import { deriveGuardrailSourceRecords } from "./deriveGuardrails";
import { deriveServiceSourceRecords } from "./deriveResources";
import type { DiscoveredGuardrail } from "./discoverGuardrails";
import type { DiscoveredService } from "./discoverSources";

/**
 * Build the derived `Registry` from discovery output: the Sources the resource
 * sections cite, plus the runtime-mutable feedback repository (selected from env /
 * injected) so this stays a pure assembly of the descriptive records.
 */
export function deriveRegistry(
  services: DiscoveredService[],
  guardrails: DiscoveredGuardrail[],
  feedback: FeedbackRepository,
): Registry {
  return {
    feedback,
    sources: new InMemorySourceRepository([
      ...deriveServiceSourceRecords(services),
      ...deriveGuardrailSourceRecords(guardrails),
    ]),
  };
}
