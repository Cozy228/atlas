# Atlas logging

Atlas runtime services use Pino for structured logs. Instrumentation follows these rules:

1. Log boundaries, state transitions, dependency calls, recoverable degradation, and failures that
   an operator can act on. Do not trace every function call.
2. The layer that owns an operation logs its completion or failure once. Lower layers should not
   repeat the same error unless they recover, retry, or add a distinct operational decision.
3. Use stable event names and low-cardinality fields. Include `requestId`, `statusCode`, `durationMs`,
   counts, and bounded enums where relevant.
4. Use `debug` for high-volume diagnostics, `info` for normal lifecycle events, `warn` for recovered
   or degraded behavior, and `error` for failed requests or dependencies.
5. Never log authorization headers, credentials, secrets, user queries, feedback text, document
   content, request or response bodies, or URLs containing query strings.
6. Log errors as `err` so Pino preserves the error type, message, and stack. Do not interpolate
   errors into message strings.

Use `safeError` before logging errors from HTTP, MCP, LLM, or other third-party boundaries. It
preserves the error type and call sites while replacing an error message that could contain a URL,
prompt, or payload. The shared redaction configuration cannot be disabled by callers.

Command-line scripts may keep human-readable console output. This package is for application
runtime logs. Browser code must not import this package or ship Pino in client bundles.

## Signal and field ownership

- HTTP server duration is owned by the host lifecycle. Hono records completion only after the response body closes; route handlers must not repeat it. `withHttpRequestLogging` remains available for non-streaming hosts.
- External dependency, MCP, and LLM boundaries may include one per-operation `durationMs` until those
  boundaries are represented by traces.
- Domain events describe outcomes and state. Counts such as `zoneCount`, `warningCount`, or
  `claimCount` are included only when they explain that specific event.
- Latency distributions, throughput, error rates, and alert thresholds belong in metrics, not in
  repeated application log fields.
- Operations with meaningful nested start/end boundaries belong in traces when OpenTelemetry is
  introduced. Do not grow a custom tracing API inside this logging package.
