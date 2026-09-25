import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import us from '../data/usmap.json';
import { BY_ID, RESULTS, STATES, TAB_LABEL, raceIn, statusAt, type Side } from '../data/races';
import { useStore } from '../lib/store';
import { Icon, PARTY, facePhoto } from './ui';

// ---- geometry ------------------------------------------------------------------------------------
// The map is the one from the Figma frame: one path per state, in the frame's own coordinates.
const SHAPES = us.states as Record<string, string>;
const LABELS = us.labels as unknown as Record<string, [number, number]>;
const BOX = Object.fromEntries(
  Object.entries(us.box as Record<string, number[]>).map(([st, b]) => [st, { x0: b[0], y0: b[1], x1: b[2], y1: b[3] }]),
) as Record<string, { x0: number; y0: number; x1: number; y1: number }>;
const ORDER = Object.keys(SHAPES);
// where the map sits inside the card, exactly as in the frame
const FRAME_VB = (us.frame as number[]).join(' ');
const LABEL_SIZE = us.labelSize as number;
// the front of the entrance runs top to bottom: each state waits for the one above it
const TOP = Math.min(...Object.values(BOX).map((b) => b.y0));
const BOTTOM = Math.max(...Object.values(BOX).map((b) => b.y1));
const DELAY: Record<string, number> = {};
for (const st of ORDER) DELAY[st] = ((BOX[st].y0 - TOP) / (BOTTOM - TOP)) * 620;
type VB = { x: number; y: number; w: number; h: number };
const FULL: VB = { x: 0, y: 0, w: 1067, h: 566 };

const Q2 = new URLSearchParams(location.search);
/** ?hover=fill|seam — alternatives to the default light layer, for comparison */
const HOVER = Q2.get('hover') || '';
/** ?hov=TX,KS — hold a state in its hover state, to look at it */
const HELD = new Set((Q2.get('hov') || '').split(',').filter(Boolean));

const COLOR = { R: 'var(--R)', D: 'var(--D)', open: 'var(--dot-open)', none: 'var(--dot-none)', pending: 'var(--dot-pending)' };

// ---- one state: its shape, and its abbreviation on top -------------------------------------------
/** The piece under the pointer, drawn again on top of the whole map: three copies of itself
    stepped down for the extruded side, then the face. The one on the map below darkens, so it
    reads as the hole the piece came out of. Nothing is moved in place, so the jigsaw stays whole. */
const WALL = [9, 8, 7, 6, 5, 4, 3, 2, 1];
/** how far the piece under the pointer rises, and how much it swells doing it */
export const LIFT_Y = 10, LIFT_K = 1.018;
/** The colour arriving from under your finger: a disc of it growing inside the state's own
    outline, so a pick reads as a touch landing rather than a fill quietly swapping. */
const Splash = memo(function Splash({ st, x, y, c, n }: { st: string; x: number; y: number; c: string; n: number }) {
  const b = BOX[st];
  const r = Math.hypot(b.x1 - b.x0, b.y1 - b.y0);
  const id = `tap-${st}-${n}`;
  return (
    <g className="splash" aria-hidden>
      <clipPath id={id}><path d={SHAPES[st]} /></clipPath>
      <motion.circle
        clipPath={`url(#${id})`} cx={x} cy={y} fill={c}
        initial={{ r: 0, opacity: 0.9 }}
        animate={{ r, opacity: 0 }}
        transition={{ r: { duration: 0.52, ease: [0.2, 0.8, 0.2, 1] }, opacity: { duration: 0.52, ease: 'easeIn' } }}
      />
    </g>
  );
});

