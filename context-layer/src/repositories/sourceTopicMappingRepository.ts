import { SourceTopicMappingSchema, type SourceTopicMapping } from "@atlas/schema";

export type SourceTopicMappingRepository = {
  getById(id: string): SourceTopicMapping | undefined;
  list(): SourceTopicMapping[];
  findByTopicId(topicId: string): SourceTopicMapping[];
  findBySourceId(sourceId: string): SourceTopicMapping[];
};

export class InMemorySourceTopicMappingRepository implements SourceTopicMappingRepository {
  private readonly mappings = new Map<string, SourceTopicMapping>();

  constructor(mappings: unknown[] = []) {
    for (const mapping of mappings) {
      this.put(mapping);
    }
  }

  put(mapping: unknown): SourceTopicMapping {
    const parsed = SourceTopicMappingSchema.parse(mapping);
    this.mappings.set(parsed.id, parsed);
    return parsed;
  }

  getById(id: string): SourceTopicMapping | undefined {
    return this.mappings.get(id);
  }

  list(): SourceTopicMapping[] {
    return Array.from(this.mappings.values());
  }

  findByTopicId(topicId: string): SourceTopicMapping[] {
    return this.list().filter((mapping) => mapping.topic_id === topicId);
  }

  findBySourceId(sourceId: string): SourceTopicMapping[] {
    return this.list().filter((mapping) => mapping.source_id === sourceId);
  }
}
