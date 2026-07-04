/**
 * Test-only convenience wrapper (locked decision 6). Colocated tests must build
 * their resolution context through the REAL factory — never a hand-rolled default
 * — so this simply spares each call site the `{ env: {} }` boilerplate (empty env
 * ⇒ in-memory content cache) and mirrors the no-creds anonymous posture. It is not
 * exported from the package root; only tests import it by relative path.
 */
import {
  createResolutionContext,
  type CreateResolutionContextInput,
  type GovernedResolutionContext,
} from "./createResolutionContext";

export function createTestResolutionContext(
  input: CreateResolutionContextInput = {},
): Promise<GovernedResolutionContext> {
  return createResolutionContext({ env: {}, ...input });
}