const Lift = memo(function Lift({ st, c, label, tapX, tapY, tapN }: { st: string; c: string; label: boolean; tapX?: number; tapY?: number; tapN?: number }) {
  const at = LABELS[st];
  const h = 1;
  return (
    <motion.g
      className="lift"
      aria-hidden
      initial={{ opacity: 0, y: 0, scale: 1 }}
      animate={{ opacity: 1, y: -LIFT_Y, scale: LIFT_K }}
      // running the pointer along the matrix hands the lift from one state to the next several
      // times a second, so the handover is what you actually see: the piece going down takes as
      // long as the one coming up, on the page's own easing, and the spring is softened until
      // neither end of it reads as a snap
      exit={{ opacity: 0, y: 0, scale: 1, transition: { duration: 0.26, ease: [0.2, 0.8, 0.2, 1] } }}
      transition={{ type: 'spring', stiffness: 210, damping: 28, mass: 0.9 }}
    >
      {/* the colour lives on a plain group inside the animated one: a custom property set on a
          motion element is not re-applied when it changes, so a pick made while the piece is up
          would leave it holding the colour it had when it rose */}
      <g style={{ ['--c' as string]: c }}>
        {/* the wall: the same shape stepped down and to the side, each course darker than the one
            above it, so the piece has a lit top and a face falling away from the light */}
        {WALL.map((i) => (
          <path key={i} className="lift-side" d={SHAPES[st]}
            transform={`translate(${i * 0.3 * h} ${i * 1.25 * h})`}
            style={{ filter: `brightness(${(0.82 - i * 0.055).toFixed(3)})` }} />
        ))}
        <path className="lift-top" d={SHAPES[st]} />
        {tapN ? <Splash st={st} x={tapX!} y={tapY!} c={c} n={tapN} /> : null}
        {at && (
          <text className={'lb' + (label ? ' on' : '')} x={at[0]} y={at[1]} fontSize={LABEL_SIZE} textAnchor="middle" dominantBaseline="central">
            {st}
          </text>
        )}
      </g>
    </motion.g>
  );
});

const State = memo(function State({ st, cls, c, o, label, tapX, tapY, tapN }: { st: string; cls: string; c: string; o: number; label: boolean; tapX?: number; tapY?: number; tapN?: number }) {
  const at = LABELS[st];
  return (
    <g className={'st ' + cls} data-st={st} style={{ ['--c' as string]: c, ['--d' as string]: DELAY[st] + 'ms', opacity: o }}>
      <path d={SHAPES[st]} />
      {/* the light layer: what the pointer touches catches the light, without the fill below it
          ever changing. White over the dark theme, black over the light one. */}
      <path className="hi" d={SHAPES[st]} />
      {tapN ? <Splash st={st} x={tapX!} y={tapY!} c={c} n={tapN} /> : null}
      {at && (
        <text className={'lb' + (label ? ' on' : '')} x={at[0]} y={at[1]} fontSize={LABEL_SIZE} textAnchor="middle" dominantBaseline="central">
          {st}
        </text>
      )}
    </g>
  );
});

