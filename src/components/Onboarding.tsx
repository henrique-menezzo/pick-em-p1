// First visit: a short guided tour of the map. Replayable from "How it works" in the card header.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ALL } from '../data/races';
import { useStore } from '../lib/store';
import { Icon } from './ui';

const STEPS = [
  {
    title: 'Call every race',
    body: 'There are 97 races on the map: Senate, Governor and House. Pick who you think wins each one.',
    aim: '.mapbox',
  },
  {
    title: 'Click a state to pick',
    body: 'One click picks the Republican, another switches to the Democrat, a third clears it. The panel on the right shows the two candidates — you can pick there too.',
    aim: '.pal',
  },
  {
    title: 'Track what is left',
    body: 'Every dot down here is one race. Hover to see your pick, click to jump to that state. In a hurry? Autofill uses polling averages or Polymarket odds.',
    aim: '.matrix',
  },
  {
    title: 'Save your map',
    body: 'Save any time and keep picking until election day. On election night we compare your map with the live calls, race by race.',
    aim: '.btn.save',
  },
];

export default function Onboarding() {
  const step = useStore((s) => s.tour);
  const tourDone = useStore((s) => s.tourDone);
  const setTour = useStore((s) => s.setTour);
  const picks = useStore((s) => s.picks);
  const live = useStore((s) => s.live);

  // first visit (nothing picked, tour never finished) starts it on its own
  useEffect(() => {
    if (!tourDone && step === null && !live && Object.keys(picks).length === 0) {
      const h = setTimeout(() => useStore.getState().setTour(0), 700);
      return () => clearTimeout(h);
    }
  }, [tourDone, step, live, picks]);

  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); setTour(null); }
      if (e.key === 'ArrowRight') setTour(Math.min(STEPS.length - 1, step + 1));
      if (e.key === 'ArrowLeft') setTour(Math.max(0, step - 1));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [step, setTour]);

  const s = step === null ? null : STEPS[step];
  const spot = useSpot(s?.aim);

  return createPortal(
    <AnimatePresence>
      {s && (
        <motion.div className="tour" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {/* the screen dims except for the piece this step is about */}
          <div className="tour-mask" style={spot ? { clipPath: `path(evenodd, '${maskPath(spot)}')` } : undefined} onClick={() => setTour(null)} />
          <motion.div
            className="tour-card"
            style={spot ? cardPos(spot) : { left: '50%', top: '40%', transform: 'translate(-50%,-50%)' }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            key={step}
          >
            <div className="tour-step">Step {(step ?? 0) + 1} of {STEPS.length}</div>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
            <div className="tour-foot">
              <div className="tour-dots">
                {STEPS.map((_, i) => <i key={i} className={i === step ? 'on' : ''} />)}
              </div>
              <div className="tour-btns">
                <button className="quiet" onClick={() => setTour(null)}>Skip</button>
                {step! > 0 && <button className="quiet" onClick={() => setTour(step! - 1)}>Back</button>}
                <button className="tour-next" onClick={() => (step! === STEPS.length - 1 ? setTour(null) : setTour(step! + 1))}>
                  {step! === STEPS.length - 1 ? 'Start picking' : <>Next <Icon name="arrowRight" size={14} stroke={2} /></>}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

type Spot = { x: number; y: number; w: number; h: number };
/** Measures the element this step points at, after paint, and keeps up with resizes. */
function useSpot(sel?: string): Spot | null {
  const [spot, setSpot] = useState<Spot | null>(null);
  useEffect(() => {
    if (!sel) { setSpot(null); return; }
    const measure = () => {
      const el = document.querySelector(sel);
      if (!el) return setSpot(null);
      const b = el.getBoundingClientRect();
      const pad = 10;
      setSpot({ x: b.left - pad, y: b.top - pad, w: b.width + pad * 2, h: b.height + pad * 2 });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [sel]);
  return spot;
}
function maskPath(s: Spot) {
  const r = 16;
  const { x, y, w, h } = s;
  return `M0 0H${innerWidth}V${innerHeight}H0Z M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}
function cardPos(s: Spot) {
  const W = 340, H = 210, gap = 16;
  const below = s.y + s.h + gap + H < innerHeight;
  const top = below ? s.y + s.h + gap : Math.max(gap, s.y - gap - H);
  const left = Math.min(Math.max(gap, s.x + s.w / 2 - W / 2), innerWidth - W - gap);
  return { left, top, width: W };
}

export const TOUR_STEPS = STEPS.length;
export const RACES_TOTAL = ALL.length;
