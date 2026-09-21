// Race data (same generator as pick-em-gamemode/shared/core.js, so names match across prototypes)
// plus a deterministic simulation of election night used by the "Election Night" preview.

export type Side = 'R' | 'D';
export type Tab = 'senate' | 'gov' | 'house';

export interface Race {
  id: string;
  type: Tab;
  state: string;
  stateName: string;
  region: string;
  R: string;
  D: string;
  margin: number;
  marketR: number;
  poll: Side;
  market: Side; // who the (simulated) prediction market has ahead
  tight: boolean;
}

export const STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

const REGION: Record<string, string> = {
  Northeast: 'CT DE DC ME MD MA NH NJ NY PA RI VT',
  South: 'AL AR FL GA KY LA MS NC OK SC TN TX VA WV',
  Midwest: 'IL IN IA KS MI MN MO NE ND OH SD WI',
  West: 'AK AZ CA CO HI ID MT NV NM OR UT WA WY',
};
const regionOf: Record<string, string> = {};
for (const [r, list] of Object.entries(REGION)) for (const st of list.split(' ')) regionOf[st] = r;

const SENATE = 'AL AK AR CO DE FL GA ID IL IA KS KY LA ME MA MI MN MS MT NE NH NJ NM NC OH OK OR RI SC SD TN TX VA WV WY'.split(' ');
const GOVERNOR = 'AL AK AZ AR CA CO CT FL GA HI ID IL IA KS ME MD MA MI MN NE NV NH NM NY OH OK OR PA RI SC SD TN TX VT WI WY'.split(' ');
const HOUSE = 'AZ CA CO FL GA IA IL KS ME MI MN MT NE NV NJ NM NY NC OH OR PA TN TX VA WA WI'.split(' ');
const LEAN: Record<string, number> = { AL: 30, AK: 13, AZ: 5, AR: 30, CA: -20, CO: -11, CT: -14, DE: -15, FL: 13, GA: 2, HI: -23, ID: 36, IL: -11, IN: 19, IA: 13, KS: 16, KY: 30, LA: 22, ME: -7, MD: -28, MA: -25, MI: 1, MN: -4, MS: 23, MO: 18, MT: 20, NE: 20, NV: 3, NH: -3, NJ: -6, NM: -6, NY: -13, NC: 3, ND: 36, OH: 11, OK: 34, OR: -14, PA: 2, RI: -14, SC: 18, SD: 29, TN: 29, TX: 14, UT: 22, VT: -32, VA: -6, WA: -18, WV: 42, WI: 1, WY: 46 };

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed: string) {
  let a = hash(seed);
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const FIRST = ['Holly', 'Mark', 'Dana', 'Grant', 'Elena', 'Russ', 'Tara', 'Owen', 'Maya', 'Cole', 'Nina', 'Brett', 'Lena', 'Wade', 'Carla', 'Reid', 'Joanna', 'Troy', 'Priya', 'Glenn'];
const LAST = ['Vance', 'Holloway', 'Pruitt', 'Castellano', 'Whitaker', 'Okafor', 'Brennan', 'Lindqvist', 'Harlan', 'Delgado', 'Mercer', 'Ashby', 'Novak', 'Tillman', 'Rourke', 'Farris', 'Kimura', 'Galloway', 'Sutter', 'Crane'];
const person = (seed: string) => { const r = rng(seed); return FIRST[Math.floor(r() * FIRST.length)] + ' ' + LAST[Math.floor(r() * LAST.length)]; };
const logistic = (x: number) => 1 / (1 + Math.exp(-x));

export const TAB_LABEL: Record<Tab, string> = { senate: 'Senate', gov: 'Governor', house: 'House' };
export const TABS: Tab[] = ['senate', 'gov', 'house'];

function build(type: Tab, st: string, base: number): Race {
  const id = type + '-' + st;
  const r = rng(id);
  const margin = Math.round((base + (r() - 0.5) * 3) * 10) / 10;
  const marketR = Math.round(Math.min(0.97, Math.max(0.03, logistic(margin / 3.2 + (r() - 0.5) * 0.9))) * 100);
  return {
    id, type, state: st, stateName: STATES[st], region: regionOf[st],
    R: person(id + 'R'), D: person(id + 'D'),
    margin, marketR, poll: margin >= 0 ? 'R' : 'D', market: marketR >= 50 ? 'R' : 'D', tight: Math.abs(margin) < 6,
  };
}
const ENV = -2.5;
const byName = (a: Race, b: Race) => a.stateName.localeCompare(b.stateName);
export const RACES: Record<Tab, Race[]> = {
  senate: SENATE.map((st) => build('senate', st, LEAN[st] * 0.8 + ENV)).sort(byName),
  gov: GOVERNOR.map((st) => build('gov', st, LEAN[st] * 0.7 + ENV)).sort(byName),
  house: HOUSE.map((st) => build('house', st, LEAN[st] * 0.25 + ENV)).sort(byName),
};
// The Figma frame shows New Mexico's Senate race with these two names.
Object.assign(RACES.senate.find((r) => r.state === 'NM')!, { R: 'Adrian Smith', D: 'Becky Stille' });

export const ALL: Race[] = [...RACES.senate, ...RACES.gov, ...RACES.house];
export const BY_ID: Record<string, Race> = Object.fromEntries(ALL.map((r) => [r.id, r]));
export const raceIn = (tab: Tab, st: string) => RACES[tab].find((r) => r.state === st);

// ---- Election night simulation --------------------------------------------------------------
// Minutes after 7:00 PM ET. Polls close by region, tight races take longer to call.
export const T_MAX = 480; // 3:00 AM
export interface Result { winner: Side; rShare: number; close: number; call: number }

export const RESULTS: Record<string, Result> = {};
for (const r of ALL) {
  const g = rng('night:' + r.id);
  const winner: Side = g() < r.marketR / 100 ? 'R' : 'D';
  const lead = Math.max(0.6, Math.abs(r.margin) * 0.55 + (g() - 0.3) * 5);
  const rShare = 50 + (winner === 'R' ? 1 : -1) * (lead / 2) - 1.2 * g();
  const base = r.state === 'AK' || r.state === 'HI' ? 330 : { Northeast: 0, South: 30, Midwest: 60, West: 150 }[r.region] ?? 60;
  const close = base + Math.round(g() * 4) * 30;
  const call = Math.min(T_MAX - 10, close + (r.tight ? 45 + g() * 150 : 2 + g() * 38));
  RESULTS[r.id] = { winner, rShare: Math.round(rShare * 10) / 10, close, call: Math.round(call) };
}

export type Status = 'polls' | 'counting' | 'called';
export function statusAt(id: string, t: number): { status: Status; reporting: number; rShare: number } {
  const res = RESULTS[id];
  if (t < res.close) return { status: 'polls', reporting: 0, rShare: 50 };
  const k = Math.min(1, (t - res.close) / Math.max(1, res.call - res.close));
  const reporting = t >= res.call ? Math.round(92 + Math.min(8, (t - res.call) / 12)) : Math.round(4 + k * 80);
  // early counts wobble around 50, then settle on the final share
  const wobble = (rng(id + Math.floor(t / 10))() - 0.5) * 6 * (1 - k);
  const rShare = 50 + (res.rShare - 50) * (0.35 + 0.65 * k) + wobble;
  return { status: t >= res.call ? 'called' : 'counting', reporting, rShare: Math.round(rShare * 10) / 10 };
}

export function clock(t: number) {
  const m = 19 * 60 + Math.round(t);
  const h = Math.floor(m / 60) % 24;
  const mm = String(m % 60).padStart(2, '0');
  return `${((h + 11) % 12) + 1}:${mm} ${h >= 12 && h < 24 ? 'PM' : 'AM'}`;
}
