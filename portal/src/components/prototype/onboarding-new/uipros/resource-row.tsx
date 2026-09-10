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
              className="on-resource-copy shrink-0"
              size="icon-xs"
              aria-label={`Copy ${label} for ${name}`}
              disabled={!copyValue.trim()}
              onClick={() => onCopy(copyValue, label)}
            />
          }
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              className="on-copy-feedback relative inline-flex shrink-0"
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
      className="on-resource-row relative isolate flex min-h-0 items-center justify-between gap-0 border-b border-border py-1 [&>div:first-child]:min-w-0 [&>.flex]:gap-0 [&_strong]:block [&_strong]:text-[13px] [&_strong]:leading-6 [&_strong]:font-medium [&_span]:block [&_span]:text-[13px] [&_span]:leading-6 [&_span]:wrap-anywhere [&_span]:text-muted-foreground on-resource-details [&>[data-slot=accordion-item]]:w-full [&_[data-slot=accordion-item]>.flex>.flex>h3]:min-w-0 [&_[data-slot=accordion-item]>.flex>.flex>h3]:flex-1 [&_[data-slot=accordion-content]_.on-accordion-inner]:h-auto [&_.on-accordion-inner]:pb-0 [&_h3]:h-auto [&_h3]:min-h-8"
      role="group"
      aria-label={name}
      onFocus={onFocus}
      value={expanded ? ["details"] : []}
      onValueChange={(value) => onExpandedChange(value.length > 0)}
    >
      {active && (
        <motion.div
          className="on-resource-selection absolute inset-y-0 -inset-x-2 -z-1 rounded-md bg-muted"
          layoutId="resource-selection"
          transition={{ duration: reducedMotion ? 0 : 0.16 }}
        />
      )}
      <AccordionItem value="details">
        <div
          className="on-resource-heading flex items-start justify-between gap-3 [&>h3]:min-h-6 [&>h3]:flex-1 [&_.on-resource-detail-trigger]:h-6 [&_.on-resource-detail-trigger]:w-full [&_.on-resource-detail-trigger]:justify-between data-[link=true]:[&>h3]:flex-none data-[link=true]:[&_.on-resource-detail-trigger]:w-6 data-[link=true]:[&_.on-resource-detail-trigger]:justify-center [&>.on-resource-name-link]:text-foreground [&>.on-resource-name-link>svg]:text-muted-foreground"
          data-link={isLink}
        >
          {isLink ? (
            <a
              className="on-resource-name-link inline-flex min-w-0 items-baseline gap-1.5 text-brand no-underline hover:underline [&_svg]:shrink-0 [&_svg]:self-center [&>span]:text-inherit"
              href={link}
              target="_blank"
              rel="noreferrer"
            >
              <strong>{name}</strong>
              <IconExternalLink size={14} aria-hidden="true" />
            </a>
          ) : null}
          <AccordionTrigger
            className="on-resource-detail-trigger items-center gap-2 rounded-none! border-0 p-0 text-foreground [&_strong]:text-left [&_strong]:leading-5 [&_[data-slot=accordion-trigger-icon]]:size-3"
            data-resource-primary
            aria-label={`Details for ${name}`}
          >
            {!isLink && <strong>{name}</strong>}
          </AccordionTrigger>
        </div>
        {value !== link && (
          <div className="on-resource-identifier mt-1 flex w-fit max-w-full items-center gap-2 [&>span]:wrap-anywhere">
            {link ? (
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="on-resource-name-link inline-flex min-w-0 items-baseline gap-1.5 text-brand no-underline hover:underline [&_svg]:shrink-0 [&_svg]:self-center [&>span]:text-inherit"
              >
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
          <div className="on-resource-detail-body mt-2 mr-2 ml-4 border-t border-border pt-3 pb-2 [&_dl]:grid [&_dl]:gap-2 [&_dl>div]:grid [&_dl>div]:grid-cols-[80px_minmax(0,1fr)] [&_dl>div]:gap-3 [&_dt]:text-xs [&_dt]:leading-6 [&_dt]:text-muted-foreground [&_dd]:m-0 [&_dd]:flex [&_dd]:min-w-0 [&_dd]:items-start [&_dd]:gap-2 [&_dd]:text-[13px] [&_dd]:leading-5 [&_dd]:wrap-anywhere [&_dd]:text-foreground [&_dd>span]:leading-6 [&_dd>span]:text-foreground [&_dd>.on-resource-copy]:shrink-0 [&_dd>.on-resource-name-link]:min-h-6 [&_dd>.on-resource-name-link]:items-center [&_dd>.on-resource-name-link]:leading-6">
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
                      className="on-resource-name-link inline-flex min-w-0 items-baseline gap-1.5 text-brand no-underline hover:underline [&_svg]:shrink-0 [&_svg]:self-center [&>span]:text-inherit"
                    >
                      Open artifact <IconExternalLink size={14} aria-hidden="true" />
                    </a>
                    {copyControl(link, "Link")}
                  </dd>
                </div>
              )}
            </dl>
            <div className="on-resource-detail-actions mt-2 flex items-center gap-4 [&>button]:mt-0 [&>button]:px-0">
              <Button
                variant="ghost"
                className="on-resource-task-link mt-3 px-0 text-xs text-brand"
                onClick={onViewTask}
              >
                View source task <ArrowNudge size={14} />
              </Button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
