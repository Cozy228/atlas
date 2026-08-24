"use client";

import { cn } from "@/lib/utils";
import { LazyMotion, m } from "motion/react";
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

// Lazily load motion's DOM feature bundle (shared with the home page chunk).
const loadDomAnimation = () => import("motion/react").then((mod) => mod.domAnimation);

// Statically map common element types to avoid declaring components during render
const MOTION_ELEMENT_MAP = {
  p: m.p,
  span: m.span,
  div: m.div,
  h1: m.h1,
  h2: m.h2,
  h3: m.h3,
  h4: m.h4,
  h5: m.h5,
  h6: m.h6,
} as const;

export interface TextShimmerProps {
  children: string;
  as?: keyof typeof MOTION_ELEMENT_MAP;
  className?: string;
  duration?: number;
  spread?: number;
}

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) => {
  const MotionComponent = MOTION_ELEMENT_MAP[Component];

  const dynamicSpread = useMemo(() => (children?.length ?? 0) * spread, [children, spread]);

  // Pause the infinite sweep while scrolled out of view so it stops driving the
  // compositor on low-power machines.
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <LazyMotion features={loadDomAnimation}>
      <MotionComponent
        ref={ref}
        animate={{ backgroundPosition: inView ? "0% center" : "100% center" }}
        className={cn(
          "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
          "[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-background),#0000_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]",
          className,
        )}
        initial={{ backgroundPosition: "100% center" }}
        style={
          {
            "--spread": `${dynamicSpread}px`,
            backgroundImage:
              "var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))",
          } as CSSProperties
        }
        transition={
          inView ? { duration, ease: "linear", repeat: Number.POSITIVE_INFINITY } : { duration: 0 }
        }
      >
        {children}
      </MotionComponent>
    </LazyMotion>
  );
};

export const Shimmer = memo(ShimmerComponent);
