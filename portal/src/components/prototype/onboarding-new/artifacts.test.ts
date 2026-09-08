import { describe, expect, it } from "vitest";
import { collectArtifacts, resolveTaskArtifacts } from "./artifacts";
import { initialProgress, tasks } from "./flow";

const taskIndex = (id: string) => tasks.findIndex((task) => task.sourceId === id);
describe("onboarding artifacts", () => {
  it("collects outputs only for completed tasks and resolves application-specific groups", () => {
    expect(collectArtifacts(tasks, initialProgress)).toEqual([]);
    const artifacts = collectArtifacts(tasks, {
      ...initialProgress,
      values: { 0: "DEMO" },
      completed: [0, taskIndex("sailpoint-groups")],
    });
    expect(artifacts.map((item) => item.id)).toEqual([
      "application-code",
      "devops-groups",
      "aws-groups",
      "tfe-groups",
    ]);
    expect(artifacts.find((item) => item.id === "devops-groups")?.fields[0].value).toBe(
      "SSO_DEVOPS_DEMO_Developer",
    );
    expect(artifacts.find((item) => item.id === "group-creation")).toBeUndefined();
    expect(artifacts.find((item) => item.id === "group-creation")?.link).toBeUndefined();
  });
  it("uses entered ticket details rather than the task's application URL", () => {
    const progress = {
      ...initialProgress,
      completed: [taskIndex("tfe-workspace")],
      values: {
        "artifact:tfe-workspace-request:number": "RITM-DEMO-42",
        "artifact:tfe-workspace-request:url": "https://tickets.example.com/RITM-DEMO-42",
      },
    };
    const request = collectArtifacts(tasks, progress)[0];
    expect(request.value).toBe("RITM-DEMO-42");
    expect(request.link).toBe("https://tickets.example.com/RITM-DEMO-42");
    expect(
      collectArtifacts(tasks, {
        ...progress,
        values: { ...progress.values, "artifact:tfe-workspace-request:url": "javascript:alert(1)" },
      })[0].link,
    ).toBeUndefined();
  });
  it("keeps task input drafts out of artifacts until completion", () => {
    const index = taskIndex("group-mapping");
    const progress = {
      ...initialProgress,
      values: { "artifact:tfe-mapping:number": "REQ-DEMO-42" },
    };
    const draft = resolveTaskArtifacts(tasks, progress, index).find(
      (item) => item.id === "tfe-mapping",
    );
    expect(draft?.value).toBe("REQ-DEMO-42");
    expect(draft?.fields[0].storageKey).toBe("artifact:tfe-mapping:number");
    expect(collectArtifacts(tasks, progress)).toEqual([]);
    expect(
      collectArtifacts(tasks, { ...progress, completed: [index] }).map((item) => item.id),
    ).toEqual(["tfe-mapping"]);
  });
  it("does not collect empty identifiers or optional details alone", () => {
    expect(
      collectArtifacts(tasks, {
        ...initialProgress,
        completed: [taskIndex("group-mapping")],
        values: { "artifact:tfe-mapping:number": "  ", "artifact:tfe-mapping:status": "Submitted" },
      }),
    ).toEqual([]);
  });
  it("shares the AWS account ID with the existing task input", () => {
    const accountIndex = tasks.findIndex((task) => task.field === "aws_account_id");
    const account = collectArtifacts(tasks, {
      ...initialProgress,
      completed: [taskIndex("aws-account")],
      values: { [accountIndex]: "123456789012" },
    }).find((item) => item.id === "aws-account");
    expect(account?.value).toBe("123456789012");
    expect(account?.fields[0].storageKey).toBe(String(accountIndex));
  });
});
