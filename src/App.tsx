import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ALL, TAB_LABEL, TABS, T_MAX, clock, statusAt } from './data/races';
import { LOCK_AT, isLocked, liveScore, useStore } from './lib/store';
import DotMap from './components/DotMap';
import DotGrid from './components/DotGrid';
import Palette from './components/Palette';
import Matrix from './components/Matrix';
import { Icon } from './components/ui';
import AuthModal from './components/AuthModal';
import Nav from './components/Nav';
import Onboarding from './components/Onboarding';
import Intro from './components/Intro';
import Tip from './components/Tip';
import TitleStudy from './components/TitleStudies';
import LockLine from './components/LockLine';
import HeaderVariant, { CardHelp, CardTitleRow, FooterClock, HDR, HeaderSwitch, clockInFooter, helpInCard, titleInCard } from './components/HeaderVariants';
import { ResetButton, Toast } from './components/Common';
import Mobile from './mobile/Mobile';
import { V } from './lib/variants';
import { RACES } from './data/races';

// ?reset · ?night=1&t=220 · ?fill=1 · ?lock=N — handy for reviews and screenshots
const Q = new URLSearchParams(location.search);
const RULE = Q.get('rule') !== '0'; // ?rule=0 — the nav without its hairline, for comparison
// ?theme=light|dark — pin a mode for a review; otherwise the switch's own choice is remembered
if (Q.get('theme')) useStore.getState().setTheme(Q.get('theme') === 'light' ? 'light' : 'dark');
// ?map=1|2 — pin a map for a review; the store's own default is whatever you last switched to.
// It has to be set here, after persist has rehydrated, or the remembered value wins.
if (Q.get('map')) useStore.getState().setMapKind(Q.get('map') === '2' ? 'dots' : 'shape');
// ?off=quiet — out of play dissolves into the card instead of taking the DS's disabled grey
if (Q.get('off')) document.documentElement.dataset.off = Q.get('off')!;
const SKIP_INTRO = Q.get('intro') === '0' || Q.has('tour') || Q.has('board');
if (Q.has('reset')) {
  localStorage.removeItem('pick-em-p1');
  history.replaceState(null, '', location.pathname);
  location.reload();
} else {
  // A prototype, not a product: every reload starts the story from the top — empty map, signed out,
  // onboarding from step one. Nothing carries over from the last visit.
  useStore.setState({
    picks: {}, savedAt: null, user: null, live: false, playing: false, tourDone: false, tour: null,
    panelMin: false, tab: 'senate',
    cursor: { senate: RACES.senate.find((r) => r.state === 'NM')!.id, gov: RACES.gov[0].id, house: RACES.house[0].id },
  });
  const s = useStore.getState();
  // ?fill=1 — screenshot helper: a complete map picked like the polls (swaps a few so there are misses)
  if (Q.has('fill')) useStore.setState({ picks: Object.fromEntries(ALL.map((r, i) => [r.id, i % 5 === 2 ? (r.poll === 'R' ? 'D' : 'R') : r.poll])) });
  if (V.empty) useStore.setState({ picks: {}, savedAt: null, tab: 'senate', cursor: { senate: RACES.senate[0].id, gov: RACES.gov[0].id, house: RACES.house[0].id } });
  if (Q.has('night')) s.setLive(Q.get('night') !== '0');
  if (Q.has('t')) s.setT(+Q.get('t')!);
  if (Q.has('tour')) setTimeout(() => useStore.getState().setTour(Number(Q.get('tour')) || 0), 100); // ?tour=0..5 — open a step for review
}

