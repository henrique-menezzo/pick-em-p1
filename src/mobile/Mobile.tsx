// Phone layouts for review (?mobile=1|2|3). They share the store with desktop, so picks carry over.
import { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import grid from '../data/grid.json';
import us from '../data/usmap.json';
import { Wordmark } from '../components/Nav';
import { ALL, BY_ID, RACES, RESULTS, TAB_LABEL, TABS, T_MAX, clock, raceIn, statusAt, type Race, type Side } from '../data/races';
import { liveScore, useStore } from '../lib/store';
import DeadLine from '../components/LockLine';
import { V, PURPOSE } from '../lib/variants';
import { Face, Flag, Icon, PARTY, liveLine } from '../components/ui';
import { ResetButton } from '../components/Common';

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

// ---- and the same country as shapes, which is map 1 on the desktop ---------------------------
// The desktop draws this inside its 1440 stage, with the country floating in a lot of empty frame.
// A phone has no room for that, so here the viewBox is the country itself and nothing else.
const SHAPES = us.states as Record<string, string>;
const LABELS = us.labels as unknown as Record<string, [number, number]>;
const SHAPE_VB = '0 0 1067 566';

const Shape = memo(function Shape({ st, cls, c, o, label }: { st: string; cls: string; c: string; o: number; label: boolean }) {
  const at = LABELS[st];
  return (
    <g className={'st ' + cls} data-st={st} style={{ ['--c' as string]: c, opacity: o }}>
      <path d={SHAPES[st]} />
      {at && (
        <text className={'lb' + (label ? ' on' : '')} x={at[0]} y={at[1]} fontSize={us.labelSize} textAnchor="middle" dominantBaseline="central">
          {st}
        </text>
      )}
    </g>
  );
});

const Dots = memo(function Dots({ st, cls, c, o }: { st: string; cls: string; c: string; o: number }) {
  return (
    <g className={'st ' + cls} style={{ ['--c' as string]: c, opacity: o }}>
      {BY_ST[st].map((d) => <circle key={d.i} cx={d.x} cy={d.y} r={grid.r} className={d.seam ? 'sm' : undefined} />)}
    </g>
  );
});

function MobileMap({ onTap }: { onTap: (id: string) => void }) {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const cur = useStore((s) => s.cursor[s.tab]);
  const live = useStore((s) => s.live);
  const t = useStore((s) => s.t);
  const kind = useStore((s) => s.mapKind);
  const ref = useRef<SVGSVGElement>(null);

  /** which state a tap landed on. Shapes answer for themselves; the grid needs the nearest cell,
      with a fat radius because a finger is not a pointer. */
  function stateAt(e: React.PointerEvent) {
    if (kind === 'shape') {
      const g = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest('g[data-st]');
      return (g as SVGGElement | null)?.dataset.st ?? null;
    }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ref.current!.getScreenCTM()!.inverse());
    const c = Math.round(p.x / P), r = Math.round(p.y / P);
    let best: Cell | null = null, bd = P * 1.6;
    for (let dc = -2; dc <= 2; dc++) for (let dr = -2; dr <= 2; dr++) {
      const cell = OWNER.get(c + dc + ',' + (r + dr));
      if (!cell) continue;
      const d = Math.hypot(cell.x - p.x, cell.y - p.y);
      if (d < bd) { bd = d; best = cell; }
    }
    return best?.st ?? null;
  }
  function up(e: React.PointerEvent) {
    const st = stateAt(e);
    const race = st && raceIn(tab, st);
    if (race) onTap(race.id);
  }

  // one description of how a state looks, whichever way it is drawn
  function look(st: string) {
    const race = raceIn(tab, st);
    const pick = race ? picks[race.id] : undefined;
    const sel = race?.id === cur;
    if (!race) return { cls: 'nr', c: 'var(--dot-none)', o: 1, label: false };
    if (live) {
      const now = statusAt(race.id, t);
      if (now.status === 'called') {
        const w = RESULTS[race.id].winner;
        const miss = !!pick && pick !== w;
        return { cls: 'pk' + (sel ? ' sel' : ''), c: `var(--${w})`, o: miss ? (sel ? 0.45 : 0.22) : 1, label: !miss };
      }
      return { cls: (now.status === 'counting' ? 'counting' : '') + (sel ? ' sel' : ''), c: 'var(--dot-pending)', o: 1, label: false };
    }
    return {
      cls: (pick ? 'pk ' : '') + (sel ? 'sel' : ''),
      c: pick ? `var(--${pick})` : 'var(--dot-open)',
      o: 1,
      label: !!pick,
    };
  }

  return (
    <svg
      ref={ref}
      className={'map mmap' + (kind === 'dots' ? ' dots' : ' shapes') + (live ? ' live' : '')}
      viewBox={kind === 'dots' ? `0 0 ${grid.w} ${grid.h}` : SHAPE_VB}
      onPointerUp={up}
    >
      {ORDER.map((st) => {
        const l = look(st);
        return kind === 'dots'
          ? <Dots key={st} st={st} cls={l.cls} c={l.c} o={l.o} />
          : <Shape key={st} st={st} cls={l.cls} c={l.c} o={l.o} label={l.label} />;
      })}
    </svg>
  );
}

