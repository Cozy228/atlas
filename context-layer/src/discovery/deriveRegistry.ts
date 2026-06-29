/**
 * Registry assembler (plan 018 G5): the `Registry` port is the OUTPUT of
 * discovery, not the `data/*.yaml` seed. Given the discovered services +
 * guardrails (and a feedback repository), it populates the GENERIC in-memory
 * repositories with derived Sources + Topics. Mappings are empty — the resource
 * derivation binds sections to sources directly, so the source↔topic mapping
 * table carries nothing post-flip.
 */
import type { Registry } from "../registry/registry";
import type { FeedbackRepository } from "../repositories/feedbackRepository";
import { InMemorySourceRepository } from "../repositories/sourceRepository";
import { InMemorySourceTopicMappingRepository } from "../repositories/sourceTopicMappingRepository";
import { InMemoryTopicRepository } from "../repositories/topicRepository";
import { deriveGuardrailSourceRecords } from "./deriveGuardrails";
import { deriveServiceSourceRecords } from "./deriveResources";
import { discoverGuardrailTopics, discoverServiceTopics } from "./deriveTopics";
import type { DiscoveredGuardrail } from "./discoverGuardrails";
import type { DiscoveredService } from "./discoverSources";

/**
 * Build the derived `Registry` from discovery output. The feedback repository is
 * supplied (selected from env / injected) so this stays a pure assembly of the
 * descriptive records; feedback is the one runtime-mutable port.
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
    topics: new InMemoryTopicRepository([
      ...discoverServiceTopics(services),
      ...discoverGuardrailTopics(guardrails),
    ]),
    mappings: new InMemorySourceTopicMappingRepository([]),
  };
}
