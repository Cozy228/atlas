import {
  AppRecordSchema,
  AppRegistrationRequestSchema,
  AppUpdateRequestSchema,
  type ApiErrorResponse,
  type AppListResponse,
  type AppMutationResponse,
  type AppRecord,
  type AppResponse,
  type Warning,
} from "@atlas/schema";
import { createDefaultContextService } from "../composition";
import { LANDING_ZONES } from "../landingZones";
import { logger } from "../observability/logging";
import { sharedAppsRepository } from "../repositories/appsRepositoryFactory";
import type { ContextService } from "../services/contextService";
import type { ApiResponse } from "./routeTypes";
import { errorResponse } from "./routeTypes";

/**
 * Consumer-state routes (Step 3, mid-level §3) — the ONLY writers of the apps
 * store (M11: no upsert-on-read anywhere). Every mutation is logged through the
 * `apps` pino channel (M3: identity-free but never silent). `origin` is
 * unconditionally `"self-declared"` on both write routes; a caller-supplied
 * `origin` (or any unknown field) is structural invalidity → 400. Dangling
 * `serviceSlugs` / `landingZoneIds` are stored VERBATIM and reported in
 * `warnings[]` (`unknown_service` / `unknown_landing_zone`), never dropped.
 */
const log = logger("apps");

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}

/** Monotonic per-process suffix so two registrations in the same millisecond
 *  still get distinct ids (Date.now alone can collide under a tight loop). */
let idCounter = 0;
function generateAppId(): string {
  return `app-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
}

export async function handleAppsListRequest(): Promise<
  ApiResponse<ApiErrorResponse | AppListResponse>
> {
  const repository = sharedAppsRepository(readProcessEnv());
  return { status: 200, body: { apps: await repository.list() } };
}

export async function handleAppRegistrationRequest(
  input: unknown,
): Promise<ApiResponse<ApiErrorResponse | AppMutationResponse>> {
  const parsed = AppRegistrationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return errorResponse(400, "invalid_request", "App registration request is invalid.");
  }

  const env = readProcessEnv();
  const now = new Date().toISOString();
  const record = AppRecordSchema.parse({
    id: generateAppId(),
    name: parsed.data.name,
    landingZoneIds: parsed.data.landingZoneIds,
    serviceSlugs: parsed.data.serviceSlugs ?? [],
    // Server-set: a self-declare always lands `self-declared` (P17). A registry
    // adapter rewrites this in place later (the P17 upgrade seat).
    origin: "self-declared",
    declaredAt: now,
    updatedAt: now,
  });

  const warnings = await danglingDeclarationWarnings(record, env);
  const stored = await sharedAppsRepository(env).put(record);
  log.info(
    {
      appId: stored.id,
      landingZoneIds: stored.landingZoneIds,
      warnings: warnings.map((w) => w.code),
    },
    `app registered: ${stored.id}`,
  );
  return { status: 201, body: { app: stored, warnings } };
}

export async function handleAppRequest(
  id: string,
): Promise<ApiResponse<ApiErrorResponse | AppResponse>> {
  const app = await sharedAppsRepository(readProcessEnv()).getById(id);
  if (!app) {
    return errorResponse(404, "app_not_found", `App '${id}' was not found.`);
  }
  return { status: 200, body: { app } };
}

export async function handleAppUpdateRequest(
  id: string,
  input: unknown,
): Promise<ApiResponse<ApiErrorResponse | AppMutationResponse>> {
  const parsed = AppUpdateRequestSchema.safeParse(input);
  if (!parsed.success) {
    return errorResponse(400, "invalid_request", "App update request is invalid.");
  }

  const env = readProcessEnv();
  const repository = sharedAppsRepository(env);
  const existing = await repository.getById(id);
  if (!existing) {
    return errorResponse(404, "app_not_found", `App '${id}' was not found.`);
  }

  const updated = AppRecordSchema.parse({
    ...existing,
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.landingZoneIds !== undefined
      ? { landingZoneIds: parsed.data.landingZoneIds }
      : {}),
    ...(parsed.data.serviceSlugs !== undefined ? { serviceSlugs: parsed.data.serviceSlugs } : {}),
    // origin is immutable here (server-set); updatedAt always bumps.
    updatedAt: new Date().toISOString(),
  });

  const warnings = await danglingDeclarationWarnings(updated, env);
  const stored = await repository.put(updated);
  log.info(
    {
      appId: stored.id,
      landingZoneIds: stored.landingZoneIds,
      warnings: warnings.map((w) => w.code),
    },
    `app updated: ${stored.id}`,
  );
  return { status: 200, body: { app: stored, warnings } };
}

/**
 * Dangling-declaration warnings (locked decision 5): `serviceSlugs` are checked
 * against discovered service records (the feedback target-existence mechanism)
 * and `landingZoneIds` against the LZ topology. Unknown entries are KEPT on the
 * record — the warning is signal (a service Atlas hasn't discovered yet, a zone
 * outside the topology), never a drop.
 */
async function danglingDeclarationWarnings(
  record: AppRecord,
  env: Record<string, string | undefined>,
): Promise<Warning[]> {
  const warnings: Warning[] = [];

  const knownZones = new Set(LANDING_ZONES.map((zone) => zone.id));
  for (const zoneId of record.landingZoneIds) {
    if (!knownZones.has(zoneId)) {
      warnings.push({
        code: "unknown_landing_zone",
        message: `Landing zone '${zoneId}' is not in the known topology; kept as declared.`,
      });
    }
  }

  if (record.serviceSlugs.length > 0) {
    const service = await createDefaultContextService({ env });
    for (const slug of record.serviceSlugs) {
      if (!serviceExists(service, slug)) {
        warnings.push({
          code: "unknown_service",
          message: `Service '${slug}' has not been discovered; kept as declared.`,
        });
      }
    }
  }

  return warnings;
}

/** A declared service slug resolves to a discovered service-kind Resource. */
function serviceExists(service: ContextService, slug: string): boolean {
  return service.resources.some((record) => record.kind === "service" && record.slug === slug);
}