export default function App() {
  useKeyboard();
  usePlayback();
  const { ref, scale, height, left } = useScale();
  const isPhone = usePhone();
  const phase = useStore((s) => s.phase);
  const setPhase = useStore((s) => s.setPhase);
  // intro → enter → live: the waveform, the screen assembling itself, then the game
  useEffect(() => { if (SKIP_INTRO) setPhase('live'); }, [setPhase]);
  useEffect(() => {
    if (phase !== 'enter') return;
    const h = setTimeout(() => setPhase('live'), 1400);
    return () => clearTimeout(h);
  }, [phase, setPhase]);
  if (V.mobile || isPhone) return (
    <>
      <Mobile />
      <AuthModal />
      {/* the phone gets the same first-visit tour: the steps name both layouts' selectors */}
      <Onboarding ready={phase === 'live'} />
      <Toast />
      <AnimatePresence>{phase === 'intro' && <Intro key="intro" onDone={() => setPhase('enter')} />}</AnimatePresence>
    </>
  );
  return (
    <div className="scaler" style={{ height }}>
      {/* the nav's rule is the only thing that bleeds past the 1440 frame: it has to reach both screen edges */}
      {RULE && <div className="page-rule" style={{ top: 64 * scale }} />}
      <div className={'app' + (phase === 'enter' ? ' enter' : phase === 'intro' ? ' pre' : '')} ref={ref} style={{ transform: `scale(${scale})`, left }}>
        <Nav />
        {V.title > 0 ? <TitleStudy v={V.title} /> : HDR > 0 ? <HeaderVariant /> : <GameTitle />}
        {V.intro === 'c' && (
          <div className="v-title">
            <h1>2026 Midterms Prediction Map</h1>
            <p>Call every Senate, Governor and House race. Your picks lock Nov 3 — then see how you did.</p>
          </div>
        )}
        <Card />
        <AuthModal />
        <ViewSwitch />
        <Onboarding ready={phase === 'live'} />
        <Toast />
        {HDR > 0 && <HeaderSwitch />}
      </div>
      <AnimatePresence>{phase === 'intro' && <Intro key="intro" onDone={() => setPhase('enter')} />}</AnimatePresence>
    </div>
  );
}

// The Figma frame is 1440 wide; narrower windows get the same composition, uniformly scaled.
function usePhone() {
  const q = '(max-width: 760px)';
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

function useScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [s, setS] = useState({ scale: 1, height: 0, left: 0 });
  useLayoutEffect(() => {
    const fit = () => {
      const h = ref.current?.offsetHeight ?? 0;
      // a tab that loads in the background is laid out lazily and measures 0. Taking that reading
      // would collapse the page to its top 90px and cut the map off, so wait for a real one.
      if (!h) return;
      const scale = Math.min(1, window.innerWidth / 1440);
      // wider than the frame: keep it centred
      const left = Math.max(0, (document.documentElement.clientWidth - 1440 * scale) / 2);
      // room under the card so the floating prototype switch never sits on top of the footer
      setS({ scale, height: h * scale + 96 * scale, left });
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (ref.current) ro.observe(ref.current);
    window.addEventListener('resize', fit);
    // the observer is part of the rendering loop, so a hidden tab is served none of it: measure
    // again when the page comes back, and a few times on the way in
    document.addEventListener('visibilitychange', fit);
    window.addEventListener('load', fit);
    const again = [60, 250, 800, 2000].map((ms) => window.setTimeout(fit, ms));
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
      document.removeEventListener('visibilitychange', fit);
      window.removeEventListener('load', fit);
      again.forEach(clearTimeout);
    };
  }, []);
  return { ref, ...s };
}

function Card() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const live = useStore((s) => s.live);
  return (
    <section className="card">
      {titleInCard && <CardTitleRow />}
      <div className="stage">
        <TheMap />

        <CardHead />

        <div className="tabs" role="tablist">
          {TABS.map((k) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} role="tab" aria-selected={tab === k}>
              {tab === k && <motion.span layoutId="tab-hl" className="hl" initial={false} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              {TAB_LABEL[k]}
            </button>
          ))}
        </div>

        {helpInCard && <CardHelp />}
        <Palette />
        {V.intro === 'b' && <MapHint />}
        {new URLSearchParams(location.search).get('tally') !== '0' && <Tally />}
        <Legend />
        <Progress />
      </div>

      <div className="foot">
        <Matrix />
        {live ? <Timeline /> : <Actions />}
      </div>
    </section>
  );
}

