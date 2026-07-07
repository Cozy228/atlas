import { loadAuthContext } from "@/api/server/auth/authContext";
import { beginLogin } from "@/api/server/auth/bff";
import { serializeTxCookie, signPayload } from "@/api/server/auth/sessionCookie";

/**
 * BFF `/auth/login` (WS1): begin the OIDC auth-code flow. Mint PKCE + `state` + `nonce`,
 * stash the transaction in a signed, HttpOnly, short-lived cookie, and 302 to the Entra
 * authorize endpoint (`response_mode=form_post`). Returns 404 when Entra is not configured
 * (the Portal stays anonymous — non-app Sources remain reachable, ADR-0012).
 */
export default async (): Promise<Response> => {
  const env = process.env as Record<string, string | undefined>;
  const auth = await loadAuthContext();
  if (!auth) {
    return new Response("Entra identity is not enabled.", { status: 404 });
  }
  const { redirectUrl, transaction } = await beginLogin(auth.idp);
  const headers = new Headers({ location: redirectUrl });
  headers.append(
    "set-cookie",
    serializeTxCookie(signPayload(transaction, auth.session.secret), env),
  );
  return new Response(null, { status: 302, headers });
};
