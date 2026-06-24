import type { SourceClass } from "@atlas/schema";
import type { AnchorResolver } from "./resolverTypes";

export type ResolverRegistry = {
  get(sourceClass: SourceClass): AnchorResolver | undefined;
};

export function createResolverRegistry(resolvers: AnchorResolver[]): ResolverRegistry {
  const bySourceClass = new Map<SourceClass, AnchorResolver>();

  for (const resolver of resolvers) {
    if (bySourceClass.has(resolver.sourceClass)) {
      throw new Error(`Duplicate resolver for source class: ${resolver.sourceClass}`);
    }
    bySourceClass.set(resolver.sourceClass, resolver);
  }

  return {
    get(sourceClass: SourceClass): AnchorResolver | undefined {
      return bySourceClass.get(sourceClass);
    },
  };
}
