import assert from "node:assert/strict";
import test from "node:test";

import {
  distanceToLattice,
  evaluateObservations,
  makeObservation,
  measureBorderInset,
  measureEqualPartition,
} from "./grid-audit-core.mjs";

test("distanceToLattice measures the real float instead of a rounded integer", () => {
  assert.equal(distanceToLattice(64.02, 32), 0.01999999999999602);
  assert.equal(distanceToLattice(63.5, 32), 0.5);
  assert.equal(distanceToLattice(72, 32, [0, 8, 16, 24]), 0);
});

test("makeObservation applies a strict geometric tolerance", () => {
  assert.equal(
    makeObservation({ ruleId: "geometry.edge", subject: "card", actual: 32.04, expected: 32 }).pass,
    true,
  );
  assert.equal(
    makeObservation({ ruleId: "geometry.edge", subject: "card", actual: 32.06, expected: 32 }).pass,
    false,
  );
});

test("evaluateObservations fails closed on zero checks and missing rule execution", () => {
  const empty = evaluateObservations([], { requiredRuleIds: ["shell.canvas"] });
  assert.equal(empty.pass, false);
  assert.match(empty.failures[0].message, /zero observations/i);

  const incomplete = evaluateObservations(
    [makeObservation({ ruleId: "shell.canvas", subject: "canvas", actual: 1120, expected: 1120 })],
    { requiredRuleIds: ["shell.canvas", "coverage.visible-elements"] },
  );
  assert.equal(incomplete.pass, false);
  assert.ok(
    incomplete.failures.some((failure) => /coverage\.visible-elements/.test(failure.message)),
  );
});

test("evaluateObservations reports measured failures without hiding them", () => {
  const observations = [
    makeObservation({ ruleId: "shell.canvas", subject: "canvas", actual: 1120, expected: 1120 }),
    makeObservation({
      ruleId: "document.no-overflow",
      subject: "document",
      actual: 1376,
      expected: 1280,
    }),
  ];
  const result = evaluateObservations(observations, {
    requiredRuleIds: ["shell.canvas", "document.no-overflow"],
  });

  assert.equal(result.pass, false);
  assert.equal(result.passed, 1);
  assert.equal(result.total, 2);
  assert.equal(result.failures[0].ruleId, "document.no-overflow");
});

test("measureEqualPartition accepts fractional tracks when they conserve the owner width", () => {
  const result = measureEqualPartition(
    { left: 0, right: 768, width: 768 },
    Array.from({ length: 10 }, (_, index) => ({
      left: index * 76.8,
      right: (index + 1) * 76.8,
      width: 76.8,
    })),
  );

  assert.ok(result.maxTrackDelta < 0.0001);
  assert.ok(result.maxGap < 0.0001);
  assert.ok(result.fillResidual < 0.0001);
});

test("measureBorderInset models a one-pixel border without rounding it onto the grid", () => {
  const result = measureBorderInset(
    { left: 512, top: 128, right: 1632, bottom: 320 },
    { left: 513, top: 129, right: 1631, bottom: 319 },
    { top: 1, right: 1, bottom: 1, left: 1 },
  );

  assert.deepEqual(result, { top: 0, right: 0, bottom: 0, left: 0 });
});
