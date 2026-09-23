// The opening. A row of capsules — circles at rest — with a wave running through them, the way the
// reference loop behaves: each one stretches into a bar as the wave passes and settles back into a
// circle. Painted on a canvas so the caps stay perfectly round at any height, and so the whole
// thing costs one draw call per frame.
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
const UNIT = 150;                                   // the biggest circle is 150px across
const W = WAVE.reduce((s, d) => s + d.r * UNIT, 0); // the row at its natural size
const H = UNIT * 3.6;                               // headroom for the tallest bar

const FADE = 300;  // each capsule fades in
const RISE = 520;  // the wave takes this long to pass through one of them
const STEP = 30;   // and this long to move to the next
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
    const mid = (WAVE.length - 1) / 2;

    // lay the row out once: touching capsules, centred
    let x = 0;
    const bars = WAVE.map((d, i) => {
      const w = d.r * UNIT;
      const b = { x: (x + w / 2) * k, w: w * k, c: d.c, amp: 2.5 + (1 - d.r) * 1.4, in: Math.abs(i - mid) * 22, up: 120 + i * STEP };
      x += w;
      return b;
    });
    const cy = (H / 2) * k;
    // there and back on a sine, so a bar leaves as gently as it arrives
    const swell = (p: number) => (p <= 0 || p >= 1 ? 0 : Math.sin(p * Math.PI) ** 2);

    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = now - t0;
      g.clearRect(0, 0, el.width, el.height);
      for (const b of bars) {
        const a = Math.min(1, Math.max(0, (t - b.in) / FADE));
        if (a <= 0) continue;
        const h = b.w * (1 + (b.amp - 1) * swell((t - b.up) / RISE));
        g.globalAlpha = a;
        g.fillStyle = b.c;
        g.beginPath();
        g.roundRect(b.x - b.w / 2, cy - h / 2, b.w, h, b.w / 2);
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
      <canvas ref={cvs} style={{ width: `min(760px, 58vw)`, aspectRatio: `${W} / ${H}` }} aria-hidden />
    </motion.div>
  );
}
