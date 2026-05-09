import { createFileRoute } from "@tanstack/react-router";

import { AskAtlasDeferredBody } from "@/components/ask-atlas-deferred-content";
import { Badge } from "@/components/ui/badge";
import { PageBody, PageHeader } from "@/components/page-section";

export const Route = createFileRoute("/ask")({
  component: AskAtlasRoute,
});

function AskAtlasRoute() {
  return (
    <PageBody>
      <PageHeader
        eyebrow="Ask Atlas"
        title="Cited platform answers"
        description="Ask Atlas is one consumer of the Atlas Context API. The full cited-answer flow is deferred until evidence surfaces are stable."
        actions={<Badge variant="outline">Deferred until P5</Badge>}
      />

      <AskAtlasDeferredBody />
    </PageBody>
  );
}
