export type PullRequestResult = { kind: "created"; url: string } | { kind: "simulated" };
export type PullRequestCreator = (repository: string) => Promise<PullRequestResult>;
export const simulatePullRequest: PullRequestCreator = async () => ({ kind: "simulated" });

export async function preparePullRequest({
  repository,
  create,
  save,
}: {
  repository: string;
  create: PullRequestCreator;
  save: (result: PullRequestResult | { kind: "failed"; message: string }) => void;
}) {
  try {
    save(await create(repository));
  } catch (error) {
    save({
      kind: "failed",
      message: error instanceof Error ? error.message : "Could not prepare this pull request.",
    });
  }
}
