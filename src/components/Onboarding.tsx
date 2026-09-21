// First visit: a hands-on tour. Each step points at one piece and waits for you to actually do it —
// the app stays clickable underneath. Replayable from "How it works" in the card header.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../lib/store';
import { Icon } from './ui';

type Step = {
  title: string;
  body: string;
  aim: string;
  /** what the reader has to do to move on; absent = just press Next */
  ask?: string;
  /** returns a cleanup; call done() when the step is satisfied */
  wait?: (done: () => void) => () => void;
};

const picksOf = () => useStore.getState().picks;
const onClickOf = (sel: string, done: () => void) => {
  const h = (e: Event) => { if ((e.target as HTMLElement).closest(sel)) setTimeout(done, 220); };
  document.addEventListener('click', h, true);
  return () => document.removeEventListener('click', h, true);
};

const STEPS: Step[] = [
  {
    title: 'This is your map',
    body: 'Every dot is a state. Grey states still need a pick; the ones you call turn red or blue.',
    aim: '.mapbox',
  },
  {
    title: 'Click a state to pick',
    body: 'Try it now: click any grey state on the map and it becomes your Republican pick.',
    aim: '.mapbox',
    ask: 'Click a state to continue',
    wait: (done) => {
      const before = Object.keys(picksOf()).length;
      return useStore.subscribe((s) => { if (Object.keys(s.picks).length > before) setTimeout(done, 320); });
    },
  },
  {
    title: 'Click again to switch',
    body: 'A second click on the same state switches it to the Democrat, a third clears it.',
    aim: '.mapbox',
    ask: 'Switch one of your picks',
    wait: (done) => {
      const before = { ...picksOf() };
      return useStore.subscribe((s) => {
        const changed = Object.keys({ ...before, ...s.picks }).some((id) => before[id] && s.picks[id] !== before[id]);
        if (changed) setTimeout(done, 320);
      });
    },
  },
  {
    title: 'Or pick from the panel',
    body: 'The panel shows both candidates for the selected race. Pick one and it jumps to the next open race.',
    aim: '.pal',
    ask: 'Pick a candidate in the panel',
    wait: (done) => onClickOf('.pal .cand', done),
  },
  {
    title: 'All 97 races, at a glance',
    body: 'One dot per race. Hover to see who you picked, click to jump straight to that state.',
    aim: '.matrix',
    ask: 'Click any dot down here',
    wait: (done) => onClickOf('.mx-btn', done),
  },
  {
    title: 'Save your map',
    body: 'Save any time and keep picking until election day. On election night we compare your map with the live calls.',
    aim: '.btn.save',
    ask: 'Hit Save Map to finish',
    wait: (done) => onClickOf('.btn.save', done),
  },
];

export default function Onboarding() {
  const step = useStore((s) => s.tour);
  const tourDone = useStore((s) => s.tourDone);
  const setTour = useStore((s) => s.setTour);
  const live = useStore((s) => s.live);
  const picks = useStore((s) => s.picks);
  const [ok, setOk] = useState(false); // the step's action just happened

  // first visit (nothing picked, tour never finished) starts it on its own
  useEffect(() => {
    if (!tourDone && step === null && !live && Object.keys(picks).length === 0) {
      const h = setTimeout(() => useStore.getState().setTour(0), 700);
      return () => clearTimeout(h);
    }
  }, [tourDone, step, live, picks]);

  const s = step === null ? null : STEPS[step];
  const next = () => (step! >= STEPS.length - 1 ? setTour(null) : setTour(step! + 1));
  const nextRef = useRef(next);
  nextRef.current = next;

  // wait for the reader to do the thing, then move on by itself
  useEffect(() => {
    setOk(false);
    if (!s?.wait) return;
    let done = false;
    const stop = s.wait(() => {
      if (done) return;
      done = true;
      setOk(true);
      setTimeout(() => nextRef.current(), 600);
    });
    return stop;
  }, [step, s]);

  // the sign-up sheet takes over from here — don't leave the tour card fighting with it
  const authOpen = useStore((st) => !!st.auth);
  useEffect(() => { if (authOpen && step !== null) setTour(null); }, [authOpen, step, setTour]);

  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); setTour(null); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [step, setTour]);

  const spot = useSpot(s?.aim, step);

  return createPortal(
    <AnimatePresence>
      {s && (
        <motion.div className="tour" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {/* the dim never blocks the app: the whole point is that you try it while the tour talks */}
          <div className="tour-mask" style={spot ? { clipPath: `path(evenodd, '${maskPath(spot)}')` } : undefined} />
          {spot && <div className="tour-ring" style={{ left: spot.x, top: spot.y, width: spot.w, height: spot.h }} />}
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
              <div className="tour-dots">{STEPS.map((_, i) => <i key={i} className={i === step ? 'on' : i < step! ? 'past' : ''} />)}</div>
              <div className="tour-btns">
                <button className="quiet" onClick={() => setTour(null)}>Skip</button>
                {s.ask ? (
                  <span className={'tour-ask' + (ok ? ' ok' : '')}>
                    {ok ? <><Icon name="check" size={13} stroke={2.6} /> Nice</> : s.ask}
                  </span>
                ) : (
                  <button className="tour-next" onClick={next}>Next <Icon name="arrowRight" size={14} stroke={2} /></button>
                )}
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
/** Measures the element this step points at, after paint, and keeps up with resizes and scrolling. */
function useSpot(sel: string | undefined, step: number | null): Spot | null {
  const [spot, setSpot] = useState<Spot | null>(null);
  useEffect(() => {
    if (!sel) { setSpot(null); return; }
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(sel);
      if (!el) return setSpot(null);
      const b = el.getBoundingClientRect();
      const pad = 10;
      setSpot((old) => {
        const next = { x: b.left - pad, y: b.top - pad, w: b.width + pad * 2, h: b.height + pad * 2 };
        return old && old.x === next.x && old.y === next.y && old.w === next.w && old.h === next.h ? old : next;
      });
      raf = requestAnimationFrame(measure); // the panel moves and resizes while you pick
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [sel, step]);
  return spot;
}
function maskPath(s: Spot) {
  const r = 16;
  const { x, y, w, h } = s;
  return `M0 0H${innerWidth}V${innerHeight}H0Z M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}
function cardPos(s: Spot) {
  const W = 340, H = 220, gap = 16;
  const below = s.y + s.h + gap + H < innerHeight;
  const top = below ? s.y + s.h + gap : Math.max(gap, s.y - gap - H);
  const left = Math.min(Math.max(gap, s.x + s.w / 2 - W / 2), innerWidth - W - gap);
  return { left, top, width: W };
}
