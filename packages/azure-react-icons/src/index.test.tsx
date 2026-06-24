import { describe, expect, it } from "vitest";
import { AzureComputeVirtualMachine, azureIconMetadata } from "./index";

describe("azure-react-icons", () => {
  it("exports generated icon components and metadata", () => {
    expect(typeof AzureComputeVirtualMachine).toBe("function");
    expect(
      azureIconMetadata.some((icon) => icon.componentName === "AzureComputeVirtualMachine"),
    ).toBe(true);
  });
});
