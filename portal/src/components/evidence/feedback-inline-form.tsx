import { useState } from "react";
import { IconMessageReport } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  feedbackTypes,
  type FeedbackTargetType,
  type FeedbackType,
} from "@atlas/schema";

type FeedbackInlineFormProps = {
  /** target_type and target_id come from the surface that mounts the form. */
  target: { target_type: FeedbackTargetType; target_id: string };
  className?: string;
};

/**
 * Inline feedback form for missing / stale / broken / unclear evidence.
 * The submit handler is intentionally local-only in V1 — the design plan
 * stages the real POST /feedback wiring with the rest of the API surface
 * in Phase 6 of docs/architecture/implementation_plan.md. The shape we
 * collect already matches the shared FeedbackSchema so wiring is a one-
 * line swap when the route lands.
 */
export function FeedbackInlineForm({
  target,
  className,
}: FeedbackInlineFormProps) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("missing");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <form
      className={cn(
        "flex flex-col gap-3 rounded-md border border-border bg-card p-4",
        className,
      )}
      onSubmit={(event) => {
        event.preventDefault();
        if (message.trim().length === 0) return;
        // TODO Phase 6: POST /feedback with shared FeedbackSchema body.
        // Today the form just reflects success state so the surface UX is
        // testable. We never invent registry writes from the browser.
        setSubmitted(true);
        setMessage("");
      }}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <IconMessageReport className="size-4 text-muted-foreground" />
        Report missing, stale, broken, or unclear guidance
      </div>
      <p className="text-xs text-muted-foreground">
        Routed to{" "}
        <span className="font-mono">
          {target.target_type}:{target.target_id}
        </span>
        . Atlas does not edit source content; the steward will follow up.
      </p>
      <fieldset className="flex flex-wrap gap-2">
        {feedbackTypes.map((option) => (
          <label
            key={option}
            className={cn(
              "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              "border-border bg-card text-foreground hover:bg-secondary",
              option === feedbackType && "border-primary bg-brand-tint",
            )}
          >
            <input
              type="radio"
              name="feedback_type"
              value={option}
              checked={option === feedbackType}
              onChange={() => setFeedbackType(option)}
              className="sr-only"
              aria-label={option}
            />
            {option}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span className="sr-only">Feedback details</span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          required
          placeholder="What is missing or wrong? Be specific so the steward can act."
          className="resize-y rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <div className="flex items-center justify-between gap-3">
        <Button
          type="submit"
          variant="default"
          size="sm"
          disabled={message.trim().length === 0}
        >
          Send feedback
        </Button>
        {submitted ? (
          <span className="text-xs text-success">
            Recorded locally. Backend write lands with /feedback in Phase 6.
          </span>
        ) : null}
      </div>
    </form>
  );
}
