// Ten ways to show the game's title (?title=1..10). Review only: 0 / absent keeps the current layout.
import { useEffect, useState } from 'react';
import { LOCK_AT } from '../lib/store';
import { Icon } from './ui';

export const NAME = 'Midterms Pick Em';
export const LEDE = 'Call every race. On election night, see how many you got right.';

function useCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(h);
  }, []);
  const s = Math.max(0, Math.floor((LOCK_AT - now) / 1000));
  const days = Math.floor(s / 86400), hrs = Math.floor(s / 3600), mins = Math.floor((s % 3600) / 60);
  const left = days >= 2 ? `${days} days` : hrs >= 1 ? `${hrs}h ${String(mins).padStart(2, '0')}m` : `${mins}m`;
  const day = new Date(LOCK_AT).toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  return { left, day };
}

/** Variants 1–5 and 7, 9, 10 live above the card; 3, 4, 6 sit inside it (see App). */
export default function TitleStudy({ v }: { v: number }) {
  const { left, day } = useCountdown();
  if (v === 1) {
    return (
      <div className="ts ts-1">
        <h1>{NAME}</h1>
        <p>{LEDE}</p>
      </div>
    );
  }
  if (v === 2) {
    return (
      <div className="ts ts-2">
        <h1>{NAME}</h1>
        <p>{LEDE}</p>
      </div>
    );
  }
  if (v === 5) {
    return (
      <div className="ts ts-5">
        <span className="eyebrow">The Midterms</span>
        <h1>Pick Em</h1>
        <span className="deadline">Picks lock in {left} · {day}</span>
      </div>
    );
  }
  if (v === 7) {
    return (
      <div className="ts ts-7">
        <div className="row"><h1>{NAME}</h1><span className="deadline">Picks lock in <b>{left}</b> · Election Day, {day}</span></div>
        <div className="rule" />
      </div>
    );
  }
  if (v === 8) {
    return (
      <div className="ts ts-8">
        <span className="crumb">The Midterms <Icon name="chevRight" size={12} stroke={2} /> <b>Pick Em</b></span>
      </div>
    );
  }
  if (v === 9) {
    return (
      <div className="ts ts-9">
        <h1>
          Call every race of the <span className="grad">2026 midterms</span>
        </h1>
        <p>{LEDE} Your map locks on Election Day, {day}.</p>
      </div>
    );
  }
  if (v === 10) {
    return (
      <div className="ts ts-10">
        <div className="pill">
          <b>{NAME}</b>
          <span className="dot" />
          <span>Picks lock in {left}</span>
        </div>
      </div>
    );
  }
  return null;
}

/** The in-card head, in the flavour each study asks for. */
export function CardTitle({ v }: { v: number }) {
  const { left, day } = useCountdown();
  if (v === 3) {
    return (
      <>
        <span className="ts-eyebrow">{NAME}</span>
        <h1>Your 2026 Map</h1>
        <p className="sub">Picks lock in <b>{left}</b> · Election Day, {day}</p>
      </>
    );
  }
  if (v === 4) {
    return (
      <>
        <div className="ts-row">
          <h1>{NAME}</h1>
          <span className="ts-chip">Locks in {left}</span>
        </div>
        <p className="sub">{LEDE}</p>
      </>
    );
  }
  if (v === 6) {
    return (
      <>
        <h1 className="ts-grad">Pick Em<span> · 2026 Midterms</span></h1>
        <p className="sub">Picks lock in <b>{left}</b> · Election Day, {day}</p>
      </>
    );
  }
  return null;
}