/** How far along you are: a label, then the count. The breakdown lives in the legend + balance bar. */
function Tally() {
  const live = useStore((s) => s.live);
  const t = useStore((s) => s.t);
  const picks = useStore((s) => s.picks);
  const done = ALL.filter((r) => picks[r.id]).length;
  const sc = liveScore(picks, t);
  const big = live ? sc.correct : done;
  const of = live ? sc.called : ALL.length;
  return (
    <div className="tally">
      <div className="lbl">{live ? 'Correct calls' : 'Races picked'}</div>
      <div className="n">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={big} className="big num" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}>
            {big}
          </motion.span>
        </AnimatePresence>
        <span className="of num">/{of}</span>
      </div>
    </div>
  );
}

/** Counts per bucket — shared by the legend and the balance bar. */
function useBuckets() {
  const live = useStore((s) => s.live);
  const t = useStore((s) => s.t);
  const picks = useStore((s) => s.picks);
  if (live) {
    const sc = liveScore(picks, t);
    return { live, a: sc.correct, b: sc.missed, open: ALL.length - sc.correct - sc.missed };
  }
  const R = ALL.filter((r) => picks[r.id] === 'R').length;
  const D = ALL.filter((r) => picks[r.id] === 'D').length;
  return { live, a: R, b: D, open: ALL.length - R - D };
}

/** Plain progress: how much of the map is picked. The R/D split is in the legend. */
function Progress() {
  const { a, b } = useBuckets();
  return <div className="progress" aria-hidden><b style={{ width: ((a + b) / ALL.length) * 100 + '%' }} /></div>;
}

function Legend() {
  const { live, a, b, open } = useBuckets();
  return (
    <div className="legend">
      {live ? (
        <>
          <span><i style={{ background: 'linear-gradient(90deg, var(--R) 50%, var(--D) 50%)' }} />Right <b className="num">{a}</b></span>
          <span><i className="faded" />Missed <b className="num">{b}</b></span>
          <span><i style={{ background: 'var(--dot-pending)' }} />To call <b className="num">{open}</b></span>
        </>
      ) : (
        <>
          <span><i style={{ background: 'var(--R)' }} />Republican <b className="num">{a}</b></span>
          <span><i style={{ background: 'var(--D)' }} />Democrat <b className="num">{b}</b></span>
          <span><i style={{ background: 'var(--dot-open)' }} />Open <b className="num">{open}</b></span>
        </>
      )}
    </div>
  );
}

/** Top-left of the card: what this is and how long you have. The account lives in the site nav now. */
/** Two maps, one game. The choice is remembered, and ?map=2 pins the dots for a review. */
function TheMap() {
  const kind = useStore((s) => s.mapKind);
  return kind === 'dots' ? <DotGrid /> : <DotMap />;
}

