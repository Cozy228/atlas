# azure-react-icons

React components generated from the official Microsoft Azure architecture SVG icon set.

Source: https://learn.microsoft.com/en-us/azure/architecture/icons/

## Usage

```tsx
import { AzureComputeVirtualMachine } from "azure-react-icons";

export function Example() {
  return <AzureComputeVirtualMachine size={32} aria-label="Azure virtual machine" />;
}
```

Components accept standard SVG props plus an optional `size` prop.

## Regenerate

```sh
pnpm --filter azure-react-icons generate
```

The generator downloads the current official Azure SVG zip from Microsoft Learn and rewrites `src/icons` plus the package index.

Review Microsoft's icon terms before using or distributing the generated icons.
