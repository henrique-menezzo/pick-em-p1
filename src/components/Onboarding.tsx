// First visit: a hands-on tour. Each step points at one piece and waits for you to actually do it.
// Only that one piece answers while the step is up — everything else is quiet, so there is no way to
// wander off mid-lesson. Replayable from "How it works" in the card header.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ALL } from '../data/races';
import { useStore } from '../lib/store';
import { MAP_SHAPES, stateShapeOnScreen } from './DotMap';
import { MAP_DOTS, stateDotsOnScreen } from './DotGrid';
import { Icon } from './ui';

type Step = {
  title: string;
  body: string;
  /** what the light is on. A list is allowed: only one layout is in the document at a time, so
      '.matrix, .m-matrix' means "the desktop one, or the phone one" without asking which. */
  aim: string;
  /** what the reader has to do to move on; absent = just press Next */
  ask?: string;
  /** returns a cleanup; call done() when the step is satisfied */
  wait?: (done: () => void) => () => void;
  /** which edge the card lines up with — its own, or the target's left / right edge */
  align?: 'start' | 'end';
  /** where the card goes relative to the light: 'bottom' hangs it inside the target's lower edge,
      'under' puts it below the target outright, whether or not the room check likes it */
  dock?: 'bottom' | 'under';
  /** what stays live while this step is up; absent = whatever the light is on, or nothing if the
      step has nothing to do */
  live?: string;
  /** light the country the map has drawn rather than the box it is drawn in — the box is the whole
      card stage, half of it empty margin, so lighting it marks nothing you can see */
  fit?: 'states';
  /** hang the card off this instead of off what the light is on. The first step lights the whole
      map, and a card hung from the map's own bottom edge sits higher than the one the next step
      puts beside Texas — so the card jumps the moment you press Next. Same anchor, no jump. */
  anchor?: string;
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
    body: 'Every state on it is a race. The grey ones are still open — the ones you call turn red or blue.',
    aim: '.mapbox, .m-stage',
    fit: 'states',
    // under the country and centred on it: this step is about the map as a whole, and a card laid
    // over the middle hides the thing it is introducing
    dock: 'under',
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
    aim: '.pal, .m-sheet',
    align: 'end',
    ask: 'Pick a candidate in the panel',
    wait: (done) => onClickOf('.pal .cand', done),
  },
  {
    title: `All ${ALL.length} races, at a glance`,
    body: 'One dot per race. Hover to see who you picked, click to jump straight to that state.',
    aim: '.matrix, .m-matrix',
    align: 'start', // on the same line as the "Senate" label under it
    ask: 'Click any dot down here',
    wait: (done) => onClickOf('.mx-btn', done),
  },
  {
    title: 'Save your map',
    body: 'Save any time and keep picking until election day. On election night we compare your map with the live calls.',
    aim: '.btn.save, .m-btn.primary',
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

  const spot = useSpot(s?.aim, step, s?.fit);
  // where the card goes, which is not always what the light is on
  const anchor = useSpot(s?.anchor, step);
  // when a step points at a state, the light takes the shape of the state instead of a box
  const st = s?.aim.match(/data-st="([A-Z]+)"/)?.[1] ?? null;
  // and the map only answers for that state while the step is up — '' while the tour points
  // somewhere else, so a stray click on the map does nothing at all
  useEffect(() => {
    useStore.setState({ tourLock: step === null ? null : st ?? '' });
    return () => { useStore.setState({ tourLock: null }); };
  }, [step, st]);
  // the hole takes the shape of the state, whichever map is drawing it: an outline for the shapes,
  // the state's own dots fattened until they merge for the grid
  const mapKind = useStore((x) => x.mapKind);
  const [shape, setShape] = useState<{ d: string; m: string; mUp: string } | null>(null);
  const [dots, setDots] = useState<{ cx: number; cy: number; r: number }[] | null>(null);
  useLayoutEffect(() => {
    if (!st) { setShape(null); setDots(null); return; }
    // follow the spot: a step that has to scroll the map into view moves the state under us
    setShape(mapKind === 'dots' ? null : stateShapeOnScreen(st));
    setDots(mapKind === 'dots' ? stateDotsOnScreen(st) : null);
  }, [st, step, mapKind, spot?.x, spot?.y, spot?.w]);
  // The whole country, when the step is about the map rather than one state: the same idea as
  // lighting a single state, with every state in the hole at once. A rectangle around the map is
  // not the map — it takes in the panel, the tabs and a lot of empty card.
  // Only the matrix is tracked, on every frame: the step scrolls the map into view, and a hole
  // measured once ends up floating where the map used to be.
  const all = s?.fit === 'states';
  const mapCut = useMapCut(all, mapKind);
  const cut = !!(shape || dots || (all && mapCut));
  const card = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 340, h: 250 });
  // the card's own size decides where it fits, so measure it instead of guessing
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const m = () => {
      const b = el.getBoundingClientRect();
      // a zero measurement is the card on its way out, not a card 0px wide. Keeping it meant the
      // next opening centred the card on a width of nothing, which put it half a card to the right
      if (!b.width || !b.height) return;
      setSize((o) => (Math.abs(o.w - b.width) < 1 && Math.abs(o.h - b.height) < 1 ? o : { w: b.width, h: b.height }));
    };
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
    // `spot` too: the card only renders once there is a spot to put it on, so on the first step
    // this effect ran before the card existed, found nothing to measure, and left the placement
    // working from the default 250px — which is why the first view sat 18px off every later one
  }, [step, s, !!spot]);

  const phone = usePhoneTour();
  const at = spot ? (phone ? dockPhone(spot, size) : place(anchor ?? spot, size, s?.align, s?.dock)) : null;
  const spring = { type: 'spring' as const, stiffness: 260, damping: 32, mass: 0.9 };

  return createPortal(
    <AnimatePresence>
      {s && spot && (
        <motion.div className={'tour' + (phone ? ' phone' : '')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
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
                  animate={{ x: spot.x, y: spot.y, width: spot.w, height: spot.h, opacity: cut ? 0 : 1 }}
                  transition={spring}
                />
                {/* …and hands over to the state's own outline when the step is about a state */}
                {shape && (
                  <motion.g fill="#000" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22 }}>
                    <path d={shape.d} transform={shape.m} />
                    <path d={shape.d} transform={shape.mUp} />
                  </motion.g>
                )}
                {dots && (
                  <motion.g fill="#000" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22 }}>
                    {dots.map((d, i) => <circle key={i} cx={d.cx} cy={d.cy} r={d.r} />)}
                  </motion.g>
                )}
                {/* a plain group, not a motion one: inside a <mask> nothing is laid out, and the
                    opacity motion writes on mount never animates away — the hole stays shut */}
                {all && mapCut && (
                  <>
                    <g fill="#000" transform={mapCut.m}>
                      {mapKind === 'dots'
                        ? MAP_DOTS.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} />)
                        : MAP_SHAPES.map((d, i) => <path key={i} d={d} stroke="#000" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
                    </g>
                    {/* and give back the strip the panel covers: white paints the dim on again */}
                    {mapCut.over && (
                      <rect fill="#fff" x={mapCut.over.x} y={mapCut.over.y} width={mapCut.over.w} height={mapCut.over.h} rx={mapCut.over.r} />
                    )}
                  </>
                )}
              </mask>
            </defs>
            {/* the whole page steps back and only what the step points at is left lit. No transform
                on this rect, ever: a transform on a masked element drags the mask's contents with
                it, and the hole ends up that far from the thing it is meant to be cut around */}
            <rect x="0" y="0" width="100%" height="100%" style={{ fill: 'var(--tour-dim)' }} mask="url(#tour-hole)" />
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
/** The union of every state the map has drawn, in screen coordinates. Works for either map: one
 *  group per state in both, shapes in one and dots in the other. */
