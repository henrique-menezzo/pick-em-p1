import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import logo from './data/logo.svg';
import { ALL, TAB_LABEL, TABS, T_MAX, clock, statusAt } from './data/races';
import { LOCK_AT, isLocked, liveScore, useStore } from './lib/store';
import DotMap from './components/DotMap';
import Palette from './components/Palette';
import Matrix from './components/Matrix';
import { Icon } from './components/ui';
import AuthModal from './components/AuthModal';

// ?reset · ?night=1&t=220 · ?fill=1 · ?lock=N — handy for reviews and screenshots
const Q = new URLSearchParams(location.search);
if (Q.has('reset')) {
  localStorage.removeItem('pick-em-p1');
  history.replaceState(null, '', location.pathname);
  location.reload();
} else {
  const s = useStore.getState();
  // ?fill=1 — screenshot helper: a complete map picked like the polls (swaps a few so there are misses)
  if (Q.has('fill')) useStore.setState({ picks: Object.fromEntries(ALL.map((r, i) => [r.id, i % 5 === 2 ? (r.poll === 'R' ? 'D' : 'R') : r.poll])) });
  if (Q.has('night')) s.setLive(Q.get('night') !== '0');
  if (Q.has('t')) s.setT(+Q.get('t')!);
}

export default function App() {
  useKeyboard();
  usePlayback();
  const { ref, scale, height, left } = useScale();
  return (
    <div className="scaler" style={{ height }}>
      <div className="app" ref={ref} style={{ transform: `scale(${scale})`, left }}>
        <Header />
        <Card />
        <AuthModal />
        <Toast />
      </div>
    </div>
  );
}

