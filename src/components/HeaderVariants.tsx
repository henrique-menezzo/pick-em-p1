// ?hdr=1..12 — each header study, live, on top of the real screen. ?board=1 is the contact sheet;
// this is the same twelve compositions wired to the real countdown, tour and election-night state.
import { createPortal } from 'react-dom';
import { useStore } from '../lib/store';
import { useCountdown } from './LockLine';
import { Icon } from './ui';

const Q = new URLSearchParams(location.search);
export const HDR = Math.max(0, Math.min(12, Number(Q.get('hdr') || 0)));
export const NAMES = [
  'Live header', 'One line', 'Lockup', 'Masthead', 'Clock block', 'Two tiers', 'One quiet line',
  'Left product', "On the card's shoulder", 'Clock first', 'Until needed', 'Deadline by the button', 'Chrome strip',
];
/** Three studies move a piece out of the header — the card and the footer have to play along. */
export const titleInCard = HDR === 8;
export const helpInCard = HDR === 4;
export const clockInFooter = HDR === 11;

const BACK = 'The Midterms';
const TITLE = 'Midterms Pick Em';
const HELP = 'How it works';

function Back({ className, size = 15 }: { className: string; size?: number }) {
  return (
    <a className={className} href="#" onClick={(e) => e.preventDefault()}>
      <Icon name="arrowLeft" size={size} stroke={1.8} />{BACK}
    </a>
  );
}
function Help({ className }: { className: string }) {
  const setTour = useStore((s) => s.setTour);
  return <button className={className} onClick={() => setTour(0)}>{HELP}</button>;
}
/** The deadline, or on election night the thing that replaced it. */
function useClock() {
  const live = useStore((s) => s.live);
  const { left, locked } = useCountdown();
  return { live, left, locked };
}

export default function HeaderVariant() {
  const { live, left, locked } = useClock();
  const setTour = useStore((s) => s.setTour);
  const clock = live ? 'Live results' : locked ? 'Picks locked' : left;
  const showHelp = !live;

  if (HDR === 1) {
    return (
      <header className="vhead">
        <div className="c1">
          <Back className="c1-back" />
          <span className="c1-sep" />
          <h1>{TITLE}</h1>
          <span className="c1-gap" />
          <span className="c1-clock">{live ? <i className="sd live-dot" /> : 'Locks in '}<b>{clock}</b></span>
          {showHelp && <Help className="c1-help" />}
        </div>
      </header>
    );
  }
  if (HDR === 2) {
    return (
      <header className="vhead">
        <div className="c2">
          <Back className="c2-back" />
          <div className="c2-mid">
            <h1>{TITLE}</h1>
            <div className="c2-lock">{!live && <span>PICKS LOCK IN</span>}<b>{clock}</b></div>
          </div>
          {showHelp ? <Help className="c2-help" /> : <span />}
        </div>
      </header>
    );
  }
  if (HDR === 3) {
    return (
      <header className="vhead">
        <div className="c3">
          <div className="c3-l">
            <Back className="c3-kick" size={12} />
            <h1>{TITLE}</h1>
          </div>
          <div className="c3-r">
            <b>{clock}</b>
            <span>{live ? 'results coming in' : 'until picks lock'}</span>
            {showHelp && <Help className="c3-help" />}
          </div>
        </div>
      </header>
    );
  }
  if (HDR === 4) {
    return (
      <header className="vhead">
        <div className="c4">
          <Back className="c4-back" />
          <h1>{TITLE}</h1>
          <div className="c4-clock">{!live && <span>PICKS LOCK IN</span>}<b>{clock}</b></div>
        </div>
      </header>
    );
  }
  if (HDR === 5) {
    return (
      <header className="vhead">
        <div className="c5">
          <h1>{TITLE}</h1>
          <div className="c5-row">
            <Back className="c5-back" size={14} />
            <span className="c5-clock"><i className={live ? 'live' : ''} />{live ? '' : 'Picks lock in '}<b>{clock}</b></span>
            {showHelp ? <Help className="c5-help" /> : <span />}
          </div>
        </div>
      </header>
    );
  }
  if (HDR === 6) {
    return (
      <header className="vhead">
        <div className="c6">
          <h1>{TITLE}</h1>
          <div className="c6-row">
            <Back className="" size={13} />
            <span className="c6-dot" />
            <span>{live ? '' : 'Picks lock in '}<b>{clock}</b></span>
            {showHelp && <><span className="c6-dot" /><Help className="" /></>}
          </div>
        </div>
      </header>
    );
  }
  if (HDR === 7) {
    return (
      <header className="vhead">
        <div className="c7">
          <div className="c7-l">
            <Back className="c7-back" size={13} />
            <div className="c7-row">
              <h1>{TITLE}</h1>
              <span className="c7-clock">{live ? '' : 'Picks lock in'}<b>{clock}</b></span>
            </div>
          </div>
          {showHelp && <Help className="c7-help" />}
        </div>
      </header>
    );
  }
  if (HDR === 8) {
    // the title itself lives in the card (see CardTitleRow); only the way back stays on the page
    return (
      <header className="vhead">
        <div className="c8"><Back className="c8-back" size={14} /></div>
      </header>
    );
  }
  if (HDR === 9) {
    return (
      <header className="vhead">
        <div className="c9">
          <div className="c9-l">
            <Back className="c9-kick" size={12} />
            <h1>{TITLE}</h1>
            {showHelp && <Help className="c9-help" />}
          </div>
          <div className="c9-r">
            {!live && <span>PICKS LOCK IN</span>}
            <b>{clock}</b>
          </div>
        </div>
      </header>
    );
  }
  if (HDR === 10) {
    return (
      <header className="vhead">
        <div className="c10 one">
          <div className="c10-row">
            <a className="c10-ico" href="#" onClick={(e) => e.preventDefault()}>
              <Icon name="arrowLeft" size={17} stroke={1.7} /><span className="lbl">{BACK}</span>
            </a>
            <h1>{TITLE}</h1>
            <button className="c10-ico" onClick={() => setTour(0)} disabled={live}>
              <Icon name="help" size={17} stroke={1.7} /><span className="lbl">{HELP}</span>
            </button>
          </div>
          <div className="c10-clock"><span className="lbl">{live ? '' : 'Picks lock in '}</span><b>{clock}</b></div>
        </div>
      </header>
    );
  }
  if (HDR === 11) {
    // the clock is in the footer, next to Save Map (see Actions)
    return (
      <header className="vhead">
        <div className="c11">
          <Back className="c11-back" />
          <h1>{TITLE}</h1>
          {showHelp ? <Help className="c11-help" /> : <span />}
        </div>
      </header>
    );
  }
  if (HDR === 12) {
    return (
      <header className="vhead">
        <div className="c12">
          <div className="c12-strip">
            <Back className="" size={13} />
            {showHelp && <Help className="" />}
          </div>
          <div className="c12-mid">
            <h1>{TITLE}</h1>
            <span className="c12-clock">{live ? '' : 'Picks lock in'}<b>{clock}</b></span>
          </div>
        </div>
      </header>
    );
  }
  return null;
}