function statesBox() {
  const gs = document.querySelectorAll('svg.map g[data-st]');
  if (!gs.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  gs.forEach((g) => {
    const r = (g as SVGGElement).getBoundingClientRect();
    if (!r.width || !r.height) return;
    x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top);
    x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
  });
  return x1 > x0 ? { left: x0, top: y0, width: x1 - x0, height: y1 - y0 } : null;
}

/** What a map-wide step needs, read every frame: the map's own screen matrix — it sits inside a
 *  scaled wrapper and the step may scroll it — and the panel that floats on top of it. The map
 *  runs under that panel, and lighting the country through it would say the panel is part of what
 *  the step is pointing at. It is not; it is the thing in front. */
function useMapCut(on: boolean, kind: 'shape' | 'dots') {
  const [cut, setCut] = useState<{ m: string; over: { x: number; y: number; w: number; h: number; r: number } | null } | null>(null);
  useEffect(() => {
    if (!on) { setCut(null); return; }
    let raf = 0;
    const read = () => {
      const svg = document.querySelector(kind === 'dots' ? 'svg.map.dots' : 'svg.map') as SVGSVGElement | null;
      const c = svg?.getScreenCTM();
      if (c) {
        const m = `matrix(${c.a},${c.b},${c.c},${c.d},${c.e},${c.f})`;
        const el = document.querySelector('.pal-anchor > *');
        let over: { x: number; y: number; w: number; h: number; r: number } | null = null;
        if (el) {
          const b = el.getBoundingClientRect();
          const br = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
          over = { x: b.left, y: b.top, w: b.width, h: b.height, r: Math.min(br, Math.min(b.width, b.height) / 2) };
        }
        setCut((old) => (old && old.m === m && JSON.stringify(old.over) === JSON.stringify(over) ? old : { m, over }));
      }
      raf = requestAnimationFrame(read);
    };
    read();
    return () => cancelAnimationFrame(raf);
  }, [on, kind]);
  return cut;
}

