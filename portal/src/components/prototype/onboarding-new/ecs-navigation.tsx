import { Fragment } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { Button } from "./uipros/button";
import { useOnboardingMotion, motionEase } from "./motion";
import { ecsCompleted, ecsStage, ecsStages } from "./ecs-journey";
export function EcsNavigation({
  values,
  onChange,
  onExit,
  collapsed = false,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onExit: () => void;
  collapsed?: boolean;
}) {
  const { reduced } = useOnboardingMotion();
  return (
    <nav
      className={
        collapsed
          ? "ecs-nav ecs-nav-collapsed"
          : "ecs-nav on-toc-list [&_[data-slot=accordion-content]_.on-accordion-inner]:h-auto"
      }
      aria-label="ECS journey steps"
    >
      <Button variant="ghost" type="button" onClick={onExit} aria-label="Back to onboarding">
        <IconArrowLeft size={14} />
        {!collapsed && "Onboarding"}
      </Button>
      <ol
        className={
          collapsed
            ? undefined
            : "on-task-list m-0 grid list-none gap-1 pt-0 pr-2 pb-2 pl-4 [&_button]:relative [&_button]:isolate [&_button]:grid [&_button]:h-auto [&_button]:min-h-8 [&_button]:w-full [&_button]:grid-cols-[14px_minmax(0,1fr)] [&_button]:items-start [&_button]:justify-start [&_button]:gap-x-2 [&_button]:gap-y-0 [&_button]:rounded-md [&_button]:px-2 [&_button]:py-[5px] [&_button]:text-left [&_button]:text-xs [&_button]:leading-5 [&_button]:font-normal [&_button]:whitespace-normal [&_button]:text-muted-foreground [&_button:hover]:bg-muted [&_button[aria-current=step]]:bg-transparent [&_button[aria-current=step]]:text-brand [&_button[aria-disabled=true]]:cursor-default [&_button>span:last-child]:block [&_button>span:last-child]:min-w-0 [&_button>span:last-child]:overflow-visible [&_button>span:last-child]:leading-5 [&_button>span:last-child]:whitespace-normal [&_button>svg]:mt-[3px] [&_button[aria-current=step]_.on-task-dot]:bg-current"
        }
      >
        {ecsStages.map((step) => {
          const active = ecsStage(values) === step.id;
          const complete = ecsCompleted(values, step.id);
          return (
            <Fragment key={step.id}>
              {!collapsed && (step.id === "preview" || step.id === "task-definition") && (
                <li className="ecs-nav-group" role="presentation">
                  {step.id === "preview" ? "Infrastructure" : "Application delivery"}
                </li>
              )}
              <li>
                <Button
                  variant="ghost"
                  type="button"
                  title={step.title}
                  aria-label={step.title}
                  aria-current={active ? "step" : undefined}
                  data-complete={complete}
                  onClick={() => onChange("scaffold:stage", step.id)}
                >
                  {collapsed ? (
                    <span aria-hidden="true" />
                  ) : (
                    <>
                      {active && (
                        <motion.div
                          className="on-task-selection absolute inset-0 -z-1 rounded-md bg-brand-tint"
                          layoutId="ecs-active-step"
                          transition={{ duration: reduced ? 0 : 0.3, ease: motionEase.out }}
                        />
                      )}
                      <span
                        className="on-task-indicator inline-grid h-5 w-3.5 shrink-0 items-center justify-items-center [&>span]:inline-flex [&>span]:items-center [&>span]:[grid-area:1/1] [&_.on-task-dot]:m-0"
                        aria-hidden="true"
                      >
                        <AnimatePresence initial={false} mode="sync">
                          <motion.span
                            key={complete ? "complete" : "pending"}
                            initial={{
                              opacity: reduced ? 1 : 0,
                              scale: reduced ? 1 : 0.25,
                              filter: reduced ? "blur(0px)" : "blur(4px)",
                            }}
                            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                            exit={{ opacity: 0 }}
                            transition={{ type: "spring", duration: reduced ? 0 : 0.3, bounce: 0 }}
                          >
                            {complete ? (
                              <IconCheck size={14} />
                            ) : (
                              <span className="on-task-dot mx-0.5 mt-[5px] size-2.5 shrink-0 rounded-full border border-current" />
                            )}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                      <span>{step.title}</span>
                    </>
                  )}
                </Button>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