export default function DotMap() {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const curId = useStore((s) => s.cursor[s.tab]);
  const live = useStore((s) => s.live);
  const t = useStore((s) => s.t);
  const hoverId = useStore((s) => s.hoverId);
  const pulse = useStore((s) => s.pulse);
  const tap = useStore((s) => s.tap);
  const phase = useStore((s) => s.phase);
  const tourLock = useStore((s) => s.tourLock);

  const svgRef = useRef<SVGSVGElement>(null);
  const vb = FULL;
  const [hov, setHov] = useState<{ st: string; x: number; y: number } | null>(null);

  // ---- look of every state ----
  const hoverRace = hoverId ? BY_ID[hoverId] : null;
  const curSt = BY_ID[curId]?.state ?? null;
  // There is always exactly one state under the light, and it is the race the panel on the right is
  // showing. The pointer only borrows it — a dot in the matrix, a row in "just called", the state
  // itself — and hands it straight back. So stepping through the order with the panel's arrows
  // reads the same as running the pointer along the dots: one piece up, everything else stepped
  // back. While the tour is pointing at a state, that state is the focus and nothing else moves.
  const focusSt = tourLock !== null
    ? (tourLock || null)
    : ((hoverRace && hoverRace.type === tab ? hoverRace.state : null) ?? hov?.st ?? curSt);
  const showSel = true;

  const looks = useMemo(() => {
    const out: Record<string, { cls: string; c: string; o: number; label: boolean }> = {};
    for (const st of ORDER) {
      const race = raceIn(tab, st);
      // spotlight: colours step back hard, greys only a little, so the base map never sinks into the card
      const off = !!focusSt && focusSt !== st;
      const dim = off ? 0.6 : 1;
      const dimGrey = off ? 0.8 : 1;
      // while the tour points at a state, that state is the one under the light — held there,
      // so the step opens with it already lifted instead of waiting for the pointer
      const hv = hov?.st === st || focusSt === st || HELD.has(st) || tourLock === st ? ' hov' : '';
      // No race here this chamber: now that this is a handful of states and not a region, it can
      // carry the design system's disabled colour without the map turning into a field of grey.
      if (!race) { out[st] = { cls: 'nr' + hv, c: COLOR.none, o: off ? 0.85 : 1, label: false }; continue; }
      const pick = picks[race.id];
      const sel = showSel && race.id === curId;
      if (!live) {
        const c = pick ? COLOR[pick] : COLOR.open;
        out[st] = { cls: (pick ? 'pk ' : '') + (sel ? 'sel' : '') + hv, c, o: pick ? dim : dimGrey, label: !!pick };
        continue;
      }
      const now = statusAt(race.id, t);
      if (now.status === 'called') {
        const w = RESULTS[race.id].winner;
        // right = the winner's colour at full strength; missed = the same colour, well faded back
        const miss = !!pick && pick !== w;
        out[st] = miss
          ? { cls: 'pk miss' + (sel ? ' sel' : '') + hv, c: COLOR[w], o: (sel || hv ? 0.45 : 0.22) * (off ? 0.8 : 1), label: false }
          : { cls: 'pk ' + (sel ? 'sel' : '') + hv, c: COLOR[w], o: dim, label: true };
      } else {
        // not called yet: dark grey, breathing while votes are counted
        out[st] = { cls: (now.status === 'counting' ? 'counting' : '') + (sel ? ' sel' : '') + hv, c: COLOR.pending, o: dimGrey, label: false };
      }
    }
    return out;
  }, [tab, picks, curId, live, t, focusSt, showSel, hov?.st, tourLock]);


  // ---- pop: a ripple of the state's dots when it gets a pick, or gets called on election night ----
  function ripple(st: string) {
    const el = svgRef.current?.querySelector(`g[data-st="${st}"] path`) as SVGPathElement | null;
    el?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.035)', offset: 0.4 }, { transform: 'scale(1)' }], {
      duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)',
    });
  }
  const lastPulse = useRef(pulse);
  useEffect(() => {
    for (const [id, n] of Object.entries(pulse)) {
      if (lastPulse.current[id] !== n) { const r = BY_ID[id]; if (r.type === tab) ripple(r.state); }
    }
    lastPulse.current = pulse;
  }, [pulse, tab]);
  // election night: no pop when a state is called — its colour just eases in (see .map.live in CSS)

  // ---- pointer: hit-test only ----
  const raf = useRef(0);
  const [badge, setBadge] = useState<{ id: string; n: number } | null>(null);
  const [splash, setSplash] = useState<{ st: string; x: number; y: number; n: number } | null>(null);

  // the shapes answer for themselves now: whatever is under the pointer names its own state
  const stateUnder = (e: { clientX: number; clientY: number }) =>
    (document.elementFromPoint(e.clientX, e.clientY)?.closest('g[data-st]') as SVGGElement | null)?.dataset.st ?? null;
  function onMove(e: React.PointerEvent) {
    if (e.pointerType !== 'mouse') return;
    // the pointer is on the map itself: any spotlight borrowed from the list/matrix is over
    if (useStore.getState().hoverId) useStore.getState().setHover(null);
    const cx = e.clientX, cy = e.clientY;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const st = stateUnder({ clientX: cx, clientY: cy });
      // during the tour only the lit state answers — but it answers normally, lift and all
      const lock = useStore.getState().tourLock;
      if (lock !== null && st !== lock) return setHov(null);
      setHov((h) => (st ? { st, x: cx, y: cy } : h && !st ? null : h));
    });
  }
  function onLeave() {
    cancelAnimationFrame(raf.current);
    setHov(null);
  }
  function onUp(e: React.PointerEvent) {
    const st = stateUnder(e);
    // during the tour the map answers for the state under the light, and for nothing else
    const lock = useStore.getState().tourLock;
    if (lock !== null && st !== lock) return;
    const race = st && raceIn(tab, st);
    if (!race) return;
    tap(race.id);
    setBadge({ id: race.id, n: Date.now() });
    // where the touch landed, in the map's own coordinates, for the colour to grow from
    const svg = svgRef.current;
    if (svg) {
      const m = svg.getScreenCTM();
      if (m) {
        const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
        setSplash({ st, x: pt.x, y: pt.y, n: Date.now() });
      }
    }
  }

  const hovRace = hov ? raceIn(tab, hov.st) : null;
  // the piece that is up is the one under the light. HELD is the review flag (?hov=TX)
  const liftCandidate = HOVER === 'halo' ? null : (focusSt ?? [...HELD][0] ?? null);
  // a state with no race this chamber never comes off the board — it only explains itself
  const lifted = liftCandidate && raceIn(tab, liftCandidate) ? liftCandidate : null;


  return (
    <>
      <div className={'mapbox' + (phase === 'enter' ? ' entering' : '')}>
        <svg
          ref={svgRef}
          className={'map' + (live ? ' live' : '') + (HOVER ? ' hv-' + HOVER : '') + (tourLock !== null ? ' lit' : '')}
          viewBox={FRAME_VB}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          onPointerUp={onUp}
        >
          {ORDER.map((st) => (
            // `soc` = this state has a copy of itself raised above it, so what is left on the board
            // is the socket it came out of. Only then does it darken — a state that darkens with
            // nothing above it is just a blotch, which is what it looked like in Light mode.
            <State key={st} st={st} {...looks[st]} cls={looks[st].cls + (st === lifted ? ' soc' : '')}
              tapX={splash?.st === st ? splash.x : undefined}
              tapY={splash?.st === st ? splash.y : undefined}
              tapN={splash?.st === st && lifted !== st ? splash.n : undefined} />
          ))}
          <AnimatePresence>
            {lifted && (
              <Lift key={lifted} st={lifted} c={looks[lifted].c} label={looks[lifted].label}
                tapX={splash?.st === lifted ? splash.x : undefined}
                tapY={splash?.st === lifted ? splash.y : undefined}
                tapN={splash?.st === lifted ? splash.n : undefined} />
            )}
          </AnimatePresence>
        </svg>
      </div>

      {hov && !(badge && BY_ID[badge.id].state === hov.st) &&
        createPortal(
          <div className="maptip" style={{ left: hov.x + 16, top: hov.y + 16 }}>
            {STATES[hov.st]}
            <em>{hovRace ? tipText(hovRace.id, picks[hovRace.id], live, t) : `· No ${TAB_LABEL[tab]} race this year — nothing to call`}</em>
          </div>,
          document.body,
        )}

      <PickBadge svg={svgRef} vb={vb} badge={badge} onDone={() => setBadge(null)} />
    </>
  );
}

