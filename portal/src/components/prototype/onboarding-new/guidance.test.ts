import { describe, expect, it } from "vitest";
import { guidanceSchema, resolveGuidance } from "./guidance";
import { initialProgress, tasks } from "./flow";

const mappingIndex = tasks.findIndex((task) => task.sourceId === "group-mapping");
const groupsIndex = tasks.findIndex((task) => task.sourceId === "sailpoint-groups");
const mapping = tasks[mappingIndex].guidance[0];
const values = {
  0: "DEMO",
  "artifact:harness-mapping:number": "REQ-DEMO-H",
  "artifact:aws-mapping:number": "REQ-DEMO-A",
  "artifact:tfe-mapping:number": "REQ-DEMO-T",
  "guidance:context:application_name": "Demo checkout",
  "guidance:context:owner_approval": "Approval record APR-DEMO-42",
};

describe("task guidance", () => {
  it("builds a complete email from task drafts and completed upstream groups", () => {
    const draft = resolveGuidance(mapping, tasks, {
      ...initialProgress,
      active: mappingIndex,
      completed: [0, groupsIndex],
      values,
    });
    expect(draft.missing).toEqual([]);
    expect(draft.text).toContain("Demo checkout (DEMO)");
    expect(draft.text).toContain("REQ-DEMO-T");
    expect(draft.text).toContain("SSO_TFE_PROD_DEMO_PRJ_OPERATOR");
    expect(draft.text).toContain("Approval record APR-DEMO-42");
    expect(draft.href).toContain("mailto:idam-ops@example.com?");
    expect(draft.text).not.toContain("[REPLACE:");
  });
  it("does not invent application names, approvals, or completed upstream groups", () => {
    const draft = resolveGuidance(mapping, tasks, {
      ...initialProgress,
      active: mappingIndex,
      values: { 0: "DEMO" },
    });
    expect(draft.missing.map((input) => input.key)).toContain("application_name");
    expect(draft.missing.map((input) => input.key)).toContain("owner_approval");
    expect(draft.missing.map((input) => input.key)).toContain("tfe_groups");
    expect(new URL(draft.href ?? "").searchParams.get("body")).toContain("[REPLACE:");
    expect(draft.body).not.toContain("SSO_TFE_PROD_DEMO");
  });
  it("recomputes drafts when an input changes and encodes email query values", () => {
    const draft = resolveGuidance(mapping, tasks, {
      ...initialProgress,
      active: mappingIndex,
      completed: [0, groupsIndex],
      values: { ...values, 0: "NEW", "guidance:context:application_name": "Demo & Co? #1" },
    });
    expect(draft.body).toContain("SSO_TFE_PROD_NEW");
    const url = new URL(draft.href ?? "");
    expect(url.searchParams.get("body")).toBe(draft.body);
    expect([...url.searchParams.keys()]).toEqual(["subject", "body"]);
  });
  it("invalidates upstream data when its task completion is undone", () => {
    const draft = resolveGuidance(mapping, tasks, {
      ...initialProgress,
      active: mappingIndex,
      completed: [0],
      values,
    });
    expect(draft.missing.map((input) => input.key)).toEqual([
      "harness_groups",
      "aws_groups",
      "tfe_groups",
    ]);
    expect(new URL(draft.href ?? "").searchParams.get("body")).toContain("[REPLACE:");
  });
  it("rejects broken template bindings at the data boundary", () => {
    expect(guidanceSchema.safeParse([{ ...mapping, subject: "{{nonexistent}}" }]).success).toBe(
      false,
    );
    expect(
      guidanceSchema.safeParse([{ ...mapping, inputs: [...mapping.inputs, mapping.inputs[0]] }])
        .success,
    ).toBe(false);
  });
  it("uses the same renderer for a different journey and email recipient", () => {
    const [action] = guidanceSchema.parse([
      {
        id: "training-request",
        kind: "email",
        label: "Prepare enrollment email",
        recipient: "training@example.com",
        subject: "Enroll {{person}}",
        body: "Course: {{course}}",
        inputs: [
          { key: "person", label: "Participant", source: { kind: "context", name: "participant" } },
          { key: "course", label: "Course", source: { kind: "context", name: "course" } },
        ],
      },
    ]);
    const draft = resolveGuidance(action, [], {
      ...initialProgress,
      values: {
        "guidance:context:participant": "Alex Example",
        "guidance:context:course": "Introduction",
      },
    });
    expect(draft.missing).toEqual([]);
    expect(draft.href).toContain("mailto:training@example.com?");
    expect(draft.subject).toBe("Enroll Alex Example");
  });
  it("does not substitute a Git system URL for the infrastructure repository", () => {
    const active = tasks.findIndex((task) => task.sourceId === "tfe-workspace");
    const completed = ["git-onboarding", "tfe-project"].map((id) =>
      tasks.findIndex((task) => task.sourceId === id),
    );
    const draft = resolveGuidance(tasks[active].guidance[0], tasks, {
      ...initialProgress,
      active,
      completed,
      values: {
        0: "DEMO",
        "artifact:git:url": "https://git.example.com",
        "artifact:tfe-project:project": "Demo project",
      },
    });
    expect(draft.missing.map((input) => input.key)).toEqual(["repository"]);
    expect(draft.body).not.toContain("https://git.example.com");
  });
  it("keeps every configured source reference valid", () => {
    for (const task of tasks) {
      for (const action of task.guidance) {
        for (const { source } of action.inputs) {
          if (source.kind === "input")
            expect(tasks.some((item) => item.field === source.name)).toBe(true);
          if (source.kind === "artifact") {
            const artifact = tasks
              .flatMap((item) => item.artifacts)
              .find((item) => item.id === source.artifact);
            expect(artifact).toBeDefined();
            if (source.field !== "*")
              expect(artifact?.fields.some((field) => field.key === source.field)).toBe(true);
          }
        }
      }
    }
  });
});
