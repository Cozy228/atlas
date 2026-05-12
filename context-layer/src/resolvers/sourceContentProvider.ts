export type SourceAnchorContent = Record<string, string>;

export type SourceContentProvider = {
  getSourceContent(sourceId: string): SourceAnchorContent | undefined;
};

export function createInMemorySourceContentProvider(
  content: Record<string, SourceAnchorContent>,
): SourceContentProvider {
  return {
    getSourceContent(sourceId: string): SourceAnchorContent | undefined {
      return content[sourceId];
    },
  };
}
