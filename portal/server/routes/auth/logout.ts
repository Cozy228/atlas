import { handlerRequest } from "@/api/server/portalOrigin";
import { loadAuthContext } from "@/api/server/auth/authContext";
import { destroySession } from "@/api/server/auth/bff";
import {
  clearSessionCookie,
  readSessionCookie,
  verifySessionId,
} from "@/api/server/auth/sessionCookie";

/**
 * BFF `/auth/logout` (WS1): LOCAL session destruction ONLY (R12) — drop the server-side
 * record and clear the cookie. NO Entra front-channel / single-logout is initiated. Always
 * clears the cookie and 302s home, even when no session or Entra is unset (idempotent).
 */
export default async (event: unknown): Promise<Response> => {
  const request = handlerRequest(event);
  const env = process.env as Record<string, string | undefined>;
  const headers = new Headers({ location: "/" });
  headers.append("set-cookie", clearSessionCookie(env));

  const auth = await loadAuthContext();
  if (auth) {
    const signed = readSessionCookie(request?.headers.get("cookie"), env);
    const sessionId = signed ? verifySessionId(signed, auth.session.secret) : undefined;
    if (sessionId) {
      await destroySession(auth.sessionStore, sessionId);
    }
  }
  return new Response(null, { status: 302, headers });
};
