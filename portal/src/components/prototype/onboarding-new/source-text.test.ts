import { describe, expect, it } from "vitest";
import { formatSourceText } from "./source-text";

describe("source text rendering", () => {
  it("substitutes all source app-code spellings without replacing other placeholders", () => {
    expect(formatSourceText("<appcode> <APP_CODE> <App Code> {app-code} <ENV>", "DEMO")).toBe(
      "DEMO DEMO DEMO DEMO <ENV>",
    );
  });
  it("removes escaped quotes while preserving their text", () => {
    expect(formatSourceText(String.raw`\"Add TFE groups\"`, "APP1")).toBe('"Add TFE groups"');
  });
  it("preserves an unresolved placeholder when no code was supplied", () => {
    expect(formatSourceText("SSO_TFE_PROD_<appcode>_PRJ_VIEWER", "")).toBe(
      "SSO_TFE_PROD_<appcode>_PRJ_VIEWER",
    );
  });
  it("treats the supplied code as literal text", () => {
    expect(formatSourceText("<appcode>", "$&")).toBe("$&");
  });
});
