// Adapted from UIPros motion-ui/motion-ui/arrow-link/index.tsx.
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { IconArrowRight } from "@tabler/icons-react";
import { useOnboardingMotion } from "../motion";

export function ArrowNudge({ size = 16 }: { size?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);
  const { reduced } = useOnboardingMotion();
  useEffect(() => {
    const surface = ref.current?.closest("button, a");
    if (!surface) return;
    const enter = () => setActive(window.matchMedia("(hover: hover)").matches);
    const leave = () => setActive(surface.matches(":focus-visible"));
    const focus = () => setActive(surface.matches(":focus-visible"));
    const blur = () => setActive(surface.matches(":hover"));
    surface.addEventListener("mouseenter", enter);
    surface.addEventListener("mouseleave", leave);
    surface.addEventListener("focus", focus);
    surface.addEventListener("blur", blur);
    return () => {
      surface.removeEventListener("mouseenter", enter);
      surface.removeEventListener("mouseleave", leave);
      surface.removeEventListener("focus", focus);
      surface.removeEventListener("blur", blur);
    };
  }, []);
  return (
    <motion.span
      ref={ref}
      className="on-arrow-nudge"
      aria-hidden="true"
      animate={{ transform: `translateX(${active && !reduced ? 3 : 0}px)` }}
      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
    >
      <IconArrowRight size={size} />
    </motion.span>
  );
}
