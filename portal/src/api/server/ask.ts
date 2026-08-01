import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { AskAtlasResponse, AskInput } from "./askContract";

const askInputSchema = z.object({
  resourceSlug: z.string().min(1).optional(),
  question: z.string().min(1),
});

export const askAtlas = createServerFn({ method: "POST" })
  .validator((input: unknown): AskInput => askInputSchema.parse(input))
  .handler(async ({ data }): Promise<AskAtlasResponse> => {
    const { handleAskAtlas } = await import("./askHandler");
    return handleAskAtlas(data);
  });

export type { AskAtlasResponse } from "./askContract";
