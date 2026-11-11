import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { openDialog } from "./dialog";
import { CHROME_CONTROLS, pressAttrs } from "./chrome";

export function Dialog({
  title,
  children,
  onClose,
  className,
  closeId,
  scrollId,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  closeId?: string;
  scrollId?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const root = ref.current;
    const scrim = scrimRef.current;
    if (!root || !scrim) return;
    return openDialog({
      root,
      scrim,
      close: () => closeRef.current(),
    });
  }, []);
  return (
    <div
      className={className ? "ad-scrim " + className : "ad-scrim"}
      ref={scrimRef}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="ad-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <div className="ad-depth ad-sheen" aria-hidden="true" />
        <header>
          <div>
            <span className="ad-eyebrow">TAMKANG / FIELD NOTES</span>
            <h2 className="ad-primary-label">{title}</h2>
          </div>
          <button id={closeId} type="button" className="ad-icon ad-raise-icon" {...pressAttrs("icon", "ready", "cancel")} onClick={onClose} aria-label={CHROME_CONTROLS.close}>
            <X size={20} />
          </button>
        </header>
        <div className="ad-dialog-body" id={scrollId}>{children}</div>
      </section>
    </div>
  );
}
