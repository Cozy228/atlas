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
        <Accordion className="on-help">
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
        <Alert role="note" className="on-source-callout" data-tone={block.tone}>
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
    <div className="on-source-content">
      {blocks.map((block, index) => (
        <ContentBlock key={index} block={block} applicationCode={applicationCode} />
      ))}
    </div>
  );
}
