import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/libre-franklin/400.css';
import '@fontsource/libre-franklin/500.css';
import '@fontsource/libre-franklin/600.css';
import './index.css';
import App from './App';
import HeaderBoard from './components/HeaderBoard';

// ?board=1 — the header exploration board, outside the product
const BOARD = new URLSearchParams(location.search).has('board');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {BOARD ? <HeaderBoard /> : <App />}
  </StrictMode>,
);
