"use client";

import { cn } from "@/lib/utils";
import type { MotionProps } from "motion/react";
import { LazyMotion, m } from "motion/react";
import type { CSSProperties, ElementType, JSX } from "react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

type MotionHTMLProps = MotionProps & Record<string, unknown>;

// Lazily load motion's DOM feature bundle (shared with the home page chunk).
const loadDomAnimation = () => import("motion/react").then((mod) => mod.domAnimation);

// Cache motion components at module level to avoid creating during render
const motionComponentCache = new Map<
  keyof JSX.IntrinsicElements,
  React.ComponentType<MotionHTMLProps>
>();

const getMotionComponent = (element: keyof JSX.IntrinsicElements) => {
  let component = motionComponentCache.get(element);
  if (!component) {
    component = m.create(element);
    motionComponentCache.set(element, component);
  }
  return component as React.ForwardRefExoticComponent<
    MotionHTMLProps & React.RefAttributes<HTMLElement>
  >;
};

export interface TextShimmerProps {
  children: string;
  as?: ElementType;
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
  const MotionComponent = getMotionComponent(Component as keyof JSX.IntrinsicElements);

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
