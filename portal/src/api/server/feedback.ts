import { createServerFn } from "@tanstack/react-start";
import {
  FeedbackSubmissionSchema,
  type FeedbackResponse,
  type FeedbackSubmission,
} from "@atlas/schema";

import { serverContextApiClient } from "./serverContextApiClient";

export const submitFeedback = createServerFn({ method: "POST" })
  .validator((input: unknown): FeedbackSubmission => FeedbackSubmissionSchema.parse(input))
  .handler(
    async ({ data }): Promise<FeedbackResponse> => serverContextApiClient.submitFeedback(data),
  );
