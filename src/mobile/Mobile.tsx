// Phone layouts for review (?mobile=1|2|3). They share the store with desktop, so picks carry over.
import { memo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import grid from '../data/grid.json';
import logo from '../data/logo.svg';
import { ALL, BY_ID, RACES, TAB_LABEL, TABS, raceIn, type Race, type Side } from '../data/races';
import { useStore } from '../lib/store';
import { V, PURPOSE } from '../lib/variants';
import { Face, Flag, Icon, PARTY } from '../components/ui';

// ---- a compact, tappable dot map ------------------------------------------------------------------
const P = grid.pitch;
type Cell = { i: number; st: string; x: number; y: number; seam: boolean };
const BY_ST: Record<string, Cell[]> = {};
const OWNER = new Map<string, Cell>();
let n = 0;
for (const [st, pts] of Object.entries(grid.states as Record<string, number[][]>)) {
  BY_ST[st] = pts.map(([c, r, seam]) => {
    const cell = { i: n++, st, x: c * P, y: r * P, seam: !!seam };
    OWNER.set(c + ',' + r, cell);
    return cell;
  });
}
const ORDER = Object.keys(BY_ST);

const Dots = memo(function Dots({ st, cls, c }: { st: string; cls: string; c: string }) {
  return (
    <g className={'st ' + cls} style={{ ['--c' as string]: c }}>
      {BY_ST[st].map((d) => <circle key={d.i} cx={d.x} cy={d.y} r={grid.r} className={d.seam ? 'sm' : undefined} />)}
    </g>
  );
});

function MobileMap({ onTap }: { onTap: (id: string) => void }) {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const cur = useStore((s) => s.cursor[s.tab]);
  const ref = useRef<SVGSVGElement>(null);
  function up(e: React.PointerEvent) {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ref.current!.getScreenCTM()!.inverse());
    const c = Math.round(p.x / P), r = Math.round(p.y / P);
    let best: Cell | null = null, bd = P * 1.6;
    for (let dc = -2; dc <= 2; dc++) for (let dr = -2; dr <= 2; dr++) {
      const cell = OWNER.get(c + dc + ',' + (r + dr));
      if (!cell) continue;
      const d = Math.hypot(cell.x - p.x, cell.y - p.y);
      if (d < bd) { bd = d; best = cell; }
    }
    const race = best && raceIn(tab, best.st);
    if (race) onTap(race.id);
  }
  return (
    <svg ref={ref} className="map mmap" viewBox={`0 0 ${grid.w} ${grid.h}`} onPointerUp={up}>
      {ORDER.map((st) => {
        const race = raceIn(tab, st);
        const pick = race ? picks[race.id] : undefined;
        const sel = race?.id === cur;
        const cls = !race ? 'nr' : (pick ? 'pk ' : '') + (sel ? 'sel' : '');
        const c = !race ? 'var(--dot-none)' : pick ? `var(--${pick})` : 'var(--dot-open)';
        return <Dots key={st} st={st} cls={cls} c={c} />;
      })}
    </svg>
  );
}

// ---- shared bits ----------------------------------------------------------------------------------
function TopBar() {
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);
  return (
    <div className="m-top">
      <button className="m-icon" aria-label="Back"><Icon name="arrowLeft" size={20} /></button>
      <img src={logo} alt="Daily Wire" className="m-logo" />
      <button className="m-av" onClick={() => !user && openAuth('play')} aria-label="Account">
        {user ? user.initials : <Icon name="user" size={18} />}
      </button>
    </div>
  );
}

function Tabs() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  return (
    <div className="m-tabs">
      {TABS.map((k) => (
        <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
          {tab === k && <motion.span layoutId="m-tab" className="hl" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          {TAB_LABEL[k]}
        </button>
      ))}
    </div>
  );
}

function useProgress() {
  const picks = useStore((s) => s.picks);
  const R = ALL.filter((r) => picks[r.id] === 'R').length;
  const D = ALL.filter((r) => picks[r.id] === 'D').length;
  return { R, D, done: R + D };
}

function Progress() {
  const { R, D, done } = useProgress();
  return (
    <div className="m-prog">
      <div className="m-prog-row">
        <span><i className="R" />{R}<i className="D" />{D}</span>
        <span><b>{done}</b> of {ALL.length} picked</span>
      </div>
      <div className="m-bar"><b className="R" style={{ width: (R / ALL.length) * 100 + '%' }} /><b className="D" style={{ width: (D / ALL.length) * 100 + '%' }} /></div>
    </div>
  );
}

