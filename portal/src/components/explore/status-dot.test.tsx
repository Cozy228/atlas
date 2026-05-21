import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatusDot } from "./status-dot";

describe("StatusDot", () => {
  it("renders as a lightweight static dot by default", () => {
    const html = renderToStaticMarkup(<StatusDot status="planned" note="ETA Q4" />);

    expect(html).toContain('aria-label="Planned · ETA Q4"');
    expect(html).toContain('title="Planned · ETA Q4"');
    expect(html).not.toContain('data-slot="tooltip"');
  });
});
