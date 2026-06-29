import { Link } from "@tanstack/react-router";
import type { Topic } from "@atlas/schema";

import { serviceRouteParamsForTopic } from "@/lib/availability-service";
import { cn } from "@/lib/utils";

type RelatedColumnProps = {
  title: string;
  topics: ReadonlyArray<Topic>;
};

const ROW_CLASS = cn(
  "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors",
  "hover:bg-muted",
);

export function RelatedColumn({ title, topics }: RelatedColumnProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="mb-2 font-mono type-caption font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <ul className="flex flex-col gap-0.5">
        {topics.map((topic) => (
          <li key={topic.id}>
            <RelatedRow topic={topic} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Each related topic links to its own surface by type: a security policy →
 *  `/policies`, a service → its canonical resource address (plan 020 15d). */
function RelatedRow({ topic }: { topic: Topic }) {
  const body = (
    <>
      <span className="text-xs font-semibold text-foreground">{topic.name}</span>
      <span className="font-mono type-caption text-muted-foreground">{topic.owner_team}</span>
    </>
  );
  if (topic.topic_type === "security-policy") {
    return (
      <Link to="/policies/$policyId" params={{ policyId: topic.id }} className={ROW_CLASS}>
        {body}
      </Link>
    );
  }
  return (
    <Link
      to="/service/$provider/$id"
      params={serviceRouteParamsForTopic(topic)}
      className={ROW_CLASS}
    >
      {body}
    </Link>
  );
}
