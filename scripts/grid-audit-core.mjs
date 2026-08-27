export const GEOMETRY_TOLERANCE = 0.05;

export function distanceToLattice(value, step, phases = [0]) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0 || phases.length === 0) {
    throw new TypeError(
      "Lattice measurements require a finite value, a positive step, and phases.",
    );
  }

  return Math.min(
    ...phases.map((phase) => {
      const normalized = (((value - phase) % step) + step) % step;
      return Math.min(normalized, step - normalized);
    }),
  );
}

export function makeObservation({
  ruleId,
  category = "geometry",
  subject,
  actual,
  expected,
  tolerance = GEOMETRY_TOLERANCE,
  note,
}) {
  if (!ruleId || !subject) {
    throw new TypeError("Every observation requires a ruleId and subject.");
  }

  const numeric = Number.isFinite(actual) && Number.isFinite(expected);
  const residual = numeric ? Math.abs(actual - expected) : null;
  const pass = numeric ? residual <= tolerance : Object.is(actual, expected);

  return {
    ruleId,
    category,
    subject,
    actual,
    expected,
    tolerance: numeric ? tolerance : null,
    residual,
    pass,
    ...(note ? { note } : {}),
  };
}

export function evaluateObservations(observations, { requiredRuleIds = [] } = {}) {
  if (!Array.isArray(observations)) {
    throw new TypeError("Observations must be an array.");
  }

  if (observations.length === 0) {
    const failure = {
      ruleId: "audit.non-empty",
      category: "contract",
      subject: "audit",
      pass: false,
      message: "Audit produced zero observations.",
    };
    return { pass: false, passed: 0, total: 1, failures: [failure], observations: [failure] };
  }

  const executed = new Set(observations.map((observation) => observation.ruleId));
  const missing = [...new Set(requiredRuleIds)]
    .filter((ruleId) => !executed.has(ruleId))
    .map((ruleId) => ({
      ruleId,
      category: "contract",
      subject: ruleId,
      pass: false,
      message: `Required rule did not execute: ${ruleId}`,
    }));
  const complete = [...observations, ...missing];
  const failures = complete.filter((observation) => !observation.pass);

  return {
    pass: failures.length === 0,
    passed: complete.length - failures.length,
    total: complete.length,
    failures,
    observations: complete,
  };
}

export function measureEqualPartition(owner, tracks) {
  if (!owner || !Array.isArray(tracks) || tracks.length === 0) {
    throw new TypeError("Equal partition measurements require an owner and at least one track.");
  }

  const widths = tracks.map((track) => track.width);
  const gaps = tracks.slice(1).map((track, index) => Math.abs(track.left - tracks[index].right));
  return {
    maxTrackDelta: Math.max(...widths) - Math.min(...widths),
    maxGap: gaps.length > 0 ? Math.max(...gaps) : 0,
    fillResidual: Math.max(
      Math.abs(tracks[0].left - owner.left),
      Math.abs(tracks.at(-1).right - owner.right),
      Math.abs(widths.reduce((sum, width) => sum + width, 0) - owner.width),
    ),
  };
}

export function measureBorderInset(owner, content, border) {
  if (!owner || !content || !border) {
    throw new TypeError("Border inset measurements require owner, content, and border rectangles.");
  }

  return {
    top: Math.abs(content.top - (owner.top + border.top)),
    right: Math.abs(content.right - (owner.right - border.right)),
    bottom: Math.abs(content.bottom - (owner.bottom - border.bottom)),
    left: Math.abs(content.left - (owner.left + border.left)),
  };
}
