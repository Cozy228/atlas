import { useState } from "react";
import { IconCheck, IconCopy, IconMail } from "@tabler/icons-react";
import { toast } from "sonner";
import type { Progress, Task } from "./flow";
import { resolveGuidance, type GuidanceAction } from "./guidance";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./uipros/accordion";
import { Button } from "./uipros/button";
import { Field, FieldLabel } from "./uipros/field";
import { Input } from "./uipros/input";

export function TaskGuidance({
  action,
  tasks,
  progress,
  onValueChange,
  onSelectTask,
}: {
  action: GuidanceAction;
  tasks: Task[];
  progress: Progress;
  onValueChange: (key: string, value: string) => void;
  onSelectTask: (index: number) => void;
}) {
  const draft = resolveGuidance(action, tasks, progress);
  const [copiedText, setCopiedText] = useState("");
  const copied = copiedText === draft.text;
  const missingSources = draft.missing.filter((input) => input.source.kind !== "context");
  return (
    <Accordion className="my-4 rounded border border-border bg-card">
      <AccordionItem value={action.id}>
        <AccordionTrigger className="px-4 py-3 text-[14px] leading-6 text-foreground [&>span]:flex [&>span]:items-center [&>span]:gap-2">
          <span className="flex items-center gap-2">
            {action.kind === "email" ? <IconMail size={16} /> : <IconCopy size={16} />}
            {action.label}
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid gap-4 px-4 pb-4">
            {draft.inputs.some((input) => input.source.kind === "context") && (
              <div className="on-task-output-fields grid grid-cols-2 gap-x-8 gap-y-4 [&_label_span]:ml-2 [&_label_span]:text-xs [&_label_span]:font-normal [&_label_span]:text-muted-foreground [&_input]:w-full">
                {draft.inputs
                  .filter((input) => input.source.kind === "context")
                  .map((input) => (
                    <Field key={input.key}>
                      <FieldLabel htmlFor={`${action.id}-${input.key}`}>{input.label}</FieldLabel>
                      <Input
                        id={`${action.id}-${input.key}`}
                        value={progress.values[input.storageKey] ?? ""}
                        onChange={(event) => onValueChange(input.storageKey, event.target.value)}
                      />
                    </Field>
                  ))}
              </div>
            )}
            {missingSources.length > 0 && (
              <div className="flex flex-wrap items-center gap-2" role="status">
                <span className="text-xs leading-6 text-muted-foreground">
                  Replace placeholders before sending
                </span>
                {missingSources.map((input) => (
                  <Button
                    key={input.key}
                    type="button"
                    variant="ghost"
                    disabled={input.taskIndex < 0}
                    className="h-auto min-h-6 px-2 text-xs text-brand-ink"
                    onClick={() => {
                      if (input.taskIndex !== progress.active) onSelectTask(input.taskIndex);
                      else {
                        const source = input.source;
                        const target =
                          source.kind === "artifact"
                            ? `artifact:${source.artifact}:${source.field}`
                            : "on-value";
                        document.getElementById(target)?.focus();
                      }
                    }}
                  >
                    {input.label}
                  </Button>
                ))}
              </div>
            )}
            <pre
              className="m-0 max-h-80 overflow-auto whitespace-pre-wrap bg-muted p-4 font-sans text-[13px] leading-6 break-words text-foreground [overflow-wrap:anywhere] select-text"
              aria-label={`${action.label} preview`}
            >
              {draft.text}
            </pre>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(draft.text);
                    setCopiedText(draft.text);
                  } catch {
                    toast.error("Could not copy the draft. Select and copy the preview text.");
                  }
                }}
              >
                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                {copied ? "Copied" : "Copy draft"}
              </Button>
              {draft.href && (
                <a
                  className="on-source-link ml-2 inline-flex items-center gap-2 text-[13px]"
                  href={draft.href}
                >
                  Open email draft <IconMail size={14} />
                </a>
              )}
              {draft.missing.length > 0 && (
                <span className="text-xs leading-6 text-muted-foreground">
                  {draft.missing.length}{" "}
                  {draft.missing.length === 1 ? "placeholder" : "placeholders"} to replace
                </span>
              )}
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