/** Prototype-only: swap between the two states of the product. Floats at the bottom, outside the layout. */
function ViewSwitch() {
  const live = useStore((s) => s.live);
  const setLive = useStore((s) => s.setLive);
  const goLive = useStore((s) => s.goLive);
  // portalled out of the scaled page wrapper: inside a transform, `position: fixed` sticks to the card
  return createPortal(
    <div className="viewswitch">
      <span className="vs-label">Preview</span>
      <div className="vs-seg">
        <button className={!live ? 'on' : ''} onClick={() => setLive(false)}>
          {!live && <motion.span layoutId="vs-hl" className="hl" initial={false} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          My picks
        </button>
        <button className={live ? 'on' : ''} onClick={() => goLive(true)}>
          {live && <motion.span layoutId="vs-hl" className="hl" initial={false} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="live-dot" /> Election night
        </button>
      </div>
      <span className="vs-div" />
      <MapSwitch />
      <span className="vs-div" />
      <ThemeSwitch />
    </div>,
    document.body,
  );
}

/** The two maps, numbered rather than named: they are the same country and the same game, and a
 *  label would claim a difference in kind that is not there. */
function MapSwitch() {
  const kind = useStore((s) => s.mapKind);
  const set = useStore((s) => s.setMapKind);
  return (
    <div className="vs-seg vs-map">
      {([['shape', '1', 'Map 1 — the states themselves'], ['dots', '2', 'Map 2 — the country in dots']] as const).map(([k, n, tip]) => (
        <Tip key={k} text={tip}>
          <button className={kind === k ? 'on' : ''} onClick={() => set(k)} aria-pressed={kind === k}>
            <span className="vs-n">Map</span> {n}
            {kind === k && <motion.span layoutId="vs-map-hl" className="hl" initial={false} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          </button>
        </Tip>
      ))}
    </div>
  );
}

/** Both modes are in the design system, so both are in the prototype: two buttons, the live one
 *  carrying the same pill as the segment beside it. The choice is remembered. */
function ThemeSwitch() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  return (
    <div className="vs-seg vs-theme">
      {(['dark', 'light'] as const).map((k) => (
        <Tip key={k} text={k === 'dark' ? 'Dark mode' : 'Light mode'}>
          <button className={theme === k ? 'on' : ''} onClick={() => setTheme(k)} aria-label={k === 'dark' ? 'Dark mode' : 'Light mode'} aria-pressed={theme === k}>
            {theme === k && <motion.span layoutId="vs-theme-hl" className="hl" initial={false} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <Icon name={k === 'dark' ? 'moon' : 'sun'} size={15} stroke={1.7} />
          </button>
        </Tip>
      ))}
    </div>
  );
}

/** Text that arrives letter by letter, each one out of its own blur (Election Hub's opening). */
function Letters({ text, base, step = 26 }: { text: string; base: number; step?: number }) {
  let i = 0;
  return (
    <>
      {text.split('').map((ch, k) =>
        ch === ' ' ? ' ' : <span key={k} className="letter" style={{ ['--d' as string]: base + i++ * step + 'ms' }}>{ch}</span>,
      )}
    </>
  );
}

function GameTitle() {
  const live = useStore((s) => s.live);
  const setTour = useStore((s) => s.setTour);
  return (
    <header className="ghead">
      {/* three zones on one band: where you came from · what this is · how to play */}
      <a className="back" href="#" onClick={(e) => e.preventDefault()}>
        <Icon name="arrowLeft" size={16} stroke={1.8} /> The Midterms
      </a>
      <div className="gtitle">
        <h1><Letters text="Midterms Pick Em" base={240} step={24} /></h1>
        {live ? <p className="sub"><i className="sd live-dot" />Live results</p> : <LockLine />}
      </div>
      <span className="ghead-r">
        {!live && (
          <button className="help" onClick={() => setTour(0)}>
            <Icon name="help" size={16} stroke={1.8} /> How it works
          </button>
        )}
      </span>
    </header>
  );
}

/** Back on the left of the map: who you are, and whether this map is saved. Nothing else —
    the game's name is in the page title and the chamber is in the tabs. */
function CardHead() {
  const live = useStore((s) => s.live);
  const user = useStore((s) => s.user);
  const savedAt = useStore((s) => s.savedAt);
  const openAuth = useStore((s) => s.openAuth);
  // on election night the header already says the map is locked and live — don't say it twice
  const status = !live && savedAt ? <><Icon name="check" size={12} stroke={2.4} />Saved</> : null;
  return (
    <div className="head">
      <button className="who-btn" onClick={() => !user && openAuth('play')}>
        <span className={'av' + (user ? ' me' : '')}>{user ? user.initials : <Icon name="user" size={18} stroke={1.8} />}</span>
        <span className="tx">
          {user ? (
            <>
              <span className="t1">{user.name}</span>
              {status && <span className="t2 saved">{status}</span>}
            </>
          ) : (
            <span className="t1 cta">Sign up to play <Icon name="arrowRight" size={13} stroke={2} /></span>
          )}
        </span>
      </button>
    </div>
  );
}


function Actions() {
  const save = useStore((s) => s.save);
  const savedAt = useStore((s) => s.savedAt);
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);
  const picks = useStore((s) => s.picks);
  const say = useStore((s) => s.say);
  const done = ALL.filter((r) => picks[r.id]).length;
  const locked = isLocked();
  return (
    <div className="actions">
      <ResetButton />
      <AutofillButton />
      {clockInFooter && <FooterClock />}
      <Tip text={savedAt ? 'Saved. Keep picking — save again any time before Nov 3.' : 'Save any time. You can keep picking until election day.'}>
      <button
        className={'btn save' + (savedAt ? ' saved' : ' ready')}
        disabled={locked}
        onClick={() => {
          if (!user) return openAuth('save');
          save();
          say(done === ALL.length ? 'Map saved' : `Saved · ${done} of ${ALL.length} picked — keep going until Nov 3`);
        }}
      >
        {savedAt ? <><Icon name="check" size={16} stroke={2.4} /> Saved</> : 'Save Map'}
      </button>
      </Tip>
    </div>
  );
}

/** Autofill offers the two sources by name: DDHQ's polling data, or Polymarket. */
function AutofillButton() {
  const autofill = useStore((s) => s.autofill);
  const say = useStore((s) => s.say);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.autofill')) setOpen(false); };
    window.addEventListener('pointerdown', off);
    return () => window.removeEventListener('pointerdown', off);
  }, [open]);
  const pick = (source: 'polls' | 'market') => {
    autofill(source);
    setOpen(false);
    say(source === 'polls' ? 'Filled from DDHQ polling data' : 'Filled from Polymarket');
  };
  return (
    <div className="autofill">
      <Tip text="Fill every open race at once — from DDHQ polling data or from Polymarket.">
        <button className="btn" onClick={() => setOpen(!open)} disabled={isLocked()}>
          <Icon name="wand" size={18} stroke={1.8} />
          Autofill
          <Icon name="chevDown" size={14} stroke={2} />
        </button>
      </Tip>
      <AnimatePresence>
        {open && (
          <motion.div className="autofill-menu" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.15 }}>
            <button onClick={() => pick('polls')}><b>Polling data · DDHQ</b><small>Fills every open race with the polling favourite</small></button>
            <button onClick={() => pick('market')}><b>Polymarket</b><small>Fills every open race with the market favourite</small></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** ?intro=b — a one-line explanation floating under the map, gone after the first pick. */
function MapHint() {
  const n = useStore((s) => Object.keys(s.picks).length);
  return (
    <AnimatePresence>
      {n === 0 && (
        <motion.div className="v-hint" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}>
          <b>Call every race.</b> Click a state to pick · click again to switch
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Timeline() {
  const t = useStore((s) => s.t);
  const playing = useStore((s) => s.playing);
  const setPlaying = useStore((s) => s.setPlaying);
  const setT = useStore((s) => s.setT);
  const sc = liveScore(useStore((s) => s.picks), t);
  const counting = ALL.filter((r) => statusAt(r.id, t).status === 'counting').length;
  return (
    <div className="tl">
      <button className="play" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play election night'}>
        <Icon name={playing ? 'pause' : 'play'} size={18} stroke={2} fill={!playing} />
      </button>
      <div className="when">
        <b className="num"><span className="live-dot" />{clock(t)} ET</b>
        <small className="num">{sc.called} of {ALL.length} called · {counting} counting</small>
      </div>
      <div>
        <input
          type="range"
          min={0}
          max={T_MAX}
          value={t}
          onChange={(e) => { setPlaying(false); setT(+e.target.value); }}
          style={{ ['--p' as string]: (t / T_MAX) * 100 + '%' }}
          aria-label="Election night time"
        />
        <div className="ticks"><span>7 PM</span><span>11 PM</span><span>3 AM</span></div>
      </div>
    </div>
  );
}

function usePlayback() {
  const playing = useStore((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    const h = setInterval(() => {
      const s = useStore.getState();
      if (s.t >= T_MAX) { s.setPlaying(false); return; }
      s.setT(s.t + 1);
    }, 70);
    return () => clearInterval(h);
  }, [playing]);
}

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      const s = useStore.getState();
      const id = s.cursor[s.tab];
      if (e.key === 'ArrowRight') s.step(1);
      else if (e.key === 'ArrowLeft') s.step(-1);
      else if (e.key === 'r' || e.key === '1') s.toggle(id, 'R', { advance: true });
      else if (e.key === 'd' || e.key === '2') s.toggle(id, 'D', { advance: true });
            else if (e.key === ' ' && s.live) { e.preventDefault(); s.setPlaying(!s.playing); }
      else return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

