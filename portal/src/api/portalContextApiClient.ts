import type {
  AvailabilityResponse,
  FeedbackResponse,
  FeedbackSubmission,
  LandingZone,
  ResourceCatalogResponse,
  ResourceContextResponse,
  ResourceRecordResponse,
  SourceDiscoveryRequest,
  SourceDiscoveryResponse,
} from "@atlas/schema";
import type { Announcement, Release } from "@atlas/context-layer";

import type { Guidance } from "@/lib/guidance";
import type { ContextApiRequestOptions } from "./contextApiClient";
import { ContextApiError, type ContextApiErrorCode } from "./contextApiError";
import type { AskAtlasRequest, AskAtlasResponse, DataMode } from "./portalContracts";

type AtlasSchemas = typeof import("@atlas/schema");

export function fetchPortalResourceCatalog(options?: ContextApiRequestOptions) {
  return requestPortalJson<ResourceCatalogResponse>({
    url: "/api/resources/catalog",
    init: withSignal({ method: "GET" }, options),
    parseWithSchemas: (schemas, body) => schemas.ResourceCatalogResponseSchema.parse(body),
  });
}

export function fetchPortalSourceDiscovery(
  request: SourceDiscoveryRequest = {},
  options?: ContextApiRequestOptions,
) {
  return requestPortalJson<SourceDiscoveryResponse>({
    url: withQuery("/api/sources", request),
    init: withSignal({ method: "GET" }, options),
    parseWithSchemas: (schemas, body) => schemas.SourceDiscoveryResponseSchema.parse(body),
  });
}

export function fetchPortalResourceRecord(
  ref: { kind: string; slug: string },
  options?: ContextApiRequestOptions,
) {
  return requestPortalJson<ResourceRecordResponse>({
    url: `/api/resources/${encodeURIComponent(ref.kind)}/${encodeSlug(ref.slug)}/record`,
    init: withSignal({ method: "GET" }, options),
    parseWithSchemas: (schemas, body) => schemas.ResourceRecordResponseSchema.parse(body),
  });
}

export function fetchPortalResourceContext(
  ref: { kind: string; slug: string },
  options?: ContextApiRequestOptions,
) {
  return requestPortalJson<ResourceContextResponse>({
    url: `/api/resources/${encodeURIComponent(ref.kind)}/${encodeSlug(ref.slug)}`,
    init: withSignal({ method: "GET" }, options),
    parseWithSchemas: (schemas, body) => schemas.ResourceContextResponseSchema.parse(body),
  });
}

export function fetchPortalDataMode(options?: ContextApiRequestOptions) {
  return requestPortalJson<DataMode>({
    url: "/api/portal/data-mode",
    init: withSignal({ method: "GET" }, options),
    parse: (body) => {
      const dataMode = objectProperty(body, "dataMode");
      if (dataMode === "mock" || dataMode === "live") return dataMode;
      throw new TypeError("Portal data-mode response is invalid.");
    },
  });
}

export function fetchPortalLandingZones(options?: ContextApiRequestOptions) {
  return requestPortalJson<LandingZone[]>({
    url: "/api/portal/landing-zones",
    init: withSignal({ method: "GET" }, options),
    parseWithSchemas: (schemas, body) =>
      schemas.LandingZoneSchema.array().parse(objectProperty(body, "landingZones")),
  });
}

export function fetchPortalAvailability(options?: ContextApiRequestOptions) {
  return requestPortalJson<AvailabilityResponse>({
    url: "/api/portal/availability",
    init: withSignal({ method: "GET" }, options),
    parse: (body) => {
      if (isAvailabilityResponse(body)) return body;
      throw new TypeError("Portal availability response is invalid.");
    },
  });
}

export function fetchPortalGuidance(options?: ContextApiRequestOptions) {
  return requestPortalJson<Guidance[]>({
    url: "/api/portal/guidance",
    init: withSignal({ method: "GET" }, options),
    parse: (body) => presentationArray(body, "guidance", isGuidance),
  });
}

