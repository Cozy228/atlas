import { createServerFn } from "@tanstack/react-start";
import {
  AppRegistrationRequestSchema,
  AppUpdateRequestSchema,
  type AppListResponse,
  type AppMutationResponse,
  type AppRegistrationRequest,
  type AppUpdateRequest,
} from "@atlas/schema";
import { z } from "zod";

import { serverContextApiClient } from "./serverContextApiClient";

/**
 * Consumer-state server functions (Step 3, P17/P21/M3). The Portal self-declare
 * form is the P21 fallback for non-repo situations: it drives POST/PATCH through
 * the one governed Context API client. `origin` is server-set (`self-declared`),
 * never chosen here.
 */
export const fetchApps = createServerFn({ method: "GET" }).handler(
  async (): Promise<AppListResponse> => serverContextApiClient.listApps(),
);

export const registerApp = createServerFn({ method: "POST" })
  .validator((input: unknown): AppRegistrationRequest => AppRegistrationRequestSchema.parse(input))
  .handler(
    async ({ data }): Promise<AppMutationResponse> => serverContextApiClient.registerApp(data),
  );

const updateInputSchema = z.object({ id: z.string().min(1), patch: AppUpdateRequestSchema });

export const updateApp = createServerFn({ method: "POST" })
  .validator((input: unknown): { id: string; patch: AppUpdateRequest } =>
    updateInputSchema.parse(input),
  )
  .handler(
    async ({ data }): Promise<AppMutationResponse> =>
      serverContextApiClient.updateApp(data.id, data.patch),
  );
