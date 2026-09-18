// Full, uniform dot lattice for the map: every cell filled (no empty row between states), with a
// one-sided "seam" flag on cells whose right/bottom neighbour belongs to another state. The seam dots
// are drawn slightly smaller, which is the whole state division — minimal on purpose.
// Input: ../pick-em-game/shared/dots.js (4152 dot centres, states touching, same 11.11 lattice).
import { readFileSync, writeFileSync } from 'node:fs';
const raw = readFileSync(new URL('../../pick-em-game/shared/dots.js', import.meta.url), 'utf8');
const src = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
const PITCH = 11.1136;
const votes = new Map(), sizes = {};
for (const [st, pts] of Object.entries(src.states)) {
  sizes[st] = pts.length;
  for (const [x, y] of pts) {
    const k = `${Math.round(x / PITCH)},${Math.round(y / PITCH)}`;
    const v = votes.get(k) || {}; v[st] = (v[st] || 0) + 1; votes.set(k, v);
  }
}
const owner = new Map();
for (const [k, v] of votes) owner.set(k, Object.entries(v).sort((a, b) => b[1] - a[1] || sizes[a[0]] - sizes[b[0]])[0][0]);
// tiny states keep a clickable minimum
for (const [st, want] of Object.entries({ DC: 1, DE: 3, RI: 2 })) {
  const have = [...owner].filter(([, s]) => s === st).length;
  if (have >= want) continue;
  const pts = src.states[st];
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length / PITCH, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length / PITCH;
  const cand = [];
  for (let c = Math.floor(cx) - 2; c <= Math.ceil(cx) + 2; c++) for (let r = Math.floor(cy) - 2; r <= Math.ceil(cy) + 2; r++) {
    const o = owner.get(`${c},${r}`);
    if (o !== st && (!o || sizes[o] > 60)) cand.push([c, r, (c - cx) ** 2 + (r - cy) ** 2]);
  }
  cand.sort((a, b) => a[2] - b[2]).slice(0, want - have).forEach(([c, r]) => owner.set(`${c},${r}`, st));
}
const cellsOf = {};
for (const st of owner.values()) cellsOf[st] = (cellsOf[st] || 0) + 1;
// Along every border (right / bottom neighbour pairs) the BIGGER state gives up its dot, so the gap is
// one dot wide and narrow states (MD, VT, NH, RI, DE…) keep all of theirs.
const gap = new Set();
for (const [k, st] of owner) {
  const [c, r] = k.split(',').map(Number);
  for (const [dc, dr] of [[1, 0], [0, 1]]) {
    const k2 = `${c + dc},${r + dr}`, o = owner.get(k2);
    if (!o || o === st) continue;
    if (gap.has(k) || gap.has(k2)) continue;
    const big = cellsOf[st] > cellsOf[o] || (cellsOf[st] === cellsOf[o] && st > o) ? k : k2;
    if (cellsOf[owner.get(big)] >= 20) gap.add(big); // two small neighbours just touch
  }
}
const states = {};
for (const [k, st] of owner) {
  const [c, r] = k.split(',').map(Number);
  (states[st] ||= []).push([c, r, gap.has(k) ? 1 : 0]);
}
for (const pts of Object.values(states)) pts.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
writeFileSync(new URL('../src/data/grid.json', import.meta.url), JSON.stringify({ pitch: PITCH, r: 3.46, w: 1204, h: 754, states }));
console.log('cells', owner.size, 'states', Object.keys(states).length, 'seams', Object.values(states).flat().filter((p) => p[2]).length);