// ---- shared bits ----------------------------------------------------------------------------------
/** Everything that is not "pick a winner" lives behind the avatar: which map, which mode, and the
 *  way into election night. On a phone those three controls in the page were three rows of chrome
 *  around a game that only needs one. */
function ProfileMenu({ onClose }: { onClose: () => void }) {
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);
  const signOut = useStore((s) => s.signOut);
  const kind = useStore((s) => s.mapKind);
  const setKind = useStore((s) => s.setMapKind);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const live = useStore((s) => s.live);
  const setLive = useStore((s) => s.setLive);
  const goLive = useStore((s) => s.goLive);
  const setTour = useStore((s) => s.setTour);
  return (
    <>
      <button className="m-menu-back" aria-label="Close" onClick={onClose} />
      <motion.div
        className="m-menu"
        initial={{ opacity: 0, y: -8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.12 } }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        style={{ transformOrigin: 'top right' }}
      >
        <div className="m-menu-head">
          {user ? (
            <div className="em">{user.email}</div>
          ) : (
            <button className="m-menu-cta" onClick={() => { onClose(); openAuth('play'); }}>
              Sign up to play <Icon name="arrowRight" size={13} stroke={2} />
            </button>
          )}
        </div>

        <div className="m-menu-row">
          <span>Map</span>
          <div className="m-seg" role="group" aria-label="Map">
            {([['shape', '1', 'Map 1 — the states themselves'], ['dots', '2', 'Map 2 — the country in dots']] as const).map(([k, n, label]) => (
              <button key={k} className={kind === k ? 'on' : ''} aria-pressed={kind === k} aria-label={label} onClick={() => setKind(k)}>
                <span className="n">Map</span> {n}
              </button>
            ))}
          </div>
        </div>

        <div className="m-menu-row">
          <span>Mode</span>
          <div className="m-seg" role="group" aria-label="Theme">
            {(['dark', 'light'] as const).map((k) => (
              <button key={k} className={theme === k ? 'on' : ''} aria-pressed={theme === k}
                aria-label={k === 'dark' ? 'Dark mode' : 'Light mode'} onClick={() => setTheme(k)}>
                <Icon name={k === 'dark' ? 'moon' : 'sun'} size={15} stroke={1.7} />
              </button>
            ))}
          </div>
        </div>

        <div className="m-menu-row stack">
          <span>Preview</span>
          <div className="m-seg wide" role="group" aria-label="Preview">
            <button className={!live ? 'on' : ''} aria-pressed={!live} onClick={() => setLive(false)}>My picks</button>
            <button className={live ? 'on' : ''} aria-pressed={live} onClick={() => goLive(true)}>
              <span className="live-dot" /> Election night
            </button>
          </div>
        </div>
        <button className="m-menu-item" onClick={() => { onClose(); setTour(0); }}>
          <Icon name="help" size={16} stroke={1.8} /> How it works
        </button>
        {user && <button className="m-menu-item" onClick={() => { onClose(); signOut(); }}>Sign out</button>}
      </motion.div>
    </>
  );
}

