// The opening. A row of capsules with a swell running through them, the way the reference loop
// behaves: the wave is already alive when the row appears, so at any instant some are stretching up
// while their neighbours are settling back. The row itself holds still — each capsule keeps its
// place and its width, and all the softness is in how it grows and lets go. Painted on a canvas so
// the caps stay perfectly round at any height, and so the whole thing costs one draw call per frame.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { motion } from 'motion/react';

/** The branding team's row, measured off their frame: diameters as a share of the biggest, and the
    colour each one carries. They touch, so the row's length is just the sum of them. */
const WAVE: { r: number; c: string }[] = [
  { r: 0.13, c: '#16165e' }, { r: 0.17, c: '#1a1e7a' }, { r: 0.41, c: '#2b5ce0' }, { r: 0.84, c: '#55c8f0' },
  { r: 0.38, c: '#ef3b34' }, { r: 0.97, c: '#c3304e' }, { r: 0.22, c: '#8e2340' }, { r: 0.39, c: '#5e1236' },
  { r: 0.37, c: '#3a0a2e' }, { r: 1.00, c: '#1a0f52' }, { r: 0.72, c: '#12277e' }, { r: 0.34, c: '#0f2fa8' },
  { r: 0.17, c: '#2b5ce0' }, { r: 0.38, c: '#55c8f0' }, { r: 0.70, c: '#ef3b34' }, { r: 0.17, c: '#a02440' },
  { r: 0.13, c: '#7a1a38' },
];
const UNIT = 150;                  // the biggest circle is 150px across
const GAP = 7;                     // and they sit on the line with a little air between them, as in the loop
const W = WAVE.reduce((s, d) => s + d.r * UNIT, 0) + GAP * (WAVE.length - 1);
const H = UNIT * 3.6;              // headroom for the tallest bar

const FADE = 200;   // the circles are simply there, and the first one is already moving
const SPREAD = 430; // the swell takes this long to travel from the left end to the right one
const RISE = 520;   // and this long to lift one circle and set it back down
export const INTRO_MS = 950;

export default function Intro({ onDone }: { onDone: () => void }) {
  const cvs = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const h = setTimeout(onDone, INTRO_MS);
    return () => clearTimeout(h);
  }, [onDone]);

  useLayoutEffect(() => {
    const el = cvs.current;
    if (!el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const k = (el.getBoundingClientRect().width / W) * dpr;
    el.width = Math.round(W * k);
    el.height = Math.round(H * k);
    const g = el.getContext('2d')!;

    // lay the row out once — fixed centres, fixed widths — then only the heights move
    let acc = 0;
    const bars = WAVE.map((d) => {
      const w = d.r * UNIT;
      const b = { w, x: acc + w / 2, u: (acc + w / 2) / W, c: d.c, amp: 1.7 + (1 - d.r) * 1.3 };
      acc += w + GAP;
      return b;
    });
    const cy = (H / 2) * k;

    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = now - t0;
      g.clearRect(0, 0, el.width, el.height);
      for (const b of bars) {
        const a = Math.min(1, Math.max(0, (t - b.u * 60) / FADE));
        if (a <= 0) continue;
        // the swell starts on the leftmost circle and runs down the line; each one lifts and settles
        // on a curve that is flat at both ends, so it eases out of the circle and never snaps back
        const p = (t - b.u * SPREAD) / RISE;
        const raw = p <= 0 || p >= 1 ? 0 : Math.sin(p * Math.PI);
        const e = raw * raw * (3 - 2 * raw);
        const h = b.w * (1 + b.amp * e);
        g.globalAlpha = a;
        g.fillStyle = b.c;
        g.beginPath();
        g.roundRect((b.x - b.w / 2) * k, cy - (h / 2) * k, b.w * k, h * k, (b.w / 2) * k);
        g.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <motion.div
      className="intro"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.08, transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] } }}
    >
      <motion.canvas
        ref={cvs}
        initial={{ scale: 0.94 }}
        animate={{ scale: 1, transition: { duration: 0.42, ease: [0.2, 0.7, 0.2, 1] } }}        style={{ width: `min(760px, 58vw)`, aspectRatio: `${W} / ${H}` }}
        aria-hidden
      />
    </motion.div>
  );
}
