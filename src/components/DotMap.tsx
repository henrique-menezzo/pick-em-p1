import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import grid from '../data/grid.json';
import { BY_ID, RESULTS, STATES, TAB_LABEL, raceIn, statusAt, type Side } from '../data/races';
import { useStore } from '../lib/store';
import { Icon, PARTY, facePhoto } from './ui';

// ---- geometry ------------------------------------------------------------------------------------
const P = grid.pitch;
const BASE_R = grid.r;
const W = grid.w, H = grid.h;
interface Cell { i: number; st: string; x: number; y: number; r: number; seam: boolean }
const CELLS: Cell[] = [];
const BY_ST: Record<string, Cell[]> = {};
const OWNER = new Map<string, Cell>();
const BOX: Record<string, { x0: number; y0: number; x1: number; y1: number }> = {};
for (const [st, pts] of Object.entries(grid.states as Record<string, number[][]>)) {
  BY_ST[st] = [];
  for (const [c, r, seam] of pts) {
    const cell = { i: CELLS.length, st, x: c * P, y: r * P, r: BASE_R, seam: !!seam };
    CELLS.push(cell);
    BY_ST[st].push(cell);
    OWNER.set(c + ',' + r, cell);
  }
  const xs = BY_ST[st].map((d) => d.x), ys = BY_ST[st].map((d) => d.y);
  BOX[st] = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
const ORDER = Object.keys(BY_ST);
// the wave reaches each state in turn, top to bottom with a lean to the right and a little jitter,
// so the map lands in the same rhythm as the hub's dots — per state, because animating all 4129
// circles at once is what made the entrance stutter
const IN_MS: Record<string, number> = {};
ORDER.forEach((st, i) => {
  const jitter = ((i * 2654435761) % 1000) / 1000;
  IN_MS[st] = Math.round((BOX[st].y0 / H) * 560 + (BOX[st].x0 / W) * 90 + jitter * 50);
});

type VB = { x: number; y: number; w: number; h: number };
const FULL: VB = { x: 0, y: 0, w: W, h: H };
// The map's frame inside the card (Figma: 199,98 · 966×605). The SVG covers the whole card stage and the
// dots are drawn inside that frame — there is no camera: no zoom, no panning.
const STAGE_W = 1363, STAGE_H = 792;
const FRAME = { x: 199, y: 98, w: 966 }; // centred, as in Figma; drag it out from under the panel when needed

const COLOR = { R: 'var(--R)', D: 'var(--D)', open: 'var(--dot-open)', none: 'var(--dot-none)', pending: 'var(--dot-pending)' };

// ---- one state (memoised: circles never re-render, only the group's class/colour changes) ---------
const StateDots = memo(function StateDots({ st, cls, c, o }: { st: string; cls: string; c: string; o: number }) {
  return (
    <g className={'st ' + cls} data-st={st} style={{ ['--c' as string]: c, ['--d' as string]: IN_MS[st] + 'ms', opacity: o }}>
      {BY_ST[st].map((d) => (
        <circle key={d.i} data-i={d.i} cx={d.x} cy={d.y} r={d.r} className={d.seam ? 'sm' : undefined} />
      ))}
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

  const svgRef = useRef<SVGSVGElement>(null);
  const els = useRef<SVGCircleElement[]>([]);
  const vb = FULL;
  const [hov, setHov] = useState<{ st: string; x: number; y: number } | null>(null);
  const k = FRAME.w / W; // screen px per map unit
  const outer = `${-FRAME.x / k} ${-FRAME.y / k} ${STAGE_W / k} ${STAGE_H / k}`;

  useLayoutEffect(() => {
    const list = svgRef.current!.querySelectorAll('circle');
    list.forEach((el) => { els.current[+el.dataset.i!] = el; });
  }, []);

  // ---- look of every state ----
  const hoverRace = hoverId ? BY_ID[hoverId] : null;
  // Spotlight only while hovering a race elsewhere (list row, up next, matrix dot) — never a permanent
  // focus, so every pick lights up the map as you go.
  const focusSt = hoverRace && hoverRace.type === tab ? hoverRace.state : null;
  const showSel = true;

  const looks = useMemo(() => {
    const out: Record<string, { cls: string; c: string; o: number }> = {};
    for (const st of ORDER) {
      const race = raceIn(tab, st);
      // spotlight: colours step back hard, greys only a little, so the base map never sinks into the card
      const off = !!focusSt && focusSt !== st;
      const dim = off ? 0.6 : 1;
      const dimGrey = off ? 0.8 : 1;
      const hv = hov?.st === st ? ' hov' : '';
      if (!race) { out[st] = { cls: 'nr' + hv, c: COLOR.none, o: off ? 0.85 : 1 }; continue; }
      const pick = picks[race.id];
      const sel = showSel && race.id === curId;
      if (!live) {
        const c = pick ? COLOR[pick] : COLOR.open;
        out[st] = { cls: (pick ? 'pk ' : '') + (sel ? 'sel' : '') + hv, c, o: pick ? dim : dimGrey };
        continue;
      }
      const now = statusAt(race.id, t);
      if (now.status === 'called') {
        const w = RESULTS[race.id].winner;
        // right = the winner's colour at full strength; missed = the same colour, well faded back
        const miss = !!pick && pick !== w;
        out[st] = miss
          ? { cls: 'pk miss' + (sel ? ' sel' : '') + hv, c: COLOR[w], o: (sel || hv ? 0.45 : 0.22) * (off ? 0.8 : 1) }
          : { cls: 'pk ' + (sel ? 'sel' : '') + hv, c: COLOR[w], o: dim };
      } else {
        // not called yet: dark grey, breathing while votes are counted
        out[st] = { cls: (now.status === 'counting' ? 'counting' : '') + (sel ? ' sel' : '') + hv, c: COLOR.pending, o: dimGrey };
      }
    }
    return out;
  }, [tab, picks, curId, live, t, focusSt, showSel, hov?.st]);

  // ---- pop: a ripple of the state's dots when it gets a pick, or gets called on election night ----
  function ripple(st: string) {
    const b = BOX[st];
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    for (const d of BY_ST[st]) {
      const el = els.current[d.i];
      el?.animate([{ transform: 'scale(.25)' }, { transform: 'scale(1.5)', offset: 0.55 }, { transform: 'scale(1)' }], {
        duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)', delay: Math.hypot(d.x - cx, d.y - cy) * 0.9,
      });
    }
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

  function toSvg(e: { clientX: number; clientY: number }) {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM()!.inverse());
  }
  function stateAt(p: { x: number; y: number }) {
    const c = Math.round(p.x / P), r = Math.round(p.y / P);
    let best: Cell | null = null, bd = P * 1.1;
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      const cell = OWNER.get(c + dc + ',' + (r + dr));
      if (!cell) continue;
      const d = Math.hypot(cell.x - p.x, cell.y - p.y);
      if (d < bd) { bd = d; best = cell; }
    }
    return best?.st ?? null;
  }
  function onMove(e: React.PointerEvent) {
    if (e.pointerType !== 'mouse') return;
    // the pointer is on the map itself: any spotlight borrowed from the list/matrix is over
    if (useStore.getState().hoverId) useStore.getState().setHover(null);
    const cx = e.clientX, cy = e.clientY;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const st = stateAt(toSvg({ clientX: cx, clientY: cy }));
      setHov((h) => (st ? { st, x: cx, y: cy } : h && !st ? null : h));
    });
  }
  function onLeave() {
    cancelAnimationFrame(raf.current);
    setHov(null);
  }
  function onUp(e: React.PointerEvent) {
    const st = stateAt(toSvg(e));
    const race = st && raceIn(tab, st);
    if (!race) return;
    tap(race.id);
    setBadge({ id: race.id, n: Date.now() });
  }

  const hovRace = hov ? raceIn(tab, hov.st) : null;

  return (
    <>
      <div className="mapbox">
        <svg
          ref={svgRef}
          className={'map' + (live ? ' live' : '') + (phase === 'enter' ? ' enter' : '')}
          viewBox={outer}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          onPointerUp={onUp}
          style={{ cursor: hovRace ? 'pointer' : undefined }}
        >
          {ORDER.map((st) => (
            <StateDots key={st} st={st} {...looks[st]} />
          ))}
        </svg>
      </div>

      {hov && !(badge && BY_ID[badge.id].state === hov.st) &&
        createPortal(
          <div className="maptip" style={{ left: hov.x + 16, top: hov.y + 16 }}>
            {STATES[hov.st]}
            <em>{hovRace ? tipText(hovRace.id, picks[hovRace.id], live, t) : `· No ${TAB_LABEL[tab]} race`}</em>
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
function anchorTo(svg: SVGSVGElement, st: string, w: number, h: number) {
  const m = svg.getScreenCTM()!;
  const b = BOX[st];
  const tl = new DOMPoint(b.x0 - P, b.y0 - P).matrixTransform(m);
  const br = new DOMPoint(b.x1 + P, b.y1 + P).matrixTransform(m);
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
