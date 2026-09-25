import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ALL, BY_ID, RACES, RESULTS, T_MAX, TABS, type Side, type Tab } from '../data/races';

export type AuthReason = 'save' | 'play' | 'night';
export type Theme = 'dark' | 'light';
/** Two ways of drawing the same country: the states themselves, or a field of dots. */
export type MapKind = 'shape' | 'dots';
export interface User { name: string; email: string; initials: string }

function userFrom(email: string): User {
  const local = email.split('@')[0].replace(/[0-9]+/g, '');
  const parts = local.split(/[._-]+/).filter(Boolean);
  const name = parts.length ? parts.map((p) => p[0].toUpperCase() + p.slice(1)).join(' ') : 'Reader';
  const initials = (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
  return { name, email, initials };
}

// The Figma frame's matrix, row by row (R / D / o = open). New Mexico (Senate #23) is the current race.
const SEED: Record<Tab, string> = {
  senate: 'RRoRDoRDoRDo' + 'DDoRDoDRoRoR' + 'DDoRDoDooRo',
  gov: 'RooRooRooDoo' + 'DooDooDooRoo' + 'RooDooDooDoo',
  house: '',
};
function seedPicks() {
  const picks: Record<string, Side> = {};
  for (const tab of TABS) RACES[tab].forEach((r, i) => { const c = SEED[tab][i]; if (c === 'R' || c === 'D') picks[r.id] = c; });
  return picks;
}

interface State {
  picks: Record<string, Side>;
  tab: Tab;
  cursor: Record<Tab, string>;
  live: boolean;
  t: number;
  playing: boolean;
  savedAt: number | null;
  user: User | null;
  panelMin: boolean;
  tourDone: boolean;
  /** the design system has both modes; the switch by "My picks" chooses one */
  theme: Theme;
  mapKind: MapKind;
  /** the opening transition: the waveform, then the screen assembling itself, then the game */
  phase: 'intro' | 'enter' | 'live';
  tour: number | null;
  /** while a tour step is up, the only state the map answers for ('' = none at all) */
  tourLock: string | null;
  // transient
  auth: { mode: 'signup' | 'login'; reason: AuthReason } | null;
  toast: { msg: string; n: number } | null;
  hoverId: string | null;
  pulse: Record<string, number>;
  flash: { id: string; n: number } | null;

  setTab(tab: Tab): void;
  select(id: string): void;
  vote(id: string, side: Side | null): void;
  toggle(id: string, side: Side, opts?: { advance?: boolean }): void;
  tap(id: string): void;
  step(dir: 1 | -1): void;
  autofill(source: 'polls' | 'market'): void;
  save(): void;
  resetPicks(): void;
  setLive(on: boolean): void;
  setT(t: number): void;
  setPlaying(p: boolean): void;
  setHover(id: string | null): void;
  openAuth(reason: AuthReason, mode?: 'signup' | 'login'): void;
  closeAuth(): void;
  signIn(email: string): void;
  signOut(): void;
  say(msg: string): void;
  setTour(step: number | null): void;
  setPhase(phase: 'intro' | 'enter' | 'live'): void;
  setPanelMin(min: boolean): void;
  setTheme(theme: Theme): void;
  setMapKind(kind: MapKind): void;
  /** Election Night needs an account and a saved map. */
  goLive(on: boolean): void;
}

let advanceTimer = 0;

// Picks lock when election day starts counting: Nov 3, 2026, 6:00 PM ET (first polls close).
// `?lock=N` moves it to N minutes from now, to preview the countdown ending.
const lockQ = new URLSearchParams(location.search).get('lock');
export const LOCK_AT = lockQ != null ? Date.now() + +lockQ * 60000 : Date.parse('2026-11-03T18:00:00-05:00');
export const isLocked = () => Date.now() >= LOCK_AT;

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      picks: seedPicks(),
      tab: 'senate',
      cursor: { senate: RACES.senate.find((r) => r.state === 'NM')!.id, gov: RACES.gov[0].id, house: RACES.house[0].id },
      live: false,
      t: 162,
      playing: false,
      savedAt: null,
      user: null,
      panelMin: false,
      tourDone: false,
      theme: (new URLSearchParams(location.search).get('theme') as Theme) || 'dark',
      mapKind: (new URLSearchParams(location.search).get('map') === '2' ? 'dots' : 'shape'),
      phase: 'intro',
      tour: null,
      tourLock: null,
      auth: null,
      toast: null,
      hoverId: null,
      pulse: {},
      flash: null,

      setTab: (tab) => set({ tab, hoverId: null }),
      select: (id) => {
        const r = BY_ID[id];
        clearTimeout(advanceTimer);
        set((s) => ({
          tab: r.type,
          cursor: { ...s.cursor, [r.type]: id },
          panelMin: false, // picking anywhere brings the panel back
          hoverId: null, // a click always ends any borrowed spotlight
          flash: { id, n: (s.flash?.n ?? 0) + 1 },
        }));
      },
      vote: (id, side) =>
        set((s) => {
          if (isLocked()) return {};
          const picks = { ...s.picks };
          if (side) picks[id] = side; else delete picks[id];
          return { picks, savedAt: null, pulse: { ...s.pulse, [id]: (s.pulse[id] ?? 0) + 1 } };
        }),
      toggle: (id, side, opts) => {
        const s = get();
        if (s.live) return;
        if (isLocked()) return s.say('Picks are locked for election day');
        const next = s.picks[id] === side ? null : side;
        s.vote(id, next);
        if (next && opts?.advance) {
          clearTimeout(advanceTimer);
          // let the pick land on the map before moving on
          advanceTimer = window.setTimeout(() => {
            const st = get();
            if (st.cursor[st.tab] !== id) return;
            const n = nextOpen(id, st.picks);
            if (n) st.select(n);
          }, 520);
        }
      },
      /** Map click. Empty → R; clicking the selected state again cycles R → D → empty;
       *  clicking a state you already voted (not selected) just selects it so you can see your pick. */
      tap: (id) => {
        const s = get();
        const p = s.picks[id];
        const isCur = s.cursor[BY_ID[id].type] === id && s.tab === BY_ID[id].type;
        s.select(id);
        if (s.live || (p && !isCur)) return;
        if (isLocked()) return s.say('Picks are locked for election day');
        s.vote(id, !p ? 'R' : p === 'R' ? 'D' : null);
      },
      step: (dir) => {
        const s = get();
        const list = RACES[s.tab];
        const i = list.findIndex((r) => r.id === s.cursor[s.tab]);
        s.select(list[(i + dir + list.length) % list.length].id);
      },
      autofill: (source) => {
        const s = get();
        if (isLocked()) return;
        let todo = RACES[s.tab].filter((r) => !s.picks[r.id]);
        if (!todo.length) todo = ALL.filter((r) => !s.picks[r.id]);
        // one quiet change: every open race fills at once (colours fade via CSS), no per-state ripple
        const picks = { ...s.picks };
        for (const r of todo) picks[r.id] = source === 'market' ? r.market : r.poll;
        set({ picks, savedAt: null });
      },
      save: () => set({ savedAt: Date.now() }),
      resetPicks: () => set((s) => (isLocked() ? {} : { picks: {}, savedAt: null, cursor: { senate: RACES.senate[0].id, gov: RACES.gov[0].id, house: RACES.house[0].id }, pulse: { ...s.pulse } })),
      setLive: (live) => set({ live, playing: false, hoverId: null }),
      setT: (t) => set({ t: Math.max(0, Math.min(T_MAX, t)) }),
      setPlaying: (playing) => set((s) => ({ playing, t: playing && s.t >= T_MAX ? 0 : s.t })),
      setHover: (hoverId) => set({ hoverId }),
      openAuth: (reason, mode = 'signup') => set({ auth: { mode, reason } }),
      closeAuth: () => set({ auth: null }),
      signIn: (email) => {
        const reason = get().auth?.reason;
        const user = userFrom(email);
        set({ user, auth: null });
        const s = get();
        const ready = ALL.every((r) => s.picks[r.id]);
        if (reason === 'save' && ready) { s.save(); s.say(`Signed in as ${user.name} · map saved`); }
        else if (reason === 'night' && s.savedAt) { s.setLive(true); s.say(`Signed in as ${user.name}`); }
        else s.say(ready ? `Signed in as ${user.name} · save your map` : `Signed in as ${user.name} · finish your map to save it`);
      },
      signOut: () => set({ user: null, live: false, playing: false }),
      say: (msg) => set((s) => ({ toast: { msg, n: (s.toast?.n ?? 0) + 1 } })),
      setPanelMin: (panelMin) => set({ panelMin }),
      setTheme: (theme) => { applyTheme(theme); set({ theme }); },
      // the spotlight and the tour read the map straight from the DOM, so swapping it ends any hover
      setMapKind: (mapKind) => set({ mapKind, hoverId: null }),
      setPhase: (phase) => set({ phase }),
      setTour: (tour) => set({ tour, tourDone: tour === null ? true : get().tourDone }),
      goLive: (on) => {
        const s = get();
        if (!on) return s.setLive(false);
        if (!s.user) return s.openAuth('night');
        if (!s.savedAt) return s.say('Save your map to compare it on election night');
        s.setLive(true);
      },
    }),
    {
      name: 'pick-em-p1',
      partialize: (s) => ({ picks: s.picks, tab: s.tab, cursor: s.cursor, live: s.live, t: s.t, savedAt: s.savedAt, user: s.user, tourDone: s.tourDone, panelMin: s.panelMin, theme: s.theme, mapKind: s.mapKind }),
      onRehydrateStorage: () => (st) => applyTheme(st?.theme ?? 'dark'),
    },
  ),
);

