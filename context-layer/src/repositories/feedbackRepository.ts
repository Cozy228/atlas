import {
  FeedbackSchema,
  type Feedback,
  type FeedbackTargetType,
} from "@atlas/schema";

export type FeedbackRepository = {
  put(feedback: unknown): Feedback | Promise<Feedback>;
  getById(id: string): Feedback | undefined | Promise<Feedback | undefined>;
  list(): Feedback[] | Promise<Feedback[]>;
  findByTarget(
    targetType: FeedbackTargetType,
    targetId: string,
  ): Feedback[] | Promise<Feedback[]>;
};

export class InMemoryFeedbackRepository implements FeedbackRepository {
  private readonly feedback = new Map<string, Feedback>();

  constructor(feedback: unknown[] = []) {
    for (const item of feedback) {
      this.put(item);
    }
  }

  put(feedback: unknown): Feedback {
    const parsed = FeedbackSchema.parse(feedback);
    this.feedback.set(parsed.id, parsed);
    return parsed;
  }

  getById(id: string): Feedback | undefined {
    return this.feedback.get(id);
  }

  list(): Feedback[] {
    return Array.from(this.feedback.values());
  }

  findByTarget(targetType: FeedbackTargetType, targetId: string): Feedback[] {
    return this.list().filter(
      (feedback) =>
        feedback.target_type === targetType && feedback.target_id === targetId,
    );
  }
}
