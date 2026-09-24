// First visit: a hands-on tour. Each step points at one piece and waits for you to actually do it.
// Only that one piece answers while the step is up — everything else is quiet, so there is no way to
// wander off mid-lesson. Replayable from "How it works" in the card header.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../lib/store';
import { stateShapeOnScreen } from './DotMap';
import { Icon } from './ui';

type Step = {
  title: string;
  body: string;
  aim: string;
  /** what the reader has to do to move on; absent = just press Next */
  ask?: string;
  /** returns a cleanup; call done() when the step is satisfied */
  wait?: (done: () => void) => () => void;
  /** which edge the card lines up with — its own, or the target's left / right edge */
  align?: 'start' | 'end';
  /** hang the card from the target's lower edge instead of looking for room beside it */
  dock?: 'bottom';
  /** what stays live while this step is up; absent = whatever the light is on, or nothing if the
      step has nothing to do */
  live?: string;
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
    dock: 'bottom',
  },
  {
    title: 'Click a state to pick',
    // the lesson is "click a state", so the spotlight closes in on one — Texas: big, central, and
    // impossible to miss — and the card comes to sit beside it
    body: 'Try it now: click Texas, lit below, and it becomes your Republican pick.',
    aim: '.map g[data-st="TX"]',
    live: '.map', // the map works out the state itself, so let the click through and lock it to Texas
    ask: 'Click Texas to continue',
    wait: (done) => {
      const before = Object.keys(picksOf()).length;
      return useStore.subscribe((s) => { if (Object.keys(s.picks).length > before) setTimeout(done, 320); });
    },
  },
  {
    title: 'Click again to switch',
    body: 'A second click on the same state switches it to the Democrat, a third clears it.',
    aim: '.map g[data-st="TX"]', // the same state, so the spotlight holds still while the colour changes
    live: '.map',
    ask: 'Click Texas again',
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
    align: 'end',
    ask: 'Pick a candidate in the panel',
    wait: (done) => onClickOf('.pal .cand', done),
  },
  {
    title: 'All 97 races, at a glance',
    body: 'One dot per race. Hover to see who you picked, click to jump straight to that state.',
    aim: '.matrix',
    align: 'start', // on the same line as the "Senate" label under it
    ask: 'Click any dot down here',
    wait: (done) => onClickOf('.mx-btn', done),
  },
  {
    title: 'Save your map',
    body: 'Save any time and keep picking until election day. On election night we compare your map with the live calls.',
    aim: '.btn.save',
    align: 'end', // its right edge on the button's right edge
    ask: 'Hit Save Map to finish',
    wait: (done) => onClickOf('.btn.save', done),
  },
];

