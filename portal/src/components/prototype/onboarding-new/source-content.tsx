import { IconInfoCircle, IconAlertTriangle } from "@tabler/icons-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./uipros/accordion";
import { formatSourceText } from "./source-text";
import { ImagePreview } from "./uipros/image-preview";
import { Alert, AlertTitle, AlertDescription } from "./uipros/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "./uipros/table";

type Span = { text: string; link?: { url?: string; address?: string } };
type Block = {
  kind: string;
  text?: string;
  spans?: Span[];
  ordered?: boolean;
  items?: { spans: Span[] }[];
  tone?: string;
  blocks?: Block[];
  caption?: string;
  rows?: { cells: { spans: Span[]; header?: boolean }[] }[];
  filename?: string;
  alt?: string;
};
export function hasContentLink(blocks: Block[], url: string): boolean {
  return blocks.some(
    (block) =>
      block.spans?.some((span) => span.link?.url === url) ||
      block.items?.some((item) => item.spans.some((span) => span.link?.url === url)) ||
      block.rows?.some((row) =>
        row.cells.some((cell) => cell.spans.some((span) => span.link?.url === url)),
      ) ||
      (block.blocks && hasContentLink(block.blocks, url)),
  );
}
function Spans({ spans = [], applicationCode }: { spans?: Span[]; applicationCode: string }) {
  return (
    <>
      {spans.map((span, index) => {
        const href =
          span.link?.url ?? (span.link?.address ? `mailto:${span.link.address}` : undefined);
        return href ? (
          <a
            key={index}
            href={href}
            target={span.link?.url ? "_blank" : undefined}
            rel="noreferrer"
          >
            {formatSourceText(span.text, applicationCode)}
          </a>
        ) : (
          <span key={index}>{formatSourceText(span.text, applicationCode)}</span>
        );
      })}
    </>
  );
}
function ContentBlock({ block, applicationCode }: { block: Block; applicationCode: string }) {
  switch (block.kind) {
    case "prose":
      return (
        <p>
          <Spans applicationCode={applicationCode} spans={block.spans} />
        </p>
      );
    case "heading":
      return <h2>{formatSourceText(block.text ?? "", applicationCode)}</h2>;
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List>
          {block.items?.map((item, index) => (
            <li key={index}>
              <Spans applicationCode={applicationCode} spans={item.spans} />
            </li>
          ))}
        </List>
      );
    }
    case "table": {
      const headers = block.rows?.filter((row) => row.cells.every((cell) => cell.header)) ?? [];
      const rows = block.rows?.filter((row) => !row.cells.every((cell) => cell.header)) ?? [];
      return (
        <Accordion className="on-help mt-6 border-y border-border [&_[data-slot=accordion-trigger]]:min-h-[46px] [&_[data-slot=accordion-trigger]]:items-center [&_[data-slot=accordion-trigger]]:px-0 [&_[data-slot=accordion-trigger]]:py-2 [&_[data-slot=accordion-trigger]]:text-[13px] [&_.on-accordion-inner]:h-auto [&_.on-accordion-inner]:pb-6 [&_.on-accordion-inner]:leading-6 [&_.on-accordion-inner]:text-muted-foreground">
          <AccordionItem value="table">
            <AccordionTrigger indicator="plus">
              {block.caption ?? "Reference table"}
            </AccordionTrigger>
            <AccordionContent>
              <Table>
                {block.caption && <TableCaption className="sr-only">{block.caption}</TableCaption>}
                <TableHeader>
                  {headers.map((row, index) => (
                    <TableRow key={index}>
                      {row.cells.map((cell, column) => (
                        <TableHead key={column} scope="col">
                          <Spans applicationCode={applicationCode} spans={cell.spans} />
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={index}>
                      {row.cells.map((cell, column) =>
                        cell.header ? (
                          <TableHead key={column} scope="row">
                            <Spans applicationCode={applicationCode} spans={cell.spans} />
                          </TableHead>
                        ) : (
                          <TableCell key={column}>
                            <Spans applicationCode={applicationCode} spans={cell.spans} />
                          </TableCell>
                        ),
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      );
    }
    case "callout":
      return (
        <Alert
          role="note"
          className="on-source-callout rounded-md border-border bg-muted p-4 [&_[data-slot=alert-description]]:gap-3 [&_[data-slot=alert-description]]:leading-6 [&_[data-slot=alert-description]]:text-muted-foreground [&_[data-slot=alert-title]]:mb-2 [&_[data-slot=alert-title]]:line-clamp-none data-[tone=warning]:border-l-[3px] data-[tone=warning]:border-l-warning-ink data-[tone=caution]:border-l-[3px] data-[tone=caution]:border-l-warning-ink data-[tone=warning]:[&>svg]:text-warning-ink data-[tone=caution]:[&>svg]:text-warning-ink"
          data-tone={block.tone}
        >
          {block.tone === "warning" || block.tone === "caution" ? (
            <IconAlertTriangle />
          ) : (
            <IconInfoCircle />
          )}
          <AlertTitle>
            {block.tone === "warning" || block.tone === "caution" ? "Before you continue" : "Note"}
          </AlertTitle>
          <AlertDescription>
            <p>
              <Spans applicationCode={applicationCode} spans={block.spans} />
            </p>
            {block.blocks?.map((child, index) => (
              <ContentBlock key={index} block={child} applicationCode={applicationCode} />
            ))}
          </AlertDescription>
        </Alert>
      );
    case "image":
      return (
        <ImagePreview
          src={`/prototype/onboarding/${block.filename}`}
          alt={block.alt ?? "Onboarding illustration"}
        />
      );
    default:
      return null;
  }
}
export function SourceContent({
  blocks,
  applicationCode,
}: {
  blocks: Block[];
  applicationCode: string;
}) {
  return (
    <div className="on-source-content grid min-w-0 gap-6 text-sm empty:hidden [&_p]:m-0 [&_p]:leading-6 [&>p]:text-muted-foreground [&_h2]:text-base [&_h2]:font-semibold [&>h2]:text-lg [&>h2]:leading-6 [&>h2]:text-foreground [&_a]:text-brand [&_a]:underline [&_a]:wrap-anywhere [&_ol]:grid [&_ol]:list-decimal [&_ol]:gap-3 [&_ol]:pl-6 [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-3 [&_ul]:pl-6 [&>ol]:text-foreground [&>ul]:text-foreground [&_.on-help]:mt-0 [&_.on-help]:min-w-0 [&_.on-help_[data-slot=accordion-trigger]]:font-semibold [&_.on-help_[data-slot=accordion-trigger]]:text-foreground [&_[data-slot=table-container]]:border [&_[data-slot=table-container]]:border-border [&_th]:min-w-32 [&_th]:bg-muted [&_th]:p-3 [&_th]:leading-6 [&_th]:whitespace-normal [&_th]:wrap-anywhere [&_td]:min-w-32 [&_td]:p-3 [&_td]:leading-6 [&_td]:whitespace-normal [&_td]:wrap-anywhere">
      {blocks.map((block, index) => (
        <ContentBlock key={index} block={block} applicationCode={applicationCode} />
      ))}
    </div>
  );
}
