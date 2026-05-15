import { performance } from "node:perf_hooks";
import { renderToString } from "react-dom/server";
import { describe, it } from "vitest";

import type {
  AvailabilityRecord,
  LandingZoneData,
  Location,
  LocationStatus,
} from "@/api/server/availability";
import { MatrixView } from "@/components/explore/matrix-view";
import { ServiceCard } from "@/components/explore/service-card";
import { StatusDot } from "@/components/explore/status-dot";
import { buildAvailabilityRowModel } from "@/lib/availability-row-model";

function median(values: number[]) {
  return values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
}

function measure(label: string, runs: number, fn: () => void) {
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  console.log(
    `[PERF-availability] ${label}: median=${median(samples).toFixed(2)}ms max=${Math.max(...samples).toFixed(2)}ms`,
  );
}

describe("availability render cost", () => {
  it("measures dense matrix and card render cost", () => {
    for (const zone of makeSyntheticZones()) {
      const rowModel = buildAvailabilityRowModel({
        locations: zone.locations,
        services: zone.services,
        query: "",
        statusFilter: "all",
        domainFilter: "all",
        activeLocationId: null,
        selectedServiceId: null,
      });

      measure(`${zone.id} MatrixView`, 10, () => {
        renderToString(
          <MatrixView
            locations={zone.locations}
            rows={rowModel.rows}
            groups={rowModel.groups}
            selectedServiceId={null}
            activeLocationId={null}
            onSelect={() => {}}
            onLocationSelect={() => {}}
          />,
        );
      });

      measure(`${zone.id} status dots`, 10, () => {
        renderToString(
          <>
            {zone.services.map((service) =>
              zone.locations.map((location) => (
                <StatusDot
                  key={`${service.id}:${location.id}`}
                  status={service.availability[location.id]?.status ?? "not-planned"}
                  note={location.label}
                  size={zone.locations.length > 6 ? "sm" : "md"}
                />
              )),
            )}
          </>,
        );
      });

      measure(`${zone.id} cards`, 10, () => {
        renderToString(
          <>
            {rowModel.rows.map((row) => (
              <ServiceCard key={row.id} row={row} selected={false} onSelect={() => {}} />
            ))}
          </>,
        );
      });
    }
  });
});

const AWS_LOCATIONS: ReadonlyArray<Location> = [
  { id: "us-east-1", label: "US-East-1", sub: "North Virginia", kind: "region" },
  { id: "ca-central-1", label: "CA-Central-1", sub: "Canada Central", kind: "region" },
  { id: "gdc", label: "GDC", sub: "Primary Outpost", kind: "outpost" },
  { id: "dc16", label: "DC16", sub: "DR Outpost", kind: "outpost" },
  { id: "mt10", label: "MT10", sub: "Future DR", kind: "outpost" },
];

const AZURE_LOCATIONS: ReadonlyArray<Location> = [
  { id: "eastus", label: "East US", sub: "Virginia", kind: "region" },
  { id: "westus2", label: "West US 2", sub: "Washington", kind: "region" },
  { id: "centralus", label: "Central US", sub: "Iowa", kind: "region" },
  { id: "northeurope", label: "North EU", sub: "Ireland", kind: "region" },
  { id: "westeurope", label: "West EU", sub: "Netherlands", kind: "region" },
  { id: "southeastasia", label: "SE Asia", sub: "Singapore", kind: "region" },
  { id: "eastasia", label: "East Asia", sub: "Hong Kong", kind: "region" },
  { id: "australiaeast", label: "AU East", sub: "Sydney", kind: "region" },
  { id: "canadacentral", label: "CA Central", sub: "Toronto", kind: "region" },
  { id: "uksouth", label: "UK South", sub: "London", kind: "region" },
];

const AWS_SERVICE_IDS = [
  "landing-zones",
  "s3",
  "efs",
  "ebs",
  "backup",
  "ec2",
  "lambda",
  "ecs-fargate",
  "ecr",
  "eks",
  "ecs-ec2",
  "aurora",
  "elasticache",
  "kinesis",
  "glue",
  "athena",
  "sqs",
  "sns",
  "eventbridge",
  "airflow",
  "step-functions",
  "transfer",
  "dms",
  "bedrock",
  "agentcore",
  "textract",
  "elb",
] as const;

function makeSyntheticZones(): ReadonlyArray<LandingZoneData> {
  return [
    {
      id: "aws",
      name: "AWS",
      locations: AWS_LOCATIONS,
      services: AWS_SERVICE_IDS.map((id, index) =>
        makeService(id, `AWS Service ${index + 1}`, index, AWS_LOCATIONS),
      ),
    },
    {
      id: "azure",
      name: "Azure",
      locations: AZURE_LOCATIONS,
      services: Array.from({ length: 30 }, (_, index) =>
        makeService(`azure-${index}`, `Azure Service ${index + 1}`, index, AZURE_LOCATIONS),
      ),
    },
  ];
}

function makeService(
  id: string,
  name: string,
  index: number,
  locations: ReadonlyArray<Location>,
): AvailabilityRecord {
  return {
    id,
    name,
    iconKey: id.slice(0, 3).toUpperCase(),
    domain: ["Compute", "Storage", "Database", "AI Services", "Networking"][index % 5]!,
    availability: Object.fromEntries(
      locations.flatMap((location, locationIndex) => {
        const status = syntheticStatus(index, locationIndex);
        if (status === "not-planned") return [];
        return [[location.id, { status, note: status === "planned" ? "Q4 2026" : undefined }]];
      }),
    ),
  };
}

function syntheticStatus(serviceIndex: number, locationIndex: number): LocationStatus {
  const n = (serviceIndex * 7 + locationIndex * 13) % 100;
  if (n < 50) return "available";
  if (n < 70) return "planned";
  if (n < 82) return "interim";
  return "not-planned";
}
