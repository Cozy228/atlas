import { useState } from "react";
import { IconCheck, IconCopy, IconMail } from "@tabler/icons-react";
import { toast } from "sonner";
import type { Progress, Task } from "./flow";
import { resolveGuidance, type GuidanceAction } from "./guidance";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./uipros/accordion";
import { Button } from "./uipros/button";
import { Field, FieldLabel } from "./uipros/field";
import { Input } from "./uipros/input";
import "./task-guidance.css";

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
    <Accordion className="on-guidance">
      <AccordionItem value={action.id}>
        <AccordionTrigger className="on-guidance-trigger">
          <span>
            {action.kind === "email" ? <IconMail size={16} /> : <IconCopy size={16} />}
            {action.label}
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="on-guidance-body">
            {draft.inputs.some((input) => input.source.kind === "context") && (
              <div className="on-task-output-fields">
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
              <div className="on-guidance-missing" role="status">
                <span>Replace placeholders before sending</span>
                {missingSources.map((input) => (
                  <Button
                    key={input.key}
                    type="button"
                    variant="ghost"
                    disabled={input.taskIndex < 0}
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
            <pre className="on-guidance-preview" aria-label={`${action.label} preview`}>
              {draft.text}
            </pre>
            <div className="on-guidance-actions">
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
                <a className="on-source-link" href={draft.href}>
                  Open email draft <IconMail size={14} />
                </a>
              )}
              {draft.missing.length > 0 && (
                <span>
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