/** A phone is not a small desktop. There is no room to put a 340px card beside anything, and a
 *  card that hops around the screen from step to step is unreadable on a small one — you lose
 *  where you were. So on a phone the card is a bar: full width, docked, and it only ever moves
 *  between two places — the bottom, or the top when what the step points at is down there. */
function usePhoneTour() {
  const q = '(max-width: 760px)';
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

function dockPhone(s: Spot, c: { w: number; h: number }) {
  const M = 12;
  const low = s.y + s.h / 2 > innerHeight / 2;
  return { left: M, top: low ? M : Math.max(M, innerHeight - c.h - M) };
}

function useSpot(sel: string | undefined, step: number | null, fit?: 'states'): Spot | null {
  const [spot, setSpot] = useState<Spot | null>(null);
  const brought = useRef<string | null>(null);
  useEffect(() => {
    // the tour is closed: forget what we last scrolled into view, so replaying it from "How it
    // works" starts from the same place a first visit does instead of skipping the scroll
    if (!sel) { brought.current = null; setSpot(null); return; }
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
          // instantly, not smoothly: the card is placed from a measurement taken right after this,
          // and a scroll still in flight puts it somewhere between where it was and where it is
          // going — which is why the same step landed in a different place on a replay
          scrollTo({ top: Math.max(0, scrollY + b.top - Math.max(24, (innerHeight - b.height) / 2)), behavior: 'auto' });
        }
      }
    }
    const measure = () => {
      const el = document.querySelector(sel);
      if (!el) return setSpot(null);
      const b = (fit === 'states' ? statesBox() : null) ?? el.getBoundingClientRect();
      // take the element's own corner, so a pill is lit as a pill and a card as a card
      const br = fit === 'states' ? 24 : parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      const r = Math.max(10, Math.min(br, Math.min(b.width, b.height) / 2) + PAD);
      setSpot((old) => {
        const next = { x: b.left - PAD, y: b.top - PAD, w: b.width + PAD * 2, h: b.height + PAD * 2, r };
        return old && old.x === next.x && old.y === next.y && old.w === next.w && old.h === next.h && old.r === next.r ? old : next;
      });
      raf = requestAnimationFrame(measure); // the panel moves and resizes while you pick
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [sel, step, fit]);
  return spot;
}
/**
 * Where the step card sits. It never covers the thing it points at and it never leaves the screen:
 * the four sides are tried in order of how much room each one has, and only when the spotlight is
 * so large that nothing fits beside it does the card come inside, docked low and centred — the same
 * place for every step that points at the map, so it doesn't hop about between steps.
 */
function place(s: Spot, c: { w: number; h: number }, align?: 'start' | 'end', dock?: 'bottom' | 'under') {
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
  // below the target, full stop. The room check below would give up and lay the card over the
  // thing it is describing, which is exactly what we do not want for the map.
  if (dock === 'under') return { left: x, top: clampY(s.y + s.h + G) };
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
