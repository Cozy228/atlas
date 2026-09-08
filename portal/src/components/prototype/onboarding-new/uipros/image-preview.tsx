import { Dialog } from "@base-ui/react/dialog";
import { IconX, IconZoomIn } from "@tabler/icons-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";

import { useOnboardingMotion } from "../motion";
import { Button } from "./button";
import "./image-preview.css";

// UIPros App Store keeps one visual identity throughout expansion and return.
// The portal image stays above the backdrop until it reaches its thumbnail.
export function ImagePreview({ src, alt }: { src: string; alt: string }) {
  const { reduced } = useOnboardingMotion();
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState("translate(0px, 0px) scale(1)");
  const [visible, setVisible] = useState(false);
  const thumbnail = useRef<HTMLSpanElement>(null);
  const actions = useRef<Dialog.Root.Actions>(null);

  function measureOrigin() {
    const rect = thumbnail.current?.getBoundingClientRect();
    if (!rect) return;
    const expandedWidth = Math.min(1120, window.innerWidth - 128, (window.innerHeight - 192) * 1.5);
    const imageWidth = Math.min(rect.width, rect.height * 1.5);
    setOrigin(
      `translate(${rect.left + rect.width / 2 - window.innerWidth / 2}px, ${rect.top + rect.height / 2 - window.innerHeight / 2}px) scale(${imageWidth / expandedWidth})`,
    );
  }

  return (
    <figure className="on-image-preview">
      <Dialog.Root
        open={open}
        actionsRef={actions}
        onOpenChange={(next, details) => {
          measureOrigin();
          setOpen(next);
          if (next) setVisible(true);
          else if (reduced) setVisible(false);
          else details.preventUnmountOnClose();
        }}
      >
        <Dialog.Trigger className="on-image-trigger" aria-label={`Enlarge ${alt}`}>
          <span
            ref={thumbnail}
            className="on-image-shared"
            style={{ visibility: visible ? "hidden" : "visible" }}
          >
            <img src={src} alt={alt} width={1536} height={1024} loading="lazy" />
          </span>
          <span className="on-image-trigger-overlay">
            <IconZoomIn size={16} /> Enlarge image
          </span>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="on-image-backdrop" />
          <Dialog.Popup className="on-image-dialog on-image-flight-dialog">
            <div className="on-image-flight-center">
              <motion.div
                className="on-image-flight-panel"
                initial={{ transform: reduced ? "translate(0px, 0px) scale(1)" : origin }}
                animate={{ transform: open ? "translate(0px, 0px) scale(1)" : origin }}
                transition={
                  reduced ? { duration: 0 } : { type: "spring", visualDuration: 0.38, bounce: 0.06 }
                }
                onAnimationComplete={() => {
                  if (!open) {
                    setVisible(false);
                    actions.current?.unmount();
                  }
                }}
              >
                <img src={src} alt={alt} width={1536} height={1024} />
                <motion.div
                  className="on-image-toolbar"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: open ? 1 : 0 }}
                  transition={{ duration: reduced ? 0 : 0.2 }}
                >
                  <Dialog.Title>{alt}</Dialog.Title>
                  <Dialog.Close
                    render={<Button variant="ghost" size="icon" />}
                    aria-label="Close image preview"
                  >
                    <IconX size={18} />
                  </Dialog.Close>
                </motion.div>
              </motion.div>
            </div>
            <Dialog.Description className="sr-only">
              Illustrative example · Fictional application data
            </Dialog.Description>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <figcaption>{alt} · Illustrative example</figcaption>
    </figure>
  );
}
