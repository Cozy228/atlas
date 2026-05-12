import { TopicSchema, type Topic, type TopicType } from "@atlas/schema";

export class InMemoryTopicRepository {
  private readonly topics = new Map<string, Topic>();

  constructor(topics: unknown[] = []) {
    for (const topic of topics) {
      this.put(topic);
    }
  }

  put(topic: unknown): Topic {
    const parsed = TopicSchema.parse(topic);
    this.topics.set(parsed.id, parsed);
    return parsed;
  }

  getById(id: string): Topic | undefined {
    return this.topics.get(id);
  }

  list(): Topic[] {
    return Array.from(this.topics.values());
  }

  findByType(topicType: TopicType): Topic[] {
    return this.list().filter((topic) => topic.topic_type === topicType);
  }

  findByCategory(category: string): Topic[] {
    return this.list().filter((topic) => topic.category === category);
  }
}
