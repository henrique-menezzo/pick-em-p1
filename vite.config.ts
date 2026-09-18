import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// On GitHub Pages the app lives at /pick-em-p1/; locally it stays at /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/pick-em-p1/' : '/',
  plugins: [react(), tailwindcss()],
}));
