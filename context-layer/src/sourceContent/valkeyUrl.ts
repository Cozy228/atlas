/**
 * Parse a Valkey/Redis connection URL into a GLIDE address + TLS flag. Extracted
 * from `valkeyContentCache.ts` so the snapshot client can reuse it WITHOUT
 * dragging the statically-GLIDE-importing content-cache module into the static
 * graph (`sourceContentCache.ts` deliberately dynamic-imports that module; the
 * snapshot chain must not statically pin it).
 */
export function parseValkeyUrl(url: string): { host: string; port: number; useTLS: boolean } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    useTLS: parsed.protocol === "rediss:",
  };
}
