import type { ComponentType, ErrorInfo, ReactNode } from "react";
import { CatchBoundary as TanStackCatchBoundary } from "@tanstack/react-router";

type RouterErrorComponentProps = {
  error: Error;
  reset: () => void;
};

type RouterCatchBoundaryProps = {
  children: ReactNode;
  getResetKey: () => unknown;
  errorComponent?: ComponentType<RouterErrorComponentProps>;
  onCatch?: (error: Error, errorInfo: ErrorInfo) => void;
};

// TanStack Router 1.170.31 emits a class render type that TypeScript 7 rejects
// as JSX even though the runtime class implements the React boundary contract.
const CompatibleCatchBoundary =
  TanStackCatchBoundary as unknown as ComponentType<RouterCatchBoundaryProps>;

export function RouterCatchBoundary(props: RouterCatchBoundaryProps) {
  return <CompatibleCatchBoundary {...props} />;
}
