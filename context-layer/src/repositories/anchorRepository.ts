import { AnchorSchema, type Anchor } from "@atlas/schema";

export class InMemoryAnchorRepository {
  private readonly anchors = new Map<string, Anchor>();

  constructor(anchors: unknown[] = []) {
    for (const anchor of anchors) {
      this.put(anchor);
    }
  }

  put(anchor: unknown): Anchor {
    const parsed = AnchorSchema.parse(anchor);
    this.anchors.set(parsed.id, parsed);
    return parsed;
  }

  getById(id: string): Anchor | undefined {
    return this.anchors.get(id);
  }

  list(): Anchor[] {
    return Array.from(this.anchors.values());
  }

  findBySourceId(sourceId: string): Anchor[] {
    return this.list().filter((anchor) => anchor.source_id === sourceId);
  }
}
