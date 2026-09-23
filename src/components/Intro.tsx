// The opening. A waveform of dots draws itself from the middle out, breathes once, and hands the
// screen to the map — which blooms outward from the very line the waveform was sitting on, so the
// two read as one movement instead of two. Drawn here rather than played from a file: nothing to
// decode, the map's own colours, and every beat can be tuned against the entrance.
import { useEffect } from 'react';
import { motion } from 'motion/react';

/** Touching circles, a fat middle, red against blue — the waveform from the Election Hub reference. */
const WAVE: { r: number; c: string }[] = [
  { r: 0.10, c: '#0d1442' }, { r: 0.15, c: '#12277e' }, { r: 0.30, c: '#1f5eff' }, { r: 0.62, c: '#55c8f0' },
  { r: 0.26, c: '#fc002c' }, { r: 0.60, c: '#c3223f' }, { r: 0.13, c: '#7e1f3a' }, { r: 0.24, c: '#5a1030' },
  { r: 0.21, c: '#2c0a2e' }, { r: 0.72, c: '#0e1450' }, { r: 0.52, c: '#12277e' }, { r: 0.22, c: '#0f2fa8' },
  { r: 0.12, c: '#1f5eff' }, { r: 0.26, c: '#55c8f0' }, { r: 0.50, c: '#fc002c' }, { r: 0.12, c: '#8e2340' },
  { r: 0.09, c: '#5a1030' },
];
const UNIT = 92; // a full-size circle is 92px across
const W = WAVE.reduce((s, d) => s + d.r * UNIT, 0);
const H = UNIT;

/** When the map takes over. The waveform stays on screen another 400ms, fading through it. */
export const INTRO_MS = 1250;

export default function Intro({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const h = setTimeout(onDone, INTRO_MS);
    return () => clearTimeout(h);
  }, [onDone]);

  let x = 0;
  const mid = (WAVE.length - 1) / 2;
  return (
    <motion.div
      className="intro"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.14, transition: { duration: 0.42, ease: [0.4, 0, 0.2, 1] } }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: `min(${Math.round(W)}px, 60vw)` }} aria-hidden>
        {WAVE.map((d, i) => {
          const r = (d.r * UNIT) / 2;
          const cx = x + r;
          x += d.r * UNIT;
          return (
            <circle
              key={i}
              cx={cx}
              cy={H / 2}
              r={r}
              fill={d.c}
              style={{
                // out from the middle, then one wave travelling left to right
                ['--in' as string]: Math.round(Math.abs(i - mid) * 34) + 'ms',
                ['--beat' as string]: Math.round(540 + i * 18) + 'ms',
              }}
            />
          );
        })}
      </svg>
    </motion.div>
  );
}