function Actions() {
  const autofill = useStore((s) => s.autofill);
  const save = useStore((s) => s.save);
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);
  const savedAt = useStore((s) => s.savedAt);
  const { done } = useProgress();
  const ready = done === ALL.length;
  return (
    <div className="m-actions">
      <button className="m-btn" onClick={autofill}><Icon name="wand" size={17} /> Autofill</button>
      <button className={'m-btn primary' + (ready && !savedAt ? ' ready' : '')} disabled={!ready} onClick={() => (user ? save() : openAuth('save'))}>
        {savedAt ? '✓ Saved' : 'Save Map'}
      </button>
    </div>
  );
}

function CandidateButton({ race, side, big }: { race: Race; side: Side; big?: boolean }) {
  const pick = useStore((s) => s.picks[race.id]);
  const toggle = useStore((s) => s.toggle);
  const on = pick === side, off = !!pick && !on;
  return (
    <button className={`m-cand ${side}${on ? ' on' : ''}${off ? ' off' : ''}${big ? ' big' : ''}`} onClick={() => toggle(race.id, side, { advance: true })}>
      <Face side={side} />
      <span className="t"><b>{race[side]}</b><small>{PARTY[side]}</small></span>
      {on && <span className="ck"><Icon name="check" size={13} stroke={2.8} /></span>}
    </button>
  );
}

// ---- 1 · map + bottom sheet ----------------------------------------------------------------------
function Sheet() {
  const race = useStore((s) => BY_ID[s.cursor[s.tab]]);
  const step = useStore((s) => s.step);
  const list = RACES[race.type];
  return (
    <div className="m-sheet">
      <div className="m-grab" />
      <div className="m-race">
        <Flag st={race.state} />
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.h3 key={race.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>{race.stateName}</motion.h3>
        </AnimatePresence>
        <span className="m-ix">{list.indexOf(race) + 1}/{list.length}</span>
        <button className="m-icon sm" onClick={() => step(-1)} aria-label="Previous"><Icon name="arrowLeft" size={16} /></button>
        <button className="m-icon sm" onClick={() => step(1)} aria-label="Next"><Icon name="arrowRight" size={16} /></button>
      </div>
      <div className="m-pair">
        <CandidateButton race={race} side="R" />
        <CandidateButton race={race} side="D" />
      </div>
      <Actions />
    </div>
  );
}

function LayoutSheet() {
  const tap = useStore((s) => s.tap);
  return (
    <div className="m-page">
      <TopBar />
      <div className="m-head">
        <h1>Your 2026 Map</h1>
        <p>{PURPOSE}</p>
      </div>
      <Tabs />
      <MobileMap onTap={tap} />
      <Progress />
      <Sheet />
    </div>
  );
}

// ---- 2 · one question at a time ------------------------------------------------------------------
function LayoutQuestion() {
  const race = useStore((s) => BY_ID[s.cursor[s.tab]]);
  const select = useStore((s) => s.select);
  const step = useStore((s) => s.step);
  const list = RACES[race.type];
  return (
    <div className="m-page">
      <TopBar />
      <Tabs />
      <div className="m-mini"><MobileMap onTap={select} /></div>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={race.id} className="m-q" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
          <div className="m-eyebrow">{TAB_LABEL[race.type]} · {list.indexOf(race) + 1} of {list.length}</div>
          <h2>Who wins <span><Flag st={race.state} /> {race.stateName}</span>?</h2>
          <div className="m-stack">
            <CandidateButton race={race} side="R" big />
            <CandidateButton race={race} side="D" big />
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="m-qfoot">
        <button className="m-link" onClick={() => step(1)}>Skip</button>
        <Progress />
      </div>
    </div>
  );
}

// ---- 3 · map first, floating bar -------------------------------------------------------------------
function LayoutMapFirst() {
  const tap = useStore((s) => s.tap);
  const race = useStore((s) => BY_ID[s.cursor[s.tab]]);
  const pick = useStore((s) => s.picks[s.cursor[s.tab]]);
  const { done } = useProgress();
  return (
    <div className="m-page m-full">
      <TopBar />
      <div className="m-head">
        <h1>Your 2026 Map</h1>
        <p>{done === 0 ? 'Tap a state to pick · tap again to switch' : PURPOSE}</p>
      </div>
      <Tabs />
      <div className="m-bigmap"><MobileMap onTap={tap} /></div>
      <Progress />
      <div className="m-float">
        <Flag st={race.state} />
        <span className="t">
          <b>{race.stateName}</b>
          <small className={pick ?? ''}>{pick ? `${race[pick]} · ${PARTY[pick]}` : 'Tap the state to pick'}</small>
        </span>
        <Actions />
      </div>
    </div>
  );
}

export default function Mobile() {
  return V.mobile === '2' ? <LayoutQuestion /> : V.mobile === '3' ? <LayoutMapFirst /> : <LayoutSheet />;
}
