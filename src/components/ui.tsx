import { RESULTS, statusAt, clock, type Race, type Side } from '../data/races';
import { useStore } from '../lib/store';

export const PARTY: Record<Side, string> = { R: 'Republican', D: 'Democrat' };

/** Public-folder asset URL that works under any deploy base (GitHub Pages serves the app at /pick-em-p1/). */
export const asset = (path: string) => import.meta.env.BASE_URL + path;
export const facePhoto = (side: Side) => asset(side === 'R' ? 'rep.png' : 'dem.png');

export function Face({ side, className = 'face' }: { side: Side; className?: string }) {
  return (
    <span className={className + (className === 'face' ? '' : '')}>
      <img src={facePhoto(side)} alt="" draggable={false} />
    </span>
  );
}

export function Flag({ st, sm }: { st: string; sm?: boolean }) {
  return <img className={'flag' + (sm ? ' sm' : '')} src={asset(`flags/us-${st.toLowerCase()}.png`)} alt="" draggable={false} />;
}

type IconName = 'arrowLeft' | 'arrowRight' | 'chevDown' | 'chevUp' | 'check' | 'x' | 'list' | 'focus' | 'zoom' | 'play' | 'pause' | 'user' | 'wand' | 'collapse' | 'reset' | 'lock';
const PATHS: Record<IconName, string> = {
  arrowLeft: 'M19 12H5 M11 6l-6 6 6 6',
  arrowRight: 'M5 12h14 M13 6l6 6-6 6',
  chevDown: 'M6 9.5l6 6 6-6',
  chevUp: 'M6 14.5l6-6 6 6',
  check: 'M5 12.5l4.2 4.2L19 7',
  x: 'M6.5 6.5l11 11 M17.5 6.5l-11 11',
  list: 'M9 6h11 M9 12h11 M9 18h11 M4.5 6h.01 M4.5 12h.01 M4.5 18h.01',
  focus: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  zoom: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M20 20l-4.5-4.5 M10.5 7.5v6 M7.5 10.5h6',
  play: 'M8 5.5v13l10.5-6.5z',
  pause: 'M8 5.5v13 M16 5.5v13',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M5.5 20c.8-3.4 3.4-5 6.5-5s5.7 1.6 6.5 5',
  wand: 'M3 21l12-12 M15 3l6 6-3 3-6-6z',
  collapse: 'M4 14h6v6 M20 10h-6V4 M14 10l7-7 M3 21l7-7',
  reset: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3 M4.5 4.5V9H9',
  lock: 'M6 10.5h12v9H6z M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3',
};
export function Icon({ name, size = 16, stroke = 1.8, fill }: { name: IconName; size?: number; stroke?: number; fill?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Figma candidate row (272×58). In election-night mode it shows the count instead of taking a pick. */
export function CandidateRow({ race, side, advance }: { race: Race; side: Side; advance?: boolean }) {
  const pick = useStore((s) => s.picks[race.id]);
  const live = useStore((s) => s.live);
  const t = useStore((s) => s.t);
  const toggle = useStore((s) => s.toggle);
  const name = race[side];

  if (live) {
    const res = RESULTS[race.id];
    const now = statusAt(race.id, t);
    const share = side === 'R' ? now.rShare : 100 - now.rShare;
    const called = now.status === 'called';
    const won = called && res.winner === side;
    const mine = pick === side;
    return (
      <button className={`cand ${side === 'R' ? 'r' : 'd'} ${won ? 'on' : called ? 'off' : ''}`} disabled>
        <Face side={side} />
        <span className="t">
          <span className="n">{name}</span>
          <span className="p">
            {mine ? <span className={'tag' + (called && !won ? ' miss' : '')}>{called && !won ? '✕ Your pick' : 'Your pick'}</span> : PARTY[side]}
          </span>
          {now.status !== 'polls' && (
            <span className="vbar"><i style={{ width: share + '%', background: side === 'R' ? 'var(--R)' : 'var(--D)' }} /></span>
          )}
        </span>
        {now.status !== 'polls' ? <span className="pct num">{share.toFixed(1)}%</span> : null}
        {won && <span className="ck"><Icon name="check" size={12} stroke={2.6} /></span>}
      </button>
    );
  }

  const on = pick === side;
  const off = !!pick && !on;
  return (
    <button className={`cand ${side === 'R' ? 'r' : 'd'} ${on ? 'on' : ''} ${off ? 'off' : ''}`} onClick={() => toggle(race.id, side, { advance })}>
      <Face side={side} />
      <span className="t">
        <span className="n">{name}</span>
        <span className="p">{PARTY[side]}</span>
      </span>
      {/* radio: empty ring until picked, then filled in the party colour */}
      <span className={'ck' + (on ? ' on' : '')}>{on && <Icon name="check" size={12} stroke={2.8} />}</span>
    </button>
  );
}

export function liveLine(race: Race, t: number, pick?: Side) {
  const res = RESULTS[race.id];
  const now = statusAt(race.id, t);
  if (now.status === 'polls') return { text: `Polls close ${clock(res.close)}`, tone: '' };
  if (now.status === 'counting') return { text: `Counting · ${now.reporting}%`, tone: '' };
  if (!pick) return { text: `Called ${clock(res.call)}`, tone: '' };
  return pick === res.winner ? { text: `✓ Called ${clock(res.call)}`, tone: 'ok' } : { text: `✕ Called ${clock(res.call)}`, tone: 'miss' };
}
