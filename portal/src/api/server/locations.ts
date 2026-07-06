import { createServerFn } from "@tanstack/react-start";
import {
  LocationRegistrationRequestSchema,
  type LocationRegistrationResponse,
  type StatusBoardResponse,
} from "@atlas/schema";
import { z } from "zod";

import { serverContextApiClient } from "./serverContextApiClient";

/**
 * Status-board + self-service registration server functions (Step 7, P24/M3/M12).
 * Both hang off the situation's selected APP (`appId`), threaded through the one
 * governed Context API client — the SAME in-process router the availability +
 * apps surfaces use. The board is aggregation-at-read (recomputed every call, no
 * store, no history — P24); registration is the store's only writer (M11) and
 * carries NO secret field (locked decision 1: the schema rejects one at the door).
 */
const boardScopeSchema = z.object({ appId: z.string().min(1) });

export const fetchStatusBoard = createServerFn({ method: "GET" })
  .validator((input: unknown) => boardScopeSchema.parse(input))
  .handler(
    async ({ data }): Promise<StatusBoardResponse> =>
      serverContextApiClient.getStatus({ appId: data.appId }),
  );

const registerLocationSchema = z.object({
  appId: z.string().min(1),
  request: LocationRegistrationRequestSchema,
});

export const registerLocation = createServerFn({ method: "POST" })
  .validator((input: unknown) => registerLocationSchema.parse(input))
  .handler(
    async ({ data }): Promise<LocationRegistrationResponse> =>
      // The owning APP arrives via the request scope (`?appId=`), never the body.
      serverContextApiClient.registerLocation(data.request, { appId: data.appId }),
  );
