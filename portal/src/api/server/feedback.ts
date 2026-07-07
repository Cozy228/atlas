import { createServerFn } from "@tanstack/react-start";
import {
  FeedbackSubmissionSchema,
  type FeedbackResponse,
  type FeedbackSubmission,
} from "@atlas/schema";

import { serverContextApiClient } from "./serverContextApiClient";
import { logMutationAttribution, requestBrowserClaims } from "./auth/requestIdentity";

export const submitFeedback = createServerFn({ method: "POST" })
  .validator((input: unknown): FeedbackSubmission => FeedbackSubmissionSchema.parse(input))
  .handler(async ({ data }): Promise<FeedbackResponse> => {
    const [result, claims] = await Promise.all([
      serverContextApiClient.submitFeedback(data),
      requestBrowserClaims(),
    ]);
    // I2: attribute the feedback submission to the verified principal, separately from the store.
    logMutationAttribution("feedback.submit", data.target_id, claims);
    return result;
  });