export function fetchPortalAnnouncements(options?: ContextApiRequestOptions) {
  return requestPortalJson<Announcement[]>({
    url: "/api/portal/announcements",
    init: withSignal({ method: "GET" }, options),
    parse: (body) => presentationArray(body, "announcements", isAnnouncement),
  });
}

export function fetchPortalReleases(options?: ContextApiRequestOptions) {
  return requestPortalJson<Release[]>({
    url: "/api/portal/releases",
    init: withSignal({ method: "GET" }, options),
    parse: (body) => presentationArray(body, "releases", isRelease),
  });
}

export function submitPortalFeedback(
  request: FeedbackSubmission,
  options?: ContextApiRequestOptions,
) {
  return requestPortalJson<FeedbackResponse>({
    url: "/api/feedback",
    init: withSignal(
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      },
      options,
    ),
    parseWithSchemas: (schemas, body) => schemas.FeedbackResponseSchema.parse(body),
  });
}

export function fetchPortalAsk(request: AskAtlasRequest, options?: ContextApiRequestOptions) {
  return requestPortalJson<AskAtlasResponse>({
    url: "/api/portal/ask",
    init: withSignal(jsonPost(request), options),
    parse: parseAskAtlasResponse,
  });
}

type PortalJsonRequest<TBody> = {
  url: string;
  init: RequestInit;
} & (
  | { parse: (body: unknown) => TBody }
  | { parseWithSchemas: (schemas: AtlasSchemas, body: unknown) => TBody }
);

async function requestPortalJson<TBody>(input: PortalJsonRequest<TBody>): Promise<TBody> {
  const responsePromise = fetch(input.url, input.init);
  const schemasPromise = "parseWithSchemas" in input ? import("@atlas/schema") : undefined;
  const response = await responsePromise;
  const schemas = await schemasPromise;
  const body: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    throwPortalHttpError(response.status, body, schemas);
  }

  return "parseWithSchemas" in input ? input.parseWithSchemas(schemas!, body) : input.parse(body);
}

function throwPortalHttpError(status: number, body: unknown, schemas?: AtlasSchemas): never {
  if (schemas) {
    const parsedError = schemas.ApiErrorResponseSchema.safeParse(body);
    if (parsedError.success) {
      throw ContextApiError.fromResponse({ status, body: parsedError.data });
    }
  }
  const error = objectProperty(body, "error");
  if (error && typeof error === "object") {
    const code = objectProperty(error, "code");
    const message = objectProperty(error, "message");
    if (typeof code === "string" && typeof message === "string") {
      throw new ContextApiError({ code: code as ContextApiErrorCode, message, status });
    }
  }
  throw new ContextApiError({
    code: "invalid_request",
    message: `Context API returned status ${status} with no structured error body.`,
    status,
  });
}

function objectProperty(body: unknown, key: string): unknown {
  return body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
}

function presentationArray<TItem>(
  body: unknown,
  key: string,
  isItem: (value: unknown) => value is TItem,
): TItem[] {
  const value = objectProperty(body, key);
  if (!Array.isArray(value) || !value.every(isItem)) {
    throw new TypeError(`Portal ${key} response is invalid.`);
  }
  return value;
}

function isAnnouncement(value: unknown): value is Announcement {
  if (!isRecord(value) || !hasStrings(value, ["id", "title"])) return false;
  if (!hasOptionalStrings(value, ["postedAt", "month", "kind", "summary"])) return false;
  return (
    value.link === undefined || (isRecord(value.link) && hasStrings(value.link, ["label", "href"]))
  );
}

function isAvailabilityResponse(value: unknown): value is AvailabilityResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.zones) &&
    value.zones.every(
      (zone) =>
        isRecord(zone) &&
        hasStrings(zone, ["id", "name", "cloud", "dataStatus"]) &&
        Array.isArray(zone.locations) &&
        zone.locations.every(
          (location) =>
            isRecord(location) &&
            hasStrings(location, ["id", "label", "sub", "kind"]) &&
            (location.coordinates === undefined ||
              (Array.isArray(location.coordinates) &&
                location.coordinates.length === 2 &&
                location.coordinates.every((coordinate) => typeof coordinate === "number"))),
        ) &&
        Array.isArray(zone.services) &&
        zone.services.every(
          (service) =>
            isRecord(service) &&
            hasStrings(service, ["id", "name", "iconKey", "domain"]) &&
            isRecord(service.availability) &&
            Object.values(service.availability).every(
              (entry) =>
                isRecord(entry) && typeof entry.status === "string" && optionalString(entry.note),
            ),
        ),
    )
  );
}

