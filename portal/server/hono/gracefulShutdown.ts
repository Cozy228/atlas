export type ShutdownResult = {
  forced: boolean;
  signal: NodeJS.Signals;
};

export type GracefulShutdown = {
  shutdown(signal: NodeJS.Signals): Promise<ShutdownResult>;
};

type ShutdownServer = {
  close(callback?: (error?: Error) => void): unknown;
  closeAllConnections?: () => void;
  closeIdleConnections?: () => void;
};

export function createGracefulShutdown(options: {
  server: ShutdownServer;
  deadlineMs: number;
  markDraining: () => void;
  closeHooks?: ReadonlyArray<() => void | Promise<void>>;
  onEvent?: (event: { event: string; activeRequests?: number; signal?: NodeJS.Signals }) => void;
  activeRequests?: () => number;
}): GracefulShutdown {
  let pending: Promise<ShutdownResult> | undefined;

  return {
    shutdown(signal) {
      pending ??= runShutdown(options, signal);
      return pending;
    },
  };
}

async function runShutdown(
  options: Parameters<typeof createGracefulShutdown>[0],
  signal: NodeJS.Signals,
): Promise<ShutdownResult> {
  options.markDraining();
  options.onEvent?.({
    event: "drain-start",
    signal,
    activeRequests: options.activeRequests?.() ?? 0,
  });

  const graceful = closeServer(options.server)
    .then(() =>
      Promise.allSettled((options.closeHooks ?? []).map((hook) => Promise.resolve().then(hook))),
    )
    .then(() => "graceful" as const);
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<"deadline">((resolve) => {
    deadlineTimer = setTimeout(() => resolve("deadline"), options.deadlineMs);
  });
  const result = await Promise.race([graceful, deadline]);
  if (deadlineTimer) clearTimeout(deadlineTimer);

  if (result === "deadline") {
    options.onEvent?.({
      event: "drain-deadline",
      signal,
      activeRequests: options.activeRequests?.() ?? 0,
    });
    options.server.closeIdleConnections?.();
    options.server.closeAllConnections?.();
    return { forced: true, signal };
  }

  options.server.closeIdleConnections?.();
  options.onEvent?.({ event: "drain-complete", signal, activeRequests: 0 });
  return { forced: false, signal };
}

function closeServer(server: ShutdownServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
