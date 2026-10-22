'use strict';
// Pop Defense - an original balloon-popping tower defense game. All art is drawn in code.
(() => {
const W = 960, H = 640, TAU = Math.PI * 2, BASE = 52;
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// ---------------- maps
const MAPS = [
  { name: 'Meadow Loop', level: 'Beginner', theme: 'meadow', grass: '#7cc35a', grass2: '#6cb34b', path: '#dcbc80', edge: '#b48f58',
    pts: [[-30, 120], [220, 120], [220, 430], [480, 430], [480, 180], [740, 180], [740, 520], [990, 520]] },
  { name: 'Zigzag Canyon', level: 'Intermediate', theme: 'canyon', grass: '#d2aa6c', grass2: '#c39a5e', path: '#8d6b45', edge: '#6b4f33',
    pts: [[-30, 90], [860, 90], [860, 250], [100, 250], [100, 410], [860, 410], [860, 560], [-30, 560]] },
  { name: 'Frozen Spiral', level: 'Advanced', theme: 'snow', grass: '#e3f0f8', grass2: '#d3e6f2', path: '#9db6c9', edge: '#7a95aa',
    pts: [[480, -30], [480, 110], [840, 110], [840, 540], [120, 540], [120, 200], [700, 200], [700, 440], [300, 440], [300, 320], [520, 320]] },
];
function prepPath(pts) { const seg = []; let L = 0; for (let i = 0; i < pts.length - 1; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[i + 1], l = Math.hypot(x2 - x1, y2 - y1); seg.push({ x1, y1, x2, y2, l, s: L }); L += l; } return { seg, len: L, pts }; }
function posOn(P, d) { const sg = P.seg; if (d <= 0) return [sg[0].x1, sg[0].y1]; for (const s of sg) if (d <= s.s + s.l) { const t = (d - s.s) / s.l; return [s.x1 + (s.x2 - s.x1) * t, s.y1 + (s.y2 - s.y1) * t]; } const s = sg[sg.length - 1]; return [s.x2, s.y2]; }
function distPath(P, x, y) { let m = 1e9; for (const s of P.seg) { const dx = s.x2 - s.x1, dy = s.y2 - s.y1; let t = ((x - s.x1) * dx + (y - s.y1) * dy) / (dx * dx + dy * dy); t = Math.max(0, Math.min(1, t)); m = Math.min(m, Math.hypot(x - s.x1 - dx * t, y - s.y1 - dy * t)); } return m; }

// ---------------- balloons
const BT = {
  red:     { hp: 1, spd: 1.0, col: '#e8343a', kids: [], r: 11 },
  blue:    { hp: 1, spd: 1.4, col: '#2f7bf0', kids: ['red'], r: 12 },
  green:   { hp: 1, spd: 1.8, col: '#3fb33f', kids: ['blue'], r: 12.5 },
  yellow:  { hp: 1, spd: 3.2, col: '#f6d21c', kids: ['green'], r: 13 },
  pink:    { hp: 1, spd: 3.5, col: '#ff7eb6', kids: ['yellow'], r: 13 },
  black:   { hp: 1, spd: 1.8, col: '#24262b', kids: ['pink', 'pink'], r: 9, imm: { explode: 1 } },
  white:   { hp: 1, spd: 2.0, col: '#f5f5f5', kids: ['pink', 'pink'], r: 9, imm: { freeze: 1 } },
  lead:    { hp: 1, spd: 1.0, col: '#8d96a0', kids: ['black', 'black'], r: 13, imm: { sharp: 1 } },
  zebra:   { hp: 1, spd: 1.8, col: '#fff', kids: ['black', 'white'], r: 13, imm: { explode: 1, freeze: 1 } },
  rainbow: { hp: 1, spd: 2.2, col: '#f0f', kids: ['zebra', 'zebra'], r: 14 },
  ceramic: { hp: 10, spd: 2.5, col: '#b5651d', kids: ['rainbow', 'rainbow'], r: 15 },
  blimp:   { hp: 200, spd: 1.0, col: '#3d9be0', kids: ['ceramic', 'ceramic', 'ceramic', 'ceramic'], r: 30, big: 1, name: 'Sky Blimp' },
  titan:   { hp: 700, spd: 0.6, col: '#d9423a', kids: ['blimp', 'blimp', 'blimp', 'blimp'], r: 42, big: 1, name: 'Titan Blimp' },
};
const ORDER = Object.keys(BT);
const rbe = k => BT[k].rbe || (BT[k].rbe = BT[k].hp + BT[k].kids.reduce((a, c) => a + rbe(c), 0));
ORDER.forEach((k, i) => { BT[k].i = i; rbe(k); });

// ---------------- towers
const TW = {
  dart: { name: 'Dart Thrower', key: 'Q', cost: 200, col: '#c98b4b', desc: 'Cheap and reliable. Throws sharp darts.',
    base: { kind: 'dart', range: 115, rate: 0.95, dmg: 1, pierce: 2, type: 'sharp', spd: 620, life: 0.55, count: 1, spread: 0.18, size: 1 },
    paths: [
      [{ n: 'Sharp Darts', c: 140, d: '+1 pierce', m: { pierce: 1 } },
       { n: 'Razor Darts', c: 200, d: '+2 pierce', m: { pierce: 2 } },
       { n: 'Spike Ball', c: 450, d: 'Huge spiky balls: +18 pierce, +1 damage', m: { pierce: 18, dmg: 1, size: 1.4, spd: -200, life: 0.3 } }],
      [{ n: 'Quick Hands', c: 100, d: 'Throws 15% faster', m: { rateX: 0.85 } },
       { n: 'Eagle Eye', c: 160, d: '+30 range and can see camo', m: { range: 30, camo: true } },
       { n: 'Triple Shot', c: 420, d: 'Throws 3 darts at once', m: { count: 2 } }]] },
  tack: { name: 'Tack Spinner', key: 'W', cost: 280, col: '#d6457a', desc: 'Sprays tacks in every direction.',
    base: { kind: 'tack', range: 75, rate: 1.3, dmg: 1, pierce: 1, type: 'sharp', spd: 420, count: 8, size: 1 },
    paths: [
      [{ n: 'Faster Spin', c: 150, d: 'Shoots 25% faster', m: { rateX: 0.75 } },
       { n: 'More Tacks', c: 200, d: '+4 tacks', m: { count: 4 } },
       { n: 'Blade Storm', c: 550, d: '16 blades, +2 pierce, much faster', m: { count: 4, pierce: 2, rateX: 0.6, blade: true } }],
      [{ n: 'Long Reach', c: 110, d: '+20 range', m: { range: 20 } },
       { n: 'Hot Tacks', c: 300, d: 'Burning tacks pop lead, +1 damage', m: { type: 'fire', dmg: 1 } },
       { n: 'Inferno Ring', c: 1600, d: 'A ring of fire burns everything in range', m: { kind: 'ring', dmg: 2, rateX: 0.35, range: 20 } }]] },
  boomer: { name: 'Boomerang Thrower', key: 'E', cost: 325, col: '#2fa39a', desc: 'Curving boomerangs that hit lots of balloons.',
    base: { kind: 'boom', range: 130, rate: 1.2, dmg: 1, pierce: 4, type: 'sharp', life: 1.0, count: 1, size: 1 },
    paths: [
      [{ n: 'Big Boomerangs', c: 200, d: '+4 pierce', m: { pierce: 4 } },
       { n: 'Glaives', c: 280, d: 'Glaives pop lead, +1 damage', m: { type: 'normal', dmg: 1, glaive: true } },
       { n: 'Glaive Storm', c: 1100, d: '2 glaives at once, +10 pierce', m: { count: 1, pierce: 10 } }],
      [{ n: 'Quick Throw', c: 180, d: 'Throws 25% faster', m: { rateX: 0.75 } },
       { n: 'Long Throw', c: 160, d: '+40 range', m: { range: 40 } },
       { n: 'Turbo Arm', c: 900, d: 'Throws over twice as fast', m: { rateX: 0.42 } }]] },
  bomb: { name: 'Bomb Cannon', key: 'R', cost: 525, col: '#555b66', desc: 'Explosions pop groups. Can\'t pop black balloons.',
    base: { kind: 'bomb', range: 125, rate: 1.5, dmg: 1, pierce: 16, type: 'explode', spd: 420, radius: 42, size: 1 },
    paths: [
      [{ n: 'Bigger Bombs', c: 300, d: '+15 blast radius, +8 pierce', m: { radius: 15, pierce: 8 } },
       { n: 'Heavy Bombs', c: 450, d: '+1 damage', m: { dmg: 1 } },
       { n: 'Blimp Buster', c: 1800, d: '+2 damage, +25 damage to blimps', m: { bigBonus: 25, dmg: 2 } }],
      [{ n: 'Faster Reload', c: 250, d: 'Fires 25% faster', m: { rateX: 0.75 } },
       { n: 'Missiles', c: 400, d: '+50 range, faster shells', m: { range: 50, spd: 250 } },
       { n: 'Cluster Bombs', c: 1100, d: 'Each blast throws out 6 mini bombs', m: { cluster: 6 } }]] },
  frost: { name: 'Frost Tower', key: 'T', cost: 400, col: '#7fd3f7', desc: 'Freezes nearby balloons solid. Can\'t freeze white.',
    base: { kind: 'frost', range: 70, rate: 2.2, dmg: 0, pierce: 40, type: 'freeze', freeze: 1.1 },
    paths: [
      [{ n: 'Ice Shards', c: 200, d: 'Frozen balloons take 1 damage', m: { dmg: 1 } },
       { n: 'Permafrost', c: 250, d: 'Balloons stay slow after thawing', m: { slow: 0.5 } },
       { n: 'Absolute Zero', c: 1500, d: '+60 range, freezes longer and more often', m: { range: 60, freeze: 0.8, rateX: 0.65, pierce: 80 } }],
      [{ n: 'Wide Freeze', c: 150, d: '+20 range', m: { range: 20 } },
       { n: 'Deep Freeze', c: 300, d: 'Freeze lasts 50% longer', m: { freeze: 0.55 } },
       { n: 'Arctic Wind', c: 900, d: 'Everything in range moves at half speed, +2 damage', m: { aura: 0.5, dmg: 2 } }]] },
  sniper: { name: 'Sharpshooter', key: 'Y', cost: 350, col: '#4d7a3a', desc: 'Hits anything on the map. Pops lead.',
    base: { kind: 'snipe', range: 9999, rate: 1.6, dmg: 2, pierce: 1, type: 'normal', target: 'strong' },
    paths: [
      [{ n: 'Full Metal', c: 350, d: '+3 damage', m: { dmg: 3 } },
       { n: 'Deadly Precision', c: 1200, d: '+10 damage', m: { dmg: 10 } },
       { n: 'Elite Shot', c: 3500, d: '+25 damage, +20 to blimps', m: { dmg: 25, bigBonus: 20 } }],
      [{ n: 'Night Vision', c: 300, d: 'Can see camo', m: { camo: true } },
       { n: 'Semi-Auto', c: 450, d: 'Fires twice as fast', m: { rateX: 0.5 } },
       { n: 'Full Auto', c: 2800, d: 'Fires 3x faster again', m: { rateX: 0.33 } }]] },
  mage: { name: 'Storm Mage', key: 'U', cost: 450, col: '#7a4fd6', desc: 'Magic bolts pop every balloon type.',
    base: { kind: 'bolt', range: 105, rate: 1.0, dmg: 1, pierce: 4, type: 'energy', spd: 520, life: 0.6, count: 1, spread: 0.25, size: 1 },
    paths: [
      [{ n: 'Intense Magic', c: 300, d: '+1 damage, +3 pierce', m: { dmg: 1, pierce: 3 } },
       { n: 'Chain Lightning', c: 900, d: 'Lightning jumps between 6 balloons', m: { chain: 6 } },
       { n: 'Storm Lord', c: 2600, d: 'Lightning jumps 16 times, +2 damage', m: { chain: 10, dmg: 2 } }],
      [{ n: 'Fireball', c: 300, d: 'Bolts explode on hit', m: { splash: 32 } },
       { n: 'Seeking Bolts', c: 300, d: 'Bolts home in, +20 range', m: { homing: true, range: 20 } },
       { n: 'Archmage', c: 2000, d: '3 bolts at once, faster, sees camo', m: { count: 2, rateX: 0.6, camo: true } }]] },
  farm: { name: 'Cash Farm', key: 'I', cost: 600, col: '#e2b33c', desc: 'Earns cash at the end of every round.',
    base: { kind: 'farm', range: 40, income: 80 },
    paths: [
      [{ n: 'Bigger Harvest', c: 400, d: '+40 cash per round', m: { income: 40 } },
       { n: 'Orchard', c: 900, d: '+100 cash per round', m: { income: 100 } },
       { n: 'Gold Mine', c: 4000, d: '+400 cash per round', m: { income: 400 } }],
      [{ n: 'Good Soil', c: 300, d: '+25% income', m: { incomeX: 1.25 } },
       { n: 'Market Stall', c: 800, d: '+30% income', m: { incomeX: 1.3 } },
       { n: 'Trade Hub', c: 2500, d: '+60% income', m: { incomeX: 1.6 } }]] },
};
const TKEYS = Object.keys(TW);
const AIMS = ['dart', 'bolt', 'boom', 'bomb', 'snipe'];
const TARGETS = ['first', 'last', 'strong', 'close'];
const DIFF = {
  easy:   { name: 'Easy', lives: 200, cost: 0.85, cash: 650, win: 40, note: '200 lives, cheaper towers, win at round 40' },
  medium: { name: 'Medium', lives: 150, cost: 1, cash: 650, win: 50, note: '150 lives, win at round 50' },
  hard:   { name: 'Hard', lives: 100, cost: 1.08, cash: 650, win: 60, note: '100 lives, pricier towers, win at round 60' },
};

// ---------------- waves
const UNLOCK = { red: 1, blue: 3, green: 6, yellow: 10, pink: 14, black: 17, white: 19, lead: 22, zebra: 24, rainbow: 27, ceramic: 31, blimp: 41, titan: 58 };
function waveGroups(n) {
  if (n === 40) return [{ t: 'rainbow', c: 12 }, { t: 'ceramic', c: 8 }, { t: 'blimp', c: 3 }];
  if (n === 60) return [{ t: 'ceramic', c: 20 }, { t: 'blimp', c: 4 }, { t: 'titan', c: 1 }];
  const r = rng(n * 7919 + 13), B = Math.round(14 * n + 0.9 * Math.pow(n, 2.15));
  const un = ORDER.filter(k => UNLOCK[k] <= n), picks = [un[un.length - 1]];
  if (un.length > 1) picks.push(un[un.length - 2]);
  if (un.length > 2) picks.push(un[Math.floor(r() * (un.length - 2))]);
  const shares = picks.length === 1 ? [1] : picks.length === 2 ? [0.6, 0.4] : [0.45, 0.35, 0.2];
  const g = [];
  picks.forEach((t, i) => { const c = Math.floor(B * shares[i] / BT[t].rbe); if (c > 0) g.push({ t, c, camo: false }); });
  if (!g.length) g.push({ t: un[0], c: Math.max(1, Math.floor(B / BT[un[0]].rbe)) });
  if (n >= 20 && n % 3 === 2 && g.length > 1 && !BT[g[1].t].big) g[1].camo = true;
  if (n >= 45 && n % 4 === 1 && !BT[g[0].t].big) g[0].camo = true;
  return g.reverse();
}
function buildQueue(n) {
  const q = [], fast = n > 60 ? 1 + (n - 60) * 0.02 : 1;
  waveGroups(n).forEach((gr, i) => { const T = BT[gr.t], sp = T.big ? 2.4 : Math.max(0.08, Math.min(0.75, 9 / gr.c)); for (let k = 0; k < gr.c; k++) q.push({ at: i * 1.2 + k * sp / fast, t: gr.t, camo: gr.camo }); });
  return q.sort((a, b) => a.at - b.at);
}

// ---------------- state
let G = null, bg = null, menuMap = 0, menuDiff = 'medium';
const price = c => Math.round(c * (G ? G.diff.cost : 1) / 5) * 5;
const best = () => { try { return JSON.parse(localStorage.getItem('popdef_best') || '{}'); } catch (e) { return {}; } };
function saveBest(r) { const b = best(), k = G.mi + '_' + G.dk; if (!b[k] || r > b[k]) { b[k] = r; try { localStorage.setItem('popdef_best', JSON.stringify(b)); } catch (e) { } } }

function newGame(mi, dk) {
  const M = MAPS[mi];
  bg = makeBg(M);
  G = { mi, dk, map: M, path: prepPath(M.pts), diff: DIFF[dk], cash: DIFF[dk].cash, lives: DIFF[dk].lives, round: 1, bs: [], ps: [], ts: [], fx: [], queue: [],
    rt: 0, active: false, speed: 1, paused: false, auto: $('auto').checked, autoT: 0, sel: null, place: null, over: false, free: false, nid: 1, pops: 0, time: 0, mouse: null, deco: bg.deco };
  $('menu').classList.add('hidden'); $('end').classList.add('hidden');
  buildShop(); showInfo(); updUI();
}
const posAt = d => posOn(G.path, d);

function spawnB(t, d, camo, ig) {
  const T = BT[t], p = posAt(d);
  const b = { id: G.nid++, t, hp: T.hp, d, camo: !!camo, ig: ig ? new Set(ig) : new Set(), frozen: 0, slow: 0, slowF: 1, aura: 1, x: p[0], y: p[1], ang: 0, wob: Math.random() * TAU };
  if (T.big) { const q = posAt(d + 2); b.ang = Math.atan2(q[1] - p[1], q[0] - p[0]); }
  G.bs.push(b); return b;
}
function dmgB(b, dmg, type, src) {
  if (b.dead) return false;
  const T = BT[b.t];
  if (T.imm && T.imm[type]) { if (G.fx.length < 300) G.fx.push({ k: 'clink', x: b.x, y: b.y, t: 0, dur: 0.2 }); return false; }
  if (dmg <= 0) return true;
  b.hp -= dmg;
  if (b.hp > 0) return true;
  popB(b, -b.hp, type, src); return true;
}
function popB(b, over, type, src) {
  b.dead = true; const T = BT[b.t];
  G.cash += 1; G.pops++; if (src) src.pops++;
  if (G.fx.length < 350) G.fx.push({ k: 'pop', x: b.x, y: b.y, col: T.col === '#f0f' ? '#ffffff' : T.col, t: 0, dur: T.big ? 0.5 : 0.22, r: T.r });
  const n = T.kids.length, sp = T.big ? 14 : 5, kids = [];
  T.kids.forEach((k, i) => kids.push(spawnB(k, Math.max(0, b.d + (i - (n - 1) / 2) * sp), b.camo, b.ig)));
  if (over > 0 && kids.length) dmgB(kids[0], over, type, src);
}
const near = (b, x, y, r) => { const rr = r + BT[b.t].r, dx = b.x - x, dy = b.y - y; return dx * dx + dy * dy <= rr * rr; };
function pickTarget(t, range) {
  let bestB = null, bv = -Infinity;
  for (const b of G.bs) {
    if (b.dead || (b.camo && !t.s.camo) || !near(b, t.x, t.y, range)) continue;
    const dx = b.x - t.x, dy = b.y - t.y; let v;
    switch (t.target) { case 'last': v = -b.d; break; case 'strong': v = BT[b.t].i * 1e5 + b.d; break; case 'close': v = -(dx * dx + dy * dy); break; default: v = b.d; }
    if (v > bv) { bv = v; bestB = b; }
  }
  return bestB;
}

// ---------------- tower logic
function calcStats(t) {
  const D = TW[t.type], s = Object.assign({}, D.base);
  for (let p = 0; p < 2; p++) for (let i = 0; i < t.up[p]; i++) {
    const m = D.paths[p][i].m;
    for (const k in m) { const v = m[k]; if (k.endsWith('X')) { const kk = k.slice(0, -1); s[kk] = (s[kk] || 1) * v; } else if (typeof v === 'number' && typeof s[k] === 'number') s[k] += v; else s[k] = v; }
  }
  t.s = s;
}
const common = t => ({ src: t, dmg: t.s.dmg, pierce: t.s.pierce, type: t.s.type, size: t.s.size || 1, radius: t.s.radius || 0, cluster: t.s.cluster || 0,
  bigBonus: t.s.bigBonus || 0, chain: t.s.chain || 0, splash: t.s.splash || 0, homing: !!t.s.homing, glaive: !!t.s.glaive, blade: !!t.s.blade });
const mk = p => { p.rot = p.rot || 0; G.ps.push(p); return p; };

function updTower(t, dt) {
  const s = t.s; if (s.kind === 'farm') return;
  t.cd -= dt; if (t.cd > 0) return;
  if (s.kind === 'frost' || s.kind === 'ring') {
    const list = G.bs.filter(b => !b.dead && near(b, t.x, t.y, s.range)); if (!list.length) return;
    t.cd = s.rate;
    if (s.kind === 'ring') { G.fx.push({ k: 'ring', x: t.x, y: t.y, r: s.range, col: '255,120,30', t: 0, dur: 0.3 }); for (const b of list) dmgB(b, s.dmg, 'fire', t); return; }
    G.fx.push({ k: 'ring', x: t.x, y: t.y, r: s.range, col: '160,225,255', t: 0, dur: 0.4 });
    let n = 0;
    for (const b of list) {
      if (n >= s.pierce) break; const T = BT[b.t]; if (T.imm && T.imm.freeze) continue; n++;
      if (T.big) { b.slow = Math.max(b.slow, 1.2); b.slowF = Math.min(b.slowF, 0.6); } else b.frozen = Math.max(b.frozen, s.freeze);
      if (s.slow) { b.slow = Math.max(b.slow, s.freeze + 2.5); b.slowF = Math.min(b.slowF, s.slow); }
      if (s.dmg) dmgB(b, s.dmg, 'freeze', t);
    }
    return;
  }
  const tg = pickTarget(t, s.range); if (!tg) return;
  t.cd = s.rate;
  const a = Math.atan2(tg.y - t.y, tg.x - t.x);
  if (s.kind === 'tack') { for (let i = 0; i < s.count; i++) { const aa = i / s.count * TAU; mk({ kind: 'tack', x: t.x, y: t.y, vx: Math.cos(aa) * s.spd, vy: Math.sin(aa) * s.spd, life: s.range / s.spd, ...common(t) }); } t.flash = 0.1; return; }
  t.ang = a;
  if (s.kind === 'snipe') { G.fx.push({ k: 'shot', x1: t.x + Math.cos(a) * 26, y1: t.y + Math.sin(a) * 26, x2: tg.x, y2: tg.y, t: 0, dur: 0.09 }); dmgB(tg, s.dmg + (BT[tg.t].big ? (s.bigBonus || 0) : 0), 'normal', t); return; }
  if (s.kind === 'bomb') { mk({ kind: 'bomb', x: t.x + Math.cos(a) * 20, y: t.y + Math.sin(a) * 20, vx: Math.cos(a) * s.spd, vy: Math.sin(a) * s.spd, life: (s.range + 40) / s.spd, ...common(t) }); return; }
  if (s.kind === 'boom') { const R = Math.min(s.range, Math.hypot(tg.x - t.x, tg.y - t.y) + 25); for (let i = 0; i < s.count; i++) mk({ kind: 'boom', ox: t.x, oy: t.y, x: t.x, y: t.y, ang: a, tt: 0, dur: s.life, R, dir: i % 2 ? -1 : 1, ...common(t) }); return; }
  const n = s.count || 1;
  for (let i = 0; i < n; i++) {
    const aa = a + (i - (n - 1) / 2) * (s.spread || 0.16);
    mk({ kind: s.kind, x: t.x + Math.cos(aa) * 14, y: t.y + Math.sin(aa) * 14, vx: Math.cos(aa) * s.spd, vy: Math.sin(aa) * s.spd, life: s.life * (s.homing ? 1.8 : 1), tgt: tg, ...common(t) });
  }
}
function explode(x, y, r, pierce, dmg, bonus, src, cluster, type) {
  G.fx.push({ k: 'boom', x, y, r, t: 0, dur: 0.35, col: type === 'fire' ? '255,90,30' : '255,170,40' });
  let n = pierce;
  for (const b of G.bs.slice()) {
    if (n <= 0) break; if (b.dead || !near(b, x, y, r * 0.8)) continue;
    n--; dmgB(b, dmg + (BT[b.t].big ? bonus : 0), type, src);
  }
  for (let i = 0; i < cluster; i++) { const a = i / cluster * TAU + Math.random() * 0.5; mk({ kind: 'bomb', mini: true, x, y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 0.25, src, dmg, pierce: 8, type: 'explode', size: 0.6, radius: 26, cluster: 0, bigBonus: 0 }); }
}
function lightning(p, first) {
  let cur = first, px = p.x, py = p.y; const hit = new Set();
  for (let i = 0; i <= p.chain && cur; i++) {
    hit.add(cur); G.fx.push({ k: 'zap', x1: px, y1: py, x2: cur.x, y2: cur.y, t: 0, dur: 0.18 });
    px = cur.x; py = cur.y;
    dmgB(cur, p.dmg + (BT[cur.t].big ? p.bigBonus : 0), 'energy', p.src);
    let nb = null, bd = 110 * 110;
    for (const b of G.bs) { if (b.dead || hit.has(b)) continue; const d = (b.x - px) ** 2 + (b.y - py) ** 2; if (d < bd) { bd = d; nb = b; } }
    cur = nb;
  }
}
function updProj(p, dt) {
  if (p.kind === 'boom') {
    p.tt += dt / p.dur; if (p.tt >= 1) { p.dead = true; return; }
    const f = p.R * Math.sin(Math.PI * p.tt), sd = p.R * 0.45 * Math.sin(TAU * p.tt) * p.dir, c = Math.cos(p.ang), s = Math.sin(p.ang);
    p.x = p.ox + c * f - s * sd; p.y = p.oy + s * f + c * sd; p.rot += dt * 22;
  } else {
    if (p.homing) {
      if (!p.tgt || p.tgt.dead) p.tgt = pickTarget({ x: p.x, y: p.y, s: p.src.s, target: 'close' }, 160);
      if (p.tgt) { const want = Math.atan2(p.tgt.y - p.y, p.tgt.x - p.x), cur = Math.atan2(p.vy, p.vx); let da = want - cur; da = Math.atan2(Math.sin(da), Math.cos(da)); const na = cur + Math.max(-9 * dt, Math.min(9 * dt, da)), sp = Math.hypot(p.vx, p.vy); p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp; }
    }
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.rot += dt * 14;
    if (p.life <= 0 || p.x < -40 || p.y < -40 || p.x > W + 40 || p.y > H + 40) { if (p.mini) explode(p.x, p.y, p.radius, p.pierce, p.dmg, 0, p.src, 0, 'explode'); p.dead = true; return; }
  }
  const pr = 5 * p.size;
  for (const b of G.bs) {
    if (b.dead || b.ig.has(p)) continue;
    const T = BT[b.t], rr = T.r + pr, dx = b.x - p.x, dy = b.y - p.y;
    if (dx * dx + dy * dy > rr * rr) continue;
    if (p.kind === 'bomb') { explode(p.x, p.y, p.radius, p.pierce, p.dmg, p.bigBonus, p.src, p.cluster, 'explode'); p.dead = true; return; }
    b.ig.add(p);
    if (p.chain) { lightning(p, b); p.dead = true; return; }
    const ok = dmgB(b, p.dmg + (T.big ? p.bigBonus : 0), p.type, p.src);
    if (p.splash) explode(p.x, p.y, p.splash, 6, 1, 0, p.src, 0, 'fire');
    p.pierce--; if (!ok) p.pierce = 0;
    if (p.pierce <= 0) { p.dead = true; return; }
  }
}

// ---------------- rounds
function startRound() { if (!G || G.active || G.over) return; G.queue = buildQueue(G.round); G.rt = 0; G.active = true; showInfo(); updUI(); }
function endRound() {
  G.active = false; const r = G.round, bonus = 100 + r; G.cash += bonus;
  for (const t of G.ts) if (t.s.kind === 'farm') { const inc = Math.round(t.s.income); G.cash += inc; floatText(t.x, t.y - 26, '+$' + inc, '#ffe066'); }
  floatText(W / 2, 46, 'Round ' + r + ' cleared!  +$' + bonus, '#ffffff', 1.6);
  saveBest(r); G.round++; G.autoT = 1;
  if (!G.free && r >= G.diff.win) { finish(true); return; }
  showInfo(); updUI();
}
function finish(won) {
  G.over = true; G.active = false; G.paused = false;
  const r = won ? G.round - 1 : G.round;
  $('endT').textContent = won ? '🏆 Victory!' : '💥 Game over';
  $('endP').textContent = won ? `You beat ${G.map.name} on ${G.diff.name}! Popped ${G.pops.toLocaleString()} balloons. Keep going in freeplay?` : `The balloons got through on round ${r}. Popped ${G.pops.toLocaleString()} balloons.`;
  $('endA').textContent = won ? 'Freeplay' : 'Try again';
  $('end').classList.remove('hidden');
}
const floatText = (x, y, s, col, dur = 1) => G.fx.push({ k: 'txt', x, y, s, col, t: 0, dur });

function step(dt) {
  G.time += dt;
  if (G.active) { G.rt += dt; while (G.queue.length && G.queue[0].at <= G.rt) { const q = G.queue.shift(); spawnB(q.t, 0, q.camo, null); } }
  else if (G.auto && !G.over) { G.autoT -= dt; if (G.autoT <= 0) startRound(); }
  for (const b of G.bs) b.aura = 1;
  for (const t of G.ts) if (t.s.aura) for (const b of G.bs) if (!b.dead && near(b, t.x, t.y, t.s.range)) b.aura = Math.min(b.aura, 1 - t.s.aura);
  for (const b of G.bs) {
    if (b.dead) continue; const T = BT[b.t];
    if (b.frozen > 0) b.frozen -= dt;
    if (b.slow > 0) { b.slow -= dt; if (b.slow <= 0) b.slowF = 1; }
    let m = b.frozen > 0 ? 0 : 1; if (b.slow > 0) m *= b.slowF; m *= b.aura;
    b.d += T.spd * BASE * m * dt;
    if (b.d >= G.path.len) { b.dead = true; G.lives -= T.rbe - (T.hp - b.hp); continue; }
    const p = posAt(b.d);
    if (T.big) { const q = posAt(b.d + 3); if (q[0] !== p[0] || q[1] !== p[1]) b.ang = Math.atan2(q[1] - p[1], q[0] - p[0]); }
    b.x = p[0]; b.y = p[1];
  }
  for (const t of G.ts) { updTower(t, dt); if (t.flash > 0) t.flash -= dt; }
  for (const p of G.ps) if (!p.dead) updProj(p, dt);
  G.ps = G.ps.filter(p => !p.dead); G.bs = G.bs.filter(b => !b.dead);
  for (const f of G.fx) f.t += dt; G.fx = G.fx.filter(f => f.t < f.dur);
  if (G.lives <= 0) { G.lives = 0; finish(false); return; }
  if (G.active && !G.queue.length && !G.bs.length) endRound();
}

// ---------------- drawing helpers
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function poly(c, n, r, rot = 0) { c.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); }
function circ(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }

function makeBg(M) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), P = prepPath(M.pts), r = rng(M.name.length * 991 + 7);
  x.fillStyle = M.grass; x.fillRect(0, 0, W, H);
  x.fillStyle = M.grass2; for (let i = 0; i < 520; i++) { x.globalAlpha = 0.5 + r() * 0.4; x.beginPath(); x.arc(r() * W, r() * H, 2 + r() * 7, 0, TAU); x.fill(); }
  x.globalAlpha = 1;
  const line = (w, col) => { x.strokeStyle = col; x.lineWidth = w; x.lineJoin = 'round'; x.lineCap = 'round'; x.beginPath(); M.pts.forEach((p, i) => x[i ? 'lineTo' : 'moveTo'](p[0], p[1])); x.stroke(); };
  line(52, 'rgba(0,0,0,.18)'); line(48, M.edge); line(40, M.path);
  x.setLineDash([2, 14]); line(3, 'rgba(255,255,255,.25)'); x.setLineDash([]);
  const end = M.pts[M.pts.length - 1];
  if (end[0] > 0 && end[0] < W && end[1] > 0 && end[1] < H) { const g = x.createRadialGradient(end[0], end[1], 2, end[0], end[1], 26); g.addColorStop(0, '#000'); g.addColorStop(0.6, '#3a1d5c'); g.addColorStop(1, 'rgba(120,60,200,0)'); x.fillStyle = g; x.beginPath(); x.arc(end[0], end[1], 26, 0, TAU); x.fill(); }
  const deco = [];
  for (let i = 0; i < 400 && deco.length < 26; i++) {
    const dx = 20 + r() * (W - 40), dy = 20 + r() * (H - 40);
    if (distPath(P, dx, dy) < 56 || deco.some(d => Math.hypot(d.x - dx, d.y - dy) < 60)) continue;
    const s = 0.8 + r() * 0.6; deco.push({ x: dx, y: dy, r: 16 * s });
    x.save(); x.translate(dx, dy); x.scale(s, s);
    x.fillStyle = 'rgba(0,0,0,.2)'; x.beginPath(); x.ellipse(4, 12, 16, 7, 0, 0, TAU); x.fill();
    if (M.theme === 'meadow') { circ(x, 0, 0, 16, '#3f8f35'); circ(x, -5, -5, 11, '#4fa843'); circ(x, -7, -8, 5, '#6cc35e'); }
    else if (M.theme === 'canyon') { if (r() < 0.5) { x.fillStyle = '#8e7a5e'; poly(x, 6, 15, r()); x.fill(); x.fillStyle = '#a8946f'; poly(x, 6, 9, r()); x.fill(); } else { x.fillStyle = '#4f9a4a'; rr(x, -5, -18, 10, 30, 5); x.fill(); rr(x, -15, -8, 8, 14, 4); x.fill(); rr(x, 7, -12, 8, 14, 4); x.fill(); } }
    else { x.fillStyle = '#2f6b55'; x.beginPath(); x.moveTo(0, -22); x.lineTo(15, 10); x.lineTo(-15, 10); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -22); x.lineTo(7, -8); x.lineTo(-7, -8); x.fill(); }
    x.restore();
  }
  return { cv: c, deco };
}

