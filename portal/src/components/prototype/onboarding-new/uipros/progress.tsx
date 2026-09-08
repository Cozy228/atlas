import { motionEase, motionDuration, useOnboardingMotion } from "../motion";
// Adapted from UIPros motion-ui/motion-ui/progress-bar/index.tsx.
import { motion } from "motion/react";
export function SetupProgress({ completed, total }: { completed: number; total: number }) {
  const { reduced: reducedMotion } = useOnboardingMotion();
  return (
    <div
      className="on-progress"
      role="progressbar"
      aria-label="Onboarding completion"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={completed}
      aria-valuetext={`${completed} of ${total} tasks completed`}
    >
      <motion.div
        initial={false}
        animate={{ transform: `scaleX(${completed / total})` }}
        transition={{
          duration: reducedMotion ? 0 : motionDuration.disclosure,
          ease: motionEase.move,
        }}
      />
    </div>
  );
}
