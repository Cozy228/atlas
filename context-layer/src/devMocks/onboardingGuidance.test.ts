/**
 * Onboarding guidance golden test — the `html → parser → schema` half of the
 * pipeline, pinned against the real onboarding page shape (`onboarding.sample.html`).
 *
 * Asserts the parser maps the page's five `<h1>` sections to steps, `<h2>`s to
 * task groups, and the actionable leaves beneath (list items, link paragraphs)
 * to checkable tasks whose links become typed verb-rule actions; that a
 * Confluence-internal page reference yields a task with no action; that the
 * assembled manifest clears `GuidanceSchema` via the authored overlay; and that
 * no `[REDACTED_*]`/`redacted-*` placeholder leaks into parsed content.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GuidanceSchema, validateGuidanceManifest } from "@atlas/schema";
import {
  buildOnboardingManifest,
  parseOnboardingPage,
} from "../sourceContent/confluenceOnboardingProvider";
import { DEV_GUIDANCE_MANIFESTS } from "./guidanceFixture";

const SAMPLE = readFileSync(new URL("./onboarding.sample.html", import.meta.url), "utf8");
const sections = parseOnboardingPage(SAMPLE);
const allTasks = sections.flatMap((s) => s.tasks);
const allActions = allTasks
  .map((t) => t.action)
  .filter((a): a is NonNullable<typeof a> => Boolean(a));

describe("onboarding parser", () => {
  it("maps the five <h1> sections to steps in order", () => {
    expect(sections.map((s) => s.title)).toEqual([
      "Meridian Application Onboarding",
      "Application Deployment to Meridian",
      "Meridian Services",
      "Meridian Support Request",
      "Related Articles",
    ]);
    expect(sections.map((s) => s.id)).toEqual([
      "meridian-application-onboarding",
      "application-deployment-to-meridian",
      "meridian-services",
      "meridian-support-request",
      "related-articles",
    ]);
  });

  it("gives every section at least one checkable task", () => {
    for (const section of sections) {
      expect(section.tasks.length, section.title).toBeGreaterThan(0);
    }
  });

  it("maps the <h2> sub-headers to groups in order (section 1)", () => {
    expect(sections[0]!.groups.map((g) => g.label)).toEqual([
      "Foundational Trainings",
      "Cloud Foundations Learning Plan",
      "Onboarding Instructions",
      "App Team Console Access",
    ]);
  });

  it("makes one top-level task per <li>, nesting deeper courses as sub-tasks", () => {
    const trainings = sections[0]!.tasks.filter((t) => t.group === "Foundational Trainings");
    // AWS, Harness, Terraform, Meridian Platform Fundamentals.
    expect(trainings.map((t) => t.title)).toEqual([
      expect.stringMatching(/^AWS/),
      expect.stringMatching(/^Harness/),
      expect.stringMatching(/^Terraform/),
      "Meridian Platform Fundamentals",
    ]);
    // Harness has no lead link — its two courses become checkable sub-tasks.
    const harness = trainings[1]!;
    expect(harness.action).toBeUndefined();
    expect(harness.subtasks?.map((s) => s.title)).toEqual([
      "Harness Pipelines 101",
      "Harness Advanced Deployments",
    ]);
    expect(harness.subtasks?.every((s) => s.action?.type === "external_link")).toBe(true);
  });

  it("mirrors nested source lists as sub-tasks, deep actionable items included", () => {
    const find = (
      tasks: (typeof sections)[number]["tasks"],
      pred: (t: (typeof tasks)[number]) => boolean,
    ): (typeof tasks)[number] | undefined => {
      for (const t of tasks) {
        if (pred(t)) return t;
        const nested = t.subtasks ? find(t.subtasks, pred) : undefined;
        if (nested) return nested;
      }
      return undefined;
    };

    // The AWS training surfaces its SSO guide as a checkable sub-task.
    const aws = sections[0]!.tasks.find((t) => t.title.startsWith("AWS"))!;
    expect(aws.subtasks?.some((s) => /Single Sign-On/i.test(s.title))).toBe(true);

    // "Process to access the training" is a sub-task tree with actionable leaves.
    const process = find(sections[0]!.tasks, (t) => t.title.startsWith("Process to access"))!;
    expect(process.subtasks?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(process.subtasks?.some((s) => s.action?.target?.includes("request-form"))).toBe(true);

    // A link-less sub-list (the identity groups) stays as detail, not sub-tasks.
    const identity = find(sections[0]!.tasks, (t) => /IdentityHub/i.test(t.title))!;
    expect(identity.subtasks).toBeUndefined();
    expect(JSON.stringify(identity.detail)).toMatch(/meridian-training-readers/);

    // A link paragraph keeps its whole sentence as detail prose.
    const console = sections[0]!.tasks.find((t) => t.group === "App Team Console Access")!;
    expect(JSON.stringify(console.detail)).toMatch(/access the Meridian Console/i);
  });

  it("types links into verb-rule actions (external, tool, contact)", () => {
    const types = new Set(allActions.map((a) => a.type));
    expect(types).toContain("external_link");
    expect(types).toContain("tool_link"); // the module registry host
    // The support DL email becomes a contact action.
    const email = allActions.find((a) => a.target?.startsWith("mailto:"));
    expect(email?.type).toBe("support_link");
    expect(email?.target).toMatch(/@example\.invalid$/);
  });

  it("keeps only no-link intro prose as step / group descriptions", () => {
    // The <h1> intro (no link) becomes the step description.
    expect(sections[0]!.description).toMatch(/self-service model/i);
    // The <h2> intro (no link) becomes the group description.
    const trainings = sections[0]!.groups.find((g) => g.label === "Foundational Trainings");
    expect(trainings?.description).toMatch(/complete the following trainings/i);
  });

  it("makes a Confluence-page reference an actionable task titled by the page", () => {
    // "Onboarding Instructions" links the "Meridian Onboarding Steps" page: a task
    // titled by that page, with a wiki title-search action (storage has no URL).
    const onboarding = sections[0]!.tasks.find((t) => t.group === "Onboarding Instructions");
    expect(onboarding?.title).toBe("Meridian Onboarding Steps");
    expect(onboarding?.action?.type).toBe("external_link");
    expect(onboarding?.action?.target).toMatch(/\/wiki\/search\?text=/);

    // "Naming Convention" is likewise a task, not a description.
    const services = sections.find((s) => s.id === "meridian-services")!;
    const naming = services.tasks.find((t) => t.group === "Naming Convention");
    expect(naming?.title).toBe("Resource Naming Convention");
    expect(naming?.action?.target).toMatch(/\/wiki\/search\?text=/);
  });

  it("leaks no REDACTED/redacted placeholder into parsed content", () => {
    const json = JSON.stringify(sections);
    expect(json).not.toMatch(/REDACTED/i);
    expect(json).not.toMatch(/redacted-/i);
  });
});

describe("onboarding manifest", () => {
  const manifest = buildOnboardingManifest(SAMPLE);

  it("assembles a schema-valid Guidance via the authored overlay", () => {
    const parsed = GuidanceSchema.safeParse(manifest);
    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues, null, 2)).toBe(
      true,
    );
  });

  it("carries the onboarding identity, five steps, and grouped tasks with actions", () => {
    const parsed = GuidanceSchema.parse(manifest);
    expect(parsed.id).toBe("new-app-onboarding");
    expect(parsed.family).toBe("onboard");
    expect(parsed.steps).toHaveLength(5);
    expect(parsed.steps.every((step) => (step.tasks?.length ?? 0) > 0)).toBe(true);
    const actions = parsed.steps.flatMap((s) => s.tasks ?? []).filter((t) => t.action);
    expect(actions.length).toBeGreaterThan(0);
  });
});

describe("guidance store manifests", () => {
  // The store is empty in the dev demo (onboarding-only), but the gate stays
  // wired so a manifest added later is validated before it reaches the loader.
  it("validates every store manifest with no schema/cross-file errors", () => {
    const docs = DEV_GUIDANCE_MANIFESTS.map((raw) => ({
      file: `${(raw as { id?: string }).id ?? "manifest"}.store`,
      raw,
    }));
    const { issues } = validateGuidanceManifest(docs);
    expect(issues.filter((issue) => issue.level === "error")).toEqual([]);
  });
});
