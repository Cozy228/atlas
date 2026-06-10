import { buildOpenApiDocument } from "@/api/server/openapiDocument";

export default (): Response =>
  Response.json(buildOpenApiDocument(), {
    headers: { "content-type": "application/openapi+json" },
  });
