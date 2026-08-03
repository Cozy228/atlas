import {
  Agent,
  Dispatcher,
  EnvHttpProxyAgent,
  setGlobalDispatcher,
  type Dispatcher as DispatcherType,
} from "undici";

export type OutboundProxyHandle = {
  close(): Promise<void>;
};

/**
 * Configure a default-deny proxy dispatcher. Only the configured Confluence
 * hosts and Terraform host use the proxy; every other server-side fetch stays
 * direct. Lowercase proxy variables take precedence over uppercase aliases.
 */
export function configureOutboundProxy(
  env: Record<string, string | undefined> = process.env,
): OutboundProxyHandle | undefined {
  const httpProxy = env.http_proxy ?? env.HTTP_PROXY;
  const httpsProxy = env.https_proxy ?? env.HTTPS_PROXY;
  if (!httpProxy && !httpsProxy) return undefined;

  const noProxy = env.no_proxy ?? env.NO_PROXY;
  const proxiedHosts = proxyHostsFromEnv(env);
  const dispatcher = new ScopedOutboundDispatcher(
    proxiedHosts,
    new EnvHttpProxyAgent({
      ...(httpProxy ? { httpProxy } : {}),
      ...(httpsProxy ? { httpsProxy } : {}),
      ...(noProxy ? { noProxy } : {}),
    }),
    new Agent(),
  );
  setGlobalDispatcher(dispatcher);

  return {
    close: () => dispatcher.close(),
  };
}

export function proxyHostsFromEnv(env: Record<string, string | undefined>): ReadonlySet<string> {
  const hosts = new Set<string>();
  for (const rawUrl of [
    env.CONFLUENCE_BASE_URL,
    env.CONFLUENCE_SECURITY_BASE_URL,
    env.TERRAFORM_BASE_URL || "https://registry.terraform.io",
  ]) {
    if (!rawUrl) continue;
    try {
      hosts.add(new URL(rawUrl).hostname.toLowerCase());
    } catch {
      // Integration validation reports malformed URLs at the owning adapter.
    }
  }
  return hosts;
}

class ScopedOutboundDispatcher extends Dispatcher {
  constructor(
    private readonly proxiedHosts: ReadonlySet<string>,
    private readonly proxy: DispatcherType,
    private readonly direct: DispatcherType,
  ) {
    super();
  }

  override dispatch(
    options: DispatcherType.DispatchOptions,
    handler: DispatcherType.DispatchHandler,
  ): boolean {
    const hostname = hostnameFromOrigin(options.origin);
    const dispatcher = hostname && this.proxiedHosts.has(hostname) ? this.proxy : this.direct;
    return dispatcher.dispatch(options, handler);
  }

  override close(callback: () => void): void;
  override close(): Promise<void>;
  override close(callback?: () => void): void | Promise<void> {
    const pending = Promise.all([this.proxy.close(), this.direct.close()]).then(() => undefined);
    if (!callback) return pending;
    void pending.then(callback);
  }

  override destroy(error: Error | null, callback: () => void): void;
  override destroy(callback: () => void): void;
  override destroy(error: Error | null): Promise<void>;
  override destroy(): Promise<void>;
  override destroy(
    errorOrCallback?: Error | null | (() => void),
    callback?: () => void,
  ): void | Promise<void> {
    const error = typeof errorOrCallback === "function" ? null : (errorOrCallback ?? null);
    const done = typeof errorOrCallback === "function" ? errorOrCallback : callback;
    const pending = Promise.all([this.proxy.destroy(error), this.direct.destroy(error)]).then(
      () => undefined,
    );
    if (!done) return pending;
    void pending.then(done);
  }
}

function hostnameFromOrigin(origin: string | URL | undefined): string | undefined {
  if (!origin) return undefined;
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}
