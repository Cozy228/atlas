import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAvailabilityPage } from "../sourceContent/confluenceAvailabilityProvider";
import {
  AWSF_LOCATIONS,
  AWSF_SERVICES,
  renderAvailabilityPageStorage,
} from "./availabilityFixture";

/** The committed snapshot (co-located) MSW serves as the availability page body. */
const SAMPLE_PATH = new URL("./availability.sample.html", import.meta.url);

describe("availabilityFixture — the MSW availability page", () => {
  it("stays byte-identical to the committed availability.sample.html snapshot", () => {
    // If this fails, the fixture data changed: regenerate the snapshot so the MSW
    // body and the human-readable sample never drift.
    const snapshot = readFileSync(SAMPLE_PATH, "utf8");
    expect(`${renderAvailabilityPageStorage()}\n`).toBe(snapshot);
  });

  it("round-trips every service id — the parser derives from the name what the fixture authored", () => {
    const parsed = parseAvailabilityPage(renderAvailabilityPageStorage());
    expect(parsed.services.map((s) => s.id)).toEqual(AWSF_SERVICES.map((s) => s.id));
  });

  it("round-trips locations with their kind from the region + outpost tables", () => {
    const parsed = parseAvailabilityPage(renderAvailabilityPageStorage());
    expect(parsed.locations.map((l) => [l.id, l.kind])).toEqual(
      AWSF_LOCATIONS.map((l) => [l.id, l.kind]),
    );
  });
});
