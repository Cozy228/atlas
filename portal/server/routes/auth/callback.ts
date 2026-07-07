import { handlerRequest } from "@/api/server/portalOrigin";
import { loadAuthContext } from "@/api/server/auth/authContext";
import { completeCallback, type LoginTransaction } from "@/api/server/auth/bff";
import {
  clearTxCookie,
  readTxCookie,
  serializeSessionCookie,
  signSessionId,
  verifyPayload,
} from "@/api/server/auth/sessionCookie";

/**
 * BFF `/auth/callback` (WS1): the `response_mode=form_post` return leg. Validate `state`
 * (CSRF) against the transaction cookie, exchange the code (the IdP validates `nonce`),
 * create a session with a FRESH id (rotation on login) holding claims + refresh only, set
 * the signed session cookie, consume the transaction cookie, and 302 home.
 */
export default async (event: unknown): Promise<Response> => {
  const request = handlerRequest(event);
  if (!request) {
    return new Response("Bad Request", { status: 400 });
  }
  const env = process.env as Record<string, string | undefined>;
  const auth = await loadAuthContext();
  if (!auth) {
    return new Response("Entra identity is not enabled.", { status: 404 });
  }

  const form = new URLSearchParams(await request.text());
  const code = form.get("code");
  const state = form.get("state");
  const signedTx = readTxCookie(request.headers.get("cookie"), env);
  const transaction = signedTx
    ? verifyPayload<LoginTransaction>(signedTx, auth.session.secret)
    : undefined;
  if (!code || !state || !transaction) {
    return new Response("Invalid callback.", { status: 400 });
  }

  try {
    const { sessionId, ttlSeconds } = await completeCallback(
      { idp: auth.idp, sessionStore: auth.sessionStore },
      { transaction, formState: state, code },
    );
    const headers = new Headers({ location: "/" });
    headers.append(
      "set-cookie",
      serializeSessionCookie(signSessionId(sessionId, auth.session.secret), env, ttlSeconds),
    );
    headers.append("set-cookie", clearTxCookie(env));
    return new Response(null, { status: 302, headers });
  } catch {
    // state/nonce failure or code-exchange failure ⇒ 401, transaction consumed.
    const headers = new Headers({ location: "/" });
    headers.append("set-cookie", clearTxCookie(env));
    return new Response("Login failed.", { status: 401, headers });
  }
};