function parseAskAtlasResponse(body: unknown): AskAtlasResponse {
  if (
    !isRecord(body) ||
    typeof body.answer !== "string" ||
    !Array.isArray(body.sources) ||
    !body.sources.every(
      (source) => isRecord(source) && hasStrings(source, ["source_id", "title", "url"]),
    ) ||
    !Array.isArray(body.warnings) ||
    !body.warnings.every((warning) => typeof warning === "string")
  ) {
    throw new TypeError("Portal Ask response is invalid.");
  }
  return body as AskAtlasResponse;
}

function isRelease(value: unknown): value is Release {
  if (!isRecord(value) || typeof value.id !== "string" || !Array.isArray(value.items)) return false;
  if (
    !hasOptionalStrings(value, [
      "month",
      "changeRequest",
      "postedAt",
      "link",
      "jiraBase",
      "support",
    ])
  ) {
    return false;
  }
  if (
    !value.items.every(
      (item) =>
        isRecord(item) &&
        hasStrings(item, ["category", "title"]) &&
        typeof item.index === "number" &&
        optionalString(item.ticket),
    )
  ) {
    return false;
  }
  return (
    value.resources === undefined ||
    (Array.isArray(value.resources) &&
      value.resources.every(
        (resource) =>
          isRecord(resource) && typeof resource.label === "string" && optionalString(resource.url),
      ))
  );
}

function isGuidance(value: unknown): value is Guidance {
  if (
    !isRecord(value) ||
    !hasStrings(value, [
      "id",
      "title",
      "scenario",
      "family",
      "objective",
      "status",
      "version",
      "lastReviewed",
    ]) ||
    !isRecord(value.destination) ||
    typeof value.destination.title !== "string" ||
    !optionalString(value.destination.description) ||
    !isRecord(value.owner) ||
    !hasStrings(value.owner, ["team", "support"]) ||
    !Array.isArray(value.steps)
  ) {
    return false;
  }
  return (
    optionalStringArray(value.sources) &&
    (value.appliesTo === undefined || isGuidanceAppliesTo(value.appliesTo)) &&
    value.steps.every(isGuidanceStep)
  );
}

function isGuidanceStep(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasStrings(value, ["id", "title"]) &&
    hasOptionalStrings(value, ["description", "why"]) &&
    optionalStringArray(value.sources) &&
    (value.tasks === undefined ||
      (Array.isArray(value.tasks) &&
        value.tasks.every(
          (task) =>
            isRecord(task) &&
            hasStrings(task, ["id", "title"]) &&
            (task.required === undefined || typeof task.required === "boolean") &&
            (task.action === undefined || isGuidanceAction(task.action)),
        )))
  );
}

function isGuidanceAction(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasStrings(value, ["type", "label"]) &&
    hasOptionalStrings(value, ["target", "ref", "text"])
  );
}

function isGuidanceAppliesTo(value: unknown): boolean {
  return (
    isRecord(value) &&
    optionalStringArray(value.services) &&
    optionalStringArray(value.landingZones) &&
    optionalStringArray(value.securityPolicies)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasStrings(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((key) => typeof value[key] === "string");
}

function hasOptionalStrings(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((key) => optionalString(value[key]));
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function optionalStringArray(value: unknown): boolean {
  return (
    value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

function withSignal(init: RequestInit, options?: ContextApiRequestOptions): RequestInit {
  return options?.signal ? { ...init, signal: options.signal } : init;
}

function jsonPost(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function encodeSlug(slug: string): string {
  return slug
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function withQuery(url: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value);
    }
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}
