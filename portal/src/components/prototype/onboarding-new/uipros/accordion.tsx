// Motion choreography: UIPros plus/dev/react-env/src/app/tests/[slug]/components/Accordion.tsx.
// Base UI retains the controlled state and keyboard navigation.
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";

import { motion } from "motion/react";
import { type ReactNode } from "react";
import { useOnboardingMotion } from "../motion";

import { cn } from "@/lib/utils";
import { IconChevronDown as ChevronDownIcon } from "@tabler/icons-react";

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex w-full flex-col", className)}
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("not-last:border-b", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  indicator = "chevron",
  ...props
}: AccordionPrimitive.Trigger.Props & { indicator?: "chevron" | "plus" }) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/accordion-trigger relative flex flex-1 items-start justify-between rounded-lg border border-transparent py-2.5 text-left text-sm font-medium transition-[border-color,box-shadow,color] outline-none hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:after:border-ring aria-disabled:pointer-events-none aria-disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 **:data-[slot=accordion-trigger-icon]:text-muted-foreground",
          className,
        )}
        {...props}
      >
        {children}
        {indicator === "plus" ? (
          <span
            className="on-accordion-plus relative inline-block size-4 shrink-0 self-center [&>span]:absolute [&>span]:top-[7px] [&>span]:left-0.5 [&>span]:h-px [&>span]:w-3 [&>span]:bg-current"
            aria-hidden="true"
          >
            <span />
            <span />
          </span>
        ) : (
          <ChevronDownIcon
            data-slot="accordion-trigger-icon"
            className="pointer-events-none shrink-0 transition-transform duration-200 group-aria-expanded/accordion-trigger:rotate-180"
          />
        )}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionBody({
  open,
  className,
  children,
}: {
  open: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { reduced } = useOnboardingMotion();
  return (
    <motion.div
      className="on-accordion-motion overflow-hidden"
      initial={false}
      animate={open ? "open" : "closed"}
      variants={{
        open: { height: "auto", opacity: 1 },
        closed: { height: 0, opacity: 0 },
      }}
      transition={{
        height: { duration: reduced ? 0 : 0.3, ease: [0.4, 0, 0.2, 1] },
        opacity: { duration: reduced ? 0 : 0.2, ease: "easeOut" },
      }}
    >
      <motion.div
        className={cn(
          "on-accordion-inner pt-0 pb-2.5 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
          className,
        )}
        variants={{
          open: { filter: "blur(0px)" },
          closed: { filter: reduced ? "blur(0px)" : "blur(2px)" },
        }}
        transition={{ duration: reduced ? 0 : 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function AccordionContent({ className, children, ...props }: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      {...props}
      keepMounted
      data-slot="accordion-content"
      className="overflow-hidden text-sm"
      render={(panelProps, state) => (
        <div {...panelProps} hidden={false} inert={!state.open} aria-hidden={!state.open}>
          <AccordionBody
            open={state.open}
            className={typeof className === "function" ? className(state) : className}
          >
            {children}
          </AccordionBody>
        </div>
      )}
    />
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
