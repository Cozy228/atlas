import { Link } from "@tanstack/react-router";
import type { Topic } from "@atlas/schema";

import { cn } from "@/lib/utils";

type RelatedColumnProps = {
  title: string;
  topics: ReadonlyArray<Topic>;
  kind: "landing-zone" | "capability";
};

export function RelatedColumn({ title, topics, kind }: RelatedColumnProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <ul className="flex flex-col gap-0.5">
        {topics.map((topic) => (
          <li key={topic.id}>
            <Link
              to={kind === "landing-zone" ? "/landing-zones/$topicId" : "/capabilities/$topicId"}
              params={{ topicId: topic.id }}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors",
                "hover:bg-muted",
              )}
            >
              <span className="text-[12px] font-semibold text-foreground">{topic.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {topic.owner_team}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
