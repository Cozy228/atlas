import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  IconCheck,
  IconCopy,
  IconGitBranch,
  IconPlus,
  IconExternalLink,
} from "@tabler/icons-react";
import { ScaffoldArchitecture } from "./scaffold-architecture";
import { buildScaffoldFiles } from "./scaffold-files";
import { useOnboardingMotion } from "./motion";
import { Button } from "./uipros/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./uipros/accordion";
import { Tabs, TabsList, TabsTrigger, AnimatedTabsPanel } from "./uipros/tabs";
import { cn } from "@/lib/utils";

import type { ExecutionPhase, prState } from "./ecs-run";

type PreviewConfig = Parameters<typeof buildScaffoldFiles>[0];

export function ScaffoldPreview({
  config,
  onEdit,
  initialView = "architecture",
  initialFilePath,
  scope,
  prStatus,
  prUrl,
  executionPhase,
  filesOnly = false,
}: {
  config: PreviewConfig;
  onEdit: () => void;
  initialView?: "architecture" | "files";
  initialFilePath?: string;
  scope?: "infra" | "app";
  prStatus?: ReturnType<typeof prState>;
  prUrl?: string;
  executionPhase?: ExecutionPhase;
  filesOnly?: boolean;
}) {
  const [view, setView] = useState<string>(initialView);
  const [fileId, setFileId] = useState(
    () => buildScaffoldFiles(config).find((file) => file.path === initialFilePath)?.id ?? "",
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const indicatorId = useId();
  const { reduced } = useOnboardingMotion();
  const files = buildScaffoldFiles(config).filter((file) => !scope || file.scope === scope);
  const selected = files.find((file) => file.id === fileId) ?? files[0];
  const repositories = [...new Set(files.map((file) => file.repository))];
  const exposure = config.exposure
    ? `${config.exposure[0].toUpperCase()}${config.exposure.slice(1)}`
    : "not confirmed";
  const deployment = [config.environment, config.region, exposure].filter(Boolean).join(" · ");
  function openFile(path: string) {
    const file = files.find((item) => item.path === path);
    if (file) setFileId(file.id);
    setCopyState("idle");
    setView("files");
  }
  return (
    <div className="on-scaffold-preview min-w-0">
      {!filesOnly && (
        <header
          className="on-scaffold-preview-context grid min-h-20 grid-cols-[minmax(224px,0.9fr)_minmax(320px,1.1fr)_auto] items-start gap-x-8 gap-y-4 border-b border-border py-4"
          aria-label="Preview outcome"
        >
          <div className="on-scaffold-preview-service grid min-w-0 content-center gap-1">
            <span className="on-scaffold-preview-summary-label text-[11px] font-semibold uppercase leading-4 tracking-[0.04em] text-muted-foreground">
              Service
            </span>
            <strong className="break-words text-[15px] leading-6 font-[550] text-foreground">
              {config.serviceName}
            </strong>
            <span className="on-scaffold-preview-deployment text-xs leading-5 text-muted-foreground">
              Deployment · {deployment}
            </span>
            <small className="text-xs leading-5 text-muted-foreground">
              Account {config.account || "not confirmed"}
            </small>
          </div>
          <div className="on-scaffold-preview-targets grid min-w-0 content-center gap-1">
            <span className="on-scaffold-preview-summary-label text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              {scope ? "Target repository" : "Target repositories"}
            </span>
            <div className="on-scaffold-preview-repositories flex min-w-0 flex-wrap gap-x-6 gap-y-2">
              {scope !== "app" && (
                <span className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1.5">
                  <IconGitBranch
                    size={14}
                    className="row-span-2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <strong className="min-w-0 break-words text-[13px] leading-5 font-[550] text-foreground">
                    {config.infraRepo}
                  </strong>
                  <small className="min-w-0 break-words text-[11px] leading-4 text-muted-foreground">
                    Infrastructure
                  </small>
                </span>
              )}
              {scope !== "infra" && (
                <span className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1.5">
                  <IconGitBranch
                    size={14}
                    className="row-span-2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <strong className="min-w-0 break-words text-[13px] leading-5 font-[550] text-foreground">
                    {config.appRepo}
                  </strong>
                  <small className="min-w-0 break-words text-[11px] leading-4 text-muted-foreground">
                    Application
                  </small>
                </span>
              )}
            </div>
          </div>
          <Button
            className="justify-self-end"
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
          >
            Edit configuration
          </Button>
        </header>
      )}
      <Tabs
        value={view}
        onValueChange={(value) => {
          if (typeof value === "string") setView(value);
        }}
      >
        {!filesOnly && (
          <TabsList
            activateOnFocus
            className="on-scaffold-stages on-scaffold-preview-tabs mb-4 flex items-center gap-4 border-b border-border"
            aria-label="Change preview"
          >
            {[
              { value: "architecture", label: "Architecture" },
              { value: "files", label: "File changes" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="on-scaffold-stage-button relative flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-1.5 text-inherit focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-default"
                data-active={view === tab.value}
              >
                {tab.label}
                {view === tab.value && (
                  <motion.span
                    className="on-scaffold-stage-indicator absolute inset-x-0 bottom-[-1px] h-0.5 bg-brand"
                    layoutId={indicatorId}
                    transition={{ duration: reduced ? 0 : 0.32 }}
                  />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        <AnimatePresence initial={false} mode="wait">
          <AnimatedTabsPanel key={view} value={view} className="on-scaffold-preview-panel min-w-0">
            {view === "architecture" ? (
              <ScaffoldArchitecture
                config={config}
                onOpenFile={openFile}
                canOpenFile={(path) => files.some((file) => file.path === path)}
                executionPhase={executionPhase ?? (scope === "app" ? "task-definition" : undefined)}
              />
            ) : selected ? (
              <div className="on-scaffold-file-browser grid min-h-[448px] min-w-0 grid-cols-[minmax(224px,27%)_minmax(0,1fr)] border border-border bg-card">
                <nav
                  className="on-scaffold-file-tree min-w-0 border-r border-border p-2"
                  aria-label="Generated files"
                >
                  <Accordion defaultValue={repositories}>
                    {repositories.map((repository) => (
                      <AccordionItem key={repository} value={repository}>
                        <AccordionTrigger className="gap-2 px-2 py-3 text-[13px]">
                          <IconGitBranch size={15} />
                          <span className="min-w-0 break-words">{repository}</span>
                        </AccordionTrigger>
                        <AccordionContent>
                          {files
                            .filter((file) => file.repository === repository)
                            .map((file) => (
                              <button
                                type="button"
                                key={file.id}
                                className={cn(
                                  "flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent p-2 text-left text-xs leading-5 text-muted-foreground hover:bg-muted",
                                  selected.id === file.id && "bg-brand-tint text-brand",
                                )}
                                aria-current={selected.id === file.id ? "true" : undefined}
                                onClick={() => {
                                  setFileId(file.id);
                                  setCopyState("idle");
                                }}
                              >
                                <IconPlus size={14} className="shrink-0 text-success-ink" />
                                <span className="min-w-0 break-words">{file.path}</span>
                              </button>
                            ))}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </nav>
                <section className="on-scaffold-file-detail min-w-0" aria-label="File content">
                  <header className="flex min-h-12 min-w-0 items-center gap-3 border-b border-border px-4 py-2 text-[13px]">
                    <strong className="break-words">{selected.path}</strong>
                    <span className="on-scaffold-file-added bg-success/10 px-1.5 py-0.5 text-[11px] text-success-ink">
                      New
                    </span>
                    <span className="on-scaffold-line-count ml-auto shrink-0 tabular-nums text-success-ink">
                      +{selected.content.trimEnd().split("\n").length}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={
                        copyState === "copied" ? "Copied file content" : "Copy file content"
                      }
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(selected.content);
                          setCopyState("copied");
                        } catch {
                          setCopyState("failed");
                        }
                      }}
                    >
                      <AnimatePresence initial={false} mode="wait">
                        <motion.span
                          key={copyState}
                          initial={{
                            opacity: 0,
                            scale: reduced ? 1 : 0.25,
                            filter: reduced ? "blur(0px)" : "blur(4px)",
                          }}
                          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                          exit={{ opacity: 0 }}
                          transition={{ type: "spring", duration: reduced ? 0 : 0.3, bounce: 0 }}
                        >
                          {copyState === "copied" ? (
                            <IconCheck size={16} />
                          ) : (
                            <IconCopy size={16} />
                          )}
                        </motion.span>
                      </AnimatePresence>
                    </Button>
                  </header>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={selected.id}
                      className="on-scaffold-code-scroll h-[352px] overflow-auto overscroll-contain py-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: reduced ? 0 : 0.16 }}
                      tabIndex={0}
                      aria-label={`${selected.path} source code`}
                    >
                      <pre className="m-0 w-max min-w-full font-mono text-xs leading-6 tab-2">
                        <code>
                          {selected.content
                            .trimEnd()
                            .split("\n")
                            .map((line, index) => (
                              <span
                                className="on-scaffold-code-line flex bg-success/[0.08] pr-6 text-foreground"
                                key={index}
                              >
                                <span
                                  aria-hidden="true"
                                  className="on-scaffold-line-number w-10 shrink-0 select-none bg-muted pr-3 text-right tabular-nums text-muted-foreground"
                                >
                                  {index + 1}
                                </span>
                                <span
                                  aria-hidden="true"
                                  className="on-scaffold-line-plus select-none px-3 text-success-ink"
                                >
                                  +
                                </span>
                                <span>{line || " "}</span>
                                {"\n"}
                              </span>
                            ))}
                        </code>
                      </pre>
                    </motion.div>
                  </AnimatePresence>
                  <p className="on-scaffold-file-description m-0 border-t border-border px-4 py-3 text-xs leading-5 text-muted-foreground">
                    {selected.description}
                  </p>
                  <span
                    className="on-scaffold-copy-status block px-4 text-xs leading-6 text-muted-foreground"
                    role="status"
                  >
                    {copyState === "failed"
                      ? "Could not copy. Select the code to copy manually."
                      : ""}
                  </span>
                </section>
              </div>
            ) : null}
          </AnimatedTabsPanel>
        </AnimatePresence>
      </Tabs>
      {scope && !filesOnly && (
        <section
          className="on-scaffold-pr-summary border border-border border-t-0 px-6 py-4"
          aria-label="Pull request summary"
        >
          <header className="flex min-w-0 items-center gap-3">
            <IconGitBranch size={18} aria-hidden="true" />
            <div>
              <strong className="block break-words text-[14px] leading-6 font-[550]">
                {scope === "infra" ? config.infraRepo : config.appRepo}
              </strong>
              <small className="block break-words text-xs leading-6 text-muted-foreground">
                {scope === "infra" ? "Infrastructure" : "Application"} · {files.length} new files
              </small>
            </div>
            {prUrl && (
              <a
                href={prUrl}
                target="_blank"
                rel="noreferrer"
                className="on-scaffold-pr-link ml-auto inline-flex items-center gap-1.5 text-[13px] text-brand"
              >
                Open PR <IconExternalLink size={14} />
              </a>
            )}
            <span
              className={cn(
                "on-scaffold-status ml-auto shrink-0 whitespace-nowrap rounded-md border border-border px-1.5 py-[3px] text-[11px] leading-4 text-muted-foreground",
                prUrl && "ml-0",
                prStatus === "open" && "text-[var(--color-pr-open)]",
                prStatus === "merged" && "text-[var(--color-pr-merged)]",
                prStatus === "closed" && "text-critical",
              )}
              data-pr-state={prStatus}
            >
              {prStatus
                ? {
                    open: "Awaiting merge",
                    merged: "Merged",
                    closed: "Closed",
                    unknown: "Status unavailable",
                  }[prStatus]
                : "1 PR · Not created"}
            </span>
          </header>
          <dl className="my-4 grid gap-2">
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4">
              <dt className="text-xs leading-6 text-muted-foreground">PR title</dt>
              <dd className="m-0 break-words text-[13px] leading-6">
                {scope === "infra" ? "Create infrastructure for" : "Deploy"} {config.serviceName}
              </dd>
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4">
              <dt className="text-xs leading-6 text-muted-foreground">Branches</dt>
              <dd className="m-0 break-words text-[13px] leading-6">
                <code>
                  scaffold/{config.serviceName}-{scope}
                </code>{" "}
                → <code>main</code>
              </dd>
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4">
              <dt className="text-xs leading-6 text-muted-foreground">Changes</dt>
              <dd className="m-0 break-words text-[13px] leading-6">
                {scope === "infra"
                  ? "Provision the cluster, load balancer, container registry, IAM roles, logs and DNS. Add the infrastructure pipeline."
                  : "Connect the task definition and service to the provisioned infrastructure. Add image build and deployment pipelines."}
              </dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}
