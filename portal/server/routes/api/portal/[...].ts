/**
 * Transitional Nitro adapter for Portal-owned HTTP endpoints.
 *
 * The browser already consumes the Hono contracts while Nitro remains the
 * production host. Delete this adapter when the Hono Node host becomes the
 * only runtime entry point.
 */
import { createPortalApp } from "../../../hono/app";
import { handlerRequest } from "@/api/server/portalOrigin";

const app = createPortalApp();

export default async (event: unknown): Promise<Response> => {
  const request = handlerRequest(event);
  if (!request) return new Response("Bad Request", { status: 400 });
  return app.fetch(request);
};
