import { expect, it } from "vitest";
import { preparePullRequest, type PullRequestResult } from "./ecs-pr";
it("keeps the successful PR while retrying only the failed repository", async () => {
  const results = new Map<string, PullRequestResult | { kind: "failed"; message: string }>();
  const calls: string[] = [];
  let fail = true;
  const create = async (repository: string): Promise<PullRequestResult> => {
    calls.push(repository);
    if (repository === "app" && fail) throw new Error("Unavailable");
    return { kind: "created", url: `https://git.example.com/${repository}/pull/1` };
  };
  await Promise.all(
    ["infra", "app"].map((repository) =>
      preparePullRequest({ repository, create, save: (result) => results.set(repository, result) }),
    ),
  );
  expect(results.get("infra")?.kind).toBe("created");
  expect(results.get("app")?.kind).toBe("failed");
  fail = false;
  await preparePullRequest({
    repository: "app",
    create,
    save: (result) => results.set("app", result),
  });
  expect(calls).toEqual(["infra", "app", "app"]);
  expect(results.get("app")?.kind).toBe("created");
});
