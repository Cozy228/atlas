import type { FeedbackRepository } from "../repositories/feedbackRepository";
import type { SourceRepository } from "../repositories/sourceRepository";
import type { SourceTopicMappingRepository } from "../repositories/sourceTopicMappingRepository";
import type { TopicRepository } from "../repositories/topicRepository";

/**
 * Registry port: the sources / topics / mappings / feedback repositories the
 * Context Layer reads. The core depends only on this shape — any adapter (the dev
 * in-memory one, a live discovery one) assembles an implementation. It carries no
 * notion of where the records came from.
 */
export type Registry = {
  feedback: FeedbackRepository;
  sources: SourceRepository;
  topics: TopicRepository;
  mappings: SourceTopicMappingRepository;
};
