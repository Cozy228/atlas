import type { IdentityClaims } from "./claims";
import { readEntraConfig, type EntraConfig } from "./entraConfig";
import {
  createRemoteEntraKeySet,
  jwksUriFromAuthority,
  validateEntraToken,
  type EntraTokenValidatorConfig,
} from "./entraTokenValidator";

/**
 * Machine-surface identity resolution (WS2, confused-deputy R7). The machine surface
 * (`/mcp`, `/api`, `/resources`) derives identity from the **Authorization Bearer ONLY** —
 * it never reads a cookie. Env-gated: with no Entra config it returns `undefined`
 * (anonymous, today's behaviour — so every existing opaque-bearer test is unchanged). A
 * token that fails validation is IGNORED (returns `undefined`, fail-closed) rather than
 * rejected — the ignore-don't-reject rule (R7).
 *
 * `validate` is injectable so a test can supply a self-signed JWKS validator; the default
 * builds a memoized remote JWKS key set from `ENTRA_AUTHORITY` (parameterized — no
 * hardcoded `login.microsoftonline.com`). The real registry adapter that turns the
 * resulting claims into a non-empty verified APP set is company-side; in the public repo
 * the default directory has no `resolveMembership`, so machine claims resolve to an empty
 * verified set (fail-closed) until a real adapter is composed.
 */
export async function resolveMachineClaims(
  bearer: string | undefined,
  env: Record<string, string | undefined>,
  validate: typeof validateEntraToken = validateEntraToken,
): Promise<IdentityClaims | undefined> {
  const config = readEntraConfig(env); // loud on half-set (E6)
  if (!config || !bearer) {
    return undefined;
  }
  try {
    return await validate(bearer, machineValidatorConfig(config, env));
  } catch {
    // ignore-don't-reject (R7): a bad/foreign token yields no identity, never a 4xx here.
    return undefined;
  }
}

let memo: { key: string; config: EntraTokenValidatorConfig } | undefined;

function machineValidatorConfig(
  config: EntraConfig,
  env: Record<string, string | undefined>,
): EntraTokenValidatorConfig {
  // Issuer is parameterized: `ENTRA_ISSUER` overrides, else the authority base (a real
  // Entra tenant's `iss` derivation is a company-side detail; the public repo never wires
  // a real tenant, and tests inject the validator directly).
  const issuer = env.ENTRA_ISSUER?.trim() || config.authority;
  const key = `${issuer}::${config.apiAudience}`;
  if (memo && memo.key === key) {
    return memo.config;
  }
  const built: EntraTokenValidatorConfig = {
    issuer,
    audience: config.apiAudience,
    jwks: createRemoteEntraKeySet(jwksUriFromAuthority(config.authority)),
  };
  memo = { key, config: built };
  return built;
}
