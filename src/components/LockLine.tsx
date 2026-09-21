// The deadline, ticking to the second. Shared by the live header and by every header study.
import { useEffect, useState } from 'react';
import { LOCK_AT } from '../lib/store';

export function useCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, []);
  const ms = Math.max(0, LOCK_AT - now);
  const s = Math.floor(ms / 1000), days = Math.floor(s / 86400);
  const hms = [Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, '0')).join(':');
  return { left: days > 0 ? `${days}d ${hms}` : hms, locked: ms === 0 };
}

export default function LockLine() {
  const { left, locked } = useCountdown();
  return <p className="sub">{locked ? 'Picks locked' : <><span>Picks lock in</span><b>{left}</b></>}</p>;
}
