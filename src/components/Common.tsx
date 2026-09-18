// Pieces shared by the desktop and phone layouts.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { isLocked, useStore } from '../lib/store';
import { Icon } from './ui';

/** Small round reset next to Autofill: icon only, asks once (toast) before wiping the map. */
export function ResetButton({ className = 'btn reset' }: { className?: string }) {
  const resetPicks = useStore((s) => s.resetPicks);
  const say = useStore((s) => s.say);
  const any = useStore((s) => Object.keys(s.picks).length > 0);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!confirm) return;
    const h = setTimeout(() => setConfirm(false), 3000);
    return () => clearTimeout(h);
  }, [confirm]);
  return (
    <button
      className={className + (confirm ? ' confirm' : '')}
      disabled={!any || isLocked()}
      title="Reset picks"
      aria-label="Reset picks"
      onClick={() => {
        if (confirm) { resetPicks(); setConfirm(false); say('All picks cleared'); }
        else { setConfirm(true); say('Click again to reset all picks'); }
      }}
    >
      <Icon name="reset" size={18} stroke={1.9} />
    </button>
  );
}


export function Toast() {
  const toast = useStore((s) => s.toast);
  const [shown, setShown] = useState<typeof toast>(null);
  useEffect(() => {
    if (!toast) return;
    setShown(toast);
    const h = setTimeout(() => setShown(null), 2800);
    return () => clearTimeout(h);
  }, [toast]);
  return (
    <AnimatePresence>
      {shown && (
        <motion.div key={shown.n} className="toast" initial={{ opacity: 0, y: 16, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 10, x: '-50%' }} transition={{ type: 'spring', stiffness: 420, damping: 32 }} style={{ position: 'fixed' }}>
          {shown.msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