function tipText(id: string, pick: Side | undefined, live: boolean, t: number) {
  const race = BY_ID[id];
  if (live) {
    const now = statusAt(id, t);
    if (now.status !== 'called') return now.status === 'polls' ? '· Polls open' : `· ${now.reporting}% in`;
    const w = RESULTS[id].winner;
    return `· ${race[w]} (${w})` + (pick ? (pick === w ? ' ✓' : ' ✕') : '');
  }
  return pick ? `· ${race[pick]} (${pick}) · click to switch` : '· Click to pick the winner';
}

// ---- where a floating card sits next to a state (right of it, or left when there's no room) ----------
/** A state's own outline, in screen coordinates — for anything that wants to light the state
    itself rather than box it. The matrix carries the map's placement and scale. */
export function stateShapeOnScreen(st: string): { d: string; m: string; mUp: string } | null {
  const svg = document.querySelector('svg.map') as SVGSVGElement | null;
  if (!svg || !SHAPES[st]) return null;
  const m = svg.getScreenCTM();
  if (!m) return null;
  const b = BOX[st];
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const base = `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`;
  // the raised piece AND the hole it came out of: together they are exactly the piece and its
  // wall, with none of the neighbours caught in between
  return {
    d: SHAPES[st],
    m: base,
    mUp: `${base} translate(0 ${-LIFT_Y}) translate(${cx} ${cy}) scale(${LIFT_K}) translate(${-cx} ${-cy})`,
  };
}