/** 08 — the title is the card's first row. */
export function CardTitleRow() {
  const { live, left, locked } = useClock();
  const showHelp = !live;
  return (
    <div className="c8-cardrow">
      <h1>{TITLE}</h1>
      <div className="c8-r">
        <span className="c8-clock">{live ? <i className="sd live-dot" /> : 'Picks lock in'}<b>{live ? 'Live results' : locked ? 'Picks locked' : left}</b></span>
        {showHelp && <Help className="c8-help" />}
      </div>
    </div>
  );
}

/** 04 — help left the header; it sits on the card, next to the tabs. */
export function CardHelp() {
  const live = useStore((s) => s.live);
  const setTour = useStore((s) => s.setTour);
  if (live) return null;
  return (
    <button className="c4-cardhelp" onClick={() => setTour(0)} aria-label={HELP}>
      <Icon name="help" size={18} stroke={1.7} />
    </button>
  );
}

/** 11 — the deadline sits with the button it constrains. */
export function FooterClock() {
  const { live, left, locked } = useClock();
  if (live || locked) return null;
  return <span className="foot-clock">Locks in <b>{left}</b></span>;
}

/** Prototype-only: flip through the studies without editing the URL. */
export function HeaderSwitch() {
  const go = (n: number) => {
    const q = new URLSearchParams(location.search);
    q.set('hdr', String(n));
    location.search = q.toString();
  };
  return createPortal(
    <div className="hdrswitch">
      <button onClick={() => go((HDR + 12) % 13)} aria-label="Previous header"><Icon name="chevLeft" size={15} stroke={2} /></button>
      <span className="n">{String(HDR).padStart(2, '0')}</span>
      <span className="nm">{NAMES[HDR]}</span>
      <button onClick={() => go((HDR + 1) % 13)} aria-label="Next header"><Icon name="chevRight" size={15} stroke={2} /></button>
      <a className="all" href={'?board=1'}>All</a>
    </div>,
    document.body,
  );
}
