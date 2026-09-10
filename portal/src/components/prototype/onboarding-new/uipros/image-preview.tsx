import { Dialog } from "@base-ui/react/dialog";
import { IconX, IconZoomIn, IconZoomOut } from "@tabler/icons-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { useOnboardingMotion } from "../motion";
import { Button } from "./button";

export function ImagePreview({
  src,
  alt,
  thumbnailHeight = 320,
}: {
  src: string;
  alt: string;
  thumbnailHeight?: CSSProperties["height"];
}) {
  return <Preview key={src} src={src} alt={alt} thumbnailHeight={thumbnailHeight} />;
}

function Preview({
  src,
  alt,
  thumbnailHeight,
}: {
  src: string;
  alt: string;
  thumbnailHeight: CSSProperties["height"];
}) {
  const { reduced } = useOnboardingMotion();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [origin, setOrigin] = useState("translate(0px, 0px) scale(1)");
  const [zoom, setZoom] = useState(1);
  const thumbnail = useRef<HTMLSpanElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const actions = useRef<Dialog.Root.Actions>(null);
  const fitScale = natural.width
    ? Math.min(
        1,
        Math.max(1, viewport.width - 32) / natural.width,
        Math.max(1, viewport.height - 128) / natural.height,
      )
    : 1;
  const width = natural.width * fitScale;
  const height = natural.height * fitScale;
  const maxZoom = Math.max(4, 1 / fitScale);

  useEffect(() => {
    const resize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setZoom(1);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function measureOrigin() {
    const rect = thumbnail.current?.getBoundingClientRect();
    if (!rect || !natural.width) return;
    const scale = Math.min(rect.width / natural.width, rect.height / natural.height);
    setOrigin(
      `translate(${rect.left + rect.width / 2 - viewport.width / 2}px, ${rect.top + rect.height / 2 - viewport.height / 2 - (24 * scale) / fitScale}px) scale(${scale / fitScale})`,
    );
  }

  return (
    <figure className="on-image-preview @container my-6">
      <Dialog.Root
        open={open}
        actionsRef={actions}
        onOpenChange={(next, details) => {
          measureOrigin();
          setZoom(1);
          setOpen(next);
          if (next) setVisible(true);
          else if (reduced) setVisible(false);
          else details.preventUnmountOnClose();
        }}
      >
        <Dialog.Trigger
          className="on-image-trigger relative block w-full cursor-zoom-in overflow-hidden rounded border border-border bg-card p-0"
          disabled={!natural.width}
          aria-label={`Enlarge ${alt}`}
        >
          <span
            ref={thumbnail}
            className="on-image-shared relative flex w-full items-center justify-center overflow-hidden rounded-md bg-card"
            style={{ height: thumbnailHeight, visibility: visible ? "hidden" : "visible" }}
          >
            <img
              src={src}
              alt={alt}
              className="block size-full object-contain"
              loading="lazy"
              onLoad={(event) =>
                setNatural({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
            />
          </span>
          <span className="on-image-trigger-overlay pointer-events-none absolute right-2 bottom-2 flex items-center gap-2 rounded-md border border-border bg-card p-1 text-xs text-foreground">
            <IconZoomIn size={16} />
            <span className="@max-[200px]:hidden">Enlarge image</span>
          </span>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="on-image-backdrop fixed inset-0 z-60 bg-overlay/40 opacity-100 transition-opacity duration-200 ease-[var(--on-ease-out)] data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none" />
          <Dialog.Popup className="on-image-dialog on-image-flight-dialog pointer-events-none fixed inset-0 z-[61] size-full max-h-none overflow-hidden rounded bg-transparent p-0 text-foreground outline-none">
            <div
              className="on-image-flight-center absolute top-1/2 left-1/2 -translate-1/2"
              style={{
                width: Math.max(width, Math.min(320, viewport.width - 32)),
                height: height + 48,
              }}
            >
              <motion.div
                className="on-image-flight-panel size-full overflow-hidden rounded-md bg-card"
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
                <div className="on-image-toolbar pointer-events-auto relative z-2 m-0 flex h-12 shrink-0 items-center justify-between gap-1 border-b border-border bg-card px-2 py-1 [&_button]:shrink-0">
                  <Dialog.Title className="m-0 min-w-0 flex-1 truncate text-sm leading-6 font-semibold">
                    {alt}
                  </Dialog.Title>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Zoom out"
                    disabled={zoom <= 1}
                    onClick={() => setZoom(Math.max(1, zoom / 2))}
                  >
                    <IconZoomOut size={18} />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setZoom(1)}
                    aria-label="Fit image to window"
                  >
                    Fit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Zoom in"
                    disabled={zoom >= maxZoom}
                    onClick={() => setZoom(Math.min(maxZoom, zoom * 2))}
                  >
                    <IconZoomIn size={18} />
                  </Button>
                  <Dialog.Close
                    render={<Button variant="ghost" size="icon" />}
                    aria-label="Close image preview"
                  >
                    <IconX size={18} />
                  </Dialog.Close>
                </div>
                <div className="on-image-stage relative w-full" style={{ height }}>
                  <img
                    src={src}
                    alt={alt}
                    className="pointer-events-auto block size-full object-contain"
                    style={{ visibility: zoom > 1 ? "hidden" : "visible" }}
                  />
                  {zoom > 1 && (
                    <div
                      ref={scroller}
                      className="on-image-zoom pointer-events-auto absolute inset-0 cursor-grab overflow-auto overscroll-contain active:cursor-grabbing"
                      tabIndex={0}
                      role="region"
                      aria-label="Zoomed image. Scroll or drag to pan."
                      onPointerDown={(event) => {
                        if (event.pointerType === "touch" || event.button !== 0) return;
                        const el = event.currentTarget;
                        drag.current = {
                          x: event.clientX,
                          y: event.clientY,
                          left: el.scrollLeft,
                          top: el.scrollTop,
                        };
                        el.setPointerCapture(event.pointerId);
                      }}
                      onPointerMove={(event) => {
                        if (drag.current) {
                          event.currentTarget.scrollLeft =
                            drag.current.left + drag.current.x - event.clientX;
                          event.currentTarget.scrollTop =
                            drag.current.top + drag.current.y - event.clientY;
                        }
                      }}
                      onPointerUp={() => {
                        drag.current = null;
                      }}
                      onLostPointerCapture={() => {
                        drag.current = null;
                      }}
                    >
                      <img
                        src={src}
                        alt={alt}
                        className="m-auto block max-h-none max-w-none select-none"
                        draggable={false}
                        style={{ width: width * zoom, height: height * zoom }}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
            <Dialog.Description className="sr-only">
              Use the zoom controls to inspect details. Scroll or drag the enlarged image to pan.
              Press Escape to close.
            </Dialog.Description>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <figcaption className="mt-2 text-xs leading-6 text-muted-foreground">
        {alt} · Illustrative example
      </figcaption>
    </figure>
  );
}
