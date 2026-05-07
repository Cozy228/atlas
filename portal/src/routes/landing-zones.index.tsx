import { Link, createFileRoute } from "@tanstack/react-router";
import { IconArrowRight } from "@tabler/icons-react";
import type { Topic } from "@atlas/schema";

import { fetchTopicDiscovery } from "@/api/server/contextApi";
import { Badge } from "@/components/ui/badge";
import { PageBody, PageHeader, PageSection } from "@/components/page-section";
import { cn } from "@/lib/utils";

type LoaderData = {
  topics: ReadonlyArray<Topic>;
};

export const Route = createFileRoute("/landing-zones/")({
  loader: async (): Promise<LoaderData> => {
    const response = await fetchTopicDiscovery({
      data: { topic_type: "landing-zone" },
    });
    return { topics: response.topics };
  },
  component: LandingZonesListRoute,
});

function LandingZonesListRoute() {
  const { topics } = Route.useLoaderData();
  const zones = [...topics].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageBody>
      <PageHeader
        eyebrow="Discovery"
        title="Landing zones"
        description="Compare environments, guardrails, and provisioning entry tools side-by-side. The matrix below uses the registered topics; expanded guardrail evidence lives on each detail page."
        actions={<Badge variant="brand">topic_type = landing-zone</Badge>}
      />
      <PageSection title="Comparison matrix">
        {zones.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Landing zone
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Owner
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Provisioning entry
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2" aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {zones.map((topic) => (
                  <tr
                    key={topic.id}
                    className="border-t border-border align-top"
                  >
                    <th scope="row" className="px-4 py-3">
                      <Link
                        to="/landing-zones/$topicId"
                        params={{ topicId: topic.id }}
                        className="flex flex-col gap-1 text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="font-semibold text-foreground">
                          {topic.name}
                        </span>
                        <span className="text-xs leading-5 text-muted-foreground">
                          {topic.description}
                        </span>
                      </Link>
                    </th>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-foreground">
                          {topic.owner_team}
                        </span>
                        <span className="font-mono text-[11px]">
                          {topic.support_channel}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {topic.entry_tools.length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5">
                          {topic.entry_tools.map((tool) => (
                            <li key={tool.url}>
                              <a
                                href={tool.url}
                                className="rounded-md border border-border bg-card px-2 py-0.5 text-foreground hover:bg-secondary"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {tool.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <Badge
                        variant={
                          topic.status === "deprecated"
                            ? "critical"
                            : topic.status === "planned"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {topic.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/landing-zones/$topicId"
                        params={{ topicId: topic.id }}
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium text-primary",
                          "hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        )}
                      >
                        Detail
                        <IconArrowRight className="size-3.5" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>
    </PageBody>
  );
}

function EmptyState() {
  return (
    <div className="rounded-md border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">No registered landing zones.</p>
      <p className="mt-1 leading-6">
        The Context API returned an empty discovery response. Add a landing zone
        to the registry or report the gap from a source detail page.
      </p>
    </div>
  );
}
