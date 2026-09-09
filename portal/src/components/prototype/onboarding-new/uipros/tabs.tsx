// Adapted from UIPros: motion-examples/react/base-tabs/index.tsx.
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { motion, useIsPresent } from "motion/react";
import { useOnboardingMotion } from "../motion";

export const Tabs = TabsPrimitive.Root;
export const TabsList = TabsPrimitive.List;
export const TabsTrigger = TabsPrimitive.Tab;

export function AnimatedTabsPanel({ children, ...props }: TabsPrimitive.Panel.Props) {
  const { reduced } = useOnboardingMotion();
  const present = useIsPresent();
  return (
    <TabsPrimitive.Panel
      {...props}
      keepMounted
      // Presence owns the exit lifetime; Base UI retains labeling and inert state.
      hidden={false}
      aria-hidden={!present}
      render={
        <motion.div
          initial={{ opacity: 0, filter: reduced ? "blur(0px)" : "blur(2px)" }}
          animate={{
            opacity: 1,
            filter: "blur(0px)",
            transition: { duration: reduced ? 0 : 0.32 },
          }}
          exit={{
            opacity: 0,
            filter: reduced ? "blur(0px)" : "blur(2px)",
            transition: { duration: reduced ? 0 : 0.15 },
          }}
          transition={{ ease: [0.23, 1, 0.32, 1] }}
          layout="position"
        />
      }
    >
      {children}
    </TabsPrimitive.Panel>
  );
}
