import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// On GitHub Pages the app lives at /pick-em-p1/; locally it stays at /. The usability builds live
// one level further down (/pick-em-p1/picks/, /pick-em-p1/night/) and say so through VITE_BASE.
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE || (command === 'build' ? '/pick-em-p1/' : '/'),
  plugins: [react(), tailwindcss()],
}));