function drawTower(c, type, x, y, ang, up, k = 1, flash = 0) {
  const D = TW[type]; c.save(); c.translate(x, y); c.scale(k, k);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(2, 6, 18, 11, 0, 0, TAU); c.fill();
  if (type === 'farm') {
    c.fillStyle = '#7a4d26'; rr(c, -18, -18, 36, 36, 6); c.fill();
    for (let i = 0; i < 3; i++) { c.fillStyle = '#5ea83a'; c.fillRect(-14, -14 + i * 10, 28, 6); }
    const gold = up[0] >= 3; c.fillStyle = gold ? '#fff2a8' : '#ffd23f';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { c.beginPath(); c.arc(-10.5 + j * 7, -11 + i * 10, 2.3, 0, TAU); c.fill(); }
    if (up[1] >= 2) { c.fillStyle = '#d2423f'; c.fillRect(8, -22, 12, 9); c.fillStyle = '#fff'; c.fillRect(8, -22, 12, 3); }
  } else {
    circ(c, 0, 0, 17, '#5b6675'); circ(c, 0, 0, 14.5, '#8e9aa8');
    const ring = type === 'tack' && up[1] >= 3;
    switch (type) {
      case 'dart': c.rotate(ang); c.fillStyle = '#6b4423'; c.fillRect(4, -3, 14, 6); c.fillStyle = '#333'; c.fillRect(14, -1.5, 10, 3); c.fillStyle = '#e33'; c.beginPath(); c.moveTo(14, 0); c.lineTo(10, -4); c.lineTo(10, 4); c.fill(); circ(c, 0, 0, 10, D.col); circ(c, -3, -3, 4, 'rgba(255,255,255,.35)'); break;
      case 'tack': c.rotate(G ? G.time * (ring ? 4 : 1.5) : 0); c.fillStyle = '#ddd'; for (let i = 0; i < 8; i++) { c.save(); c.rotate(i / 8 * TAU); c.beginPath(); c.moveTo(11, -3); c.lineTo(19, 0); c.lineTo(11, 3); c.fill(); c.restore(); } c.fillStyle = ring ? '#ff7a1a' : D.col; poly(c, 8, 12, Math.PI / 8); c.fill(); circ(c, 0, 0, 5, ring ? '#ffe08a' : '#f9b6cf'); if (flash > 0) circ(c, 0, 0, 13, 'rgba(255,255,255,.35)'); break;
      case 'boomer': c.rotate(ang); circ(c, 0, 0, 10, D.col); c.strokeStyle = up[0] >= 2 ? '#d9dee5' : '#f0b429'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(10, -9); c.lineTo(17, 0); c.lineTo(10, 9); c.stroke(); circ(c, -3, -3, 4, 'rgba(255,255,255,.3)'); break;
      case 'bomb': c.rotate(ang); c.fillStyle = '#2b2f36'; rr(c, 0, -7, 24, 14, 4); c.fill(); c.fillStyle = '#444b55'; c.fillRect(18, -8, 5, 16); circ(c, 0, 0, 11, D.col); circ(c, -3, -4, 4, 'rgba(255,255,255,.25)'); break;
      case 'frost': c.rotate(G ? G.time * 0.4 : 0); c.fillStyle = up[1] >= 3 ? '#bfefff' : D.col; poly(c, 6, 13); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); const a = i / 3 * Math.PI; c.moveTo(Math.cos(a) * 10, Math.sin(a) * 10); c.lineTo(-Math.cos(a) * 10, -Math.sin(a) * 10); c.stroke(); } break;
      case 'sniper': c.rotate(ang); c.fillStyle = '#222'; c.fillRect(0, -2, 30, 4); c.fillStyle = '#333'; c.fillRect(4, -6, 10, 4); circ(c, 0, 0, 10, D.col); circ(c, -4, 3, 2.5, '#2f4f22'); circ(c, 3, -4, 2.5, '#6a9a4f'); break;
      case 'mage': c.rotate(ang); c.fillStyle = '#4b2a8f'; c.fillRect(4, -2, 10, 4); circ(c, 0, 0, 10, D.col); circ(c, 15, 0, 6, 'rgba(200,160,255,.45)'); circ(c, 15, 0, 3.5, '#efe0ff'); c.fillStyle = '#ffd54a'; poly(c, 5, 4, -Math.PI / 2); c.fill(); break;
    }
  }
  c.restore();
  for (let p = 0; p < 2; p++) for (let i = 0; i < up[p]; i++) circ(c, x + (p ? 4 + i * 5 : -14 + i * 5), y + 19 * k, 2.2, p ? '#4ad7ff' : '#ffc93c');
}

