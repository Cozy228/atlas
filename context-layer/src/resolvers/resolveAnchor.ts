import type { Anchor } from "@atlas/schema";
import type { ResolveRequest, ResolveResult } from "./resolverTypes.js";

type ResolveAnchorOptions = ResolveRequest & {
  isValidLocator(locator: string): boolean;
};

export function resolveAnchor({
  source,
  anchorId,
  contentProvider,
  isValidLocator,
}: ResolveAnchorOptions): ResolveResult {
  const anchor = selectAnchor(source.available_anchors, anchorId);

  if (!anchor || !isValidLocator(anchor.locator)) {
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

  const sourceContent = contentProvider.getSourceContent(source.id);
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

  const text = sourceContent[anchor.locator];
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
          label: anchor.label,
          location: `${source.location}${anchor.locator}`,
        },
      },
    ],
    warnings: [],
  };
}

function selectAnchor(anchors: Anchor[], anchorId: string | undefined): Anchor | undefined {
  if (anchorId) {
    return anchors.find((anchor) => anchor.id === anchorId);
  }
  return anchors[0];
}
