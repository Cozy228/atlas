import { describe, expect, it } from "vitest";
import { parseReleaseNotes } from "./parseReleaseNotes.js";

// Trimmed from a real federated-platform release-notes page section.
const SAMPLE = `Release Notes : link to jira release.
• Release Scope:
Non-Compute:
1. SCP: Enable DMS in all Ous in PE Org and Fed LZ [AFCN-11574]
2. SCP: Enable API Gateway in all Ous in PE Org and Fed LZ [AFCN-11589]
3. Config: Data Sync Hardening Guidelines [AFCN-11603]
4. Release 1.0.2 of Transfer Family Service [AFCN-11745]
5. Resolve Elastic Cache access issue in cluster node mode [AFCN-11187]
6. enhance security group module to not always forces replacement AFCN-11472
7. Update OPA Policy for ENV_CLASS tag AFCN-116191
8. Config: autoscaling-capacity-rebalancing AFCN-11686
9. Config: Tag support Autoscaling Resource AFCN-11703
10. Release 1.0.2 of MWAA Airflow Service[AFCN-11758]
Compute:
1. EC2-Patch Compliance Report Lambda Production Deployment [AFCN-11725]
2. CMDB failures to be reported through pipeline execution and to PE team [AFCN-11457]
3. EC2 Script Repo Production Deployment on May 23th [AFCN-11765]
•Forthis release change CHG1052711 | Change Request | Service Management - Production
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
      title: "SCP: Enable DMS in all Ous in PE Org and Fed LZ",
      ticket: "AFCN-11574",
    });
    // Bare ticket, no brackets.
    const bare = release.items.find((i) => i.ticket === "AFCN-11472");
    expect(bare?.title).toBe("enhance security group module to not always forces replacement");
    // Glued bracket, no preceding space.
    const glued = release.items.find((i) => i.ticket === "AFCN-11758");
    expect(glued?.title).toBe("Release 1.0.2 of MWAA Airflow Service");
  });

  it("derives month, change request, and ISO posted date, with a self-owned stable id", () => {
    const [release] = parseReleaseNotes(SAMPLE);
    expect(release.changeRequest).toBe("CHG1052711");
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
1. EC2 hardening follow-up [AFCN-11800]
•For this release change CHG1052999
• posted in AWS Federated Platform on 23th May, 2026.
`;
    const releases = parseReleaseNotes(twice);
    expect(releases).toHaveLength(2);
    expect(new Set(releases.map((r) => r.id)).size).toBe(2);
    expect(releases.every((r) => r.month === "May 2026")).toBe(true);
  });
});
