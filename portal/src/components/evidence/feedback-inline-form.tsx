import { useForm } from "@tanstack/react-form";
import { IconMessageReport } from "@tabler/icons-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  FeedbackTargetTypeSchema,
  FeedbackTypeSchema,
  feedbackTypes,
  type FeedbackTargetType,
  type FeedbackType,
} from "@atlas/schema";

type FeedbackInlineFormProps = {
  target: { target_type: FeedbackTargetType; target_id: string };
  className?: string;
};

const formSchema = z.object({
  feedback_type: FeedbackTypeSchema,
  message: z.string().min(1, "Describe what is missing or wrong."),
  target_type: FeedbackTargetTypeSchema,
  target_id: z.string().min(1),
});

export function FeedbackInlineForm({
  target,
  className,
}: FeedbackInlineFormProps) {
  const form = useForm({
    defaultValues: {
      feedback_type: "missing" as FeedbackType,
      message: "",
      target_type: target.target_type as FeedbackTargetType,
      target_id: target.target_id,
    },
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      // TODO Phase 6: POST /feedback with shared FeedbackSchema body.
      toast.success("Feedback recorded locally", {
        description: `Routed to ${value.target_type}:${value.target_id}. Backend write lands with /feedback in Phase 6.`,
      });
      formApi.reset();
    },
  });

  return (
    <form
      className={cn(
        "flex flex-col gap-3 rounded-md border border-border bg-card p-4",
        className,
      )}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
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

      <form.Field name="feedback_type">
        {(field) => (
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Feedback type</legend>
            {feedbackTypes.map((option) => (
              <Label
                key={option}
                className={cn(
                  "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  "border-border bg-card text-foreground hover:bg-secondary",
                  option === field.state.value && "border-primary bg-brand-tint",
                )}
              >
                <input
                  type="radio"
                  name="feedback_type"
                  value={option}
                  checked={option === field.state.value}
                  onChange={() => field.handleChange(option)}
                  className="sr-only"
                  aria-label={option}
                />
                {option}
              </Label>
            ))}
          </fieldset>
        )}
      </form.Field>

      <form.Field name="message">
        {(field) => (
          <Label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="sr-only">Feedback details</span>
            <Textarea
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              rows={3}
              required
              placeholder="What is missing or wrong? Be specific so the steward can act."
              aria-invalid={field.state.meta.errors.length > 0}
              className="resize-y"
            />
          </Label>
        )}
      </form.Field>

      <div className="flex items-center justify-between gap-3">
        <form.Subscribe
          selector={(state) => ({
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "Sending…" : "Send feedback"}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
