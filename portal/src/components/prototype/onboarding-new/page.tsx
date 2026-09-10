import { EcsNavigation } from "./ecs-navigation";
import { ecsStage, ecsStages, ecsProgress, ecsArtifactStage } from "./ecs-journey";
import { EcsScaffold } from "./scaffold";
import { TaskGuidance } from "./task-guidance";
import { collectArtifacts, resolveTaskArtifacts } from "./artifacts";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
  useReducedMotion,
  useIsPresent,
  type HTMLMotionProps,
} from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, useId } from "react";
import { toast } from "sonner";
import {
  IconCheck,
  IconCircle,
  IconFolder,
  IconSearch,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from "@tabler/icons-react";
import { motionEase, motionDuration, KeyboardMotionContext } from "./motion";
import { Button } from "./uipros/button";
import { Field, FieldLabel, FieldError } from "./uipros/field";
import { Input } from "./uipros/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./uipros/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./uipros/tooltip";
import {
  initialProgress,
  inputDependencies,
  markComplete,
  phaseStart,
  sections,
  readProgress,
  STORAGE_KEY,
  tasks,
} from "./flow";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./uipros/accordion";
import { SourceContent, hasContentLink } from "./source-content";
import { SetupProgress } from "./uipros/progress";
import { resourceMatches } from "./uipros/resource-search";
import { ArrowNudge } from "./uipros/arrow-nudge";
import { ResourceArrival, type ResourceArrivalHandle } from "./uipros/resource-arrival";
import { Confetti, type ConfettiHandle } from "./uipros/confetti";
import { ResourceRow } from "./uipros/resource-row";
import "./style.css";

function TaskPanel(props: HTMLMotionProps<"div">) {
  const present = useIsPresent();
  return <motion.div {...props} inert={!present} aria-hidden={!present} />;
}

function inputLabel(field: string) {
  return field === "app_code"
    ? "Application code"
    : field === "aws_account_id"
      ? "AWS account ID"
      : field.replaceAll("_", " ");
}

export function OnboardingNew() {
  const [progress, updateProgress] = useState(readProgress);
  const progressRef = useRef(progress);
  const prefersReducedMotion = useReducedMotion();
  const [keyboardMotion, setKeyboardMotion] = useState(false);
  const reducedMotion = prefersReducedMotion || keyboardMotion;
  const motionId = useId();
  const completionToastId = `${motionId}-completion`;
  const [contentSize, setContentSize] = useState<{ height: number | null; duration: number }>({
    height: null,
    duration: 0,
  });
  const [completing, setCompleting] = useState(false);
  const [resourceAdded, setResourceAdded] = useState<number | null>(null);
  const resourceFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resourceArrival = useRef<ResourceArrivalHandle>(null);
  const celebration = useRef<ConfettiHandle>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (completionTimer.current) clearTimeout(completionTimer.current);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      if (resourceFeedbackTimer.current) clearTimeout(resourceFeedbackTimer.current);
      toast.dismiss(completionToastId);
    },
    [completionToastId],
  );
  const [expanded, setExpanded] = useState<number | null>(tasks[progress.active].phaseIndex);
  const [panel, setPanel] = useState<"resources" | null>(null);
  const [query, setQuery] = useState("");
  const resourceSearch = useRef<HTMLInputElement>(null);
  const [activeResource, setActiveResource] = useState("");
  const [expandedResource, setExpandedResource] = useState("");
  const resourceList = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(true);
  const [copied, setCopied] = useState("");
  const frame = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const initialRender = useRef(true);
  const restoreSidebar = useRef(false);
  const focusSourceTask = useRef(false);
  const phaseIndex = tasks[progress.active].phaseIndex;
  const phase = sections[phaseIndex];
  const task = tasks[progress.active];
  const isSummary = task.presentation === "summary";
  const isEcs = task.journeyRef === "ecs-service";
  const isScaffold = isEcs;
  const setEcsValue = (key: string, value: string) =>
    setProgress((previous) => ({
      ...previous,
      values: { ...previous.values, [key]: value },
      completed:
        key.startsWith("journey:ecs-service:completed:") && value === "false"
          ? previous.completed.filter((index) => tasks[index].journeyRef !== "ecs-service")
          : previous.completed,
    }));
  const exitEcs = () => {
    const previous = Number(progress.values["journey:ecs-service:return-task"] ?? 0);
    selectTask(
      Number.isInteger(previous) &&
        previous >= 0 &&
        previous < tasks.length &&
        tasks[previous].journeyRef !== "ecs-service"
        ? previous
        : 0,
    );
  };
  const currentEcsStage = ecsStage(progress.values);

  const started = progress.completed.length > 0 || progress.active > 0;
  const finished =
    progress.completed.length === tasks.length && progress.active === tasks.length - 1;
  const value = progress.values[progress.active] ?? "";
  const nextUnfinished = tasks.findIndex((_, index) => !progress.completed.includes(index));
  const dependencies = inputDependencies(progress);
  const resources = collectArtifacts(tasks, progress);
  const outputForms = resolveTaskArtifacts(tasks, progress, progress.active)
    .map((artifact) => ({
      ...artifact,
      fields: artifact.fields.filter(
        (field) => field.editable && !(task.field && field.storageKey === String(progress.active)),
      ),
    }))
    .filter((artifact) => artifact.fields.length > 0);
  const filtered = resources.filter((item) => resourceMatches(item, query));
  const groups = [...new Set(filtered.map((item) => item.group))];

  useLayoutEffect(() => {
    const container = frame.current;
    if (!container) return;
    let observed: HTMLElement | null = null;
    let observer: ResizeObserver | undefined;
    let taskTimer: ReturnType<typeof setTimeout> | undefined;
    function attach() {
      const element = container?.querySelector<HTMLElement>(
        `[data-task-id="${tasks[progress.active].sourceId}"]`,
      );
      if (!element || element === observed) return;
      observed = element;
      let lastHeight = element.getBoundingClientRect().height;
      let changingTask = true;
      setContentSize({ height: Math.ceil(lastHeight / 32) * 32, duration: motionDuration.task });
      taskTimer = setTimeout(() => {
        changingTask = false;
      }, motionDuration.task * 1000);
      if (!initialRender.current)
        element.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
      observer = new ResizeObserver(() => {
        const height = element.getBoundingClientRect().height;
        if (height === lastHeight) return;
        lastHeight = height;
        setContentSize({
          height: Math.ceil(height / 32) * 32,
          duration: changingTask ? motionDuration.task : motionDuration.layout,
        });
      });
      observer.observe(element);
    }
    attach();
    const mounting = new MutationObserver(attach);
    mounting.observe(container, { childList: true, subtree: true });
    return () => {
      mounting.disconnect();
      observer?.disconnect();
      if (taskTimer) clearTimeout(taskTimer);
    };
  }, [progress.active]);
  function setProgress(next: typeof progress | ((previous: typeof progress) => typeof progress)) {
    const updated = typeof next === "function" ? next(progressRef.current) : next;
    progressRef.current = updated;
    updateProgress(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }
  function getTaskHeading() {
    return (
      frame.current?.querySelector<HTMLHeadingElement>(
        `[data-task-id="${tasks[progressRef.current.active].sourceId}"] h1`,
      ) ?? null
    );
  }
  useEffect(() => {
    if (isScaffold && (currentEcsStage === "config" || currentEcsStage === "preview"))
      getTaskHeading()?.focus({ preventScroll: true });
  }, [isScaffold, currentEcsStage]);
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    getTaskHeading()?.focus({ preventScroll: true });
  }, [progress.active]);

  function selectTask(index: number) {
    if (tasks[index].journeyRef === "ecs-service" && !isEcs)
      setEcsValue("journey:ecs-service:return-task", String(progress.active));
    resourceArrival.current?.cancel();
    if (completionTimer.current) clearTimeout(completionTimer.current);
    setCompleting(false);
    setProgress((previous) => ({
      ...previous,
      active: index,
      navigation: previous.navigation === "hidden" ? "expanded" : previous.navigation,
    }));
    setExpanded(tasks[index].phaseIndex);
    setPanel(null);
    setError("");
  }
  function complete() {
    if (completing) return;
    if (task.field && !value.trim()) {
      setError(`Enter your ${inputLabel(task.field).toLowerCase()} to continue.`);
      input.current?.focus();
      if (!reducedMotion) {
        input.current?.getAnimations().forEach((animation) => animation.cancel());
        input.current?.animate(
          {
            transform: [
              "translateX(0)",
              "translateX(-4px)",
              "translateX(4px)",
              "translateX(-4px)",
              "translateX(0)",
            ],
          },
          { duration: 240, easing: "cubic-bezier(0.77, 0, 0.175, 1)" },
        );
      }
      return;
    }
    const origin = frame.current
      ?.querySelector<HTMLElement>(".on-primary")
      ?.getBoundingClientRect();
    setCompleting(true);
    if (
      !progress.completed.includes(progress.active) &&
      (task.artifacts.length > 0 || (task.field && value.trim()))
    ) {
      const target = document.querySelector<HTMLElement>(".on-resource-feedback");
      if (origin && target) resourceArrival.current?.fly(origin, target);
    }
    completionTimer.current = setTimeout(() => {
      const next = Math.min(progress.active + 1, tasks.length - 1);
      setProgress((previous) => ({
        ...markComplete(previous),
        values: { ...previous.values, [previous.active]: value.trim() },
        active: next,
      }));
      setCompleting(false);
      if (
        progress.completed.length < tasks.length &&
        progressRef.current.completed.length === tasks.length
      ) {
        celebration.current?.burst();
      }
      setExpanded(tasks[next].phaseIndex);
      setError("");
      if (!progress.completed.includes(progress.active)) {
        const completedIndex = progress.active;
        if (task.artifacts.length > 0 || (task.field && value.trim())) {
          if (resourceFeedbackTimer.current) clearTimeout(resourceFeedbackTimer.current);
          setResourceAdded(completedIndex);
          resourceFeedbackTimer.current = setTimeout(() => setResourceAdded(null), 1600);
        }
        toast("Task marked complete", {
          id: completionToastId,
          description: tasks[completedIndex].title,
          duration: 8000,
          action: {
            label: "Undo",
            onClick: () => {
              setResourceAdded(null);
              if (resourceFeedbackTimer.current) clearTimeout(resourceFeedbackTimer.current);
              selectTask(completedIndex);
              setProgress((previous) => ({
                ...previous,
                completed: previous.completed.filter((index) => index !== completedIndex),
              }));
            },
          },
        });
      }
    }, 850);
  }

  function taskList() {
    if (isScaffold)
      return <EcsNavigation values={progress.values} onChange={setEcsValue} onExit={exitEcs} />;
    return (
      <nav
        aria-label="Onboarding tasks"
        className="on-toc-list [&_[data-slot=accordion-content]_.on-accordion-inner]:h-auto"
      >
        <Accordion
          value={expanded === null ? [] : [String(expanded)]}
          onValueChange={(value) => {
            if (value.length === 0) {
              setExpanded(null);
              return;
            }
            const nextPhase = Number(value[0]);
            if (nextPhase === phaseIndex) setExpanded(nextPhase);
            else selectTask(phaseStart(nextPhase));
          }}
        >
          {sections.map((item, index) => {
            const count = item.tasks.filter((_, offset) =>
              progress.completed.includes(phaseStart(index) + offset),
            ).length;
            return (
              <AccordionItem className="on-phase" key={item.name} value={String(index)}>
                <AccordionTrigger className="on-phase-button flex h-16 w-full items-center gap-2 rounded-none! px-3 py-0 text-left text-xs font-[550] whitespace-nowrap hover:bg-muted [&>span]:flex-1 [&_small]:ml-auto [&_small]:text-[11px] [&_small]:font-normal [&_small]:text-muted-foreground [&_[data-slot=accordion-trigger-icon]]:size-3">
                  <span>{item.name}</span>
                  <small>
                    {count}/{item.tasks.length}
                  </small>
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="on-task-list m-0 grid list-none gap-1 pt-0 pr-2 pb-2 pl-4 [&_button]:relative [&_button]:isolate [&_button]:grid [&_button]:h-auto [&_button]:min-h-8 [&_button]:w-full [&_button]:grid-cols-[14px_minmax(0,1fr)] [&_button]:items-start [&_button]:justify-start [&_button]:gap-x-2 [&_button]:gap-y-0 [&_button]:rounded-md [&_button]:px-2 [&_button]:py-[5px] [&_button]:text-left [&_button]:text-xs [&_button]:leading-5 [&_button]:font-normal [&_button]:whitespace-normal [&_button]:text-muted-foreground [&_button:hover]:bg-muted [&_button[aria-current=step]]:bg-transparent [&_button[aria-current=step]]:text-brand [&_button[aria-disabled=true]]:cursor-default [&_button>span:last-child]:block [&_button>span:last-child]:min-w-0 [&_button>span:last-child]:overflow-visible [&_button>span:last-child]:leading-5 [&_button>span:last-child]:whitespace-normal [&_button>svg]:mt-[3px] [&_button[aria-current=step]_.on-task-dot]:bg-current">
                    {item.tasks.map((entry, offset) => {
                      const number = phaseStart(index) + offset;
                      return (
                        <li key={entry.sourceId}>
                          <Button
                            variant="ghost"
                            aria-current={number === progress.active ? "step" : undefined}
                            onClick={() => selectTask(number)}
                            title={entry.name}
                          >
                            {number === progress.active && (
                              <motion.div
                                className="on-task-selection absolute inset-0 -z-1 rounded-md bg-brand-tint"
                                layoutId="active-task"
                                transition={{
                                  duration: reducedMotion ? 0 : 0.18,
                                  ease: motionEase.out,
                                }}
                              />
                            )}
                            <span
                              className="on-task-indicator inline-grid h-5 w-3.5 shrink-0 items-center justify-items-center [&>span]:inline-flex [&>span]:items-center [&>span]:[grid-area:1/1] [&_.on-task-dot]:m-0"
                              aria-hidden="true"
                            >
                              <AnimatePresence initial={false} mode="sync">
                                <motion.span
                                  key={progress.completed.includes(number) ? "complete" : "pending"}
                                  initial={{ opacity: keyboardMotion ? 1 : 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={{
                                    duration: keyboardMotion ? 0 : motionDuration.feedback,
                                    ease: motionEase.out,
                                  }}
                                >
                                  {progress.completed.includes(number) ? (
                                    <IconCheck size={14} />
                                  ) : (
                                    <span className="on-task-dot mx-0.5 mt-[5px] size-2.5 shrink-0 rounded-full border border-current" />
                                  )}
                                </motion.span>
                              </AnimatePresence>
                            </span>
                            <span>{entry.name}</span>
                          </Button>
                        </li>
                      );
                    })}
                  </ol>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </nav>
    );
  }

  return (
    <MotionConfig reducedMotion={keyboardMotion ? "always" : "user"}>
      <KeyboardMotionContext value={keyboardMotion}>
        <LayoutGroup id={motionId}>
          <TooltipProvider delay={800}>
            <div
              className="onboarding-new group/on min-h-dvh bg-background text-[15px] leading-6 text-foreground tabular-nums [font-feature-settings:'tnum'] [&_*]:box-border [&_button]:cursor-pointer [&_a]:cursor-pointer [&_button]:rounded-md [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-brand [&_:focus-visible]:outline-offset-3"
              data-motion={keyboardMotion ? "instant" : undefined}
              onPointerDownCapture={() => setKeyboardMotion(false)}
              onKeyDownCapture={(event) => {
                if (
                  event.target instanceof HTMLElement &&
                  event.target.closest(
                    ".on-scaffold-stages, .on-scaffold-choice-row, .on-scaffold-radio-list",
                  )
                ) {
                  setKeyboardMotion(false);
                  return;
                }
                const editing =
                  event.target instanceof HTMLElement &&
                  event.target.closest("input, textarea, [contenteditable='true']");
                if (
                  editing &&
                  [" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                if (
                  [
                    "Tab",
                    "Enter",
                    " ",
                    "Escape",
                    "ArrowUp",
                    "ArrowDown",
                    "ArrowLeft",
                    "ArrowRight",
                    "Home",
                    "End",
                  ].includes(event.key)
                )
                  setKeyboardMotion(true);
              }}
              data-panel={panel ?? "none"}
              data-sidebar={progress.navigation === "hidden" ? "none" : progress.navigation}
            >
              <a
                href="#on-task"
                className="on-skip fixed -top-16 left-8 z-90 bg-card px-4 py-2 focus:top-4"
              >
                Skip to current task
              </a>
              <header className="on-header sticky top-0 z-20 flex h-16 items-center gap-6 bg-background px-8 shadow-[inset_0_-1px_var(--border)] max-lg:gap-4 max-md:gap-3 max-md:px-4">
                <a
                  href="/prototype"
                  className="on-brand text-[26px] font-[650] tracking-[-1px] max-md:text-[22px]"
                >
                  Atlas
                </a>
                <span className="on-header-divider h-6 w-px bg-border max-md:hidden" />
                <span className="on-app-name min-w-0 truncate text-sm max-md:max-w-36 max-md:text-xs">
                  {progress.values[0] || "Application onboarding"}
                </span>

                <div className="on-header-actions ml-auto flex items-center gap-8 whitespace-nowrap max-lg:gap-4 max-md:gap-3">
                  <ThemeToggle />
                  <a
                    className="on-exit text-[13px] text-muted-foreground hover:underline max-md:text-xs"
                    href="/prototype"
                  >
                    Exit setup
                  </a>
                </div>
              </header>

              <ResourceArrival ref={resourceArrival} />
              <div className="on-journey-celebration pointer-events-none fixed top-[45%] left-1/2 z-90 size-px">
                <Confetti ref={celebration} />
              </div>
              <AnimatePresence initial={false}>
                {progress.navigation !== "hidden" && (
                  <motion.aside
                    className="on-sidebar fixed top-16 bottom-0 left-0 z-10 w-56 overflow-x-hidden overflow-y-auto bg-background shadow-[inset_-1px_0_var(--border)] group-data-[sidebar=collapsed]/on:overflow-y-hidden max-md:z-30 max-md:group-data-[sidebar=expanded]/on:shadow-[8px_0_24px_var(--border)]"
                    aria-label="Setup progress"
                    initial={{
                      opacity: 0,
                      transform: reducedMotion ? "translateX(0px)" : "translateX(-16px)",
                    }}
                    animate={{ opacity: 1, transform: "translateX(0px)" }}
                    transition={{
                      duration: keyboardMotion ? 0 : motionDuration.layout,
                      ease: motionEase.out,
                    }}
                  >
                    <div className="on-sidebar-heading relative flex h-16 items-center justify-between px-4 [&_strong]:text-[15px] [&_strong]:font-semibold [&_strong]:whitespace-nowrap [&>button]:absolute [&>button]:top-4 [&>button]:right-4 max-md:group-data-[sidebar=collapsed]/on:p-0">
                      <strong aria-hidden={progress.navigation === "collapsed"}>
                        {isScaffold ? "ECS service" : "Onboarding"}
                      </strong>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={
                          progress.navigation === "collapsed"
                            ? "Expand progress sidebar"
                            : "Collapse progress sidebar"
                        }
                        aria-expanded={progress.navigation === "expanded"}
                        onClick={() =>
                          setProgress((previous) => ({
                            ...previous,
                            navigation:
                              previous.navigation === "collapsed" ? "expanded" : "collapsed",
                          }))
                        }
                      >
                        {progress.navigation === "collapsed" ? (
                          <IconLayoutSidebarLeftExpand size={18} />
                        ) : (
                          <IconLayoutSidebarLeftCollapse size={18} />
                        )}
                      </Button>
                    </div>
                    <nav
                      aria-label="Onboarding phases"
                      className="on-rail absolute top-16 left-0 flex w-16 flex-col items-center bg-transparent [&_button]:flex [&_button]:h-8 [&_button]:w-12 [&_button]:items-center [&_button]:justify-center [&_button]:bg-transparent [&_button:hover]:bg-muted [&_button>span]:h-[3px] [&_button>span]:w-3 [&_button>span]:bg-border [&_button[data-complete=true]>span]:bg-muted-foreground [&_button[aria-current=step]>span]:w-5 [&_button[aria-current=step]>span]:bg-brand max-md:[&_button]:w-8"
                      inert={progress.navigation === "expanded"}
                      aria-hidden={progress.navigation === "expanded"}
                    >
                      {isScaffold ? (
                        <EcsNavigation
                          collapsed
                          values={progress.values}
                          onChange={setEcsValue}
                          onExit={exitEcs}
                        />
                      ) : (
                        sections.map((item, index) => {
                          const count = item.tasks.filter((_, offset) =>
                            progress.completed.includes(phaseStart(index) + offset),
                          ).length;
                          return (
                            <Tooltip key={item.name}>
                              <TooltipTrigger
                                render={
                                  <button
                                    aria-label={`${item.name}, ${count} of ${item.tasks.length} tasks complete`}
                                    aria-current={index === phaseIndex ? "step" : undefined}
                                    data-complete={count === item.tasks.length}
                                    onClick={() => {
                                      selectTask(phaseStart(index));
                                      setProgress((previous) => ({
                                        ...previous,
                                        navigation: "expanded",
                                      }));
                                    }}
                                  />
                                }
                              >
                                <span />
                              </TooltipTrigger>
                              <TooltipContent side="right">
                                {item.name} · {count}/{item.tasks.length} complete
                              </TooltipContent>
                            </Tooltip>
                          );
                        })
                      )}
                    </nav>
                    <div
                      className="on-sidebar-body w-56"
                      inert={progress.navigation === "collapsed"}
                      aria-hidden={progress.navigation === "collapsed"}
                    >
                      <p className="on-toc-caption -mt-2 mx-4 mb-6 text-xs text-muted-foreground">
                        {isScaffold
                          ? `${ecsStages.length} steps · DEV`
                          : `${sections.length} phases · ${tasks.length} tasks`}
                      </p>
                      {taskList()}
                      <SetupProgress
                        completed={
                          isScaffold ? ecsProgress(progress.values) : progress.completed.length
                        }
                        total={isScaffold ? ecsStages.length : tasks.length}
                      />
                      <p className="on-sidebar-bottom mx-4 my-8 text-xs text-muted-foreground">
                        {isScaffold
                          ? `${ecsProgress(progress.values)} of ${ecsStages.length} steps complete`
                          : `${progress.completed.length} of ${tasks.length} tasks complete`}
                      </p>
                    </div>
                  </motion.aside>
                )}
              </AnimatePresence>

              <motion.main
                layout="position"
                layoutDependency={`${progress.navigation}-${panel}`}
                transition={{
                  layout: {
                    duration: reducedMotion ? 0 : motionDuration.sheet,
                    ease: motionEase.drawer,
                  },
                }}
                className="on-main relative ml-0 flex min-h-[calc(100dvh-64px)] flex-col group-data-[sidebar=expanded]/on:ml-56 group-data-[sidebar=collapsed]/on:ml-16 max-md:group-data-[sidebar=expanded]/on:ml-16 max-md:group-data-[sidebar=collapsed]/on:ml-8 min-[1200px]:group-data-[panel=resources]/on:mr-[480px] min-[832px]:max-[1200px]:group-data-[panel=resources]/on:mr-80"
                id="on-task"
                tabIndex={-1}
              >
                <motion.div
                  layout="position"
                  layoutDependency={`${progress.navigation}-${panel}`}
                  transition={{
                    layout: {
                      duration: reducedMotion ? 0 : motionDuration.sheet,
                      ease: motionEase.drawer,
                    },
                  }}
                  className="on-workspace-actions absolute top-4 right-8 z-1 flex h-8 items-center gap-3"
                >
                  {!isScaffold &&
                    started &&
                    nextUnfinished >= 0 &&
                    nextUnfinished !== progress.active && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button variant="outline" onClick={() => selectTask(nextUnfinished)} />
                          }
                        >
                          Continue setup <ArrowNudge size={16} />
                        </TooltipTrigger>
                        <TooltipContent>{tasks[nextUnfinished].title}</TooltipContent>
                      </Tooltip>
                    )}
                  {started && nextUnfinished === -1 && (
                    <Button
                      variant="ghost"
                      onClick={() => selectTask(tasks.length - 1)}
                      disabled={finished}
                    >
                      <IconCheck size={16} /> All tasks complete
                    </Button>
                  )}
                  {started && (
                    <Sheet
                      open={panel === "resources"}
                      onOpenChangeComplete={(open) => {
                        if (!open && focusSourceTask.current) {
                          getTaskHeading()?.focus({ preventScroll: true });
                        }
                      }}
                      onOpenChange={(open) => {
                        if (open) focusSourceTask.current = false;
                        if (
                          open &&
                          progress.navigation === "expanded" &&
                          window.matchMedia("(max-width: 1199px)").matches
                        ) {
                          restoreSidebar.current = true;
                          setProgress((previous) => ({ ...previous, navigation: "collapsed" }));
                        } else if (!open && restoreSidebar.current) {
                          restoreSidebar.current = false;
                          setProgress((previous) => ({
                            ...previous,
                            navigation: "expanded",
                          }));
                        }
                        setPanel(open ? "resources" : null);
                        setQuery("");
                        setCopied("");
                        setExpandedResource("");
                      }}
                    >
                      <SheetTrigger
                        render={
                          <Button
                            variant="outline"
                            className="on-resource-button ml-auto gap-2 border-border bg-card hover:bg-card data-open:bg-card text-[13px] max-md:w-8 max-md:shrink-0 max-md:p-0 max-md:[&>span:last-child]:hidden min-[832px]:max-[1200px]:group-data-[panel=resources]/on:px-2 min-[832px]:max-[1200px]:group-data-[panel=resources]/on:[&>span:last-child]:hidden"
                            aria-label="Artifacts"
                          />
                        }
                      >
                        <span
                          className="on-resource-feedback relative inline-grid size-4 shrink-0 items-center justify-items-center [&>span]:inline-flex [&>span]:items-center [&>span]:[grid-area:1/1]"
                          aria-hidden="true"
                        >
                          <span className="on-resource-ripple pointer-events-none absolute -inset-1 rounded border border-success-ink" />
                          <AnimatePresence initial={false} mode="sync">
                            <motion.span
                              key={resourceAdded === null ? "folder" : "added"}
                              initial={{
                                opacity: keyboardMotion ? 1 : 0,
                                transform: reducedMotion ? "scale(1)" : "scale(0.95)",
                              }}
                              animate={{ opacity: 1, transform: "scale(1)" }}
                              exit={{ opacity: 0 }}
                              transition={{
                                duration: keyboardMotion ? 0 : motionDuration.feedback,
                                ease: motionEase.out,
                              }}
                            >
                              {resourceAdded === null ? (
                                <IconFolder size={16} />
                              ) : (
                                <IconCheck
                                  size={16}
                                  className="on-resource-added text-success-ink"
                                />
                              )}
                            </motion.span>
                          </AnimatePresence>
                        </span>
                        <span>Artifacts</span>
                      </SheetTrigger>
                      <SheetContent
                        className="on-sheet data-[side=right]:w-[480px] max-w-screen data-[side=right]:sm:max-w-screen gap-0 bg-card text-foreground tabular-nums [font-feature-settings:'tnum'] [&_*]:box-border [&_a]:cursor-pointer [&_button]:cursor-pointer [&_button]:rounded-md [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-brand [&_:focus-visible]:outline-offset-3 [&_[data-slot=sheet-header]]:min-h-24 [&_[data-slot=sheet-header]]:gap-0 [&_[data-slot=sheet-header]]:px-8 [&_[data-slot=sheet-header]]:pt-6 [&_[data-slot=sheet-header]]:pb-4 [&_[data-slot=sheet-title]]:text-[22px] [&_[data-slot=sheet-title]]:leading-8 [&_[data-slot=sheet-title]]:font-semibold [&_[data-slot=sheet-title]]:tracking-[-0.5px] [&_[data-slot=sheet-description]]:text-[13px] [&_[data-slot=sheet-description]]:leading-6 [&_[data-slot=sheet-description]]:text-muted-foreground [&_[data-slot=sheet-close]]:top-6 [&_[data-slot=sheet-close]]:right-6 [&_[data-slot=input-group-addon]]:text-muted-foreground min-[832px]:max-[1200px]:data-[side=right]:w-80 max-md:[&_[data-slot=sheet-header]]:px-6"
                        finalFocus={() => {
                          if (focusSourceTask.current) {
                            return getTaskHeading();
                          }
                          return document.querySelector<HTMLButtonElement>(".on-resource-button");
                        }}
                      >
                        <SheetHeader>
                          <SheetTitle>Artifacts</SheetTitle>
                          <SheetDescription>Created during this setup</SheetDescription>
                        </SheetHeader>
                        <div className="on-search relative mx-8 mt-0 mb-4 [&>svg]:absolute [&>svg]:top-2 [&>svg]:left-3 [&>svg]:text-muted-foreground [&_input]:h-8 [&_input]:rounded-md [&_input]:border-border [&_input]:pl-9 [&_input]:text-[13px] [&_input]:shadow-none max-md:mx-6">
                          <IconSearch size={16} />
                          <Input
                            ref={resourceSearch}
                            role="searchbox"
                            aria-label="Find an artifact"
                            aria-describedby="on-resource-search-help"
                            onKeyDown={(event) => {
                              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                              const targets =
                                resourceList.current?.querySelectorAll<HTMLElement>(
                                  "[data-resource-primary]",
                                );
                              if (targets?.length) {
                                event.preventDefault();
                                targets[event.key === "ArrowDown" ? 0 : targets.length - 1].focus();
                              }
                            }}
                            placeholder="Find a group, account, ticket or system"
                            value={query}
                            onChange={(event) => {
                              setQuery(event.target.value);
                              setActiveResource("");
                            }}
                          />
                        </div>
                        <p id="on-resource-search-help" className="sr-only">
                          Use the up and down arrows to move through results. Press Enter to view
                          details. Use Tab to reach copy and open actions.
                        </p>
                        <p
                          className="on-resource-count mx-8 mt-0 mb-2 text-xs leading-6 text-muted-foreground"
                          role="status"
                          aria-live="polite"
                        >
                          {filtered.length} {filtered.length === 1 ? "artifact" : "artifacts"}
                          {query ? " found" : ""}
                        </p>
                        <div
                          className="on-resource-list flex-1 overflow-y-auto px-8 [&_section]:mb-4 [&_h3]:flex [&_h3]:h-8 [&_h3]:items-center [&_h3]:text-sm [&_h3]:font-semibold max-md:px-6"
                          ref={resourceList}
                          onKeyDown={(event) => {
                            if (
                              event.target instanceof HTMLInputElement ||
                              !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
                            )
                              return;
                            const targets = [
                              ...(resourceList.current?.querySelectorAll<HTMLElement>(
                                "[data-resource-primary]",
                              ) ?? []),
                            ];
                            const row =
                              event.target instanceof Element
                                ? event.target.closest(".on-resource-row")
                                : null;
                            const index = targets.findIndex((target) => row?.contains(target));
                            if (index < 0) return;
                            event.preventDefault();
                            const next =
                              event.key === "Home"
                                ? 0
                                : event.key === "End"
                                  ? targets.length - 1
                                  : Math.max(
                                      0,
                                      Math.min(
                                        targets.length - 1,
                                        index + (event.key === "ArrowDown" ? 1 : -1),
                                      ),
                                    );
                            targets[next]?.focus();
                          }}
                        >
                          {groups.map((group) => (
                            <section key={group}>
                              <h3>{group}</h3>
                              {filtered
                                .filter((item) => item.group === group)
                                .map((item) => (
                                  <ResourceRow
                                    key={item.id}
                                    {...item}
                                    copied={copied}
                                    active={activeResource === item.name}
                                    expanded={expandedResource === item.name}
                                    onExpandedChange={(open) =>
                                      setExpandedResource(open ? item.name : "")
                                    }
                                    details={{
                                      phase: sections[tasks[item.index].phaseIndex].name,
                                      task:
                                        ecsArtifactStage(item.id)?.title ?? tasks[item.index].title,
                                      applicationCode: progress.values[0] ?? "",
                                    }}
                                    onViewTask={() => {
                                      focusSourceTask.current = true;
                                      selectTask(item.index);
                                      const sourceStage = ecsArtifactStage(item.id);
                                      if (sourceStage)
                                        setEcsValue("scaffold:stage", sourceStage.id);
                                    }}
                                    onFocus={() => setActiveResource(item.name)}
                                    onCopy={async (copyValue, label) => {
                                      try {
                                        await navigator.clipboard.writeText(copyValue);
                                        setCopied(`${item.name}: ${label}`);
                                        if (copyTimer.current) clearTimeout(copyTimer.current);
                                        copyTimer.current = setTimeout(() => setCopied(""), 1600);
                                      } catch {
                                        setCopied(
                                          "Copy unavailable. Select and copy the value above.",
                                        );
                                      }
                                    }}
                                  />
                                ))}
                            </section>
                          ))}
                          {!filtered.length && (
                            <div className="on-empty pt-8 text-muted-foreground [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:h-auto [&_h3]:text-foreground [&_p]:text-sm [&_p]:leading-6">
                              <IconFolder size={24} />
                              <h3>
                                {resources.length
                                  ? "No matching artifacts"
                                  : "Your artifacts will appear here"}
                              </h3>
                              <p>
                                {resources.length
                                  ? "Try a different name or identifier."
                                  : "Groups, accounts, tickets and system details are collected as you complete setup."}
                              </p>
                              {query && (
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setQuery("");
                                    setActiveResource("");
                                    resourceSearch.current?.focus();
                                  }}
                                >
                                  Clear search
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        <p
                          className="on-sheet-note min-h-8 px-8 py-2 text-xs leading-6 text-muted-foreground"
                          role="status"
                        >
                          {copied
                            ? copied.startsWith("Copy unavailable")
                              ? copied
                              : `${copied} copied.`
                            : "Created during completed tasks."}
                        </p>
                      </SheetContent>
                    </Sheet>
                  )}
                </motion.div>
                <motion.div
                  layout="position"
                  layoutDependency={`${progress.navigation}-${panel}`}
                  transition={{
                    layout: {
                      duration: reducedMotion ? 0 : motionDuration.sheet,
                      ease: motionEase.drawer,
                    },
                  }}
                  className="on-task-content relative mt-16 mr-0 mb-8 ml-[round(down,max(32px,calc((100%_-_896px)/2)),32px)] min-h-96 w-[min(896px,round(down,calc(100%_-_64px),32px))] bg-card p-8 shadow-[inset_0_0_0_1px_var(--border)] [&_h1]:mt-6 [&_h1]:mb-0 [&_h1]:text-[32px] [&_h1]:leading-[48px] [&_h1]:font-[650] [&_h1]:tracking-[-1px] [&_h1]:wrap-anywhere [&_h1:focus:not(:focus-visible)]:outline-none [&_.on-task-body_h1]:mt-2 [&_.on-task-body_h1]:leading-10 [&_form]:mt-6 [&_form:has(>.on-dependencies)]:mt-2 [&_.on-source-content]:mb-6 [&_.on-actions]:mt-auto [&_.on-actions]:justify-end [&_.on-actions]:pt-8 max-md:ml-8 max-md:w-[round(down,calc(100%_-_48px),32px)] max-md:p-4 max-md:[&_h1]:text-[26px] max-md:[&_h1]:leading-8 max-md:[&_h1]:tracking-[-0.6px] min-[832px]:max-[1200px]:group-data-[panel=resources]/on:p-4 min-[832px]:max-[1200px]:group-data-[panel=resources]/on:[&_h1]:text-2xl min-[832px]:max-[1200px]:group-data-[panel=resources]/on:[&_h1]:leading-8"
                  data-grid="task"
                  ref={frame}
                >
                  <motion.div
                    className="on-content-transition relative grid items-start overflow-clip [overflow-clip-margin:12px]"
                    animate={{ height: contentSize.height ?? "auto" }}
                    transition={{
                      duration: reducedMotion ? 0 : contentSize.duration,
                      ease: motionEase.out,
                    }}
                  >
                    <AnimatePresence initial={false} mode="wait">
                      <TaskPanel
                        key={task.sourceId}
                        className="on-task-body relative flex min-h-80 min-w-0 flex-col [grid-area:1/1] [&>form]:flex [&>form]:flex-1 [&>form]:flex-col [&_h1]:mt-2 [&_h1]:leading-10"
                        data-task-id={task.sourceId}

                        variants={{
                          enter: { opacity: 0, filter: reducedMotion ? "blur(0px)" : "blur(5px)" },
                          active: { opacity: 1, filter: "blur(0px)" },
                          exit: {
                            opacity: 0,
                            filter: reducedMotion ? "blur(0px)" : "blur(5px)",
                            transition: {
                              duration: keyboardMotion ? 0 : motionDuration.feedback,
                              ease: motionEase.out,
                            },
                          },
                        }}
                        initial="enter"
                        animate="active"
                        exit="exit"
                        transition={{
                          duration: keyboardMotion
                            ? 0
                            : reducedMotion
                              ? motionDuration.feedback
                              : motionDuration.layout,
                          ease: motionEase.out,
                        }}
                      >
                        <div className="on-context flex h-6 min-h-6 items-center justify-between gap-4 pb-0 text-xs leading-6 font-normal text-muted-foreground max-md:flex-row max-md:justify-center max-md:gap-2 max-md:[&>span]:max-w-[calc(100%_-_48px)]">
                          <span>
                            {finished
                              ? "Setup complete"
                              : isScaffold
                                ? "Onboarding / ECS service"
                                : `${phase.name} · Task ${progress.active - phaseStart(phaseIndex) + 1} of ${phase.tasks.length}`}
                          </span>
                          {progress.navigation === "hidden" && (
                            <Button
                              variant="ghost"
                              className="on-view-tasks pr-0 text-[13px] text-brand"
                              onClick={() => {
                                setProgress((previous) => ({
                                  ...previous,
                                  navigation: "expanded",
                                }));
                              }}
                            >
                              View all tasks
                            </Button>
                          )}
                        </div>
                        <h1 tabIndex={-1}>
                          {finished
                            ? "Onboarding checklist complete"
                            : isScaffold
                              ? ecsStages.find((stage) => stage.id === ecsStage(progress.values))
                                  ?.title
                              : task.title}
                        </h1>
                        {!isEcs && (finished || task.description) && (
                          <p className="on-description m-0 min-h-8 py-1 leading-6 text-muted-foreground max-md:text-sm">
                            {finished
                              ? "Your recorded steps and artifacts are saved. Confirm deployment outcomes in Harness and AWS."
                              : task.description}
                          </p>
                        )}
                        {isSummary && (
                          <div className="on-summary-overview mt-6 flex flex-wrap items-center gap-x-8 gap-y-6 border-y border-border py-6 [&>div]:grid [&>div]:gap-1 [&_strong]:text-2xl [&_strong]:leading-8 [&_strong]:tabular-nums [&_span]:text-xs [&_span]:text-muted-foreground [&_button]:ml-auto">
                            <div>
                              <strong>
                                {
                                  progress.completed.filter(
                                    (index) => tasks[index].presentation !== "summary",
                                  ).length
                                }{" "}
                                / {tasks.length - 1}
                              </strong>
                              <span>Setup tasks completed</span>
                            </div>
                            <div>
                              <strong>{resources.length}</strong>
                              <span>Collected artifacts</span>
                            </div>
                            <Button variant="outline" onClick={() => setPanel("resources")}>
                              View artifacts <IconFolder size={16} />
                            </Button>
                          </div>
                        )}
                        {finished ? (
                          <div className="on-completion mt-8 flex flex-wrap items-center gap-4 [&>.on-source-content]:basis-full">
                            <motion.div
                              className="on-completion-feedback inline-flex origin-left items-center gap-3 text-success-ink"
                              role="status"
                              initial={{
                                opacity: keyboardMotion ? 1 : 0,
                                transform: reducedMotion ? "scale(1)" : "scale(0.97)",
                              }}
                              animate={{ opacity: 1, transform: "scale(1)" }}
                              transition={{
                                duration: keyboardMotion ? 0 : motionDuration.disclosure,
                                ease: motionEase.out,
                              }}
                            >
                              <IconCheck size={24} />
                              <span>All {tasks.length} tasks completed</span>
                            </motion.div>
                            <SourceContent
                              blocks={task.blocks}
                              applicationCode={progress.values[0] ?? ""}
                            />
                          </div>
                        ) : (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              complete();
                            }}
                          >
                            {!isSummary && !isScaffold && dependencies.length > 0 && (
                              <div
                                className="on-dependencies mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-6 text-muted-foreground [&_button]:h-6 [&_button]:gap-2 [&_button]:px-2 [&_button]:py-0 [&_button]:text-xs [&_button]:font-normal [&_button]:text-foreground [&_button_span]:text-muted-foreground"
                                aria-label="Required inputs"
                              >
                                <span>Required inputs</span>
                                {dependencies.map((dependency) => (
                                  <Button
                                    key={dependency.field}
                                    type="button"
                                    variant="ghost"
                                    onClick={() => selectTask(dependency.index)}
                                  >
                                    {dependency.confirmed ? (
                                      <IconCheck size={14} />
                                    ) : (
                                      <IconCircle size={14} />
                                    )}
                                    {inputLabel(dependency.field)}
                                    <span>
                                      {dependency.confirmed ? "Confirmed" : "Not confirmed"}
                                    </span>
                                  </Button>
                                ))}
                              </div>
                            )}
                            {task.field ? (
                              <motion.div
                                className="on-field-reveal mb-6"
                                initial={
                                  task.field === "aws_account_id" && !reducedMotion
                                    ? { opacity: 0 }
                                    : false
                                }
                                animate={{ opacity: 1 }}
                                transition={{ duration: reducedMotion ? 0 : 0.2 }}
                              >
                                <Field
                                  className="on-field gap-2 data-[field=app\_code]:w-80 data-[field=app\_code]:max-w-full [&_label]:flex [&_label]:h-8 [&_label]:items-center [&_label]:text-[13px] [&_label]:font-medium [&_[data-slot=field-label]]:h-6 [&_[data-slot=field-label]]:text-foreground [&_input]:h-8 [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-border [&_input]:bg-card [&_input]:px-3 [&_input]:py-0 [&_input]:text-sm [&_input]:text-foreground [&_input]:shadow-none [&_select]:h-8 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-border [&_select]:bg-card [&_select]:px-3 [&_select]:text-sm [&_input[aria-invalid=true]]:border-critical-ink [&_input[aria-invalid=true]]:shadow-none [&_input[aria-invalid=true]:focus-visible]:border-2 [&_input[aria-invalid=true]:focus-visible]:px-[11px] [&_input[aria-invalid=true]:focus-visible]:outline-none [&_[data-slot=field-error]]:text-[13px] [&_[data-slot=field-error]]:leading-6 [&_[data-slot=field-error]]:text-critical-ink"
                                  data-field={task.field}
                                  data-invalid={!!error}
                                >
                                  <FieldLabel htmlFor="on-value">
                                    {inputLabel(task.field)}
                                  </FieldLabel>
                                  <Input
                                    ref={input}
                                    id="on-value"
                                    aria-invalid={!!error}
                                    aria-describedby={error ? "on-error" : undefined}
                                    value={value}
                                    placeholder={task.placeholder}
                                    onChange={(event) => {
                                      setProgress((previous) => ({
                                        ...previous,
                                        values: {
                                          ...previous.values,
                                          [previous.active]: event.target.value,
                                        },
                                      }));
                                      setError("");
                                    }}
                                  />
                                  <FieldError id="on-error">{error}</FieldError>
                                </Field>
                              </motion.div>
                            ) : null}
                            {isScaffold && (
                              <EcsScaffold
                                onRepositorySetup={() =>
                                  selectTask(
                                    tasks.findIndex(
                                      (task) =>
                                        !task.journeyRef &&
                                        task.artifacts.some(
                                          (artifact) => artifact.id === "infra-repository",
                                        ),
                                    ),
                                  )
                                }
                                values={{
                                  ...progress.values,
                                  app_code: progress.values[0] ?? "",
                                  aws_account_id:
                                    progress.values[
                                      String(
                                        tasks.findIndex((item) => item.field === "aws_account_id"),
                                      )
                                    ] ?? "",
                                }}
                                onValueChange={setEcsValue}
                                onFinish={() =>
                                  setProgress((previous) => ({
                                    ...markComplete(previous),
                                    values: {
                                      ...previous.values,
                                      "journey:ecs-service:open": "false",
                                    },
                                  }))
                                }
                              />
                            )}
                            {!isEcs && (
                              <SourceContent
                                blocks={task.blocks}
                                applicationCode={progress.values[0] ?? ""}
                              />
                            )}
                            {!isScaffold &&
                              task.action &&
                              !hasContentLink(task.blocks, task.action) && (
                                <a
                                  className="on-source-link mt-4 inline-flex items-center gap-2 text-[13px] text-brand hover:underline"
                                  href={task.action}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {task.actionLabel} <ArrowNudge size={14} />
                                </a>
                              )}
                            {outputForms.length > 0 && !isEcs && (
                              <div className="on-task-outputs my-8 grid gap-8 [&_fieldset]:m-0 [&_fieldset]:min-w-0 [&_fieldset]:border-0 [&_fieldset]:p-0 [&_legend]:mb-4 [&_legend]:text-sm [&_legend]:leading-6 [&_legend]:font-semibold [&_legend]:text-foreground">
                                {outputForms.map((artifact) => (
                                  <fieldset key={artifact.id}>
                                    <legend>{artifact.name}</legend>
                                    <div className="on-task-output-fields grid grid-cols-2 gap-x-8 gap-y-4 [&_label_span]:ml-2 [&_label_span]:text-xs [&_label_span]:font-normal [&_label_span]:text-muted-foreground [&_input]:w-full">
                                      {artifact.fields.map((field) => (
                                        <Field key={field.key}>
                                          <FieldLabel htmlFor={field.storageKey}>
                                            {field.label}
                                            {field.key !== artifact.primary && (
                                              <span>Optional</span>
                                            )}
                                          </FieldLabel>
                                          <Input
                                            id={field.storageKey}
                                            aria-label={`${artifact.name}: ${field.label}`}
                                            required={field.key === artifact.primary}
                                            pattern={
                                              field.key === artifact.link
                                                ? "https?://.+"
                                                : ".*\\S.*"
                                            }
                                            type={field.key === artifact.link ? "url" : "text"}
                                            value={field.value}
                                            disabled={completing}
                                            onChange={(event) => {
                                              const nextValue = event.target.value;
                                              setProgress((previous) => ({
                                                ...previous,
                                                values: {
                                                  ...previous.values,
                                                  [field.storageKey]: nextValue,
                                                },
                                              }));
                                            }}
                                          />
                                        </Field>
                                      ))}
                                    </div>
                                  </fieldset>
                                ))}
                              </div>
                            )}
                            {!isEcs &&
                              task.guidance.map((action) => (
                                <TaskGuidance
                                  key={action.id}
                                  action={action}
                                  tasks={tasks}
                                  progress={progress}
                                  onSelectTask={selectTask}
                                  onValueChange={(key, value) =>
                                    setProgress((previous) => ({
                                      ...previous,
                                      values: { ...previous.values, [key]: value },
                                    }))
                                  }
                                />
                              ))}
                            {!isEcs && (
                              <div className="on-actions mt-6 flex flex-wrap items-center gap-4">
                                <Button
                                  className="on-primary relative grid h-8 min-w-40 w-48 gap-3 bg-brand px-4 text-[13px] text-brand-foreground data-[started=true]:min-w-64 data-[started=true]:w-64 [&_.on-button-feedback]:[grid-area:1/1] enabled:hover:bg-[color-mix(in_oklch,var(--brand)_88%,var(--foreground))] enabled:focus-visible:bg-[color-mix(in_oklch,var(--brand)_88%,var(--foreground))] enabled:hover:shadow-none enabled:focus-visible:shadow-none data-[completing=true]:border-success data-[completing=true]:bg-success data-[completing=true]:text-success-foreground data-[completing=true]:shadow-none max-md:px-3 max-md:text-xs max-md:[&>svg]:hidden"
                                  type="submit"
                                  disabled={completing}
                                  data-completing={completing}
                                  data-started={started}
                                >
                                  <AnimatePresence initial={false} mode="sync">
                                    <motion.span
                                      className="on-button-feedback inline-flex shrink-0 items-center justify-center gap-3"
                                      key={completing ? "done" : "next"}
                                      initial={
                                        reducedMotion
                                          ? { opacity: 0 }
                                          : { opacity: 0, filter: "blur(2px)" }
                                      }
                                      animate={{ opacity: 1, filter: "blur(0px)" }}
                                      exit={{
                                        opacity: 0,
                                        filter: reducedMotion ? "blur(0px)" : "blur(2px)",
                                      }}
                                      transition={{
                                        duration: keyboardMotion
                                          ? 0
                                          : reducedMotion
                                            ? motionDuration.feedback
                                            : 0.32,
                                        ease: motionEase.out,
                                      }}
                                    >
                                      {completing
                                        ? "Marked complete"
                                        : progress.active === tasks.length - 1
                                          ? "Complete setup"
                                          : started
                                            ? "Mark complete and continue"
                                            : "Continue"}
                                      {completing ? (
                                        <svg
                                          width="16"
                                          height="16"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          aria-hidden="true"
                                        >
                                          <motion.path
                                            d="m5 12 4 4 10-10"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            initial={{ pathLength: reducedMotion ? 1 : 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{
                                              duration: reducedMotion ? 0 : 0.3,
                                              delay: reducedMotion ? 0 : 0.12,
                                            }}
                                          />
                                        </svg>
                                      ) : (
                                        <ArrowNudge size={16} />
                                      )}
                                    </motion.span>
                                  </AnimatePresence>
                                </Button>
                              </div>
                            )}
                            {!saved && (
                              <p
                                className="on-save mt-2 bg-transparent text-xs leading-6 text-muted-foreground"
                                role="status"
                              >
                                Progress could not be saved on this device.
                              </p>
                            )}
                          </form>
                        )}
                      </TaskPanel>
                    </AnimatePresence>
                  </motion.div>
                </motion.div>
                <footer className="on-footer mt-auto flex min-h-16 items-center justify-between gap-4 bg-background px-8 py-4 text-xs text-muted-foreground shadow-[inset_0_1px_var(--border)] [&_button]:text-xs max-md:flex-wrap max-md:p-4">
                  <span>Interactive prototype · No live requests</span>
                  {started && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        resourceArrival.current?.cancel();
                        if (completionTimer.current) clearTimeout(completionTimer.current);
                        setCompleting(false);
                        toast.dismiss(completionToastId);
                        setResourceAdded(null);
                        if (resourceFeedbackTimer.current)
                          clearTimeout(resourceFeedbackTimer.current);
                        setProgress(initialProgress);
                        setQuery("");
                        setCopied("");
                        setExpandedResource("");
                        setExpanded(0);
                        setPanel(null);
                        setError("");
                      }}
                    >
                      Start a new demo
                    </Button>
                  )}
                </footer>
              </motion.main>
            </div>
          </TooltipProvider>
        </LayoutGroup>
      </KeyboardMotionContext>
    </MotionConfig>
  );
}
