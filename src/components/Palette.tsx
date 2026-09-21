import { AnimatePresence, motion } from 'motion/react';
import { BY_ID, RACES, RESULTS, clock, type Race } from '../data/races';
import { useStore } from '../lib/store';
import { CandidateRow, Flag, Icon, liveLine } from './ui';
import Tip from './Tip';

/** The Figma "palette": always open, one race at a time. */
export default function Palette() {
  const race = useStore((s) => BY_ID[s.cursor[s.tab]]);
  const min = useStore((s) => s.panelMin);
  const setMin = useStore((s) => s.setPanelMin);
  return (
    <div className="pal-anchor">
      <AnimatePresence initial={false} mode="popLayout">
        {min ? (
          // out of the way, so the whole map is visible; any pick on the map brings it back
          <motion.button
            key="handle"
            className="pal-handle"
            onClick={() => setMin(false)}
            aria-label="Show the race panel"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            <Flag st={race.state} />
            <span>{race.stateName}</span>
            <Icon name="chevDown" size={15} stroke={2} />
          </motion.button>
        ) : (
          <motion.div
            key="panel"
            className="pal"
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            style={{ transformOrigin: 'top right' }}
          >
            <FocusBody race={race} />
            {/* one quiet arrow along the panel's bottom edge: tuck it away, any pick brings it back */}
            <Tip text="Hide the panel — picking a state brings it back">
              <button className="pal-collapse" onClick={() => setMin(true)} aria-label="Hide panel">
                <Icon name="chevUp" size={16} stroke={2} />
              </button>
            </Tip>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- one race at a time --------------------------------------------------------------------------
function FocusBody({ race }: { race: Race }) {
  const pick = useStore((s) => s.picks[race.id]);
  const step = useStore((s) => s.step);
  const live = useStore((s) => s.live);
  const t = useStore((s) => s.t);
  const line = live ? liveLine(race, t, pick) : null;

  return (
    <div>
      <div className="fb-head">
        <div className="fb-title">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={race.id}
              className="fb-name"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            >
              <Flag st={race.state} />
              <h3>{race.stateName}</h3>
            </motion.div>
          </AnimatePresence>
          <div className="fb-nav">
            <button aria-label="Previous race" onClick={() => step(-1)}><Icon name="arrowLeft" size={15} /></button>
            <button aria-label="Next race" onClick={() => step(1)}><Icon name="arrowRight" size={15} /></button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={race.id}
          className="fb-cands"
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        >
          <CandidateRow race={race} side="R" advance />
          <CandidateRow race={race} side="D" advance />
        </motion.div>
      </AnimatePresence>

      {line && <div className={'fb-hint' + (line.tone === 'ok' ? ' ok' : '')}>{line.text}</div>}
      {live && <JustCalled />}
    </div>
  );
}

function JustCalled() {
  const t = useStore((s) => s.t);
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const select = useStore((s) => s.select);
  const setHover = useStore((s) => s.setHover);
  const called = RACES[tab].filter((r) => RESULTS[r.id].call <= t).sort((a, b) => RESULTS[b.id].call - RESULTS[a.id].call).slice(0, 4);
  return (
    <div className="next">
      <h6>{called.length ? 'Just called' : 'Waiting for the first call'}</h6>
      {called.map((r) => {
        const w = RESULTS[r.id].winner, p = picks[r.id];
        return (
          <button key={r.id} onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)} onClick={() => { setHover(null); select(r.id); }}>
            <span className={'sdot ' + w} />
            {r.stateName}
            <span className="r">
              {clock(RESULTS[r.id].call)}
              <span style={{ color: !p ? 'var(--dim)' : p === w ? 'var(--fg)' : 'var(--R)', fontWeight: 600 }}>{!p ? '–' : p === w ? '✓' : '✕'}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