export default function Onboarding({ ready = true }: { ready?: boolean }) {
  const step = useStore((s) => s.tour);
  const tourDone = useStore((s) => s.tourDone);
  const setTour = useStore((s) => s.setTour);
  const live = useStore((s) => s.live);
  const [ok, setOk] = useState(false); // the step's action just happened

  // every first visit gets the tour: the map arrives with a few races already called, so waiting for
  // an empty map meant it never ran. Only a finished (or skipped) tour, or election night, stops it.
  useEffect(() => {
    if (!ready || tourDone || step !== null || live) return;
    const h = setTimeout(() => useStore.getState().setTour(0), 420);
    return () => clearTimeout(h);
  }, [ready, tourDone, step, live]);

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

  // the tour owns the viewport: the spotlight and its card stay put, and only the tour itself moves
  // the page, when a step points at something below the fold
  useEffect(() => {
    if (step === null) return;
    const stop = (e: Event) => e.preventDefault();
    window.addEventListener('wheel', stop, { passive: false });
    window.addEventListener('touchmove', stop, { passive: false });
    return () => {
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchmove', stop);
    };
  }, [step]);

  // …and the tour owns the input, too: while a step is up, the only thing that answers is the piece
  // it is pointing at (and the card itself). Clicking a different state, or reaching for the
  // keyboard shortcuts, would take the lesson somewhere it cannot follow.
  const liveSel = s ? (s.live ?? (s.ask ? s.aim : null)) : null;
  useEffect(() => {
    if (step === null) return;
    const gate = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest) return;
      if (t.closest('.tour-card') || t.closest('.auth')) return;
      if (liveSel && t.closest(liveSel)) return;
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
    };
    const kinds = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'];
    for (const k of kinds) window.addEventListener(k, gate, true);
    return () => { for (const k of kinds) window.removeEventListener(k, gate, true); };
  }, [step, liveSel]);

  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); setTour(null); }
      // arrows and the r/d shortcuts move the selection out from under the spotlight
      else if (['ArrowRight', 'ArrowLeft', 'r', 'd', '1', '2'].includes(e.key)) e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [step, setTour]);

  const spot = useSpot(s?.aim, step);
  // when a step points at a state, the light takes the shape of the state instead of a box
  const st = s?.aim.match(/data-st="([A-Z]+)"/)?.[1] ?? null;
  // and the map only answers for that state while the step is up — '' while the tour points
  // somewhere else, so a stray click on the map does nothing at all
  useEffect(() => {
    useStore.setState({ tourLock: step === null ? null : st ?? '' });
    return () => { useStore.setState({ tourLock: null }); };
  }, [step, st]);
  const [shape, setShape] = useState<{ d: string; m: string } | null>(null);
  useLayoutEffect(() => {
    if (!st) { setShape(null); return; }
    // follow the spot: a step that has to scroll the map into view moves the state under us
    setShape(stateShapeOnScreen(st));
  }, [st, step, spot?.x, spot?.y, spot?.w]);
  const card = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 340, h: 250 });
  // the card's own size decides where it fits, so measure it instead of guessing
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const m = () => {
      const b = el.getBoundingClientRect();
      setSize((o) => (Math.abs(o.w - b.width) < 1 && Math.abs(o.h - b.height) < 1 ? o : { w: b.width, h: b.height }));
    };
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, [step, s]);

  const at = spot ? place(spot, size, s?.align, s?.dock) : null;
  const spring = { type: 'spring' as const, stiffness: 260, damping: 32, mass: 0.9 };

  return createPortal(
    <AnimatePresence>
      {s && spot && (
        <motion.div className="tour" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
          {/* one spotlight for the whole tour: it opens onto the map and then travels and resizes
              from step to step, instead of blinking out and back in. The dim is its own shadow, so
              there is nothing to keep in sync and nothing to clip per frame. */}
          <svg className="tour-dim" aria-hidden>
            <defs>
              <mask id="tour-hole">
                <rect x="0" y="0" width="100%" height="100%" fill="#fff" />
                {/* the box travels and resizes between steps… */}
                <motion.rect
                  rx={spot.r}
                  fill="#000"
                  initial={{ x: spot.x + spot.w * 0.12, y: spot.y + spot.h * 0.12, width: spot.w * 0.76, height: spot.h * 0.76, opacity: 0 }}
                  animate={{ x: spot.x, y: spot.y, width: spot.w, height: spot.h, opacity: shape ? 0 : 1 }}
                  transition={spring}
                />
                {/* …and hands over to the state's own outline when the step is about a state */}
                {shape && (
                  <motion.g fill="#000" transform={shape.m} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22 }}>
                    <path d={shape.d} />
                  </motion.g>
                )}
              </mask>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="rgba(5,5,5,.6)" mask="url(#tour-hole)" />
          </svg>
          {/* and one card, which travels with it */}
          <motion.div
            ref={card}
            className="tour-card"
            initial={{ left: at?.left, top: at?.top, opacity: 0, scale: 0.96 }}
            animate={{ left: at?.left, top: at?.top, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
            transition={spring}
          >
            {/* the words change on the spot: the card is already travelling, and fading them out
                and back in left it empty for a beat */}
            <div className="tour-step">Step {(step ?? 0) + 1} of {STEPS.length}</div>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
            {/* doing it moves you on, but Next is always there for anyone who just wants to read */}
            {s.ask && (
              <div className={'tour-ask' + (ok ? ' ok' : '')}>
                {ok ? <><Icon name="check" size={13} stroke={2.6} /> Nice</> : <><span className="pulse" /> {s.ask}</>}
              </div>
            )}
            <div className="tour-foot">
              <div className="tour-dots">{STEPS.map((_, i) => <i key={i} className={i === step ? 'on' : i < step! ? 'past' : ''} />)}</div>
              <div className="tour-btns">
                <button className="quiet" onClick={() => setTour(null)}>Skip</button>
                <button className="tour-next" onClick={next}>
                  {step! === STEPS.length - 1 ? 'Done' : <>Next <Icon name="arrowRight" size={14} stroke={2} /></>}
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

type Spot = { x: number; y: number; w: number; h: number; r: number };
const PAD = 6; // how far the lit area reaches past the element it points at
/** Measures the element this step points at, after paint, and keeps up with resizes and scrolling. */
function useSpot(sel: string | undefined, step: number | null): Spot | null {
  const [spot, setSpot] = useState<Spot | null>(null);
  const brought = useRef<string | null>(null);
  useEffect(() => {
    if (!sel) { setSpot(null); return; }
    let raf = 0;
    // a step can point at something below the fold: bring it into view once, then track it.
    // scrollIntoView misbehaves inside the scaled page wrapper, so work out the offset ourselves.
    const key = sel + ':' + step;
    if (brought.current !== key) {
      brought.current = key;
      const el = document.querySelector(sel);
      if (el) {
        const b = el.getBoundingClientRect();
        if (b.top < 64 || b.bottom > innerHeight - 24) {
          scrollTo({ top: Math.max(0, scrollY + b.top - Math.max(24, (innerHeight - b.height) / 2)), behavior: 'smooth' });
        }
      }
    }
    const measure = () => {
      const el = document.querySelector(sel);
      if (!el) return setSpot(null);
      const b = el.getBoundingClientRect();
      // take the element's own corner, so a pill is lit as a pill and a card as a card
      const br = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      const r = Math.max(10, Math.min(br, Math.min(b.width, b.height) / 2) + PAD);
      setSpot((old) => {
        const next = { x: b.left - PAD, y: b.top - PAD, w: b.width + PAD * 2, h: b.height + PAD * 2, r };
        return old && old.x === next.x && old.y === next.y && old.w === next.w && old.h === next.h && old.r === next.r ? old : next;
      });
      raf = requestAnimationFrame(measure); // the panel moves and resizes while you pick
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [sel, step]);
  return spot;
}
/**
 * Where the step card sits. It never covers the thing it points at and it never leaves the screen:
 * the four sides are tried in order of how much room each one has, and only when the spotlight is
 * so large that nothing fits beside it does the card come inside, docked low and centred — the same
 * place for every step that points at the map, so it doesn't hop about between steps.
 */
function place(s: Spot, c: { w: number; h: number }, align?: 'start' | 'end', dock?: 'bottom') {
  const M = 20, G = 14;
  const vw = innerWidth, vh = innerHeight;
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  const clampX = (l: number) => Math.min(Math.max(M, l), vw - c.w - M);
  const clampY = (t: number) => Math.min(Math.max(M, t), vh - c.h - M);
  // the spot carries PAD around the element, so line up with the element itself, not with the halo
  const x = align === 'start' ? clampX(s.x + PAD) : align === 'end' ? clampX(s.x + s.w - PAD - c.w) : clampX(cx - c.w / 2);
  // hanging from the target's lower edge, with 76px of clearance so the card never lands on the
  // prototype switch at the bottom of the window
  const hang = { left: x, top: clampY(Math.min(s.y + s.h - c.h - G, vh - c.h - M - 76)) };
  if (dock === 'bottom') return hang;
  // otherwise: under it first, then over it, then beside it — a card below what it explains reads
  // as its caption
  const sides = [
    { room: vh - (s.y + s.h), need: c.h + G + M, left: x, top: s.y + s.h + G },
    { room: s.y, need: c.h + G + M, left: x, top: s.y - G - c.h },
    { room: vw - (s.x + s.w), need: c.w + G + M, left: s.x + s.w + G, top: clampY(cy - c.h / 2) },
    { room: s.x, need: c.w + G + M, left: s.x - G - c.w, top: clampY(cy - c.h / 2) },
  ];
  const fit = sides.find((p) => p.room >= p.need);
  if (fit) return { left: fit.left, top: fit.top };
  return hang; // nothing fits beside it: hang the card from the target's lower edge
}
