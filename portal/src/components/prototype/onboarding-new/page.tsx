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
      <nav aria-label="Onboarding tasks" className="on-toc-list">
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
                <AccordionTrigger className="on-phase-button">
                  <span>{item.name}</span>
                  <small>
                    {count}/{item.tasks.length}
                  </small>
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="on-task-list">
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
                                className="on-task-selection"
                                layoutId="active-task"
                                transition={{
                                  duration: reducedMotion ? 0 : 0.18,
                                  ease: motionEase.out,
                                }}
                              />
                            )}
                            <span className="on-task-indicator" aria-hidden="true">
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
                                    <span className="on-task-dot" />
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
              className="onboarding-new"
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
              <a href="#on-task" className="on-skip">
                Skip to current task
              </a>
              <header className="on-header">
                <a href="/prototype" className="on-brand">
                  Atlas
                </a>
                <span className="on-header-divider" />
                <span className="on-app-name">
                  {progress.values[0] || "Application onboarding"}
                </span>

                <div className="on-header-actions">
                  <ThemeToggle />
                  <a className="on-exit" href="/prototype">
                    Exit setup
                  </a>
                </div>
              </header>

              <ResourceArrival ref={resourceArrival} />
              <div className="on-journey-celebration">
                <Confetti ref={celebration} />
              </div>
              <AnimatePresence initial={false}>
                {progress.navigation !== "hidden" && (
                  <motion.aside
                    className="on-sidebar"
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
                    <div className="on-sidebar-heading">
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
                      className="on-rail"
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
                      className="on-sidebar-body"
                      inert={progress.navigation === "collapsed"}
                      aria-hidden={progress.navigation === "collapsed"}
                    >
                      <p className="on-toc-caption">
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
                      <p className="on-sidebar-bottom">
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
                className="on-main"
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
                  className="on-workspace-actions"
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
                            className="on-resource-button"
                            aria-label="Artifacts"
                          />
                        }
                      >
                        <span className="on-resource-feedback" aria-hidden="true">
                          <span className="on-resource-ripple" />
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
                                <IconCheck size={16} className="on-resource-added" />
                              )}
                            </motion.span>
                          </AnimatePresence>
                        </span>
                        <span>Artifacts</span>
                      </SheetTrigger>
                      <SheetContent
                        className="on-sheet"
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
                        <div className="on-search">
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
                        <p className="on-resource-count" role="status" aria-live="polite">
                          {filtered.length} {filtered.length === 1 ? "artifact" : "artifacts"}
                          {query ? " found" : ""}
                        </p>
                        <div
                          className="on-resource-list"
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
                            <div className="on-empty">
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
                        <p className="on-sheet-note" role="status">
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
                  className="on-task-content"
                  data-grid="task"
                  ref={frame}
                >
                  <motion.div
                    className="on-content-transition"
                    animate={{ height: contentSize.height ?? "auto" }}
                    transition={{
                      duration: reducedMotion ? 0 : contentSize.duration,
                      ease: motionEase.out,
                    }}
                  >
                    <AnimatePresence initial={false} mode="wait">
                      <TaskPanel
                        key={task.sourceId}
                        className="on-task-body"
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
                        <div className="on-context">
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
                              className="on-view-tasks"
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
                          <p className="on-description">
                            {finished
                              ? "Your recorded steps and artifacts are saved. Confirm deployment outcomes in Harness and AWS."
                              : task.description}
                          </p>
                        )}
                        {isSummary && (
                          <div className="on-summary-overview">
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
                          <div className="on-completion">
                            <motion.div
                              className="on-completion-feedback"
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
                              <div className="on-dependencies" aria-label="Required inputs">
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
                                className="on-field-reveal"
                                initial={
                                  task.field === "aws_account_id" && !reducedMotion
                                    ? { opacity: 0 }
                                    : false
                                }
                                animate={{ opacity: 1 }}
                                transition={{ duration: reducedMotion ? 0 : 0.2 }}
                              >
                                <Field
                                  className="on-field"
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
                                  className="on-source-link"
                                  href={task.action}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {task.actionLabel} <ArrowNudge size={14} />
                                </a>
                              )}
                            {outputForms.length > 0 && !isEcs && (
                              <div className="on-task-outputs">
                                {outputForms.map((artifact) => (
                                  <fieldset key={artifact.id}>
                                    <legend>{artifact.name}</legend>
                                    <div className="on-task-output-fields">
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
                              <div className="on-actions">
                                <Button
                                  className="on-primary"
                                  type="submit"
                                  disabled={completing}
                                  data-completing={completing}
                                  data-started={started}
                                >
                                  <AnimatePresence initial={false} mode="sync">
                                    <motion.span
                                      className="on-button-feedback"
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
                              <p className="on-save" role="status">
                                Progress could not be saved on this device.
                              </p>
                            )}
                          </form>
                        )}
                      </TaskPanel>
                    </AnimatePresence>
                  </motion.div>
                </motion.div>
                <footer className="on-footer">
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
