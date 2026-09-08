import { motionDuration, useOnboardingMotion } from "../motion";
import { AnimatePresence, motion } from "motion/react";
// Adapted from UIPros reui-blocks/blocks/form-8/components/api-key-row.tsx.
import { IconCopy, IconExternalLink } from "@tabler/icons-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./accordion";
import { ArrowNudge } from "./arrow-nudge";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export function ResourceRow({
  name,
  value,
  link,
  copied,
  onCopy,
  active,
  onFocus,
  expanded,
  onExpandedChange,
  details,
  onViewTask,
  fields,
  group,
}: {
  fields: { key: string; label: string; value: string; editable: boolean; storageKey: string }[];
  group: string;
  name: string;
  value: string;
  link?: string;
  copied: string;
  onCopy: (value: string, label: string) => void;
  active: boolean;
  onFocus: () => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  details: { phase: string; task: string; applicationCode: string };
  onViewTask: () => void;
}) {
  const { reduced: reducedMotion, keyboard } = useOnboardingMotion();
  const isLink = !!link && group !== "Requests & tickets" && group !== "Accounts & values";
  const groupCount = group === "Access groups" && fields.length > 1 ? fields.length : 0;
  function copyControl(copyValue: string, label: string) {
    const isCopied = copied === `${name}: ${label}`;
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              className="on-resource-copy"
              size="icon-xs"
              aria-label={`Copy ${label} for ${name}`}
              disabled={!copyValue.trim()}
              onClick={() => onCopy(copyValue, label)}
            />
          }
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              className="on-copy-feedback"
              key={isCopied ? "copied" : "copy"}
              initial={reducedMotion ? false : { opacity: 0, filter: "blur(4px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: reducedMotion ? "blur(0px)" : "blur(4px)" }}
              transition={
                keyboard
                  ? { duration: 0 }
                  : reducedMotion
                    ? { duration: motionDuration.feedback }
                    : { type: "spring", stiffness: 260, damping: 18 }
              }
            >
              {isCopied ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <motion.path
                    d="M4 12l5 5L20 6"
                    initial={{ pathLength: reducedMotion ? 1 : 0 }}
                    animate={{ pathLength: 1 }}
                    transition={
                      reducedMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 300, damping: 25, delay: 0.1 }
                    }
                  />
                </svg>
              ) : (
                <IconCopy size={14} />
              )}
            </motion.span>
          </AnimatePresence>
        </TooltipTrigger>
        <TooltipContent>{isCopied ? "Copied" : `Copy ${label.toLowerCase()}`}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Accordion
      className="on-resource-row on-resource-details"
      role="group"
      aria-label={name}
      onFocus={onFocus}
      value={expanded ? ["details"] : []}
      onValueChange={(value) => onExpandedChange(value.length > 0)}
    >
      {active && (
        <motion.div
          className="on-resource-selection"
          layoutId="resource-selection"
          transition={{ duration: reducedMotion ? 0 : 0.16 }}
        />
      )}
      <AccordionItem value="details">
        <div className="on-resource-heading" data-link={isLink}>
          {isLink ? (
            <a className="on-resource-name-link" href={link} target="_blank" rel="noreferrer">
              <strong>{name}</strong>
              <IconExternalLink size={14} aria-hidden="true" />
            </a>
          ) : null}
          <AccordionTrigger
            className="on-resource-detail-trigger"
            data-resource-primary
            aria-label={`Details for ${name}`}
          >
            {!isLink && <strong>{name}</strong>}
          </AccordionTrigger>
        </div>
        {value !== link && (
          <div className="on-resource-identifier">
            {link ? (
              <a href={link} target="_blank" rel="noreferrer" className="on-resource-name-link">
                <span>{value || "Open artifact"}</span>
                <IconExternalLink size={14} aria-hidden="true" />
              </a>
            ) : (
              <span>{groupCount ? `${groupCount} groups` : value}</span>
            )}
            {value && !groupCount && copyControl(value, "Value")}
          </div>
        )}
        <AccordionContent>
          <div className="on-resource-detail-body">
            <dl>
              {fields
                .filter((field) => field.value.trim() && field.value !== link)
                .map((field) => (
                  <div key={field.key}>
                    <dt>{field.label}</dt>
                    <dd>
                      <span>{field.value}</span>
                      {field.value && copyControl(field.value, field.label)}
                    </dd>
                  </div>
                ))}
              <div>
                <dt>Phase</dt>
                <dd>
                  <span>{details.phase}</span>
                </dd>
              </div>
              {link && (
                <div>
                  <dt>Link</dt>
                  <dd>
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="on-resource-name-link"
                    >
                      Open artifact <IconExternalLink size={14} aria-hidden="true" />
                    </a>
                    {copyControl(link, "Link")}
                  </dd>
                </div>
              )}
            </dl>
            <div className="on-resource-detail-actions">
              <Button variant="ghost" className="on-resource-task-link" onClick={onViewTask}>
                View source task <ArrowNudge size={14} />
              </Button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
