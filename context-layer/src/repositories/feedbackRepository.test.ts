import { describe, expect, it } from "vitest";
import type { Feedback } from "@atlas/schema";
import { InMemoryFeedbackRepository } from "./feedbackRepository";

const feedback: Feedback = {
  id: "feedback-1",
  target_type: "source",
  target_id: "textract-module-readme",
  feedback_type: "broken",
  message: "The private subnet section is out of date.",
  submitted_at: "2026-05-06T00:00:00.000Z",
};

describe("InMemoryFeedbackRepository", () => {
  it("creates and retrieves operational feedback records independently", () => {
    const repository = new InMemoryFeedbackRepository();

    repository.put(feedback);

    expect(repository.getById("feedback-1")).toEqual(feedback);
    expect(repository.findByTarget("source", "textract-module-readme")).toEqual([feedback]);
  });

  it("rejects malformed feedback records", () => {
    const repository = new InMemoryFeedbackRepository();

    expect(() =>
      repository.put({
        ...feedback,
        feedback_type: "approval",
      }),
    ).toThrow();
  });
});