function drawBalloon(c, b) {
  const T = BT[b.t], x = b.x, y = b.y + Math.sin(G.time * 3 + b.wob) * 1.2;
  if (T.big) {
    c.save(); c.translate(x, y); c.rotate(b.ang);
    const L = T.r * 1.6, R = T.r * 0.72;
    c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(4, R + 8, L, R * 0.35, 0, 0, TAU); c.fill();
    c.fillStyle = shade(T.col, -30); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(-L * 0.6, 0); c.lineTo(-L * 1.05, s * R * 1.1); c.lineTo(-L * 0.85, 0); c.fill(); }
    const g = c.createLinearGradient(0, -R, 0, R); g.addColorStop(0, shade(T.col, 50)); g.addColorStop(0.5, T.col); g.addColorStop(1, shade(T.col, -40));
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, L, R, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, L * 0.6, R, 0, -Math.PI / 2, Math.PI / 2); c.stroke();
    c.fillStyle = '#333'; rr(c, -L * 0.3, R * 0.7, L * 0.6, R * 0.4, 4); c.fill();
    if (b.camo) { c.fillStyle = 'rgba(60,90,40,.45)'; c.beginPath(); c.ellipse(0, 0, L, R, 0, 0, TAU); c.fill(); }
    c.restore();
    const f = Math.max(0, b.hp / T.hp), w = T.r * 2;
    c.fillStyle = '#0009'; c.fillRect(x - w / 2, y - T.r - 12, w, 6); c.fillStyle = f > 0.5 ? '#5bd75b' : f > 0.25 ? '#ffc93c' : '#ff5a5a'; c.fillRect(x - w / 2 + 1, y - T.r - 11, (w - 2) * f, 4);
    return;
  }
  const r = T.r;
  c.save(); c.translate(x, y);
  c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, r); c.quadraticCurveTo(3, r + 5, 0, r + 9); c.stroke();
  c.fillStyle = T.col === '#f0f' ? '#a04ad7' : shade(T.col === '#fff' ? '#ccc' : T.col, -20); c.beginPath(); c.moveTo(0, r - 2); c.lineTo(-3, r + 3); c.lineTo(3, r + 3); c.fill();
  c.beginPath(); c.ellipse(0, 0, r * 0.86, r, 0, 0, TAU);
  if (b.t === 'rainbow') { const g = c.createLinearGradient(0, -r, 0, r); ['#ff3b3b', '#ffa531', '#ffe14a', '#4fd34f', '#3fa0ff', '#a85cff'].forEach((col, i) => g.addColorStop(i / 5, col)); c.fillStyle = g; }
  else if (b.t === 'lead') { const g = c.createLinearGradient(-r, -r, r, r); g.addColorStop(0, '#c4ccd4'); g.addColorStop(1, '#5d666f'); c.fillStyle = g; }
  else c.fillStyle = T.col;
  c.fill();
  if (b.t === 'zebra') { c.save(); c.clip(); c.strokeStyle = '#222'; c.lineWidth = 3; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-r, i * 6 - 4); c.lineTo(r, i * 6 + 4); c.stroke(); } c.restore(); }
  if (b.t === 'ceramic') { const dmg = 1 - b.hp / T.hp; c.strokeStyle = '#5a2e0c'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-r * 0.5, -r * 0.6); c.lineTo(-r * 0.1, -r * 0.1); c.lineTo(r * 0.3, -r * 0.4); if (dmg > 0.3) { c.moveTo(-r * 0.1, -r * 0.1); c.lineTo(-r * 0.2, r * 0.5); } if (dmg > 0.6) { c.moveTo(r * 0.5, 0); c.lineTo(r * 0.1, r * 0.4); c.lineTo(r * 0.4, r * 0.7); } c.stroke(); }
  if (b.camo) { c.save(); c.beginPath(); c.ellipse(0, 0, r * 0.86, r, 0, 0, TAU); c.clip(); c.globalAlpha = 0.55; circ(c, -4, -3, r * 0.45, '#3e5a2a'); circ(c, 5, 4, r * 0.4, '#7a6a3a'); circ(c, 3, -6, r * 0.3, '#2d4520'); c.restore(); }
  c.beginPath(); c.ellipse(0, 0, r * 0.86, r, 0, 0, TAU); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-r * 0.32, -r * 0.42, r * 0.22, r * 0.32, -0.5, 0, TAU); c.fill();
  if (b.frozen > 0) { c.fillStyle = 'rgba(170,230,255,.55)'; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 0, r * 1.05, r * 1.15, 0, 0, TAU); c.fill(); c.stroke(); }
  c.restore();
}
function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, v + amt)); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; }

