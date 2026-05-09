import { useId, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { IconArrowUp, IconBook, IconExclamationCircle } from "@tabler/icons-react";
import { toast } from "sonner";

import { askAtlas, type AskAtlasResponse } from "@/api/server/ask";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type AskAtlasChatProps = {
  topicId?: string;
  suggestions?: ReadonlyArray<{ category: string; prompt: string }>;
  className?: string;
};

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      sources: AskAtlasResponse["sources"];
      warnings: AskAtlasResponse["warnings"];
    };

const DEFAULT_SUGGESTIONS = [
  {
    category: "Capability",
    prompt: "Which storage service for a multi-region workload?",
  },
  {
    category: "Landing zone",
    prompt: "Compare DC16 and US-East-1 for a payments service.",
  },
  {
    category: "Onboarding",
    prompt: "How do I provision a sandbox EKS cluster?",
  },
  {
    category: "Guardrails",
    prompt: "What policies apply to data exports out of GDC?",
  },
] as const;

const DEFAULT_TOPIC_ID = "capability:ask-atlas";

export function AskAtlasChat({
  topicId = DEFAULT_TOPIC_ID,
  suggestions = DEFAULT_SUGGESTIONS,
  className,
}: AskAtlasChatProps) {
  const [messages, setMessages] = useState<ReadonlyArray<ChatMessage>>([]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formId = useId();

  const mutation = useMutation({
    mutationFn: async (question: string) => askAtlas({ data: { topicId, question } }),
    onError: (error) => {
      toast.error("Ask Atlas failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  function send(question: string) {
    const trimmed = question.trim();
    if (trimmed.length === 0 || mutation.isPending) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");

    mutation
      .mutateAsync(trimmed)
      .then((response) => {
        const assistantMessage: ChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: response.answer,
          sources: response.sources,
          warnings: response.warnings,
        };
        setMessages((current) => [...current, assistantMessage]);
      })
      .catch(() => {
        // toast handled in onError
      });
  }

  const hasMessages = messages.length > 0;

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {hasMessages ? (
            messages.map((message) =>
              message.role === "user" ? (
                <Message key={message.id} from="user">
                  <MessageContent>{message.text}</MessageContent>
                </Message>
              ) : (
                <Message key={message.id} from="assistant">
                  <MessageContent>
                    {message.warnings.length > 0 && message.text === "" ? (
                      <NoAnswerNotice warnings={message.warnings} />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
                    )}
                    {message.sources.length > 0 ? (
                      <Sources className="mt-3">
                        <SourcesTrigger count={message.sources.length} />
                        <SourcesContent>
                          {message.sources.map((source) => (
                            <Source
                              key={source.source_id}
                              href={source.url ?? "#"}
                              title={source.title}
                            />
                          ))}
                        </SourcesContent>
                      </Sources>
                    ) : null}
                  </MessageContent>
                </Message>
              ),
            )
          ) : (
            <EmptyGreeting
              suggestions={suggestions}
              onSelect={(prompt) => {
                setInput(prompt);
                inputRef.current?.focus();
              }}
            />
          )}
          {mutation.isPending ? (
            <Message from="assistant">
              <MessageContent className="px-3 py-2">
                <Shimmer>Atlas is consulting registered sources…</Shimmer>
              </MessageContent>
            </Message>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 px-5 py-3">
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            send(input);
          }}
          className={cn(
            "flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5",
            "shadow-xs transition-[border-color,box-shadow]",
            "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
          )}
        >
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="How do I get started?"
            className="!min-h-0 flex-1 resize-none border-none bg-transparent p-0 text-base leading-6 !shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <Button
            type="submit"
            size="icon-sm"
            aria-label="Send question"
            disabled={input.trim().length === 0 || mutation.isPending}
            className="shrink-0 rounded-lg"
          >
            <IconArrowUp className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function EmptyGreeting({
  suggestions,
  onSelect,
}: {
  suggestions: ReadonlyArray<{ category: string; prompt: string }>;
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5 px-5 py-6">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
          <IconBook className="size-4 text-muted-foreground" />
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-foreground">Hi!</p>
          <p className="text-[13px] leading-relaxed text-foreground">
            I'm an AI assistant trained on platform documentation, runbooks,
            and source registry data. Ask me anything about{" "}
            <span className="rounded bg-muted px-1.5 py-0.5 font-semibold">Atlas Platform</span>.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 pl-11">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Example questions
        </span>
        {suggestions.map((item) => (
          <button
            key={item.prompt}
            type="button"
            onClick={() => onSelect(item.prompt)}
            className={cn(
              "rounded-lg border border-border px-3 py-2 text-left text-[13px] text-foreground transition-colors",
              "hover:border-border-strong hover:bg-accent",
            )}
          >
            {item.prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function NoAnswerNotice({ warnings }: { warnings: ReadonlyArray<string> }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
      <IconExclamationCircle aria-hidden className="mt-0.5 size-4 text-warning" />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">Atlas could not answer.</p>
        <ul className="list-inside list-disc text-muted-foreground">
          {warnings.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
