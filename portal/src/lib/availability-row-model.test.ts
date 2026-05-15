import { describe, expect, it } from "vitest";

import type { AvailabilityRecord, Location } from "@/api/server/availability";
import { buildAvailabilityRowModel } from "@/lib/availability-row-model";

const LOCATIONS: ReadonlyArray<Location> = [
  { id: "us-east-1", label: "US-East-1", sub: "Virginia", kind: "region" },
  { id: "gdc", label: "GDC", sub: "Primary Outpost", kind: "outpost" },
  { id: "dc16", label: "DC16", sub: "DR Outpost", kind: "outpost" },
];

const SERVICES: ReadonlyArray<AvailabilityRecord> = [
  {
    id: "s3",
    name: "S3",
    iconKey: "S3",
    domain: "Storage",
    availability: {
      "us-east-1": { status: "available" },
    },
  },
  {
    id: "ec2",
    name: "EC2",
    iconKey: "EC2",
    domain: "Compute",
    availability: {
      gdc: { status: "planned", note: "06/30/2026" },
      dc16: { status: "interim", note: "preview" },
    },
  },
  {
    id: "bedrock",
    name: "Amazon Bedrock",
    iconKey: "BDR",
    domain: "AI Services",
    availability: {
      "us-east-1": { status: "available" },
      gdc: { status: "planned", note: "TBD" },
    },
  },
];

describe("buildAvailabilityRowModel", () => {
  it("filters services and keeps grouped row identity stable", () => {
    const model = buildAvailabilityRowModel({
      locations: LOCATIONS,
      services: SERVICES,
      query: "ec",
      domainFilter: "Compute",
      statusFilter: "planned",
      activeLocationId: "gdc",
      selectedServiceId: "ec2",
    });

    expect(model.rows.map((row) => row.id)).toEqual(["ec2"]);
    expect(model.rowById.get("ec2")?.service.name).toBe("EC2");
    expect(model.groups).toHaveLength(1);
    expect(model.groups[0]?.domain).toBe("Compute");
    expect(model.groups[0]?.rowIds).toEqual(["ec2"]);
    expect(model.selectedRow?.id).toBe("ec2");
    expect(model.activeLocationLabel).toBe("GDC");
    expect(model.rows[0]?.activeLocations.map((location) => location.id)).toEqual(["gdc", "dc16"]);
  });

  it("returns no selection when the selected service is filtered out", () => {
    const model = buildAvailabilityRowModel({
      locations: LOCATIONS,
      services: SERVICES,
      query: "",
      domainFilter: "Storage",
      statusFilter: "all",
      activeLocationId: null,
      selectedServiceId: "ec2",
    });

    expect(model.rows.map((row) => row.id)).toEqual(["s3"]);
    expect(model.selectedRow).toBeNull();
    expect(model.domainOptions).toEqual(["all", "AI Services", "Compute", "Storage"]);
  });
});
