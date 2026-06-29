import { SourceSchema, type Source } from "@atlas/schema";

export type SourceRepository = {
  getById(id: string): Source | undefined;
  list(): Source[];
};

export class InMemorySourceRepository implements SourceRepository {
  private readonly sources = new Map<string, Source>();

  constructor(sources: unknown[] = []) {
    for (const source of sources) {
      this.put(source);
    }
  }

  put(source: unknown): Source {
    const parsed = SourceSchema.parse(source);
    this.sources.set(parsed.id, parsed);
    return parsed;
  }

  getById(id: string): Source | undefined {
    return this.sources.get(id);
  }

  list(): Source[] {
    return Array.from(this.sources.values());
  }
}
