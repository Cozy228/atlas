import { createContext, useContext } from "react";

import type { Application } from "./fixtures/types";

export const ApplicationContext = createContext<Application | null>(null);

export function useApplication(): Application {
  const application = useContext(ApplicationContext);
  if (application === null) {
    throw new Error("useApplication must be used inside the opus prototype layout");
  }
  return application;
}
