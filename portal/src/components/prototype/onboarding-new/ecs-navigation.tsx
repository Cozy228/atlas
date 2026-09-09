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
      className={collapsed ? "ecs-nav ecs-nav-collapsed" : "ecs-nav on-toc-list"}
      aria-label="ECS journey steps"
    >
      <Button variant="ghost" type="button" onClick={onExit} aria-label="Back to onboarding">
        <IconArrowLeft size={14} />
        {!collapsed && "Onboarding"}
      </Button>
      <ol className={collapsed ? undefined : "on-task-list"}>
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
                          className="on-task-selection"
                          layoutId="ecs-active-step"
                          transition={{ duration: reduced ? 0 : 0.3, ease: motionEase.out }}
                        />
                      )}
                      <span className="on-task-indicator" aria-hidden="true">
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
                            {complete ? <IconCheck size={14} /> : <span className="on-task-dot" />}
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
