/**
 * CLI: federated-platform release-notes page text -> structured release YAML.
 *
 *   node --experimental-strip-types context-layer/scripts/parse-release-notes.ts <page.txt>
 *   pbpaste | node --experimental-strip-types context-layer/scripts/parse-release-notes.ts
 *   pnpm parse:release-notes <page.txt>        # from the repo root
 *
 * Reads a file path argument, or stdin when none is given, and writes YAML to
 * stdout. Body-only; the live Confluence provider can feed the text later.
 */
import { readFileSync } from "node:fs";
import { stringify } from "yaml";

import { parseReleaseNotes } from "../src/releaseNotes/parseReleaseNotes.ts";

const fileArg = process.argv[2];
// fd 0 = stdin, so the script works in a pipe with no argument.
const text = readFileSync(fileArg ?? 0, "utf8");

process.stdout.write(stringify(parseReleaseNotes(text)));