function anchorTo(svg: SVGSVGElement, st: string, w: number, h: number) {
  const m = svg.getScreenCTM()!;
  const b = BOX[st];
  const tl = new DOMPoint(b.x0 - 6, b.y0 - 6).matrixTransform(m);
  const br = new DOMPoint(b.x1 + 6, b.y1 + 6).matrixTransform(m);
  let side: 'l' | 'r' = 'r';
  let left = br.x + 12;
  if (left + w > window.innerWidth - 12) { left = tl.x - 12 - w; side = 'l'; }
  const top = Math.max(12, Math.min(window.innerHeight - h - 12, (tl.y + br.y) / 2 - h / 2));
  return { left: Math.max(12, left), top, side };
}

// ---- the pick you just made on the map, shown right next to the state -------------------------------
function PickBadge({ svg, vb, badge, onDone }: { svg: React.RefObject<SVGSVGElement | null>; vb: VB; badge: { id: string; n: number } | null; onDone: () => void }) {
  const pick = useStore((s) => (badge ? s.picks[badge.id] : undefined));
  const live = useStore((s) => s.live);
  const [pos, setPos] = useState<ReturnType<typeof anchorTo> | null>(null);
  const race = badge ? BY_ID[badge.id] : null;

  useLayoutEffect(() => {
    if (race && svg.current) setPos(anchorTo(svg.current, race.state, 230, 56));
  }, [race?.id, vb, svg]);
  // stays while you keep clicking, fades a moment after the last click
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!badge) return;
    const h = setTimeout(() => done.current(), 2400);
    return () => clearTimeout(h);
  }, [badge]);

  const show = race && pos && !live;
  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          key={race.id}
          className="pick-badge"
          initial={{ opacity: 0, scale: 0.92, x: pos.side === 'r' ? -6 : 6 }}
          animate={{ opacity: 1, scale: 1, x: 0, left: pos.left, top: pos.top }}
          exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          style={{ left: pos.left, top: pos.top, transformOrigin: pos.side === 'r' ? 'left center' : 'right center' }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={pick ?? 'none'}
              className={'pb-row ' + (pick ?? '')}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            >
              {pick ? (
                <>
                  <span className={'face ' + pick}><img src={facePhoto(pick)} alt="" /></span>
                  <span className="t">
                    <b>{race[pick]}</b>
                    <small>{race.stateName} · {PARTY[pick]}</small>
                  </span>
                  <span className="ck"><Icon name="check" size={11} stroke={2.8} /></span>
                </>
              ) : (
                <span className="t">
                  <b>No pick</b>
                  <small>{race.stateName} · click to pick</small>
                </span>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
