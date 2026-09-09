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
import "./scaffold-preview.css";

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
    <div className="on-scaffold-preview">
      {!filesOnly && (
        <header className="on-scaffold-preview-context" aria-label="Preview outcome">
          <div className="on-scaffold-preview-service">
            <span className="on-scaffold-preview-summary-label">Service</span>
            <strong>{config.serviceName}</strong>
            <span className="on-scaffold-preview-deployment">Deployment · {deployment}</span>
            <small>Account {config.account || "not confirmed"}</small>
          </div>
          <div className="on-scaffold-preview-targets">
            <span className="on-scaffold-preview-summary-label">
              {scope ? "Target repository" : "Target repositories"}
            </span>
            <div className="on-scaffold-preview-repositories">
              {scope !== "app" && (
                <span>
                  <IconGitBranch size={14} aria-hidden="true" />
                  <strong>{config.infraRepo}</strong>
                  <small>Infrastructure</small>
                </span>
              )}
              {scope !== "infra" && (
                <span>
                  <IconGitBranch size={14} aria-hidden="true" />
                  <strong>{config.appRepo}</strong>
                  <small>Application</small>
                </span>
              )}
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
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
            className="on-scaffold-stages on-scaffold-preview-tabs"
            aria-label="Change preview"
          >
            {[
              { value: "architecture", label: "Architecture" },
              { value: "files", label: "File changes" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="on-scaffold-stage-button"
                data-active={view === tab.value}
              >
                {tab.label}
                {view === tab.value && (
                  <motion.span
                    className="on-scaffold-stage-indicator"
                    layoutId={indicatorId}
                    transition={{ duration: reduced ? 0 : 0.32 }}
                  />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        <AnimatePresence initial={false} mode="wait">
          <AnimatedTabsPanel key={view} value={view} className="on-scaffold-preview-panel">
            {view === "architecture" ? (
              <ScaffoldArchitecture
                config={config}
                onOpenFile={openFile}
                canOpenFile={(path) => files.some((file) => file.path === path)}
                executionPhase={executionPhase ?? (scope === "app" ? "task-definition" : undefined)}
              />
            ) : selected ? (
              <div className="on-scaffold-file-browser">
                <nav className="on-scaffold-file-tree" aria-label="Generated files">
                  <Accordion defaultValue={repositories}>
                    {repositories.map((repository) => (
                      <AccordionItem key={repository} value={repository}>
                        <AccordionTrigger>
                          <IconGitBranch size={15} />
                          <span>{repository}</span>
                        </AccordionTrigger>
                        <AccordionContent>
                          {files
                            .filter((file) => file.repository === repository)
                            .map((file) => (
                              <button
                                type="button"
                                key={file.id}
                                aria-current={selected.id === file.id ? "true" : undefined}
                                onClick={() => {
                                  setFileId(file.id);
                                  setCopyState("idle");
                                }}
                              >
                                <IconPlus size={14} />
                                <span>{file.path}</span>
                              </button>
                            ))}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </nav>
                <section className="on-scaffold-file-detail" aria-label="File content">
                  <header>
                    <strong>{selected.path}</strong>
                    <span className="on-scaffold-file-added">New</span>
                    <span className="on-scaffold-line-count">
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
                      className="on-scaffold-code-scroll"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: reduced ? 0 : 0.16 }}
                      tabIndex={0}
                      aria-label={`${selected.path} source code`}
                    >
                      <pre>
                        <code>
                          {selected.content
                            .trimEnd()
                            .split("\n")
                            .map((line, index) => (
                              <span className="on-scaffold-code-line" key={index}>
                                <span aria-hidden="true" className="on-scaffold-line-number">
                                  {index + 1}
                                </span>
                                <span aria-hidden="true" className="on-scaffold-line-plus">
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
                  <p className="on-scaffold-file-description">{selected.description}</p>
                  <span className="on-scaffold-copy-status" role="status">
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
        <section className="on-scaffold-pr-summary" aria-label="Pull request summary">
          <header>
            <IconGitBranch size={18} aria-hidden="true" />
            <div>
              <strong>{scope === "infra" ? config.infraRepo : config.appRepo}</strong>
              <small>
                {scope === "infra" ? "Infrastructure" : "Application"} · {files.length} new files
              </small>
            </div>
            {prUrl && (
              <a href={prUrl} target="_blank" rel="noreferrer" className="on-scaffold-pr-link">
                Open PR <IconExternalLink size={14} />
              </a>
            )}
            <span className="on-scaffold-status" data-pr-state={prStatus}>
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
          <dl>
            <div>
              <dt>PR title</dt>
              <dd>
                {scope === "infra" ? "Create infrastructure for" : "Deploy"} {config.serviceName}
              </dd>
            </div>
            <div>
              <dt>Branches</dt>
              <dd>
                <code>
                  scaffold/{config.serviceName}-{scope}
                </code>{" "}
                → <code>main</code>
              </dd>
            </div>
            <div>
              <dt>Changes</dt>
              <dd>
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
