/**
 * CLI: newsletter email body -> What's New entries as YAML.
 *
 *   node --experimental-strip-types context-layer/scripts/parse-newsletter.ts <body.txt>
 *   pbpaste | node --experimental-strip-types context-layer/scripts/parse-newsletter.ts
 *   pnpm parse:newsletter <body.txt>            # from the repo root
 *
 * Reads a file path argument, or stdin when none is given, and writes YAML to
 * stdout. Body-only; automated ingestion is future work.
 */
import { readFileSync } from "node:fs";
import { stringify } from "yaml";

import { parseNewsletter } from "../src/newsletter/parseNewsletter.ts";

const fileArg = process.argv[2];
// fd 0 = stdin, so the script works in a pipe with no argument.
const body = readFileSync(fileArg ?? 0, "utf8");

process.stdout.write(stringify({ changes: parseNewsletter(body) }));
