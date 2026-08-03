import { beforeEach, describe, expect, it, vi } from "vitest";

const undici = vi.hoisted(() => ({
  directDispatch: vi.fn(() => true),
  proxyClose: vi.fn(async () => {}),
  proxyDestroy: vi.fn(async () => {}),
  proxyDispatch: vi.fn(() => true),
  proxyOptions: [] as unknown[],
  setGlobalDispatcher: vi.fn(),
}));

vi.mock("undici", () => {
  class Dispatcher {}
  return {
    Agent: class {
      close = vi.fn(async () => {});
      destroy = vi.fn(async () => {});
      dispatch = undici.directDispatch;
    },
    Dispatcher,
    EnvHttpProxyAgent: class {
      constructor(options: unknown) {
        undici.proxyOptions.push(options);
      }

      close = undici.proxyClose;
      destroy = undici.proxyDestroy;
      dispatch = undici.proxyDispatch;
    },
    setGlobalDispatcher: undici.setGlobalDispatcher,
  };
});

import { configureOutboundProxy, proxyHostsFromEnv } from "./outboundProxy";

describe("configureOutboundProxy", () => {
  beforeEach(() => {
    undici.directDispatch.mockClear();
    undici.proxyClose.mockClear();
    undici.proxyDestroy.mockClear();
    undici.proxyDispatch.mockClear();
    undici.proxyOptions.length = 0;
    undici.setGlobalDispatcher.mockClear();
  });

  it("leaves the global dispatcher unchanged without a configured proxy", () => {
    expect(configureOutboundProxy({ NO_PROXY: "localhost" })).toBeUndefined();
    expect(undici.setGlobalDispatcher).not.toHaveBeenCalled();
  });

  it("proxies only configured Confluence and Terraform hosts", () => {
    configureOutboundProxy({
      HTTPS_PROXY: "http://proxy.example:8443",
      CONFLUENCE_BASE_URL: "https://docs.example/wiki",
      CONFLUENCE_SECURITY_BASE_URL: "https://security-docs.example/wiki",
      TERRAFORM_BASE_URL: "https://terraform.example/api",
    });
    const dispatcher = undici.setGlobalDispatcher.mock.calls[0]?.[0] as {
      dispatch(options: { origin: string }, handler: object): boolean;
    };
    const handler = {};

    dispatcher.dispatch({ origin: "https://docs.example" }, handler);
    dispatcher.dispatch({ origin: "https://security-docs.example" }, handler);
    dispatcher.dispatch({ origin: "https://terraform.example" }, handler);
    dispatcher.dispatch({ origin: "https://rai.example" }, handler);

    expect(undici.proxyDispatch).toHaveBeenCalledTimes(3);
    expect(undici.directDispatch).toHaveBeenCalledOnce();
  });

  it("uses the public Terraform registry as the default Terraform host", () => {
    expect(proxyHostsFromEnv({})).toEqual(new Set(["registry.terraform.io"]));
  });

  it("passes standard proxy variables through with lowercase precedence", () => {
    configureOutboundProxy({
      http_proxy: "http://lower.example:8080",
      HTTP_PROXY: "http://upper.example:8080",
      no_proxy: "docs-direct.example",
      NO_PROXY: "other.example",
    });

    expect(undici.proxyOptions).toEqual([
      { httpProxy: "http://lower.example:8080", noProxy: "docs-direct.example" },
    ]);
  });
});