function drawProj(c, p) {
  c.save(); c.translate(p.x, p.y);
  switch (p.kind) {
    case 'dart':
      if (p.size > 1.2) { c.rotate(p.rot); c.fillStyle = '#666'; for (let i = 0; i < 8; i++) { c.save(); c.rotate(i / 8 * TAU); c.beginPath(); c.moveTo(6, -2); c.lineTo(11, 0); c.lineTo(6, 2); c.fill(); c.restore(); } circ(c, 0, 0, 7, '#888'); circ(c, -2, -2, 2.5, '#bbb'); }
      else { c.rotate(Math.atan2(p.vy, p.vx)); c.fillStyle = '#333'; c.fillRect(-7, -1.2, 13, 2.4); c.fillStyle = '#e33'; c.beginPath(); c.moveTo(-6, 0); c.lineTo(-11, -3.5); c.lineTo(-11, 3.5); c.fill(); }
      break;
    case 'tack': c.rotate(Math.atan2(p.vy, p.vx)); if (p.blade) { c.fillStyle = '#e8edf2'; c.beginPath(); c.moveTo(8, 0); c.lineTo(-4, -4); c.lineTo(-2, 0); c.lineTo(-4, 4); c.fill(); } else { c.fillStyle = p.type === 'fire' ? '#ff8a2a' : '#555'; c.fillRect(-4, -1, 8, 2); c.fillRect(-4, -3, 2, 6); } break;
    case 'boom': c.rotate(p.rot); c.strokeStyle = p.glaive ? '#dfe5ec' : '#f0b429'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-8, 6); c.lineTo(0, -3); c.lineTo(8, 6); c.stroke(); break;
    case 'bomb': circ(c, 0, 0, 6 * p.size, '#1d1f24'); circ(c, -2 * p.size, -2 * p.size, 2 * p.size, '#666'); circ(c, 4 * p.size, -5 * p.size, 2, Math.random() < 0.5 ? '#ffd23f' : '#ff7a1a'); break;
    case 'bolt': circ(c, 0, 0, 8, p.splash ? 'rgba(255,120,40,.35)' : 'rgba(170,120,255,.35)'); circ(c, 0, 0, 4.5, p.splash ? '#ffb347' : '#e6d6ff'); break;
  }
  c.restore();
}
function drawFx(c, f) {
  const k = f.t / f.dur, a = 1 - k;
  switch (f.k) {
    case 'pop': c.strokeStyle = f.col; c.globalAlpha = a; c.lineWidth = 2; for (let i = 0; i < 7; i++) { const an = i / 7 * TAU, r1 = f.r * (0.4 + k), r2 = f.r * (0.8 + k * 1.6); c.beginPath(); c.moveTo(f.x + Math.cos(an) * r1, f.y + Math.sin(an) * r1); c.lineTo(f.x + Math.cos(an) * r2, f.y + Math.sin(an) * r2); c.stroke(); } break;
    case 'clink': c.globalAlpha = a; c.fillStyle = '#fff'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText('clink', f.x, f.y - 14 - k * 8); break;
    case 'boom': c.globalAlpha = a * 0.7; circ(c, f.x, f.y, f.r * (0.5 + k * 0.6), `rgb(${f.col})`); c.globalAlpha = a; c.strokeStyle = '#fff3c4'; c.lineWidth = 3; c.beginPath(); c.arc(f.x, f.y, f.r * (0.6 + k * 0.5), 0, TAU); c.stroke(); break;
    case 'ring': c.globalAlpha = a * 0.8; c.strokeStyle = `rgb(${f.col})`; c.lineWidth = 6 * a + 1; c.beginPath(); c.arc(f.x, f.y, f.r * (0.3 + 0.7 * k), 0, TAU); c.stroke(); break;
    case 'shot': c.globalAlpha = a; c.strokeStyle = '#fff6b0'; c.lineWidth = 2; c.beginPath(); c.moveTo(f.x1, f.y1); c.lineTo(f.x2, f.y2); c.stroke(); break;
    case 'zap': { c.globalAlpha = a; c.strokeStyle = '#d8c4ff'; c.lineWidth = 3; c.beginPath(); c.moveTo(f.x1, f.y1); for (let i = 1; i < 5; i++) { const t = i / 5; c.lineTo(f.x1 + (f.x2 - f.x1) * t + (Math.random() - 0.5) * 12, f.y1 + (f.y2 - f.y1) * t + (Math.random() - 0.5) * 12); } c.lineTo(f.x2, f.y2); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke(); break; }
    case 'txt': c.globalAlpha = Math.min(1, a * 2); c.font = 'bold 18px "Trebuchet MS",sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#000a'; c.strokeText(f.s, f.x, f.y - k * 24); c.fillStyle = f.col; c.fillText(f.s, f.x, f.y - k * 24); break;
  }
  c.globalAlpha = 1;
}
function canPlace(x, y) {
  if (x < 16 || y < 16 || x > W - 16 || y > H - 16) return false;
  if (distPath(G.path, x, y) < 38) return false;
  if (G.ts.some(t => Math.hypot(t.x - x, t.y - y) < 32)) return false;
  if (G.deco.some(d => Math.hypot(d.x - x, d.y - y) < d.r + 12)) return false;
  return true;
}
function draw() {
  if (!G) { ctx.fillStyle = '#2a3c4f'; ctx.fillRect(0, 0, W, H); return; }
  ctx.drawImage(bg.cv, 0, 0);
  const sel = G.sel;
  if (sel && sel.s.range < 2000) { ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sel.x, sel.y, sel.s.range, 0, TAU); ctx.fill(); ctx.stroke(); }
  const smalls = G.bs.filter(b => !BT[b.t].big), bigs = G.bs.filter(b => BT[b.t].big);
  for (const b of smalls) drawBalloon(ctx, b);
  for (const b of bigs) drawBalloon(ctx, b);
  for (const t of G.ts) drawTower(ctx, t.type, t.x, t.y, t.ang, t.up, 1, t.flash);
  if (sel) { ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sel.x, sel.y, 21, 0, TAU); ctx.stroke(); }
  for (const p of G.ps) drawProj(ctx, p);
  for (const f of G.fx) drawFx(ctx, f);
  if (G.place && G.mouse) {
    const D = TW[G.place], ok = canPlace(G.mouse.x, G.mouse.y) && G.cash >= price(D.cost), r = D.base.range;
    if (r < 2000) { ctx.fillStyle = ok ? 'rgba(255,255,255,.15)' : 'rgba(255,60,60,.25)'; ctx.strokeStyle = ok ? '#fff' : '#ff5a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(G.mouse.x, G.mouse.y, r, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.globalAlpha = 0.75; drawTower(ctx, G.place, G.mouse.x, G.mouse.y, -Math.PI / 2, [0, 0]); ctx.globalAlpha = 1;
  }
  if (!G.active && !G.over) banner(`Round ${G.round} ready — press Start or Space`);
  if (G.paused) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(0, 0, W, H); banner('Paused — press P to resume', H / 2); }
}
function banner(s, y = H - 28) { ctx.font = 'bold 20px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = '#000b'; ctx.strokeText(s, W / 2, y); ctx.fillStyle = '#fff'; ctx.fillText(s, W / 2, y); }

// ---------------- UI
function buildShop() {
  const sh = $('shop'); sh.innerHTML = '';
  for (const k of TKEYS) {
    const D = TW[k], b = document.createElement('button'); b.className = 'tw'; b.dataset.t = k;
    b.title = D.desc;
    const ic = document.createElement('canvas'); ic.width = 80; ic.height = 80; const ix = ic.getContext('2d'); ix.scale(2, 2); drawTower(ix, k, 20, 18, -0.7, [0, 0], 0.95);
    b.appendChild(ic); const sp = document.createElement('span'); sp.innerHTML = `${D.name}<small>$${price(D.cost)}</small>`; b.appendChild(sp);
    const i = document.createElement('i'); i.textContent = D.key; b.appendChild(i);
    b.onclick = () => choosePlace(k); sh.appendChild(b);
  }
}
function choosePlace(k) { if (!G || G.over) return; G.place = G.place === k ? null : k; G.sel = null; showInfo(); updUI(); }
function groupsText(n) { return waveGroups(n).slice().reverse().map(g => `${g.c} ${g.camo ? 'camo ' : ''}${BT[g.t].name || g.t}`).join(', '); }
function showInfo() {
  const el = $('info'); if (!G) { el.innerHTML = ''; return; }
  if (G.place) { const D = TW[G.place]; el.innerHTML = `<h2>${D.name}</h2><div class="dim">${D.desc}</div><p>Cost: <b>$${price(D.cost)}</b><br>Click on the grass to place it. Right-click or Esc to cancel.</p>`; return; }
  const t = G.sel;
  if (!t) {
    el.innerHTML = `<h2>${G.active ? 'Round ' + G.round : 'Next: round ' + G.round}</h2><div class="dim">${groupsText(G.round)}</div>
      <p class="dim" style="margin-top:8px">Tips: Lead balloons ignore sharp darts — use bombs, magic, the Sharpshooter or Hot Tacks. Black balloons ignore explosions, white ones can't be frozen. Camo balloons need a tower that can see camo.</p>`;
    return;
  }
  const D = TW[t.type];
  let h = `<h2>${D.name}</h2><div class="dim">Popped ${t.pops.toLocaleString()} · ${t.up[0]}-${t.up[1]}</div><div class="paths">`;
  for (let p = 0; p < 2; p++) {
    const i = t.up[p], blocked = i === 2 && t.up[1 - p] === 3;
    h += `<div class="path p${p}"><div class="pips">${[0, 1, 2].map(j => `<span class="${j < i ? 'f' : ''}"></span>`).join('')}</div>`;
    if (i >= 3) h += `<button disabled>Maxed out</button>`;
    else if (blocked) h += `<button disabled>Path locked<small>Only one path can reach tier 3</small></button>`;
    else { const u = D.paths[p][i]; h += `<button data-up="${p}" data-c="${price(u.c)}">${u.n} <b>$${price(u.c)}</b><small>${u.d}</small></button>`; }
    h += `</div>`;
  }
  h += `</div>`;
  if (t.s.kind === 'farm') h += `<p>Earns <b>$${Math.round(t.s.income)}</b> every round.</p>`;
  if (AIMS.includes(t.s.kind)) h += `<div class="row tgt">${TARGETS.map(m => `<button data-tg="${m}" class="${t.target === m ? 'on' : ''}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div>`;
  h += `<div class="row" style="margin-top:8px"><button class="red" data-sell="1">Sell for $${Math.round(t.spent * 0.7)}</button></div>`;
  el.innerHTML = h;
}
$('info').onclick = e => {
  const b = e.target.closest('button'); if (!b || !G || !G.sel) return; const t = G.sel;
  if (b.dataset.up !== undefined) buyUp(t, +b.dataset.up);
  else if (b.dataset.tg) { t.target = b.dataset.tg; showInfo(); }
  else if (b.dataset.sell) sell(t);
};
function buyUp(t, p) {
  const D = TW[t.type], i = t.up[p]; if (i >= 3 || (i === 2 && t.up[1 - p] === 3)) return;
  const c = price(D.paths[p][i].c); if (G.cash < c) return;
  G.cash -= c; t.spent += c; t.up[p]++; calcStats(t);
  G.fx.push({ k: 'ring', x: t.x, y: t.y, r: 30, col: p ? '74,215,255' : '255,201,60', t: 0, dur: 0.4 });
  showInfo(); updUI();
}
function sell(t) { G.cash += Math.round(t.spent * 0.7); G.ts = G.ts.filter(x => x !== t); G.sel = null; floatText(t.x, t.y, '+$' + Math.round(t.spent * 0.7), '#ffe066'); showInfo(); updUI(); }
function place(x, y) {
  const D = TW[G.place], c = price(D.cost);
  if (G.cash < c || !canPlace(x, y)) return false;
  const t = { type: G.place, x, y, up: [0, 0], spent: c, cd: 0, ang: -Math.PI / 2, pops: 0, target: D.base.target || 'first', flash: 0 };
  calcStats(t); G.ts.push(t); G.cash -= c; return t;
}
function updUI() {
  if (!G) return;
  $('lives').textContent = Math.max(0, Math.ceil(G.lives));
  $('cash').textContent = '$' + Math.floor(G.cash).toLocaleString();
  $('round').textContent = G.free ? G.round + ' ∞' : `${G.round}/${G.diff.win}`;
  $('go').textContent = G.active ? `⏩ Speed ${G.speed}x` : `▶ Start round ${G.round}`;
  $('pause').textContent = G.paused ? '▶' : '⏸';
  document.querySelectorAll('.tw').forEach(b => { b.classList.toggle('on', G.place === b.dataset.t); b.classList.toggle('poor', G.cash < price(TW[b.dataset.t].cost)); });
  document.querySelectorAll('#info [data-c]').forEach(b => b.classList.toggle('off', G.cash < +b.dataset.c));
}
function toGame(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
cv.addEventListener('pointermove', e => { if (G) G.mouse = toGame(e); });
cv.addEventListener('pointerleave', () => { if (G && e_pointerType !== 'touch') G.mouse = null; });
let e_pointerType = 'mouse';
cv.addEventListener('pointerdown', e => {
  e_pointerType = e.pointerType;
  if (!G || G.over) return; const m = toGame(e); G.mouse = m;
  if (e.button === 2) { G.place = null; showInfo(); updUI(); return; }
  if (G.place) { const t = place(m.x, m.y); if (t) { if (!e.shiftKey) G.place = null; G.sel = e.shiftKey ? null : t; showInfo(); updUI(); } return; }
  let hit = null, bd = 22 * 22; for (const t of G.ts) { const d = (t.x - m.x) ** 2 + (t.y - m.y) ** 2; if (d < bd) { bd = d; hit = t; } }
  G.sel = hit; showInfo(); updUI();
});
cv.addEventListener('contextmenu', e => e.preventDefault());
function goBtn() { if (!G || G.over) return; if (!G.active) startRound(); else { G.speed = G.speed === 1 ? 2 : G.speed === 2 ? 3 : 1; updUI(); } }
$('go').onclick = goBtn;
$('pause').onclick = () => { if (G && !G.over) { G.paused = !G.paused; updUI(); } };
$('auto').onchange = () => { if (G) { G.auto = $('auto').checked; G.autoT = 1; } };
$('menuBtn').onclick = () => { if (G && !G.over && !confirm('Quit to the main menu? This run will be lost.')) return; openMenu(); };
$('endA').onclick = () => { if (G.lives > 0 && G.over) { G.over = false; G.free = true; $('end').classList.add('hidden'); showInfo(); updUI(); } else newGame(G.mi, G.dk); };
$('endB').onclick = openMenu;
document.addEventListener('keydown', e => {
  if (!G || G.over || !$('menu').classList.contains('hidden')) return;
  const k = e.key.toUpperCase();
  const tk = TKEYS.find(t => TW[t].key === k); if (tk) { choosePlace(tk); return; }
  if (e.key === ' ') { e.preventDefault(); goBtn(); }
  else if (e.key === 'Escape') { G.place = null; G.sel = null; showInfo(); updUI(); }
  else if (k === 'P') { G.paused = !G.paused; updUI(); }
  else if (G.sel && e.key === ',') buyUp(G.sel, 0);
  else if (G.sel && e.key === '.') buyUp(G.sel, 1);
  else if (G.sel && e.key === 'Tab') { e.preventDefault(); if (AIMS.includes(G.sel.s.kind)) { G.sel.target = TARGETS[(TARGETS.indexOf(G.sel.target) + 1) % 4]; showInfo(); } }
  else if (G.sel && k === 'S') sell(G.sel);
});

function openMenu() {
  G = null; $('end').classList.add('hidden'); $('menu').classList.remove('hidden');
  const b = best();
  $('maps').innerHTML = '';
  MAPS.forEach((M, i) => {
    const d = document.createElement('div'); d.className = 'map' + (i === menuMap ? ' on' : '');
    const c = document.createElement('canvas'); c.width = 480; c.height = 320; c.getContext('2d').drawImage(makeBg(M).cv, 0, 0, 480, 320);
    const rec = ['easy', 'medium', 'hard'].map(k => b[i + '_' + k] ? `${DIFF[k].name[0]}: ${b[i + '_' + k]}` : '').filter(Boolean).join(' · ');
    d.appendChild(c); d.insertAdjacentHTML('beforeend', `<b>${M.name}</b><span>${M.level}${rec ? ' · Best ' + rec : ''}</span>`);
    d.onclick = () => { menuMap = i; openMenu(); }; $('maps').appendChild(d);
  });
  $('diffs').innerHTML = Object.keys(DIFF).map(k => `<button data-d="${k}" class="${k === menuDiff ? 'on' : ''}">${DIFF[k].name}<small>${DIFF[k].note}</small></button>`).join('');
  $('diffs').onclick = e => { const x = e.target.closest('[data-d]'); if (x) { menuDiff = x.dataset.d; openMenu(); } };
}
$('play').onclick = () => newGame(menuMap, menuDiff);

let last = performance.now(), uiT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G && !G.paused && !G.over) for (let i = 0; i < G.speed; i++) { step(dt); if (G.over) break; }
  draw();
  uiT += dt; if (uiT > 0.15) { uiT = 0; updUI(); }
  requestAnimationFrame(frame);
}
openMenu(); requestAnimationFrame(frame);
window.PopDefense = { get G() { return G; }, newGame, startRound, place: (type, x, y) => { G.place = type; const t = place(x, y); G.place = null; return t; }, buyUp, step, TW, BT, waveGroups };
})();
