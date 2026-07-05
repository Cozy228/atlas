/**
 * Batch-0 stub helper (Step 4). Every signature in `briefs/` (templates,
 * executor, assembler) and the brief route throws through this until its batch
 * lands the behavior, so the frozen D2–D11 suite is red for BEHAVIORAL reasons
 * only (an unimplemented throw), never for import/type errors.
 *
 * Convention inherited from Step 2/3 Batch 0: a tiny local helper that is deleted
 * once every caller is implemented (nothing outside `briefs/` imports it).
 */
export function unimplemented(name: string): never {
  throw new Error(`Not implemented yet: ${name} (Step 4 Batch 0 signature).`);
}
