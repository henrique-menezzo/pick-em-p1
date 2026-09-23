// The waveform that opens every visit to the map. It holds for the length of the loop, then lifts
// away while the screen behind it assembles itself.
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { asset } from './ui';

export default function Intro({ onDone }: { onDone: () => void }) {
  const [ready, setReady] = useState(false);

  // the gif runs 3s; hand over just before it loops
  useEffect(() => {
    if (!ready) return;
    const h = setTimeout(onDone, 2500);
    return () => clearTimeout(h);
  }, [ready, onDone]);

  // a slow connection must not hold the screen hostage
  useEffect(() => {
    const h = setTimeout(() => setReady(true), 2000);
    return () => clearTimeout(h);
  }, []);

  return (
    <motion.div
      className="intro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.25 } }}
      exit={{ opacity: 0, filter: 'blur(16px)', transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] } }}
    >
      {/* the frame crops the 1920x1080 loop to the band the waveform lives in, as in Figma */}
      <motion.span
        className="win"
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: ready ? 1 : 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <img src={asset('intro.gif')} alt="" draggable={false} onLoad={() => setReady(true)} />
      </motion.span>
    </motion.div>
  );
}
