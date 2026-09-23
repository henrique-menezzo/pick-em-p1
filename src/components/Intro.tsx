// The opening. A row of capsules with a swell running through them, the way the reference loop
// behaves: a broad wave is already alive when the row appears, so at any instant some are stretching
// tall and narrow while their neighbours are settling back — one body of liquid being squeezed
// along its length. Painted on a canvas so the caps stay perfectly round at any height, and so the
// whole thing costs one draw call per frame.
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

const FADE = 240;    // the row fades in, centre first — the swell is already running underneath
const PERIOD = 780;  // one full breath
const WL = 1.05;     // one wave spans the row, so a crest and a trough are on screen together
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

    // each capsule's resting size, its place along the row (0..1) and how far it can stretch
    let acc = 0;
    const bars = WAVE.map((d, i) => {
      const w = d.r * UNIT;
      const b = { w, u: (acc + w / 2) / W, c: d.c, amp: 1.6 + (1 - d.r) * 1.3, in: Math.abs(i - mid) * 20 };
      acc += w;
      return b;
    });
    const cy = (H / 2) * k;

    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = now - t0;

      // stretch tall, and give the width back: the row keeps its mass, so it reads as one body of
      // liquid being squeezed rather than seventeen meters reacting to a beat. The wave runs from
      // the first frame, so nothing waits its turn — each capsule is already on its way up or down.
      const shape = bars.map((b) => {
        const s = 1 + b.amp * (0.5 + 0.5 * Math.cos(2 * Math.PI * (t / PERIOD - b.u / WL)));
        return { ...b, h: b.w * s, ww: b.w / Math.sqrt(s) };
      });

      // relay the row out from its live widths, centred, so the capsules stay touching as they move
      const total = shape.reduce((s, b) => s + b.ww, 0);
      let x = (W - total) / 2;

      g.clearRect(0, 0, el.width, el.height);
      for (const b of shape) {
        const a = Math.min(1, Math.max(0, (t - b.in) / FADE));
        const cx = x + b.ww / 2;
        x += b.ww;
        if (a <= 0) continue;
        g.globalAlpha = a;
        g.fillStyle = b.c;
        g.beginPath();
        g.roundRect((cx - b.ww / 2) * k, cy - (b.h / 2) * k, b.ww * k, b.h * k, (b.ww / 2) * k);
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
