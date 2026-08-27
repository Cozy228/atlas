#!/usr/bin/env node

/**
 * Static Atlas blueprint audit.
 *
 * This contract is intentionally tied to atlas-design-system-enriched.html.
 * It audits desktop geometry only. React implementation rules belong to a
 * separate gate because component ownership and runtime states differ.
 */

import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  distanceToLattice,
  evaluateObservations,
  makeObservation,
  measureBorderInset,
  measureEqualPartition,
} from "./grid-audit-core.mjs";

const require = createRequire(import.meta.url);
const DEFAULT_HTML_PATH = path.resolve("docs/design/atlas-design-system-enriched.html");
const HTML_PATH = path.resolve(process.argv[2] ?? DEFAULT_HTML_PATH);
const EPSILON = 0.05;
const G = 32;
const Q = 8;

const VIEWPORTS = [
  { name: "FHD", width: 1920, height: 1080 },
  { name: "Laptop", width: 1440, height: 900 },
  { name: "QHD", width: 2560, height: 1440 },
  { name: "Compact desktop", width: 1280, height: 800 },
];

const RULE_IDS = [
  "contract.cardinality",
  "document.no-horizontal-overflow",
  "foundation.tokens",
  "foundation.fonts",
  "foundation.grid-background",
  "shell.geometry",
  "structure.master-grid",
  "structure.column-tracks",
  "structure.section-rows",
  "structure.border-compensation",
  "component.controls",
  "component.equal-partitions",
  "component.table",
  "component.decorative-geometry",
  "component.vector-geometry",
  "aesthetic.peer-overlap",
  "typography.rhythm",
  "coverage.visible-elements",
];

const CARDINALITY = new Map([
  [".app-root", 1],
  [".sidebar", 1],
  [".main-wrapper", 1],
  [".top-header", 1],
  [".centered-canvas", 1],
  [".section-block", 8],
  [".section-header-locked", 7],
  [".tech-card", 25],
  [".grid-4col-locked", 2],
  [".grid-3col-locked", 2],
  [".ramp-color-bar", 2],
  [".ramp-swatch-step", 20],
  [".table-container", 1],
  [".blueprint-table", 1],
  [".type-spec-row", 5],
  [".component-test-row", 9],
  [".form-grid-3col", 2],
  [".switch-grid-3col", 2],
  [".input-control", 6],
  [".switch-field", 6],
  [".btn", 12],
  [".code-panel-locked", 1],
]);

const STRUCTURE_FAMILY = [
  ".app-root",
  ".sidebar",
  ".sidebar-header",
  ".sidebar-header-icon-box",
  ".brand-title-wrap",
  ".nav-scroll",
  ".nav-group-title",
  ".nav-item",
  ".nav-icon-box",
  ".nav-spacer-row",
  ".sidebar-footer",
  ".main-wrapper",
  ".top-header",
  ".header-breadcrumb",
  ".header-actions",
  ".centered-canvas",
  ".section-block",
  ".section-header-locked",
  ".section-eyebrow-row",
  ".section-title-row",
  ".section-desc-row",
  ".section-buffer-row",
  ".grid-4col-locked",
  ".grid-3col-locked",
  ".tech-card",
  ".hero-top-row",
  ".hero-body-content",
  ".hero-badge-pill",
  ".hero-meta-grid",
  ".hero-meta-cell",
  ".brand-mark",
  ".brand-title",
  ".axiom-card-tag",
  ".axiom-card-title",
  ".axiom-card-metrics",
  ".ramp-strip-row",
  ".ramp-title-col",
  ".ramp-color-bar",
  ".ramp-swatch-step",
  ".color-preview-box",
  ".color-details",
  ".color-role-header",
  ".color-specs-line",
  ".metric-top-row",
  ".metric-number",
  ".metric-subtext",
  ".type-spec-row",
  ".type-role-title",
  ".type-role-metrics",
  ".type-sample-render",
  ".type-usage-desc",
  ".table-container",
  ".blueprint-table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  ".note-aside",
  ".component-test-row",
  ".form-grid-3col",
  ".form-field-group",
  ".input-addon-group",
  ".switch-grid-3col",
  ".switch-field",
  ".switch-label-group",
  ".code-panel-locked",
  ".toast-pill",
  ".hero-top-row > div:not([class])",
  ".note-aside > div:not([class])",
  ".type-spec-row > div:not([class])",
].join(",");

