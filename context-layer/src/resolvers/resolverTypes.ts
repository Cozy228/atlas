import type { Anchor, Source, SourceClass } from "@atlas/schema";
import type { SourceContentProvider } from "./sourceContentProvider.js";

export type ResolvedExcerpt = {
  anchor_id?: string;
  text: string;
  citation: {
    source_id: string;
    anchor_id?: string;
    label: string;
    location: string;
  };
};

export type ResolverWarning = {
  code: "broken_anchor" | "source_unavailable" | "weak_anchoring";
  message: string;
  source_id?: string;
  anchor_id?: string;
};

export type ResolveRequest = {
  source: Source;
  anchors: Anchor[];
  anchorId?: string;
  contentProvider: SourceContentProvider;
};

export type ResolveResult = {
  excerpts: ResolvedExcerpt[];
  warnings: ResolverWarning[];
};

export type AnchorResolver = {
  sourceClass: SourceClass;
  resolve(request: ResolveRequest): ResolveResult;
};
