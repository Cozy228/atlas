import { DynamoFeedbackRepository } from "./dynamoFeedbackRepository";
import { InMemoryFeedbackRepository, type FeedbackRepository } from "./feedbackRepository";

/**
 * Select the feedback repository implementation by environment: a durable
 * DynamoDB repository when `FEEDBACK_TABLE` is configured, otherwise an
 * in-memory repository pre-loaded with the supplied initial records. Feedback is
 * runtime-mutable, so this is the one repository whose default is not durable.
 */
export function createFeedbackRepository(
  env: Record<string, string | undefined>,
  initialFeedback?: unknown[],
): FeedbackRepository {
  const tableName = env.FEEDBACK_TABLE;
  if (tableName) {
    return new DynamoFeedbackRepository({ tableName });
  }
  return new InMemoryFeedbackRepository(initialFeedback);
}
