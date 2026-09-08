import { useReducedMotion, type Transition } from "motion/react";
import { createContext, useContext } from "react";

export const KeyboardMotionContext = createContext(false);
export function useOnboardingMotion() {
  const keyboard = useContext(KeyboardMotionContext);
  const reduced = useReducedMotion();
  return { keyboard, reduced: keyboard || reduced };
}

export const motionEase = {
  out: [0.23, 1, 0.32, 1],
  move: [0.77, 0, 0.175, 1],
  drawer: [0.32, 0.72, 0, 1],
} satisfies Record<string, Transition["ease"]>;

// The longer task transition is intentional for the onboarding reading flow.
export const motionDuration = {
  feedback: 0.15,
  disclosure: 0.2,
  layout: 0.25,
  task: 0.42,
  sheet: 0.5,
};