const TYPOGRAPHY_FAMILY = "span,h1,p,strong,code,pre,button,label,input";
const VECTOR_FAMILY = "svg,svg *";
const COVERAGE_SELECTOR = `${STRUCTURE_FAMILY},${TYPOGRAPHY_FAMILY},${VECTOR_FAMILY}`;

const SELECTORS = [
  ...new Set([
    ...CARDINALITY.keys(),
    ...STRUCTURE_FAMILY.split(","),
    ...TYPOGRAPHY_FAMILY.split(","),
    ...VECTOR_FAMILY.split(","),
    COVERAGE_SELECTOR,
    "body",
    "html",
    ".hero-panel",
    ".hero-title",
    ".hero-desc",
    ".hero-badge-pill",
    ".hero-meta-label",
    ".hero-meta-val",
    ".axiom-card",
    ".axiom-card-tag",
    ".axiom-card-title",
    ".axiom-card-metrics",
    ".metric-card-box",
    ".metric-card-lg",
    ".metric-card-lg .metric-top-row",
    ".metric-card-lg .metric-number",
    ".metric-card-lg .metric-subtext",
    ".metric-top-row",
    ".color-swatch-card",
    ".type-table-card",
    ".button-suite-card",
    ".chips-suite-card",
    ".form-inputs-card",
    ".form-switches-card",
    ".btn-sm",
    ".btn-lg",
    ".btn-tool",
    ".dim-badge",
    ".chip",
    ".chip-split",
    ".switch-track",
    ".has-corner-ticks",
    ".main-grid-canvas",
  ]),
];

function formatNumber(value) {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : value;
}

function describeObservation(observation) {
  if (observation.message) return observation.message;
  const tolerance = observation.tolerance === null ? "" : ` ±${observation.tolerance}`;
  return `${observation.subject}: actual ${formatNumber(observation.actual)}, expected ${formatNumber(observation.expected)}${tolerance}`;
}

