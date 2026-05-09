import { useId, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { IconArrowUp, IconExclamationCircle } from "@tabler/icons-react";
import { toast } from "sonner";

import { askAtlas, type AskAtlasResponse } from "@/api/server/ask";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
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
  { category: "Capability", prompt: "Which storage service for a multi-region workload?" },
  { category: "Landing zone", prompt: "Compare DC16 and US-East-1 for a payments service." },
  { category: "Onboarding", prompt: "How do I provision a sandbox EKS cluster?" },
  { category: "Guardrails", prompt: "What policies apply to data exports out of GDC?" },
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
    mutationFn: async (question: string) =>
      askAtlas({ data: { topicId, question } }),
    onError: (error) => {
      toast.error("Ask Atlas failed", {
        description:
          error instanceof Error ? error.message : "Unknown error",
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

  return (
    <div
      className={cn(
        "flex h-full min-h-[480px] flex-col gap-3",
        className,
      )}
    >
      <Conversation className="min-h-[240px] flex-1 rounded-lg border border-border bg-background">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="What can Atlas help you find?"
              description="Cited platform answers from authoritative context. Pick a starter question or ask your own."
            />
          ) : (
            messages.map((message) =>
              message.role === "user" ? (
                <Message key={message.id} from="user">
                  <MessageContent className="rounded-lg bg-primary px-3 py-2 text-primary-foreground">
                    {message.text}
                  </MessageContent>
                </Message>
              ) : (
                <Message key={message.id} from="assistant">
                  <MessageContent className="px-3 py-2">
                    {message.warnings.length > 0 && message.text === "" ? (
                      <NoAnswerNotice warnings={message.warnings} />
                    ) : (
                      <p className="whitespace-pre-wrap text-[13px] leading-[1.6]">
                        {message.text}
                      </p>
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

      {messages.length === 0 ? (
        <Suggestions>
          {suggestions.map((item) => (
            <Suggestion
              key={item.prompt}
              suggestion={item.prompt}
              onClick={(prompt) => {
                setInput(prompt);
                inputRef.current?.focus();
              }}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                {item.category}
              </span>
              <span className="ml-2 text-[12px]">{item.prompt}</span>
            </Suggestion>
          ))}
        </Suggestions>
      ) : null}

      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
        className={cn(
          "rounded-xl border border-[1.5px] border-border bg-card p-3",
          "focus-within:border-primary focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_8%,transparent)]",
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
          rows={2}
          placeholder="Ask anything about capabilities, landing zones, sources…"
          className="min-h-0 resize-none border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] text-muted-foreground">
            Atlas cites authoritative sources only · Enter sends, Shift+Enter newline
          </p>
          <Button
            type="submit"
            size="icon-sm"
            aria-label="Send question"
            disabled={input.trim().length === 0 || mutation.isPending}
          >
            <IconArrowUp className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

function NoAnswerNotice({
  warnings,
}: {
  warnings: ReadonlyArray<string>;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-2 text-[12px] text-foreground">
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
