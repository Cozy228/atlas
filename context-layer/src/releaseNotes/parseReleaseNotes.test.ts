import { describe, expect, it } from "vitest";
import { parseReleaseNotes } from "./parseReleaseNotes";

// Fictional, public-safe — mirrors the real page's messy formatting (bracketed,
// bare, and glued tickets) so the parser is exercised, with invented keys.
const SAMPLE = `Release Notes : link to jira release.
• Release Scope:
Non-Compute:
1. SCP: Enable DMS in all OUs in PE Org and Fed LZ [PLAT-101]
2. SCP: Enable API Gateway in all OUs in PE Org and Fed LZ [PLAT-102]
3. Config: Data Sync hardening guidelines [PLAT-103]
4. Release 1.0.2 of Transfer Family service [PLAT-104]
5. Resolve ElastiCache access issue in cluster-node mode [PLAT-105]
6. enhance security group module to not always force replacement PLAT-106
7. Update OPA policy for ENV_CLASS tag PLAT-107
8. Config: autoscaling-capacity-rebalancing PLAT-108
9. Config: Tag support Autoscaling Resource PLAT-109
10. Release 1.0.2 of MWAA Airflow service[PLAT-110]
Compute:
1. EC2-Patch Compliance Report Lambda Production Deployment [PLAT-111]
2. CMDB failures to be reported through pipeline execution and to PE team [PLAT-112]
3. EC2 Script Repo Production Deployment on May 23th [PLAT-113]
•For this release change CHG0010001 | Change Request | Service Management - Production
• On Viva Engage: (19) Viva Engage - Conversation (posted in AWS Federated Platform on 09th May, 2026.
Additional details:
`;

describe("parseReleaseNotes", () => {
  it("captures every scope item under its category", () => {
    const [release] = parseReleaseNotes(SAMPLE);
    expect(release.items).toHaveLength(13);
    expect(release.items.filter((i) => i.category === "Non-Compute")).toHaveLength(10);
    expect(release.items.filter((i) => i.category === "Compute")).toHaveLength(3);
  });

  it("splits the Jira ticket from the title, brackets optional", () => {
    const [release] = parseReleaseNotes(SAMPLE);
    expect(release.items[0]).toEqual({
      category: "Non-Compute",
      index: 1,
      title: "SCP: Enable DMS in all OUs in PE Org and Fed LZ",
      ticket: "PLAT-101",
    });
    // Bare ticket, no brackets.
    const bare = release.items.find((i) => i.ticket === "PLAT-106");
    expect(bare?.title).toBe("enhance security group module to not always force replacement");
    // Glued bracket, no preceding space.
    const glued = release.items.find((i) => i.ticket === "PLAT-110");
    expect(glued?.title).toBe("Release 1.0.2 of MWAA Airflow service");
  });

  it("derives month, change request, and ISO posted date, with a self-owned stable id", () => {
    const [release] = parseReleaseNotes(SAMPLE);
    expect(release.changeRequest).toBe("CHG0010001");
    expect(release.postedAt).toBe("2026-05-09");
    expect(release.month).toBe("May 2026");
    // Our own key, not the CHG; deterministic across reparses.
    expect(release.id).toMatch(/^rel-[0-9a-f]{8}$/);
    expect(parseReleaseNotes(SAMPLE)[0].id).toBe(release.id);
  });

  it("splits a multi-release month into separate releases with distinct ids", () => {
    const twice = `${SAMPLE}
Release Notes : second drop.
• Release Scope:
Compute:
1. EC2 hardening follow-up [PLAT-130]
•For this release change CHG0010002
• posted in AWS Federated Platform on 23th May, 2026.
`;
    const releases = parseReleaseNotes(twice);
    expect(releases).toHaveLength(2);
    expect(new Set(releases.map((r) => r.id)).size).toBe(2);
    expect(releases.every((r) => r.month === "May 2026")).toBe(true);
  });
});
