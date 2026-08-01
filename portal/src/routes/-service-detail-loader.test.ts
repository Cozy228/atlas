import { describe, expect, it, vi } from "vitest";

import { Route } from "./service.$provider.$id";

describe("service detail loader", () => {
  it("starts independent queries before the record resolves", async () => {
    let resolveRecord!: (value: unknown) => void;
    const record = new Promise((resolve) => {
      resolveRecord = resolve;
    });
    const ensureQueryData = vi.fn((options: { queryKey: readonly unknown[] }) => {
      switch (options.queryKey[0]) {
        case "resource-record":
          return record;
        case "resource-catalog":
          return Promise.resolve({ resources: [] });
        case "guidance":
          return Promise.resolve([]);
        case "availability":
          return Promise.resolve({ zones: [] });
        case "resource-context":
          return Promise.resolve(null);
        default:
          throw new Error(`Unexpected query ${String(options.queryKey[0])}`);
      }
    });
    const loader = Route.options.loader as ((context: unknown) => Promise<unknown>) | undefined;
    if (!loader) throw new Error("Service detail route has no loader.");

    const pending = loader({
      context: { queryClient: { ensureQueryData } },
      params: { id: "object-store", provider: "aws" },
    } as never);

    expect(ensureQueryData.mock.calls.map(([options]) => options.queryKey[0])).toEqual([
      "resource-record",
      "resource-catalog",
      "guidance",
      "availability",
      "resource-context",
    ]);

    resolveRecord({
      category: "storage",
      kind: "service",
      name: "Object Store",
      slug: "aws/object-store",
    });
    await expect(pending).resolves.toMatchObject({ slug: "aws/object-store" });
  });
});
