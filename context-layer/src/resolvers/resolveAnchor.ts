import type { Anchor } from "@atlas/schema";
import type { ResolveRequest, ResolveResult } from "./resolverTypes";

type ResolveAnchorOptions = ResolveRequest & {
  isValidLocator(locator: string): boolean;
};

export async function resolveAnchor({
  source,
  anchors,
  anchorId,
  contentProvider,
  isValidLocator,
}: ResolveAnchorOptions): Promise<ResolveResult> {
  const anchor = selectAnchor(anchors, anchorId);
  const locator = anchor ? selectorLocator(anchor) : undefined;

  if (!anchor || !locator || !isValidLocator(locator)) {
    return {
      excerpts: [],
      warnings: [
        {
          code: "broken_anchor",
          message: "Requested anchor is not registered or has an invalid locator.",
          source_id: source.id,
          anchor_id: anchorId,
        },
      ],
    };
  }

  const sourceContent = await contentProvider.getSourceContent(source.id);
  if (!sourceContent) {
    return {
      excerpts: [],
      warnings: [
        {
          code: "source_unavailable",
          message: "Source content is unavailable at request time.",
          source_id: source.id,
          anchor_id: anchor.id,
        },
      ],
    };
  }

  const text = sourceContent[locator];
  if (!text) {
    return {
      excerpts: [],
      warnings: [
        {
          code: "broken_anchor",
          message: "Registered anchor could not be resolved in the source.",
          source_id: source.id,
          anchor_id: anchor.id,
        },
      ],
    };
  }

  return {
    excerpts: [
      {
        anchor_id: anchor.id,
        text,
        citation: {
          source_id: source.id,
          anchor_id: anchor.id,
          label: anchor.citation_label,
          location: `${source.location}${locator}`,
        },
      },
    ],
    warnings: [],
  };
}

function selectorLocator(anchor: Anchor): string | undefined {
  const locator = anchor.selector.locator;
  return typeof locator === "string" ? locator : undefined;
}

function selectAnchor(anchors: Anchor[], anchorId: string | undefined): Anchor | undefined {
  if (anchorId) {
    return anchors.find((anchor) => anchor.id === anchorId);
  }
  return anchors[0];
}
