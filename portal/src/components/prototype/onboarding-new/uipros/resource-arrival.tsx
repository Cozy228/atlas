// Adapted from UIPros motion-ui/motion-ui/add-to-basket/index.tsx.
import { arc, motion, useAnimate } from "motion/react";
import { useImperativeHandle, useRef, type Ref } from "react";
import { IconFile } from "@tabler/icons-react";
import { useOnboardingMotion } from "../motion";

export type ResourceArrivalHandle = {
  fly: (from: DOMRect, target: HTMLElement) => void;
  cancel: () => void;
};
export function ResourceArrival({ ref }: { ref: Ref<ResourceArrivalHandle> }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const { reduced } = useOnboardingMotion();
  const busy = useRef(false);
  const playback = useRef<{ stop: () => void } | null>(null);
  const generation = useRef(0);
  useImperativeHandle(
    ref,
    () => ({
      cancel() {
        generation.current++;
        playback.current?.stop();
        if (scope.current) scope.current.style.opacity = "0";
        busy.current = false;
      },
      fly(from, target) {
        if (reduced || busy.current || !scope.current) return;
        busy.current = true;
        const run = ++generation.current;
        const to = target.getBoundingClientRect();
        const startX = from.left + from.width / 2 - 16;
        const startY = from.top + from.height / 2 - 16;
        const endX = to.left + to.width / 2 - 16;
        const endY = to.top + to.height / 2 - 16;
        void (async () => {
          try {
            await animate(
              scope.current,
              { x: startX, y: startY, scale: 1, opacity: 1 },
              { duration: 0 },
            );
            const flight = animate(
              scope.current,
              { x: endX, y: endY, scale: to.width / 32, opacity: [1, 1, 0] },
              {
                duration: 0.6,
                path: arc({ strength: 0.5, peak: 0.15, rotate: 0.9 }),
                ease: [0.74, 0.18, 0.93, 0.69],
                opacity: { inherit: true, times: [0, 0.95, 1] },
              },
            );
            playback.current = flight;
            await flight;
            if (generation.current !== run) return;
            if (target.isConnected) {
              const ring = target.querySelector<HTMLElement>(".on-resource-ripple");
              if (ring)
                void animate(
                  ring,
                  { transform: ["scale(1)", "scale(2.2)"], opacity: [0.6, 0] },
                  { duration: 0.4 },
                );
              await animate(
                target,
                { transform: ["translateY(-2px)", "translateY(0px)"] },
                { type: "spring", stiffness: 400, damping: 22 },
              );
            }
          } finally {
            if (generation.current === run) busy.current = false;
          }
        })();
      },
    }),
    [animate, reduced, scope],
  );
  return (
    <motion.div
      ref={scope}
      className="on-resource-flight pointer-events-none fixed top-0 left-0 z-90 grid size-8 place-items-center rounded border border-muted-foreground bg-card text-foreground"
      initial={{ opacity: 0 }}
      aria-hidden="true"
    >
      <IconFile size={20} />
    </motion.div>
  );
}
