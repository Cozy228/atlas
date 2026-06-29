import type { FeedbackRepository } from "../repositories/feedbackRepository";
import type { SourceRepository } from "../repositories/sourceRepository";

/**
 * Registry port: the sources + feedback repositories the Context Layer reads. The
 * core depends only on this shape — any adapter (the dev in-memory one, a live
 * discovery one) assembles an implementation. It carries no notion of where the
 * records came from. (Topics/mappings were retired in the resource-first collapse:
 * the catalog reads discovered Resources, and sources bind to Resource sections
 * directly.)
 */
export type Registry = {
  feedback: FeedbackRepository;
  sources: SourceRepository;
};
