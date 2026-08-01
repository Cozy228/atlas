export type DataMode = "mock" | "live";

export type AskAtlasRequest = {
  resourceSlug?: string;
  question: string;
};

export type AskAtlasSourceRef = {
  source_id: string;
  title: string;
  url: string;
};

export type AskAtlasResponse = {
  answer: string;
  sources: ReadonlyArray<AskAtlasSourceRef>;
  warnings: ReadonlyArray<string>;
};