function TopBar() {
  const user = useStore((s) => s.user);
  const [menu, setMenu] = useState(false);
  // the hairline only appears once content scrolls under the bar
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <div className={'m-top' + (scrolled ? ' scrolled' : '')}>
      <button className="m-icon" aria-label="Back"><Icon name="arrowLeft" size={20} /></button>
      <Wordmark className="m-logo" />
      <div className="m-acct">
        <button className={'m-av' + (menu ? ' on' : '')} onClick={() => setMenu(!menu)} aria-label="Account and settings" aria-expanded={menu}>
          {user ? user.initials : <Icon name="user" size={18} />}
        </button>
        <AnimatePresence>{menu && <ProfileMenu onClose={() => setMenu(false)} />}</AnimatePresence>
      </div>
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
  const live = useStore((s) => s.live);
  const t = useStore((s) => s.t);
  const picks = useStore((s) => s.picks);
  if (live) {
    const sc = liveScore(picks, t);
    return (
      <div className="m-prog">
        <div className="m-prog-row">
          <span><b>{sc.correct}</b> right · {sc.missed} missed</span>
          <span><b>{sc.called}</b> of {ALL.length} called</span>
        </div>
        <div className="m-bar live"><b className="a" style={{ width: (sc.correct / ALL.length) * 100 + '%' }} /><b className="b" style={{ left: (sc.correct / ALL.length) * 100 + '%', width: (sc.missed / ALL.length) * 100 + '%' }} /></div>
      </div>
    );
  }
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

/** Every race at a glance, the phone's version of the desktop footer. Same dots, sized for a
 *  thumb, and a tap goes to that race instead of only pointing at it. */
function Matrix() {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const live = useStore((s) => s.live);
  const t = useStore((s) => s.t);
  const cur = useStore((s) => s.cursor[s.tab]);
  const select = useStore((s) => s.select);
  const setTab = useStore((s) => s.setTab);
  return (
    <section className="m-matrix" aria-label="All races">
      {TABS.map((k) => {
        const list = RACES[k];
        const done = list.filter((r) => picks[r.id]).length;
        const sc = live ? liveScore(picks, t, k) : null;
        return (
          <div key={k} className={'m-mx-sec' + (tab === k ? ' on' : '')}>
            <div className="m-mx-lbl">
              {TAB_LABEL[k]}
              <span className={done === list.length && !live ? 'done' : ''}>
                {live ? `${sc!.correct} of ${sc!.called} right` : done === list.length ? '✓ Complete' : `${done} of ${list.length}`}
              </span>
            </div>
            <div className="m-mx-grid">
              {list.map((r) => {
                const p = picks[r.id];
                const now = live ? statusAt(r.id, t) : null;
                const called = now?.status === 'called';
                const lost = called && !!p && p !== RESULTS[r.id].winner;
                return (
                  <button
                    key={r.id}
                    className="m-mx-btn"
                    aria-label={`${r.stateName} ${TAB_LABEL[k]}`}
                    onClick={() => { if (tab !== k) setTab(k); select(r.id); }}
                  >
                    <span className={'m-mx' + (p ? ' ' + p : '') + (r.id === cur && tab === k ? ' cur' : '') + (lost ? ' lost' : '')} />
                    {live && <span className={'m-mx-res' + (called ? ' ' + RESULTS[r.id].winner : now!.status === 'counting' ? ' counting' : '')} />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** Election night's running feed, which the desktop keeps in its right-hand panel. */
function JustCalled() {
  const t = useStore((s) => s.t);
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const select = useStore((s) => s.select);
  const called = RACES[tab].filter((r) => RESULTS[r.id].call <= t).sort((a, b) => RESULTS[b.id].call - RESULTS[a.id].call).slice(0, 6);
  return (
    <section className="m-called" aria-label="Just called">
      <h4>{called.length ? 'Just called' : 'Waiting for the first call'}</h4>
      {called.map((r) => {
        const w = RESULTS[r.id].winner, p = picks[r.id];
        return (
          <button key={r.id} onClick={() => select(r.id)}>
            <span className={'sdot ' + w} />
            <span className="nm">{r.stateName}</span>
            <span className="r">
              {clock(RESULTS[r.id].call)}
              <b style={{ color: !p ? 'var(--dim)' : p === w ? 'var(--fg)' : 'var(--R)' }}>{!p ? '–' : p === w ? '✓' : '✕'}</b>
            </span>
          </button>
        );
      })}
    </section>
  );
}

/** Autofill, with the same two sources the desktop offers. */
function AutofillButton() {
  const autofill = useStore((s) => s.autofill);
  const [open, setOpen] = useState(false);
  return (
    <div className="m-autofill">
      <button className="m-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name="wand" size={17} /> Autofill
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="m-autofill-menu"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            {([['polls', 'From the polls', 'Every open race goes the way the averages have it'],
               ['market', 'From the market', 'Every open race goes the way the betting odds have it']] as const).map(([k, title, note]) => (
              <button key={k} onClick={() => { autofill(k); setOpen(false); }}>
                <b>{title}</b><small>{note}</small>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Actions() {
  const save = useStore((s) => s.save);
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);
  const savedAt = useStore((s) => s.savedAt);
  const { done } = useProgress();
  const ready = done === ALL.length;
  return (
    <div className="m-actions">
      <ResetButton className="m-btn m-reset" />
      <AutofillButton />
      <button className={'m-btn primary' + (ready && !savedAt ? ' ready' : '')} disabled={!ready} onClick={() => (user ? save() : openAuth('save'))}>
        {savedAt ? '✓ Saved' : 'Save Map'}
      </button>
    </div>
  );
}

function CandidateButton({ race, side, big }: { race: Race; side: Side; big?: boolean }) {
  const pick = useStore((s) => s.picks[race.id]);
  const toggle = useStore((s) => s.toggle);
  const live = useStore((s) => s.live);
  const t = useStore((s) => s.t);
  if (live) {
    const now = statusAt(race.id, t);
    const called = now.status === 'called';
    const won = called && RESULTS[race.id].winner === side;
    const share = side === 'R' ? now.rShare : 100 - now.rShare;
    return (
      <div className={`m-cand ${side}${won ? ' on' : called ? ' off' : ''}`}>
        <Face side={side} />
        <span className="t">
          <b>{race[side]}</b>
          <small>{pick === side ? 'Your pick' : PARTY[side]}</small>
          {now.status !== 'polls' && <span className="m-vbar"><i className={side} style={{ width: share + '%' }} /></span>}
        </span>
        {now.status !== 'polls' && <span className="m-pct">{share.toFixed(0)}%</span>}
        {won && <span className="ck"><Icon name="check" size={13} stroke={2.8} /></span>}
      </div>
    );
  }
  const on = pick === side, off = !!pick && !on;
  return (
    <button className={`m-cand ${side}${on ? ' on' : ''}${off ? ' off' : ''}${big ? ' big' : ''}`} onClick={() => toggle(race.id, side, { advance: true })}>
      <Face side={side} />
      <span className="t"><b>{race[side]}</b><small>{PARTY[side]}</small></span>
      {on && <span className="ck"><Icon name="check" size={13} stroke={2.8} /></span>}
    </button>
  );
}

// ---- election night on the phone -------------------------------------------------------------------
function LiveBottom({ race }: { race: Race }) {
  const t = useStore((s) => s.t);
  const pick = useStore((s) => s.picks[race.id]);
  const playing = useStore((s) => s.playing);
  const setPlaying = useStore((s) => s.setPlaying);
  const setT = useStore((s) => s.setT);
  const line = liveLine(race, t, pick);
  return (
    <>
      <div className={'m-status' + (line.tone ? ' ' + line.tone : '')}>{line.text}</div>
      <div className="m-tl">
        <button className="m-play" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} size={17} stroke={2} fill={!playing} />
        </button>
        <div className="m-when"><b><span className="live-dot" />{clock(t)} ET</b></div>
        <input type="range" min={0} max={T_MAX} value={t} onChange={(e) => { setPlaying(false); setT(+e.target.value); }} style={{ ['--p' as string]: (t / T_MAX) * 100 + '%' }} aria-label="Election night time" />
      </div>
    </>
  );
}

// ---- 1 · map + bottom sheet ----------------------------------------------------------------------
function Sheet() {
  const race = useStore((s) => BY_ID[s.cursor[s.tab]]);
  const live = useStore((s) => s.live);
  const step = useStore((s) => s.step);
  const list = RACES[race.type];
  return (
    <div className="m-sheet">
      <div className="m-race">
        <Flag st={race.state} />
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.h3 key={race.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>{race.stateName}</motion.h3>
        </AnimatePresence>
        <span className="m-ix">{list.indexOf(race) + 1}/{list.length}</span>
        <button className="m-icon sm" onClick={() => step(-1)} aria-label="Previous"><Icon name="arrowLeft" size={16} /></button>
        <button className="m-icon sm" onClick={() => step(1)} aria-label="Next"><Icon name="arrowRight" size={16} /></button>
      </div>
      <div className={'m-pair' + (live ? ' live' : '')}>
        <CandidateButton race={race} side="R" />
        <CandidateButton race={race} side="D" />
      </div>
      {live ? <LiveBottom race={race} /> : <Actions />}
    </div>
  );
}

function LayoutSheet() {
  const tap = useStore((s) => s.tap);
  const live = useStore((s) => s.live);
  return (
    <div className="m-page">
      <TopBar />
      {/* the game is one screen-tall section; the sheet sticks to the bottom only while this section is on
          screen, so whatever content comes below the map later scrolls in free of it */}
      <section className="m-hero">
        <div className="m-head">
          <h1>Midterms Pick Em</h1>
          {live ? <p className="sub"><i className="sd live-dot" />Live results</p> : <DeadLine />}
        </div>
        <Tabs />
        <div className="m-stage">
          <MobileMap onTap={tap} />
          <Progress />
        </div>
      </section>
      {/* everything the desktop keeps around the map, in the order a thumb reaches it */}
      {live && <JustCalled />}
      <Matrix />
      {/* the picker is last in the flow and sticky, so it stays pinned to the bottom of the screen
          the whole way down and lands in place at the end of the page. Inside the map section it
          unpinned the moment you scrolled past it — and then tapping a race down in the matrix
          changed something you could no longer see. */}
      <Sheet />
      {V.more && (
        <section className="m-more" aria-label="Future content placeholder">
          <h4>More from the midterms</h4>
          {[0, 1, 2, 3].map((i) => <div key={i} className="m-ph"><i /><span><b /><b /></span></div>)}
        </section>
      )}
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