/** Next race without a pick. It stays inside the chamber you are working through and wraps around
 *  it — you leave the Senate when the Senate is finished, or when you choose to, never because you
 *  happened to reach the bottom of the list. */
export function nextOpen(fromId: string, picks: Record<string, Side>) {
  const list = RACES[BY_ID[fromId].type];
  const i = list.findIndex((r) => r.id === fromId);
  for (let k = 1; k <= list.length; k++) {
    const r = list[(i + k) % list.length];
    if (!picks[r.id]) return r.id;
  }
  // this chamber is done: carry on into the next one that still has something open
  const j = ALL.findIndex((r) => r.id === fromId);
  for (let k = 1; k <= ALL.length; k++) {
    const r = ALL[(j + k) % ALL.length];
    if (!picks[r.id]) return r.id;
  }
  return null;
}

/** Dark is the default, so the attribute is only ever present for Light. */
export function applyTheme(theme: Theme) {
  if (theme === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
}

export const currentId = (s: State) => s.cursor[s.tab];

export function liveScore(picks: Record<string, Side>, t: number, tab?: Tab) {
  const list = tab ? RACES[tab] : ALL;
  let called = 0, correct = 0, missed = 0;
  for (const r of list) {
    if (t < RESULTS[r.id].call) continue;
    called++;
    const p = picks[r.id];
    if (!p) continue;
    if (p === RESULTS[r.id].winner) correct++; else missed++;
  }
  return { called, correct, missed, total: list.length };
}
