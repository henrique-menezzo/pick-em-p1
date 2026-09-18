import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { BY_ID, RACES, RESULTS, TAB_LABEL, TABS, clock, statusAt, type Tab } from '../data/races';
import { liveScore, useStore } from '../lib/store';
import { Face, Flag, facePhoto } from './ui';

const COLS: Record<Tab, number> = { senate: 12, gov: 12, house: 9 };

/**
 * The 97-dot race matrix from the Figma footer. Every dot is a race: hover shows who you picked,
 * click takes you to that state on the map to vote. On election night each dot gets its result
 * underneath, and an × when the call went the other way.
 */
export default function Matrix() {
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);
  const tab = useStore((s) => s.tab);
  const live = useStore((s) => s.live);
  const t = useStore((s) => s.t);
  const picks = useStore((s) => s.picks);
  const curId = useStore((s) => s.cursor[s.tab]);
  const select = useStore((s) => s.select);
  const setTab = useStore((s) => s.setTab);
  const setHover = useStore((s) => s.setHover);

  function go(id: string) {
    setTip(null);
    setHover(null);
    select(id);
    document.querySelector('.mapbox')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  return (
    <div className="matrix">
      {TABS.map((k) => {
        const list = RACES[k];
        const done = list.filter((r) => picks[r.id]).length;
        const sc = live ? liveScore(picks, t, k) : null;
        return (
          <div key={k} className={'mx-sec' + (tab === k ? ' on' : '')} onClick={() => tab !== k && setTab(k)}>
            <div className="lbl">
              {TAB_LABEL[k]}
              <span className={'c num' + (!live && done === list.length ? ' done' : '')}>
                {live ? `${sc!.correct} of ${sc!.called} right` : done === list.length ? '✓ Complete' : `${done} of ${list.length}`}
              </span>
            </div>
            <div className="mx-grid" style={{ gridTemplateColumns: `repeat(${COLS[k]}, 13px)`, rowGap: live ? 9 : 7 }}>
              {list.map((r) => {
                const p = picks[r.id];
                const res = RESULTS[r.id];
                const now = live ? statusAt(r.id, t) : null;
                const called = now?.status === 'called';
                const lost = called && !!p && p !== res.winner;
                return (
                  <button
                    key={r.id}
                    className="mx-btn"
                    aria-label={`${r.stateName} ${TAB_LABEL[k]}`}
                    onMouseEnter={(e) => {
                      const b = e.currentTarget.getBoundingClientRect();
                      setTip({ id: r.id, x: b.left + b.width / 2, y: b.top });
                      if (k === tab) setHover(r.id);
                    }}
                    onMouseLeave={() => { setTip(null); setHover(null); }}
                    onClick={(e) => { e.stopPropagation(); go(r.id); }}
                  >
                    <span className="mx-pair">
                      <span className={'mx' + (p ? ' ' + p : '') + (r.id === curId && tab === k ? ' cur' : '') + (lost ? ' lost' : '')} style={live && !called && p ? { opacity: 0.45 } : undefined}>
                        {lost && (
                          <span className="x">
                            <svg width="9" height="9" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" stroke="#0a0909" strokeWidth="2" strokeLinecap="round" /></svg>
                          </span>
                        )}
                      </span>
                      {live && <span className={'mx-res' + (called ? ' ' + res.winner : now!.status === 'counting' ? ' counting' : '')} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {createPortal(<AnimatePresence>{tip && <DotTip key="tip" {...tip} />}</AnimatePresence>, document.body)}
    </div>
  );
}

function DotTip({ id, x, y }: { id: string; x: number; y: number }) {
  const r = BY_ID[id];
  const pick = useStore((s) => s.picks[id]);
  const live = useStore((s) => s.live);
  const t = useStore((s) => s.t);
  const list = RACES[r.type];
  const res = RESULTS[id];
  const now = statusAt(id, t);
  const called = live && now.status === 'called';

  return (
    <motion.div
      className={'tip' + (live ? '' : ' tip-mini')}
      initial={{ opacity: 0, y: 6, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: 4, x: '-50%', transition: { duration: 0.1 } }}
      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
      style={{ left: x, top: y - 12, translateY: '-100%' }}
    >
      {!live && (
        <div className="mini">
          {pick ? (
            <>
              <span className={'face ' + pick}><img src={facePhoto(pick)} alt="" /></span>
              <b>{r[pick]}</b>
              <em>{r.stateName}</em>
            </>
          ) : (
            <>
              <b>{r.stateName}</b>
              <em>No pick</em>
            </>
          )}
        </div>
      )}
      {live && (
        <>
          <div className="h"><Flag st={r.state} sm />{r.stateName} <em>· {TAB_LABEL[r.type]} #{list.indexOf(r) + 1}</em></div>
          <div className="who2">
            <span className="k">You</span>
            {pick ? (
              <>
                <Face side={pick} className={'face ' + pick} />
                <span><b>{r[pick]}</b></span>
              </>
            ) : <span style={{ fontSize: 12, color: 'var(--muted)' }}>No pick</span>}
            {called && pick && <span className="mark" style={{ color: pick === res.winner ? 'var(--fg)' : 'var(--R)' }}>{pick === res.winner ? '✓ Right' : '✕ Wrong'}</span>}
          </div>
          <div className="who2">
            <span className="k">Result</span>
            {called ? (
              <>
                <Face side={res.winner} className={'face ' + res.winner} />
                <span>
                  <b>{r[res.winner]}</b>
                  <small>Called {clock(res.call)} · {(res.winner === 'R' ? now.rShare : 100 - now.rShare).toFixed(1)}%</small>
                </span>
              </>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{now.status === 'polls' ? `Polls close ${clock(res.close)}` : `Counting · ${now.reporting}% in`}</span>
            )}
          </div>
        </>
      )}
      <span className="arrow" />
    </motion.div>
  );
}
