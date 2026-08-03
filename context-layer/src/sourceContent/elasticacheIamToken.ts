import { Sha256 } from "@aws-crypto/sha256-js";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { SignatureV4 } from "@smithy/signature-v4";

const TOKEN_TTL_SECONDS = 900;

export type ElastiCacheIamTokenInput = {
  cacheName: string;
  region: string;
  userId: string;
  credentials?: ReturnType<typeof defaultProvider>;
  now?: () => Date;
};

/** Generate the 15-minute SigV4 password accepted by ElastiCache IAM auth. */
export function createElastiCacheIamTokenProvider(
  input: ElastiCacheIamTokenInput,
): () => Promise<string> {
  const credentials = input.credentials ?? defaultProvider();
  const signer = new SignatureV4({
    credentials,
    region: input.region,
    service: "elasticache",
    sha256: Sha256,
  });

  return async () => {
    const signed = await signer.presign(
      {
        method: "GET",
        protocol: "http:",
        hostname: input.cacheName.toLowerCase(),
        path: "/",
        headers: { host: input.cacheName.toLowerCase() },
        query: { Action: "connect", User: input.userId },
      },
      { expiresIn: TOKEN_TTL_SECONDS, signingDate: input.now?.() },
    );
    const query = new URLSearchParams();
    for (const [name, rawValues] of Object.entries(signed.query ?? {})) {
      for (const value of Array.isArray(rawValues) ? rawValues : [rawValues]) {
        if (value != null) query.append(name, value);
      }
    }
    return `${signed.hostname}${signed.path}?${query.toString()}`;
  };
}