function buildAuditor(snapshot) {
  const observations = [];
  const bySelector = new Map(SELECTORS.map((selector) => [selector, []]));
  const byIndex = new Map(snapshot.elements.map((element) => [element.index, element]));
  for (const element of snapshot.elements) {
    for (const selector of element.matches) bySelector.get(selector)?.push(element);
  }

  const select = (selector) => bySelector.get(selector) ?? [];
  const first = (selector) => select(selector)[0];
  const children = (owner, selector) =>
    select(selector).filter((element) => element.parentIndex === owner.index);
  const closest = (element, selector) => {
    let cursor = byIndex.get(element.parentIndex);
    while (cursor) {
      if (cursor.matches.includes(selector)) return cursor;
      cursor = byIndex.get(cursor.parentIndex);
    }
    return undefined;
  };
  const observe = (ruleId, subject, actual, expected, tolerance = EPSILON, note) => {
    observations.push(makeObservation({ ruleId, subject, actual, expected, tolerance, note }));
  };
  const observeBoolean = (ruleId, subject, actual, note) => {
    observe(ruleId, subject, actual, true, EPSILON, note);
  };
  const observeLattice = (ruleId, subject, value, step = G, phases = [0]) => {
    observe(
      ruleId,
      subject,
      Number.isFinite(value) ? distanceToLattice(value, step, phases) : Number.NaN,
      0,
    );
  };
  const observeRectLattice = (
    ruleId,
    element,
    fields = ["left", "top", "right", "bottom", "width", "height"],
  ) => {
    for (const field of fields)
      observeLattice(ruleId, `${element.path}.${field}`, element.rect[field]);
  };
  const union = (elements) => ({
    left: Math.min(...elements.map((element) => element.rect.left)),
    top: Math.min(...elements.map((element) => element.rect.top)),
    right: Math.max(...elements.map((element) => element.rect.right)),
    bottom: Math.max(...elements.map((element) => element.rect.bottom)),
  });
  const groupRows = (elements) => {
    const rows = [];
    for (const element of [...elements].sort(
      (left, right) => left.rect.top - right.rect.top || left.rect.left - right.rect.left,
    )) {
      const row = rows.find(
        (candidate) => Math.abs(candidate[0].rect.top - element.rect.top) <= EPSILON,
      );
      if (row) row.push(element);
      else rows.push([element]);
    }
    return rows.map((row) => row.sort((left, right) => left.rect.left - right.rect.left));
  };

  for (const [selector, expected] of CARDINALITY) {
    observe("contract.cardinality", `${selector} count`, select(selector).length, expected, 0);
  }
  observe(
    "document.no-horizontal-overflow",
    "document overflow width",
    Math.max(0, snapshot.document.scrollWidth - snapshot.document.clientWidth),
    0,
  );

  const tokenExpectations = new Map([
    ["--G-unit", 32],
    ["--G-half", 16],
    ["--G-quarter", 8],
    ["--G-micro", 4],
    ["--w-sidebar", 224],
    ["--w-canvas", 1120],
    ["--h-header", 64],
  ]);
  for (const [token, expected] of tokenExpectations) {
    observe("foundation.tokens", token, Number.parseFloat(snapshot.rootTokens[token]), expected);
  }

  observeBoolean("foundation.fonts", "Inter webfont loaded", snapshot.fonts.inter);
  observeBoolean("foundation.fonts", "IBM Plex Mono webfont loaded", snapshot.fonts.ibmPlexMono);
  observe(
    "foundation.fonts",
    "body line-height",
    Number.parseFloat(snapshot.bodyStyle.lineHeight),
    24,
  );
  observeBoolean(
    "foundation.fonts",
    "body tabular numerics",
    snapshot.bodyStyle.fontFeatureSettings.includes("tnum"),
  );

  const mainGrid = first(".main-grid-canvas");
  observeBoolean(
    "foundation.grid-background",
    "grid background size has two 32px layers",
    mainGrid?.style.backgroundSize.split(",").every((value) => value.trim() === "32px 32px") ??
      false,
  );
  observeBoolean(
    "foundation.grid-background",
    "grid background origin is (0, 0)",
    mainGrid?.style.backgroundPosition.split(",").every((value) => value.trim() === "0px 0px") ??
      false,
  );

  const sidebar = first(".sidebar");
  const main = first(".main-wrapper");
  const header = first(".top-header");
  const canvas = first(".centered-canvas");
  const shellChecks = [
    [sidebar, "sidebar.left", "left", 0],
    [sidebar, "sidebar.top", "top", 0],
    [sidebar, "sidebar.width", "width", 224],
    [sidebar, "sidebar.height", "height", snapshot.viewport.height],
    [main, "main.left", "left", 224],
    [main, "main.width", "width", snapshot.viewport.width - 224],
    [header, "header.left", "left", 224],
    [header, "header.top", "top", 0],
    [header, "header.width", "width", snapshot.viewport.width - 224],
    [header, "header.height", "height", 64],
    [canvas, "canvas.top", "top", 64],
    [canvas, "canvas.width", "width", 1120],
  ];
  for (const [element, subject, field, expected] of shellChecks) {
    observe("shell.geometry", subject, element?.rect[field] ?? Number.NaN, expected);
  }
  observeLattice("shell.geometry", "canvas.left on master grid", canvas?.rect.left ?? Number.NaN);
  observe(
    "shell.geometry",
    "canvas remains inside viewport",
    Math.max(0, (canvas?.rect.right ?? Number.POSITIVE_INFINITY) - snapshot.viewport.width),
    0,
  );
  const leftGutter = (canvas?.rect.left ?? 0) - (main?.rect.left ?? 0);
  const rightGutter = snapshot.viewport.width - (canvas?.rect.right ?? snapshot.viewport.width);
  observe(
    "shell.geometry",
    "canvas gutter imbalance beyond one grid unit",
    Math.max(0, Math.abs(leftGutter - rightGutter) - G),
    0,
  );

  const masterGridSelectors = [
    ".centered-canvas",
    ".section-block",
    ".section-header-locked",
    ".grid-4col-locked",
    ".grid-3col-locked",
    ".tech-card",
    ".table-container",
    ".note-aside",
    ".code-panel-locked",
  ];
  for (const selector of masterGridSelectors) {
    for (const element of select(selector)) observeRectLattice("structure.master-grid", element);
  }

  for (const owner of select(".grid-4col-locked")) {
    const rows = groupRows(children(owner, ".tech-card"));
    observe(
      "structure.column-tracks",
      `${owner.path} row count`,
      rows.length,
      rows.flat().some((card) => card.matches.includes(".color-swatch-card")) ? 2 : 1,
      0,
    );
    for (const [rowIndex, cards] of rows.entries()) {
      observe(
        "structure.column-tracks",
        `${owner.path} row ${rowIndex + 1} card count`,
        cards.length,
        4,
        0,
      );
      cards.forEach((card) =>
        observe("structure.column-tracks", `${card.path}.width`, card.rect.width, 256),
      );
      cards.slice(1).forEach((card, index) => {
        observe(
          "structure.column-tracks",
          `${owner.path} row ${rowIndex + 1} gap ${index + 1}`,
          card.rect.left - cards[index].rect.right,
          G,
        );
      });
      if (cards.length > 0) {
        observe(
          "structure.column-tracks",
          `${owner.path} row ${rowIndex + 1} first edge`,
          cards[0].rect.left,
          owner.rect.left,
        );
        observe(
          "structure.column-tracks",
          `${owner.path} row ${rowIndex + 1} last edge`,
          cards.at(-1).rect.right,
          owner.rect.right,
        );
      }
    }
  }
  for (const owner of select(".grid-3col-locked")) {
    const cards = children(owner, ".tech-card").sort(
      (left, right) => left.rect.left - right.rect.left,
    );
    observe("structure.column-tracks", `${owner.path} direct card count`, cards.length, 3, 0);
    for (const [index, card] of cards.entries()) {
      const compact = card.matches.includes(".metric-card-box");
      const expectedWidth = compact ? 256 : 352;
      observe("structure.column-tracks", `${card.path}.width`, card.rect.width, expectedWidth);
      observe(
        "structure.column-tracks",
        `${card.path} aligned to 352px track origin`,
        card.rect.left,
        owner.rect.left + index * (352 + G),
      );
    }
  }

  for (const owner of select(".section-header-locked")) {
    const rows = [
      ...children(owner, ".section-eyebrow-row"),
      ...children(owner, ".section-title-row"),
      ...children(owner, ".section-desc-row"),
      ...children(owner, ".section-buffer-row"),
    ].sort((a, b) => a.rect.top - b.rect.top);
    observe("structure.section-rows", `${owner.path} row count`, rows.length, 4, 0);
    rows.forEach((row) =>
      observe("structure.section-rows", `${row.path}.height`, row.rect.height, G),
    );
    rows.slice(1).forEach((row, index) => {
      observe(
        "structure.section-rows",
        `${owner.path} row seam ${index + 1}`,
        row.rect.top,
        rows[index].rect.bottom,
      );
    });
    if (rows.length > 0) {
      observe(
        "structure.section-rows",
        `${owner.path} first edge`,
        rows[0].rect.top,
        owner.rect.top,
      );
      observe(
        "structure.section-rows",
        `${owner.path} last edge`,
        rows.at(-1).rect.bottom,
        owner.rect.bottom,
      );
    }
  }
  for (const selector of [".nav-group-title", ".nav-item", ".nav-spacer-row"]) {
    for (const element of select(selector)) {
      observe("structure.section-rows", `${element.path}.height`, element.rect.height, G);
      observeLattice("structure.section-rows", `${element.path}.top`, element.rect.top);
    }
  }
  for (const selector of [".header-breadcrumb", ".header-actions", ".btn-tool"]) {
    for (const element of select(selector)) {
      observe("structure.section-rows", `${element.path}.height`, element.rect.height, G);
      observeLattice(
        "structure.section-rows",
        `${element.path}.centerY`,
        element.rect.top + element.rect.height / 2,
      );
    }
  }

  const borderedGroups = [
    [".button-suite-card", ".component-test-row", false],
    [".chips-suite-card", ".component-test-row", false],
    [".type-table-card", ".type-spec-row", false],
    [".form-inputs-card", ".form-grid-3col", false],
    [".form-switches-card", ".switch-grid-3col", true],
  ];
  for (const [ownerSelector, childSelector, sharesBottomBorder] of borderedGroups) {
    for (const owner of select(ownerSelector)) {
      const rows = children(owner, childSelector).sort((a, b) => a.rect.top - b.rect.top);
      if (rows.length === 0) {
        observe("structure.border-compensation", `${owner.path} has rows`, 0, 1, 0);
        continue;
      }
      const border = sharesBottomBorder ? { ...owner.border, bottom: 0 } : owner.border;
      const residuals = measureBorderInset(owner.rect, union(rows), border);
      for (const [side, residual] of Object.entries(residuals)) {
        observe(
          "structure.border-compensation",
          `${owner.path} ${side} content inset`,
          residual,
          0,
        );
      }
      rows.slice(1).forEach((row, index) => {
        observe(
          "structure.border-compensation",
          `${owner.path} row seam ${index + 1}`,
          row.rect.top,
          rows[index].rect.bottom,
        );
      });
    }
  }
  for (const card of select(".color-swatch-card")) {
    const parts = [...children(card, ".color-preview-box"), ...children(card, ".color-details")];
    const residuals = measureBorderInset(card.rect, union(parts), { ...card.border, bottom: 0 });
    for (const [side, residual] of Object.entries(residuals)) {
      observe("structure.border-compensation", `${card.path} ${side} content inset`, residual, 0);
    }
  }

  const controlDimensions = [
    [".input-control", "height", 32],
    [".input-addon-group", "height", 32],
    [".switch-field", "height", 64],
    [".switch-track", "width", 32],
    [".switch-track", "height", 18],
    [".hero-badge-pill", "height", 32],
  ];
  for (const [selector, field, expected] of controlDimensions) {
    for (const element of select(selector)) {
      const addon =
        selector === ".input-control" ? closest(element, ".input-addon-group") : undefined;
      const adjustedExpected = addon
        ? addon.rect.height - addon.border.top - addon.border.bottom
        : expected;
      observe(
        "component.controls",
        `${element.path}.${field}`,
        element.rect[field],
        adjustedExpected,
      );
    }
  }
  for (const button of select(".btn")) {
    const expected = button.matches.includes(".btn-sm")
      ? 24
      : button.matches.includes(".btn-lg")
        ? 48
        : 32;
    observe("component.controls", `${button.path}.height`, button.rect.height, expected);
    observeLattice(
      "component.controls",
      `${button.path}.height on 8px subgrid`,
      button.rect.height,
      Q,
    );
  }
  for (const chip of [...select(".chip"), ...select(".chip-split")]) {
    observe(
      "component.controls",
      `${chip.path}.height`,
      chip.rect.height,
      closest(chip, ".metric-top-row") ? 22 : 24,
    );
  }

  for (const owner of select(".ramp-color-bar")) {
    const tracks = children(owner, ".ramp-swatch-step").sort((a, b) => a.rect.left - b.rect.left);
    observe("component.equal-partitions", `${owner.path} track count`, tracks.length, 10, 0);
    if (tracks.length > 0) {
      const content = {
        left: owner.rect.left + owner.border.left,
        right: owner.rect.right - owner.border.right,
        width: owner.rect.width - owner.border.left - owner.border.right,
      };
      const result = measureEqualPartition(
        content,
        tracks.map((track) => track.rect),
      );
      observe(
        "component.equal-partitions",
        `${owner.path} equal track delta`,
        result.maxTrackDelta,
        0,
      );
      observe("component.equal-partitions", `${owner.path} maximum gap`, result.maxGap, 0);
      observe("component.equal-partitions", `${owner.path} fill residual`, result.fillResidual, 0);
    }
  }

  const table = first(".blueprint-table");
  const headerRow = select("tr").find((row) => closest(row, "thead"));
  const bodyRows = select("tr").filter((row) => closest(row, "tbody"));
  const tableOwner = first(".table-container");
  observe(
    "component.table",
    "table left border coincidence",
    table?.rect.left ?? Number.NaN,
    tableOwner?.rect.left ?? Number.NaN,
  );
  observe(
    "component.table",
    "table right border coincidence",
    table?.rect.right ?? Number.NaN,
    (tableOwner?.rect.right ?? Number.NaN) + 1,
  );
  observe(
    "component.table",
    "table top border coincidence",
    table?.rect.top ?? Number.NaN,
    tableOwner?.rect.top ?? Number.NaN,
  );
  observe(
    "component.table",
    "table bottom border coincidence",
    table?.rect.bottom ?? Number.NaN,
    tableOwner?.rect.bottom ?? Number.NaN,
  );
  observe("component.table", "table header height", headerRow?.rect.height ?? Number.NaN, 32);
  bodyRows.forEach((row) => observe("component.table", `${row.path}.height`, row.rect.height, 64));
  const expectedColumns = [288, 192, 224, 224, 192];
  for (const row of [headerRow, ...bodyRows].filter(Boolean)) {
    const cells = snapshot.elements.filter(
      (element) => element.parentIndex === row.index && ["th", "td"].includes(element.tag),
    );
    observe("component.table", `${row.path} cell count`, cells.length, 5, 0);
    cells.forEach((cell, index) =>
      observe("component.table", `${cell.path}.width`, cell.rect.width, expectedColumns[index]),
    );
  }

  for (const owner of select(".has-corner-ticks")) {
    for (const [pseudoName, pseudo] of [
      ["before", owner.before],
      ["after", owner.after],
    ]) {
      observe(
        "component.decorative-geometry",
        `${owner.path}::${pseudoName}.width`,
        Number.parseFloat(pseudo.width),
        Q,
      );
      observe(
        "component.decorative-geometry",
        `${owner.path}::${pseudoName}.height`,
        Number.parseFloat(pseudo.height),
        Q,
      );
    }
  }
  for (const track of select(".switch-track")) {
    observe(
      "component.decorative-geometry",
      `${track.path}::before.width`,
      Number.parseFloat(track.before.width),
      14,
    );
    observe(
      "component.decorative-geometry",
      `${track.path}::before.height`,
      Number.parseFloat(track.before.height),
      14,
    );
    observe(
      "component.decorative-geometry",
      `${track.path}::before.left`,
      Number.parseFloat(track.before.left),
      1,
    );
    observe(
      "component.decorative-geometry",
      `${track.path}::before.top`,
      Number.parseFloat(track.before.top),
      1,
    );
  }
  for (const badge of select(".dim-badge")) {
    observe("component.decorative-geometry", `${badge.path}.height`, badge.rect.height, 14);
    observe(
      "component.decorative-geometry",
      `${badge.path}.top inset`,
      Number.parseFloat(badge.style.top),
      -8,
    );
    observe(
      "component.decorative-geometry",
      `${badge.path}.right inset`,
      Number.parseFloat(badge.style.right),
      6,
    );
  }

  for (const svg of select("svg").filter((element) => element.visible)) {
    observeLattice(
      "component.vector-geometry",
      `${svg.path}.width on 2px icon lattice`,
      svg.rect.width,
      2,
    );
    observeLattice(
      "component.vector-geometry",
      `${svg.path}.height on 2px icon lattice`,
      svg.rect.height,
      2,
    );
    for (const [index, value] of svg.viewBox.entries()) {
      observeLattice("component.vector-geometry", `${svg.path}.viewBox[${index}]`, value, 2);
    }
  }

  const peers = [
    ...select(".tech-card"),
    ...select(".table-container"),
    ...select(".note-aside"),
    ...select(".code-panel-locked"),
  ];
  for (let leftIndex = 0; leftIndex < peers.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < peers.length; rightIndex += 1) {
      const left = peers[leftIndex];
      const right = peers[rightIndex];
      let cursor = byIndex.get(left.parentIndex);
      let nested = false;
      while (cursor) {
        if (cursor.index === right.index) nested = true;
        cursor = byIndex.get(cursor.parentIndex);
      }
      cursor = byIndex.get(right.parentIndex);
      while (cursor) {
        if (cursor.index === left.index) nested = true;
        cursor = byIndex.get(cursor.parentIndex);
      }
      if (nested) continue;
      const overlapWidth = Math.max(
        0,
        Math.min(left.rect.right, right.rect.right) - Math.max(left.rect.left, right.rect.left),
      );
      const overlapHeight = Math.max(
        0,
        Math.min(left.rect.bottom, right.rect.bottom) - Math.max(left.rect.top, right.rect.top),
      );
      observe(
        "aesthetic.peer-overlap",
        `${left.path} vs ${right.path}`,
        overlapWidth * overlapHeight,
        0,
      );
    }
  }

  const allowedLineHeights = [
    9, 9.5, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 16, 18, 20, 22, 24, 30, 31, 32, 44, 48, 64,
  ];
  for (const element of snapshot.elements.filter(
    (candidate) => candidate.visible && candidate.hasOwnText,
  )) {
    const lineHeight = Number.parseFloat(element.style.lineHeight);
    const distance = Math.min(
      ...allowedLineHeights.map((allowed) => Math.abs(lineHeight - allowed)),
    );
    observe("typography.rhythm", `${element.path} canonical line-height`, distance, 0);
    if (/\d/.test(element.ownText)) {
      observeBoolean(
        "typography.rhythm",
        `${element.path} tabular numerics`,
        element.style.fontFeatureSettings.includes("tnum"),
      );
    }
  }
  for (const [selector, ownerSelector, localCenter] of [
    [".axiom-card-tag", ".axiom-card", 32],
    [".axiom-card-title", ".axiom-card", 64],
    [".metric-card-lg .metric-top-row", ".metric-card-lg", 32],
    [".metric-card-lg .metric-number", ".metric-card-lg", 80],
    [".metric-card-lg .metric-subtext", ".metric-card-lg", 128],
  ]) {
    for (const element of select(selector)) {
      const owner = closest(element, ownerSelector);
      observe(
        "typography.rhythm",
        `${element.path} local centerline`,
        element.rect.top + element.rect.height / 2 - (owner?.rect.top ?? 0),
        localCenter,
      );
    }
  }

  const visible = snapshot.elements.filter((element) => element.visible);
  const unclassified = visible.filter((element) => !element.matches.includes(COVERAGE_SELECTOR));
  observe(
    "coverage.visible-elements",
    "unclassified visible DOM elements",
    unclassified.length,
    0,
    0,
    unclassified
      .slice(0, 12)
      .map((element) => element.path)
      .join(", "),
  );
  observe(
    "coverage.visible-elements",
    "classified visible DOM elements",
    visible.length - unclassified.length,
    visible.length,
    0,
  );

  return evaluateObservations(observations, { requiredRuleIds: RULE_IDS });
}

