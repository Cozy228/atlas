import { SourceSchema, type Source } from "@atlas/schema";

export class InMemorySourceRepository {
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

  findByAuthorityScope(authorityScope: string): Source[] {
    return this.list().filter((source) =>
      source.authority_scope.includes(authorityScope),
    );
  }
}
