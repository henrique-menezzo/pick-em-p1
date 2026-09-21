// Small hover hint for a control. Short reminders only — the step-by-step lives in the tour.
import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';

export default function Tip({ text, children }: { text: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef(0);

  const show = () => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const b = ref.current?.getBoundingClientRect();
      if (b) setAt({ x: b.left + b.width / 2, y: b.top });
    }, 350);
  };
  const hide = () => { clearTimeout(timer.current); setAt(null); };

  return (
    <>
      <span className="tip-host" ref={ref} onPointerEnter={show} onPointerLeave={hide} onPointerDown={hide}>
        {children}
      </span>
      {createPortal(
        <AnimatePresence>
          {at && (
            <motion.div
              className="hint"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 2, transition: { duration: 0.1 } }}
              transition={{ duration: 0.16 }}
              style={{ left: at.x, top: at.y - 10 }}
            >
              {text}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
