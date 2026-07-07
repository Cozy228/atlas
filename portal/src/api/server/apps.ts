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
import {
  logMutationAttribution,
  requestBrowserClaims,
  verifiedRegistryApps,
} from "./auth/requestIdentity";

/**
 * Consumer-state server functions (Step 3, P17/P21/M3). The Portal self-declare
 * form is the P21 fallback for non-repo situations: it drives POST/PATCH through
 * the one governed Context API client. `origin` is server-set (`self-declared`),
 * never chosen here.
 */

/**
 * The APP selector's list = claims-derived (verified, `membershipSource:"entra"`) ∪
 * self-declared (the store, `membershipSource:"none"`) — the selector union (WS5/E7). The
 * verified registry APPs come from the browser session's membership; when Entra is unset
 * the union collapses to the self-declared store (today's behaviour, unchanged). A verified
 * APP that is ALSO self-declared is de-duped id-first, verified winning (so its badge reads
 * verified).
 */
export const fetchApps = createServerFn({ method: "GET" }).handler(
  async (): Promise<AppListResponse> => {
    const [selfDeclared, verified] = await Promise.all([
      serverContextApiClient.listApps(),
      requestBrowserClaims().then(verifiedRegistryApps),
    ]);
    const byId = new Map(selfDeclared.apps.map((app) => [app.id, app]));
    for (const app of verified) {
      byId.set(app.id, app);
    }
    return { apps: [...byId.values()] };
  },
);

export const registerApp = createServerFn({ method: "POST" })
  .validator((input: unknown): AppRegistrationRequest => AppRegistrationRequestSchema.parse(input))
  .handler(async ({ data }): Promise<AppMutationResponse> => {
    const [result, claims] = await Promise.all([
      serverContextApiClient.registerApp(data),
      requestBrowserClaims(),
    ]);
    // I2: attribute the mutation to the verified principal, separately from the store/response.
    logMutationAttribution("app.register", result.app.id, claims);
    return result;
  });

const updateInputSchema = z.object({ id: z.string().min(1), patch: AppUpdateRequestSchema });

export const updateApp = createServerFn({ method: "POST" })
  .validator((input: unknown): { id: string; patch: AppUpdateRequest } =>
    updateInputSchema.parse(input),
  )
  .handler(async ({ data }): Promise<AppMutationResponse> => {
    const [result, claims] = await Promise.all([
      serverContextApiClient.updateApp(data.id, data.patch),
      requestBrowserClaims(),
    ]);
    // I2: attribute the mutation to the verified principal, separately from the store/response.
    logMutationAttribution("app.update", data.id, claims);
    return result;
  });
