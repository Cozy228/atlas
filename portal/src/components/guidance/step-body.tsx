/**
 * Step body renderer — draws a station's structured content blocks (an authored
 * source page's prose, sub-headings, nested lists, typed links, and image refs)
 * as stepper-native content. This is NOT a Confluence document mirror: it renders
 * the small closed block model from @atlas/schema, with typed inline links.
 *
 * A `confluence-page` link has no resolvable URL, so it is drawn as a plain
 * (non-navigable) reference marker — honest about what Atlas can and cannot link.
 */
import { IconPhoto } from "@tabler/icons-react";
import type { GuidanceBlock, GuidanceListItem, GuidanceSpan } from "@atlas/schema";

import { cn } from "@/lib/utils";

export function StepBody({ blocks }: { blocks: ReadonlyArray<GuidanceBlock> }) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: GuidanceBlock }) {
  switch (block.kind) {
    case "heading":
      return (
        <h3 className="type-detail mt-1.5 font-semibold text-foreground first:mt-0">
          {block.text}
        </h3>
      );
    case "prose":
      return (
        <p className="type-detail max-w-[64ch] text-muted-foreground">
          <Spans spans={block.spans} />
        </p>
      );
    case "list":
      return <ListView ordered={block.ordered} items={block.items} />;
    case "image":
      return (
        <figure className="flex w-fit items-center gap-2 rounded-[4px] border border-dashed border-border bg-muted/30 px-3 py-2.5 text-muted-foreground">
          <IconPhoto aria-hidden className="size-4 shrink-0" />
          <figcaption className="type-caption">
            Screenshot — <span className="font-mono">{block.alt ?? block.filename}</span>
          </figcaption>
        </figure>
      );
  }
}

function ListView({
  ordered,
  items,
}: {
  ordered: boolean;
  items: ReadonlyArray<GuidanceListItem>;
}) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag
      className={cn(
        "type-detail ml-1 flex flex-col gap-1.5 pl-4 text-muted-foreground marker:text-muted-foreground/60",
        ordered ? "list-decimal" : "list-disc",
      )}
    >
      {items.map((item, index) => (
        <li key={index} className="pl-1">
          <Spans spans={item.spans} />
          {item.blocks && item.blocks.length > 0 ? (
            <div className="mt-1.5 flex flex-col gap-1.5">
              {item.blocks.map((nested, nestedIndex) => (
                <BlockView key={nestedIndex} block={nested} />
              ))}
            </div>
          ) : null}
        </li>
      ))}
    </Tag>
  );
}

function Spans({ spans }: { spans: ReadonlyArray<GuidanceSpan> }) {
  return (
    <>
      {spans.map((span, index) => (
        <SpanView key={index} span={span} />
      ))}
    </>
  );
}

const INLINE_LINK =
  "font-medium text-brand-ink underline decoration-brand-ink/30 underline-offset-2 hover:decoration-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function SpanView({ span }: { span: GuidanceSpan }) {
  const link = span.link;
  if (!link) return <>{span.text}</>;

  if (link.kind === "external") {
    return (
      <a href={link.url} target="_blank" rel="noreferrer noopener" className={INLINE_LINK}>
        {span.text}
      </a>
    );
  }
  if (link.kind === "email") {
    return (
      <a href={`mailto:${link.address}`} className={INLINE_LINK}>
        {span.text}
      </a>
    );
  }
  // confluence-page: a reference by title, not a navigable link (no URL). The
  // dotted underline + tooltip signal "referenced page" without faking a link.
  return (
    <span
      className="text-foreground/80 underline decoration-dotted decoration-muted-foreground/50 underline-offset-2"
      title={`Confluence page: ${link.title}${link.space ? ` · ${link.space}` : ""}`}
    >
      {span.text}
    </span>
  );
}
