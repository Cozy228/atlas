/**
 * D1 — moment-brief schema contracts (Step 4, locked decision 1: mid-level §1,
 * P26/P28, ADR-0013 §4). `BriefSchema` / `BriefBlockSchema` /
 * `OperationalLocationSchema` accept the documented shapes and reject structural
 * invalidity (unknown fields, an unknown two-axis status, a parallel status word,
 * a missing `origin`).
 *
 * The schema LANDS in Batch 0 (deliverable 1), so these ACCEPT/REJECT cases are
 * GREEN from the first commit — unlike the behavioral suites (template / assemble
 * / route), which are red until their batch implements the behavior. All data is
 * fictional (public-safe).
 */
import { describe, expect, it } from "vitest";
import {
  BriefBlockSchema,
  BriefEvidenceSchema,
  BriefSchema,
  OperationalLocationSchema,
  SituationSchema,
} from "./src/index";

const VALID_EVIDENCE = {
  resourceId: "service/cloudx/parser",
  sectionId: "availability",
  citations: [
    {
      sourceId: "availability-matrix",
      title: "Regional Availability Matrix",
      url: "https://confluence.example.com/display/CLOUD/Availability",
      resolvedAt: "2026-07-05T10:00:00.000Z",
    },
  ],
  excerpt: "Parser is available in Zone Alpha and Zone Beta.",
};

const VALID_POINTER = {
  id: "tfe-workspace-parser-alpha",
  system: "tfe",
  kind: "workspace",
  url: "https://tfe.example.com/app/acme/workspaces/parser-alpha",
  discoveredFrom: "terraform",
};

const VALID_BLOCK = {
  id: "adopt-availability-zone-alpha",
  question: "Is Parser available in Zone Alpha?",
  landingZoneId: "zone-alpha",
  status: "available",
  evidence: [VALID_EVIDENCE],
  pointers: [VALID_POINTER],
  warnings: [],
};

const VALID_SITUATION = {
  appId: "app-fictional-orion",
  landingZoneIds: ["zone-alpha", "zone-beta"],
  origin: "by-reference",
};

const VALID_BRIEF = {
  moment: "adopt",
  situation: VALID_SITUATION,
  blocks: [VALID_BLOCK],
  resolvedAt: "2026-07-05T10:00:00.000Z",
};

describe("D1: OperationalLocationSchema", () => {
  it("accepts a full valid pointer (ADR-0003 seat)", () => {
    expect(OperationalLocationSchema.safeParse(VALID_POINTER).success).toBe(true);
  });

  it("rejects an unknown pointer kind (closed enum)", () => {
    expect(OperationalLocationSchema.safeParse({ ...VALID_POINTER, kind: "metrics" }).success).toBe(
      false,
    );
  });

  it("rejects an unknown field (strict)", () => {
    expect(OperationalLocationSchema.safeParse({ ...VALID_POINTER, token: "secret" }).success).toBe(
      false,
    );
  });
});

describe("D1: BriefEvidenceSchema", () => {
  it("accepts cited content with an excerpt body (depth=excerpts)", () => {
    expect(BriefEvidenceSchema.safeParse(VALID_EVIDENCE).success).toBe(true);
  });

  it("accepts a null excerpt (depth=citations: structure + citations, no body)", () => {
    expect(BriefEvidenceSchema.safeParse({ ...VALID_EVIDENCE, excerpt: null }).success).toBe(true);
  });

  it("rejects evidence with zero citations (a join must be cited, P14/P28)", () => {
    expect(BriefEvidenceSchema.safeParse({ ...VALID_EVIDENCE, citations: [] }).success).toBe(false);
  });
});

describe("D1: BriefBlockSchema", () => {
  it("accepts a full valid block with separate evidence + pointer arrays", () => {
    expect(BriefBlockSchema.safeParse(VALID_BLOCK).success).toBe(true);
  });

  it("accepts an LZ-independent block (no landingZoneId)", () => {
    const { landingZoneId, ...rest } = VALID_BLOCK;
    void landingZoneId;
    expect(BriefBlockSchema.safeParse(rest).success).toBe(true);
  });

  it("accepts each two-axis status value", () => {
    for (const status of ["available", "partial", "unresolved"]) {
      expect(BriefBlockSchema.safeParse({ ...VALID_BLOCK, status }).success).toBe(true);
    }
  });

  it("rejects a parallel status word (only sectionStatuses, no new vocabulary)", () => {
    expect(BriefBlockSchema.safeParse({ ...VALID_BLOCK, status: "missing" }).success).toBe(false);
  });

  it("rejects a warning whose code is outside the shared warningCodes vocabulary", () => {
    expect(
      BriefBlockSchema.safeParse({
        ...VALID_BLOCK,
        warnings: [{ code: "not_implemented", message: "x" }],
      }).success,
    ).toBe(false);
  });

  it("rejects merging evidence into pointers (separate arrays by construction, ADR-0003)", () => {
    expect(BriefBlockSchema.safeParse({ ...VALID_BLOCK, pointers: [VALID_EVIDENCE] }).success).toBe(
      false,
    );
  });
});

describe("D1: SituationSchema", () => {
  it("accepts a by-reference situation (appId present, LZ set)", () => {
    expect(SituationSchema.safeParse(VALID_SITUATION).success).toBe(true);
  });

  it("accepts a by-value situation with no appId", () => {
    expect(
      SituationSchema.safeParse({
        landingZoneIds: ["zone-alpha", "zone-beta"],
        origin: "by-value",
      }).success,
    ).toBe(true);
  });

  it("rejects an AppRecord-style origin (situation origin is scope-provenance)", () => {
    expect(SituationSchema.safeParse({ ...VALID_SITUATION, origin: "self-declared" }).success).toBe(
      false,
    );
  });

  it("rejects a missing origin", () => {
    const { origin, ...rest } = VALID_SITUATION;
    void origin;
    expect(SituationSchema.safeParse(rest).success).toBe(false);
  });
});

describe("D1: BriefSchema", () => {
  it("accepts a full valid brief (the one serialized I3 value)", () => {
    expect(BriefSchema.safeParse(VALID_BRIEF).success).toBe(true);
  });

  it("accepts every moment in the enum (adopt/build/debug/change)", () => {
    for (const moment of ["adopt", "build", "debug", "change"]) {
      expect(BriefSchema.safeParse({ ...VALID_BRIEF, moment }).success).toBe(true);
    }
  });

  it("accepts an honest-empty brief (zero blocks — never a fabricated block)", () => {
    expect(BriefSchema.safeParse({ ...VALID_BRIEF, blocks: [] }).success).toBe(true);
  });

  it("rejects an unknown moment", () => {
    expect(BriefSchema.safeParse({ ...VALID_BRIEF, moment: "provision" }).success).toBe(false);
  });

  it("rejects a non-datetime resolvedAt", () => {
    expect(BriefSchema.safeParse({ ...VALID_BRIEF, resolvedAt: "yesterday" }).success).toBe(false);
  });

  it("rejects an unknown top-level field (strict)", () => {
    expect(BriefSchema.safeParse({ ...VALID_BRIEF, generatedAt: "x" }).success).toBe(false);
  });
});
