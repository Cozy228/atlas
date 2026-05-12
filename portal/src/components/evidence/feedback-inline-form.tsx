import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { IconMessageReport } from "@tabler/icons-react";
import { toast } from "sonner";
import { z } from "zod";

import { submitFeedback } from "@/api/server/feedback";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
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

export function FeedbackInlineForm({ target, className }: FeedbackInlineFormProps) {
  const mutation = useMutation({
    mutationFn: async (value: z.infer<typeof formSchema>) => submitFeedback({ data: value }),
  });
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
      const response = await mutation.mutateAsync(value);
      toast.success("Feedback sent", {
        description: `Routed to ${response.feedback.target_type}:${response.feedback.target_id}.`,
      });
      formApi.reset();
    },
  });

  return (
    <form
      className={cn("rounded-md border border-border bg-card p-4", className)}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
        <IconMessageReport className="size-4 text-muted-foreground" />
        Report missing, stale, broken, or unclear guidance
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Routed to{" "}
        <span className="font-mono">
          {target.target_type}:{target.target_id}
        </span>
        . Atlas does not edit source content; the steward will follow up.
      </p>

      <FieldGroup>
        <form.Field name="feedback_type">
          {(field) => (
            <FieldSet>
              <FieldLegend variant="label">Feedback type</FieldLegend>
              <div className="flex flex-wrap gap-2" role="radiogroup">
                {feedbackTypes.map((option) => (
                  <label
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
                  </label>
                ))}
              </div>
            </FieldSet>
          )}
        </form.Field>

        <form.Field name="message">
          {(field) => {
            const isInvalid = field.state.meta.errors.length > 0;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Feedback details</FieldLabel>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  rows={3}
                  required
                  aria-invalid={isInvalid}
                  placeholder="What is missing or wrong? Be specific so the steward can act."
                  className="resize-y"
                />
                <FieldDescription>
                  The steward owns the source content; Atlas only forwards the signal.
                </FieldDescription>
                {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
              </Field>
            );
          }}
        </form.Field>
      </FieldGroup>

      <div className="mt-4 flex items-center justify-between gap-3">
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
              disabled={!canSubmit || isSubmitting || mutation.isPending}
            >
              {isSubmitting || mutation.isPending ? "Sending..." : "Send feedback"}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
