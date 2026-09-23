// The opening: the branding team's loading loop, played as vector capsules.
//
// Not a re-creation by eye — the loop itself was decoded frame by frame and measured, so what runs
// here is its own motion: the same seventeen circles, in their own colours, at their own places,
// each one stretching to the height the loop gives it on that frame. Nothing moves sideways, the
// widths never change, and every capsule stays centred on the same line — which is exactly what the
// source does. Drawn on a canvas so the caps stay perfectly round at any height and any screen.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { motion } from 'motion/react';

const FRAME_W = 1920, FRAME_H = 1080, MID = 539.5; // the source frame, and the line the row sits on
/** measured off frame 0: centre, diameter, colour. */
const ROW: [number, number, string][] = [
  [301.5, 24, '#051777'], [328.5, 30, '#03129a'], [378.5, 69, '#2241cb'], [483.5, 139, '#5bc5ee'],
  [588.5, 70, '#e33138'], [698.0, 149, '#bb273f'], [790.5, 34, '#871839'], [847.5, 80, '#69103b'],
  [922.0, 69, '#2c0236'], [1036.0, 159, '#15085b'], [1179.5, 128, '#071676'], [1277.5, 69, '#03129a'],
  [1329.0, 33, '#2145d6'], [1384.0, 75, '#5ecefb'], [1481.5, 120, '#e33138'], [1555.0, 27, '#b8273d'],
  [1579.5, 22, '#921b3c'],
];
/** and every frame after it: one height per capsule, 40ms apart, as the loop plays them. */
const HEIGHTS = `
23,29,69,139,69,149,35,79,69,159,129,69,33,75,119,27,21
31,29,69,139,69,149,35,79,69,159,129,69,33,75,119,27,21
47,39,69,139,69,149,35,79,69,159,129,69,33,75,119,27,21
69,61,79,139,69,149,35,79,69,159,129,69,33,75,119,27,21
97,93,107,145,69,149,35,79,69,159,129,69,33,75,119,27,21
127,131,149,169,77,149,35,79,69,159,129,69,33,75,119,27,21
159,175,201,203,109,151,35,79,69,159,129,69,33,75,119,27,21
189,221,259,247,161,171,41,79,69,159,129,69,33,75,119,27,21
217,267,321,299,229,207,81,81,69,159,129,69,33,75,119,27,21
241,309,383,353,307,251,155,107,69,159,129,69,33,75,119,27,21
259,345,441,405,389,303,257,155,91,159,129,69,33,75,119,27,21
267,371,489,457,473,359,375,225,137,171,129,69,33,75,119,27,21
267,387,529,501,551,415,503,307,201,199,139,69,33,75,119,27,21
259,389,551,535,621,469,633,395,279,241,163,79,33,75,119,27,21
241,377,557,557,677,519,759,487,365,291,201,115,43,75,119,27,21
219,353,541,563,713,555,871,577,455,349,249,169,89,81,119,27,21
193,321,513,553,727,583,965,657,541,409,303,237,165,111,121,27,21
165,283,471,529,713,595,1031,725,621,467,359,317,263,163,137,29,21
135,241,421,493,679,587,1061,773,689,521,415,399,375,233,169,43,21
105,199,365,451,625,567,1049,799,739,567,469,483,493,313,211,71,29
79,155,305,403,561,531,1003,795,765,601,513,561,613,399,259,109,47
55,115,247,351,487,487,927,765,765,623,549,629,727,485,311,155,73
37,79,191,301,409,439,831,713,739,625,569,683,827,569,365,205,103
25,53,143,251,329,385,717,647,691,609,573,717,907,643,417,257,135
23,35,105,209,253,331,595,569,629,579,561,727,961,703,465,307,171
`.trim().split('\n').map((r) => r.split(',').map(Number));

const STEP = 40;                            // the loop runs at 25fps
export const INTRO_MS = HEIGHTS.length * STEP;
const FADE = 160;                           // the row arrives out of the black, already at rest
// the row sits a little left of centre in the source frame; put it back on the middle
const SHIFT = FRAME_W / 2 - (ROW[0][0] - ROW[0][1] / 2 + (ROW[16][0] + ROW[16][1] / 2 - (ROW[0][0] - ROW[0][1] / 2)) / 2);

export default function Intro({ onDone }: { onDone: () => void }) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const end = useRef(onDone);
  end.current = onDone;

  // if animation frames stop coming at all — a background tab — hand over anyway
  useEffect(() => {
    const h = setTimeout(() => end.current(), INTRO_MS + 3000);
    return () => clearTimeout(h);
  }, []);

  useLayoutEffect(() => {
    const el = cvs.current;
    if (!el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const k = (el.getBoundingClientRect().width / FRAME_W) * dpr;
    el.width = Math.round(FRAME_W * k);
    el.height = Math.round(FRAME_H * k);
    const g = el.getContext('2d')!;
    const last = HEIGHTS.length - 1;

    let raf = 0;
    // the loop is driven by the frames it actually gets, not by the clock: building the rest of the
    // screen blocks the main thread for over a second, and a wall clock would run the whole opening
    // out during that pause and show none of it. A gap longer than a few frames counts as a few.
    let prev = performance.now(), t = 0, over = false;
    const frame = (now: number) => {
      t += Math.min(now - prev, 64);
      prev = now;
      // read the loop between its own frames, so it plays smooth at whatever the screen refreshes at
      const f = Math.min(last, t / STEP);
      const i = Math.floor(f), j = Math.min(last, i + 1), u = f - i;
      g.clearRect(0, 0, el.width, el.height);
      g.globalAlpha = Math.min(1, t / FADE);
      for (let n = 0; n < ROW.length; n++) {
        const [cx, w, c] = ROW[n];
        const h = HEIGHTS[i][n] + (HEIGHTS[j][n] - HEIGHTS[i][n]) * u;
        g.fillStyle = c;
        g.beginPath();
        g.roundRect((cx + SHIFT - w / 2) * k, (MID - h / 2) * k, w * k, h * k, (w / 2) * k);
        g.fill();
      }
      if (t >= INTRO_MS && !over) { over = true; end.current(); }
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
      {/* the row reads at the same size as before: 760px across, in the source's own frame */}
      <canvas ref={cvs} style={{ width: 'min(1122px, 88vw)', aspectRatio: `${FRAME_W} / ${FRAME_H}` }} aria-hidden />
    </motion.div>
  );
}