async function collectSnapshot(page, viewport) {
  return page.evaluate(
    ({ selectors, coverageSelector, viewportValue }) => {
      const nodes = [...document.body.querySelectorAll("*")];
      const indexByNode = new Map(nodes.map((node, index) => [node, index]));
      const px = (value) => Number.parseFloat(value) || 0;
      const rectOf = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left + window.scrollX,
          top: rect.top + window.scrollY,
          right: rect.right + window.scrollX,
          bottom: rect.bottom + window.scrollY,
          width: rect.width,
          height: rect.height,
        };
      };
      const pseudoStyle = (element, pseudo) => {
        const style = getComputedStyle(element, pseudo);
        return {
          content: style.content,
          width: style.width,
          height: style.height,
          top: style.top,
          right: style.right,
          bottom: style.bottom,
          left: style.left,
          transform: style.transform,
        };
      };
      const pathOf = (element) => {
        const id = element.id ? `#${element.id}` : "";
        const classes = [...element.classList].map((name) => `.${name}`).join("");
        if (id || classes) return `${element.tagName.toLowerCase()}${id}${classes}`;
        const siblings = element.parentElement
          ? [...element.parentElement.children].filter((child) => child.tagName === element.tagName)
          : [];
        const suffix = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(element) + 1})` : "";
        return `${element.tagName.toLowerCase()}${suffix}`;
      };
      const isRendered = (element, rect) => {
        if (rect.width <= 0 || rect.height <= 0) return false;
        let cursor = element;
        while (cursor && cursor !== document.documentElement) {
          const style = getComputedStyle(cursor);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) === 0
          ) {
            return false;
          }
          cursor = cursor.parentElement;
        }
        return true;
      };

      const elements = nodes.map((element, index) => {
        const style = getComputedStyle(element);
        const rect = rectOf(element);
        const visible = isRendered(element, rect);
        const ownText = [...element.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        return {
          index,
          parentIndex: indexByNode.get(element.parentElement) ?? -1,
          tag: element.tagName.toLowerCase(),
          classes: [...element.classList],
          path: pathOf(element),
          visible,
          hasOwnText: ownText.length > 0,
          ownText,
          rect,
          border: {
            top: px(style.borderTopWidth),
            right: px(style.borderRightWidth),
            bottom: px(style.borderBottomWidth),
            left: px(style.borderLeftWidth),
          },
          style: {
            lineHeight: style.lineHeight,
            fontFamily: style.fontFamily,
            fontFeatureSettings: style.fontFeatureSettings,
            backgroundSize: style.backgroundSize,
            backgroundPosition: style.backgroundPosition,
            top: style.top,
            right: style.right,
          },
          viewBox:
            element instanceof SVGSVGElement && element.hasAttribute("viewBox")
              ? element.getAttribute("viewBox").trim().split(/[ ,]+/).map(Number)
              : [],
          matches: selectors.filter((selector) => {
            try {
              return element.matches(selector);
            } catch {
              return false;
            }
          }),
          before: pseudoStyle(element, "::before"),
          after: pseudoStyle(element, "::after"),
          clientWidth: element.clientWidth,
          clientHeight: element.clientHeight,
          scrollWidth: element.scrollWidth,
          scrollHeight: element.scrollHeight,
        };
      });

      const rootStyle = getComputedStyle(document.documentElement);
      const bodyStyle = getComputedStyle(document.body);
      const rootTokenNames = [
        "--G-unit",
        "--G-half",
        "--G-quarter",
        "--G-micro",
        "--w-sidebar",
        "--w-canvas",
        "--h-header",
      ];
      return {
        viewport: viewportValue,
        document: {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          clientHeight: document.documentElement.clientHeight,
          scrollHeight: document.documentElement.scrollHeight,
        },
        rootTokens: Object.fromEntries(
          rootTokenNames.map((name) => [name, rootStyle.getPropertyValue(name).trim()]),
        ),
        bodyStyle: {
          lineHeight: bodyStyle.lineHeight,
          fontFamily: bodyStyle.fontFamily,
          fontFeatureSettings: bodyStyle.fontFeatureSettings,
        },
        fonts: {
          inter: document.fonts.check("12px Inter"),
          ibmPlexMono: document.fonts.check('12px "IBM Plex Mono"'),
        },
        coverageSelector,
        elements,
      };
    },
    { selectors: SELECTORS, coverageSelector: COVERAGE_SELECTOR, viewportValue: viewport },
  );
}

async function loadChromium() {
  const resolutionPaths = [path.resolve("packages/atlas-e2e"), process.cwd()];
  const playwright = require(require.resolve("@playwright/test", { paths: resolutionPaths }));
  try {
    return await playwright.chromium.launch({ headless: true });
  } catch (error) {
    if (!String(error).includes("Executable doesn't exist")) throw error;
    return playwright.chromium.launch({ channel: "chrome", headless: true });
  }
}

async function main() {
  await access(HTML_PATH);
  if (path.extname(HTML_PATH).toLowerCase() !== ".html") {
    throw new Error(`Grid audit target must be an HTML file: ${HTML_PATH}`);
  }

  const browser = await loadChromium();
  let overallPass = true;
  let overallPassed = 0;
  let overallTotal = 0;

  console.log("Atlas static blueprint hard gate");
  console.log(`Target: ${HTML_PATH}`);
  console.log(`Grid: 32px master / 8px component / ${EPSILON}px tolerance`);

  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
      });
      await page.goto(pathToFileURL(HTML_PATH).href, { waitUntil: "load" });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });

      const snapshot = await collectSnapshot(page, viewport);
      const result = buildAuditor(snapshot);
      overallPass &&= result.pass;
      overallPassed += result.passed;
      overallTotal += result.total;

      console.log(
        `\n[${result.pass ? "PASS" : "FAIL"}] ${viewport.name} ${viewport.width}x${viewport.height}: ${result.passed}/${result.total}`,
      );
      const failuresByRule = Map.groupBy(result.failures, (failure) => failure.ruleId);
      for (const [ruleId, failures] of failuresByRule) {
        console.log(`  ${ruleId}: ${failures.length} failure${failures.length === 1 ? "" : "s"}`);
        for (const failure of failures.slice(0, 3)) {
          console.log(`    ${describeObservation(failure)}`);
          if (failure.note) console.log(`      ${failure.note}`);
        }
        if (failures.length > 3) console.log(`    ... ${failures.length - 3} more`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`\nOverall: ${overallPassed}/${overallTotal} (${overallPass ? "PASS" : "FAIL"})`);
  process.exitCode = overallPass ? 0 : 1;
}

main().catch((error) => {
  console.error(`Grid audit could not run: ${error.message}`);
  process.exitCode = 1;
});