// The Figma frame is 1440 wide; narrower windows get the same composition, uniformly scaled.
function useScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [s, setS] = useState({ scale: 1, height: 0, left: 0 });
  useLayoutEffect(() => {
    const fit = () => {
      const scale = Math.min(1, window.innerWidth / 1440);
      // wider than the frame: keep it centred
      const left = Math.max(0, (document.documentElement.clientWidth - 1440 * scale) / 2);
      setS({ scale, height: (ref.current?.offsetHeight ?? 0) * scale + 40 * scale, left });
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (ref.current) ro.observe(ref.current);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, []);
  return { ref, ...s };
}

function Header() {
  const live = useStore((s) => s.live);
  const goLive = useStore((s) => s.goLive);
  const locked = useStore((s) => !s.user || !s.savedAt);
  return (
    <header className="hd">
      <a className="back" href="#">
        <Icon name="arrowLeft" size={20} stroke={1.8} />
        Back to Midterms
      </a>
      <img className="logo" src={logo} alt="Daily Wire" />
      <div className="mode" role="tablist" aria-label="View">
        {[{ on: false, label: 'My Picks' }, { on: true, label: 'Election Night' }].map((m) => (
          <button key={m.label} className={live === m.on ? 'on' : ''} onClick={() => goLive(m.on)} title={m.on && locked && !live ? 'Sign in and save your map to unlock' : undefined}>
            {live === m.on && <motion.span layoutId="mode-hl" className="hl" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            {m.on && (locked && !live ? <Icon name="lock" size={13} stroke={1.9} /> : <span className="live-dot" />)}
            {m.label}
          </button>
        ))}
      </div>
    </header>
  );
}

function Card() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const live = useStore((s) => s.live);
  return (
    <section className="card">
      <div className="stage">
        <DotMap />

        <Who />

        <div className="tabs" role="tablist">
          {TABS.map((k) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} role="tab" aria-selected={tab === k}>
              {tab === k && <motion.span layoutId="tab-hl" className="hl" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              {TAB_LABEL[k]}
            </button>
          ))}
        </div>

        <Palette />
        {new URLSearchParams(location.search).get('tally') !== '0' && <Tally />}
        <Legend />
        <Balance />
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

/** Balance bar: Republicans grow from the left, Democrats from the right, open races are the gap between.
 *  On election night: right calls from the left, then misses, then what's still to call. */
function Balance() {
  const { live, a, b } = useBuckets();
  const pct = (n: number) => (n / ALL.length) * 100 + '%';
  return (
    <div className={'balance' + (live ? ' live' : '')} aria-hidden>
      <b className="a" style={{ width: pct(a) }} />
      {live ? <b className="b" style={{ left: pct(a), width: pct(b) }} /> : <b className="b" style={{ right: 0, width: pct(b) }} />}
    </div>
  );
}

function Legend() {
  const { live, a, b, open } = useBuckets();
  return (
    <div className="legend">
      {live ? (
        <>
          <span><i style={{ background: 'linear-gradient(90deg, var(--R) 50%, var(--D) 50%)' }} />Right <b className="num">{a}</b></span>
          <span><i className="faded" />Missed <b className="num">{b}</b></span>
          <span><i style={{ background: '#4a4a4a' }} />To call <b className="num">{open}</b></span>
        </>
      ) : (
        <>
          <span><i style={{ background: 'var(--R)' }} />Republican <b className="num">{a}</b></span>
          <span><i style={{ background: 'var(--D)' }} />Democrat <b className="num">{b}</b></span>
          <span><i style={{ background: '#6f6f6f' }} />Open <b className="num">{open}</b></span>
        </>
      )}
    </div>
  );
}

/** Top-left: "Sign up to play" until there is an account, then the account itself. */
function Who() {
  const live = useStore((s) => s.live);
  const user = useStore((s) => s.user);
  const savedAt = useStore((s) => s.savedAt);
  const openAuth = useStore((s) => s.openAuth);
  const signOut = useStore((s) => s.signOut);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return;
    const off = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.who')) setMenu(false); };
    window.addEventListener('pointerdown', off);
    return () => window.removeEventListener('pointerdown', off);
  }, [menu]);

  // one status line: what state the map is in, never the section (the tabs already say that)
  const status = live
    ? <><i className="sd live-dot" />Picks locked · live</>
    : !user
      ? <span className="cta">Sign up to play <Icon name="arrowRight" size={13} stroke={2} /></span>
      : <>{user.name}{savedAt && <><span className="sep">·</span><span className="saved"><Icon name="check" size={12} stroke={2.4} />Saved</span></>}</>;
  return (
    <div className="who">
      <button className={'who-btn' + (user ? ' in' : '')} onClick={() => (user ? setMenu(!menu) : openAuth('play'))}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={user ? 'u' : 'anon'}
            className={'av' + (user ? ' me' : '')}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {user ? user.initials : <Icon name="user" size={18} stroke={1.8} />}
          </motion.span>
        </AnimatePresence>
        <span className="tx">
          <span className="t1">Your 2026 Map</span>
          <span className="t2">{status}</span>
        </span>
      </button>
      <AnimatePresence>
        {menu && user && (
          <motion.div className="who-menu" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
            <div className="em">{user.email}</div>
            <button onClick={() => { setMenu(false); signOut(); }}>Sign out</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Toast() {
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

function Actions() {
  const autofill = useStore((s) => s.autofill);
  const save = useStore((s) => s.save);
  const savedAt = useStore((s) => s.savedAt);
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);
  const picks = useStore((s) => s.picks);
  const ready = ALL.every((r) => picks[r.id]);
  return (
    <div className="actions">
      <LockTimer />
      <ResetButton />
      <button className="btn" onClick={autofill} disabled={isLocked()} style={isLocked() ? { opacity: 0.35, cursor: 'default' } : undefined}>
        <Icon name="wand" size={18} stroke={1.8} />
        Autofill
      </button>
      <button
        className={'btn save' + (ready ? ' ready' : '') + (savedAt ? ' saved' : '')}
        disabled={!ready}
        onClick={() => (user ? save() : openAuth('save'))}
        title={!ready ? 'Pick all 97 races to save' : undefined}
      >
        {savedAt ? <><Icon name="check" size={16} stroke={2.4} /> Saved</> : 'Save Map'}
      </button>
    </div>
  );
}

/** Small round reset next to Autofill: icon only, asks once (toast) before wiping the map. */
function ResetButton() {
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
      className={'btn reset' + (confirm ? ' confirm' : '')}
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

/** Countdown to election day: after it, picks can't change any more. Precision grows as the lock gets close. */
function LockTimer() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, []);
  const ms = Math.max(0, LOCK_AT - now);
  const locked = ms === 0;
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400), hrs = Math.floor(s / 3600), mins = Math.floor((s % 3600) / 60);
  const left =
    days >= 2 ? `${days} days`
    : hrs >= 1 ? `${hrs}h ${String(mins).padStart(2, '0')}m`
    : `${mins}:${String(s % 60).padStart(2, '0')}`;
  const day = new Date(LOCK_AT).toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  const time = new Date(LOCK_AT).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
  return (
    <div className={'lock' + (locked ? ' done' : s < 86400 ? ' soon' : '')} title={`Picks lock ${day}, ${time} ET`}>
      <b className="num">{locked ? 'Picks locked' : <>Locks in <em>{left}</em></>}</b>
      <small>{locked ? `${day} · ${time} ET` : `Election Day · ${day}`}</small>
    </div>
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

