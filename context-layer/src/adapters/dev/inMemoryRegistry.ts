import { FeedbackSchema, SourceSchema, SourceTopicMappingSchema, TopicSchema } from "@atlas/schema";
import {
  InMemoryFeedbackRepository,
  type FeedbackRepository,
} from "../../repositories/feedbackRepository";
import { InMemorySourceRepository } from "../../repositories/sourceRepository";
import { InMemorySourceTopicMappingRepository } from "../../repositories/sourceTopicMappingRepository";
import { InMemoryTopicRepository } from "../../repositories/topicRepository";
import type { Registry } from "../../registry/registry";

export type RegistrySeed = {
  feedback: unknown[];
  sources: unknown[];
  topics: unknown[];
  mappings: unknown[];
};

export type RegistryOptions = {
  feedback?: FeedbackRepository;
};

export function createInMemoryRegistry(
  seed: RegistrySeed,
  options: RegistryOptions = {},
): Registry {
  const feedback = seed.feedback.map((item) => FeedbackSchema.parse(item));
  const sources = seed.sources.map((source) => SourceSchema.parse(source));
  const topics = seed.topics.map((topic) => TopicSchema.parse(topic));
  const mappings = seed.mappings.map((mapping) => SourceTopicMappingSchema.parse(mapping));

  const sourceIds = new Set(sources.map((source) => source.id));
  const topicIds = new Set(topics.map((topic) => topic.id));

  for (const mapping of mappings) {
    if (!sourceIds.has(mapping.source_id)) {
      throw new Error(`Unknown source_id in mapping: ${mapping.source_id}`);
    }
    if (!topicIds.has(mapping.topic_id)) {
      throw new Error(`Unknown topic_id in mapping: ${mapping.topic_id}`);
    }
  }

  for (const item of feedback) {
    if (item.target_type === "source" && !sourceIds.has(item.target_id)) {
      throw new Error(`Unknown source target_id in feedback: ${item.target_id}`);
    }
    if (item.target_type === "topic" && !topicIds.has(item.target_id)) {
      throw new Error(`Unknown topic target_id in feedback: ${item.target_id}`);
    }
  }

  return {
    feedback: options.feedback ?? new InMemoryFeedbackRepository(feedback),
    sources: new InMemorySourceRepository(sources),
    topics: new InMemoryTopicRepository(topics),
    mappings: new InMemorySourceTopicMappingRepository(mappings),
  };
}
