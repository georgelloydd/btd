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
  glue: { name: 'Goo Chimp', key: 'O', cost: 225, desc: 'Squirts sticky goo that slows balloons down.',
    base: { kind: 'dart', proj: 'glue', range: 115, rate: 1.0, dmg: 0, pierce: 1, type: 'glue', spd: 480, life: 0.5, count: 1, spread: 0.2, size: 1, slowHit: 0.5, slowT: 4 },
    paths: [
      [{ n: 'Stickier Goo', c: 120, d: 'Goo slows much more', m: { slowHit: -0.2 } },
       { n: 'Goo Splash', c: 220, d: 'Each blob goos 3 balloons', m: { pierce: 2 } },
       { n: 'Acid Goo', c: 1100, d: 'Goo burns 1 layer every second', m: { glueDmg: 1, pierce: 3 } }],
      [{ n: 'Quick Squirt', c: 150, d: 'Squirts 30% faster', m: { rateX: 0.7 } },
       { n: 'Goo Spray', c: 300, d: 'Fires 3 blobs at once', m: { count: 2 } },
       { n: 'Blimp Goo', c: 1500, d: 'Goo sticks to blimps too', m: { glueBig: true, rateX: 0.7 } }]] },
  sling: { name: 'Gunslinger Chimp', key: 'A', cost: 300, desc: 'Fires quick two-shot bursts.',
    base: { kind: 'dart', proj: 'bullet', range: 125, rate: 0.9, dmg: 1, pierce: 1, type: 'sharp', spd: 900, life: 0.3, count: 2, spread: 0.06, size: 1 },
    paths: [
      [{ n: 'Hollow Points', c: 200, d: '+1 damage', m: { dmg: 1 } },
       { n: 'Ricochet', c: 350, d: '+2 pierce, pops lead', m: { pierce: 2, type: 'normal' } },
       { n: 'Six Shooter', c: 1600, d: '6 bullets per burst, much faster', m: { count: 4, rateX: 0.6 } }],
      [{ n: 'Quick Draw', c: 180, d: 'Fires 30% faster', m: { rateX: 0.7 } },
       { n: 'Eagle Sight', c: 260, d: '+30 range, sees camo', m: { range: 30, camo: true } },
       { n: 'Dead Eye', c: 1400, d: '+3 damage, +6 to blimps', m: { dmg: 3, bigBonus: 6 } }]] },
  mortar: { name: 'Barrel Mortar', key: 'D', cost: 750, desc: 'Lobs shells anywhere on the map. Blasts hit camo.',
    base: { kind: 'mortar', range: 9999, rate: 2.2, dmg: 1, pierce: 22, radius: 45, type: 'explode' },
    paths: [
      [{ n: 'Bigger Blast', c: 350, d: '+15 blast radius, +10 pierce', m: { radius: 15, pierce: 10 } },
       { n: 'Heavy Shells', c: 500, d: '+1 damage', m: { dmg: 1 } },
       { n: 'The Big One', c: 2600, d: '+3 damage, huge blast, +10 to blimps', m: { dmg: 3, radius: 25, bigBonus: 10 } }],
      [{ n: 'Rapid Reload', c: 300, d: 'Fires 25% faster', m: { rateX: 0.75 } },
       { n: 'Burning Shells', c: 500, d: 'Fire shells pop black balloons', m: { type: 'fire' } },
       { n: 'Artillery Battery', c: 2200, d: 'Fires 2.5x faster', m: { rateX: 0.4 } }]] },
  gatling: { name: 'Gatling Chimp', key: 'F', cost: 850, desc: 'A spinning gun that sprays darts very fast.',
    base: { kind: 'dart', proj: 'bullet', range: 190, rate: 0.16, dmg: 1, pierce: 1, type: 'sharp', spd: 900, life: 0.35, count: 1, spread: 0.1, size: 1 },
    paths: [
      [{ n: 'Focused Barrel', c: 300, d: '+1 pierce', m: { pierce: 1 } },
       { n: 'Laser Cannon', c: 900, d: 'Lasers pop lead, +2 pierce', m: { proj: 'laser', type: 'energy', pierce: 2 } },
       { n: 'Ray Blaster', c: 4500, d: '+1 damage, +6 pierce', m: { dmg: 1, pierce: 6, rateX: 0.7 } }],
      [{ n: 'Faster Spin', c: 400, d: 'Fires 30% faster', m: { rateX: 0.7 } },
       { n: 'Rocket Rounds', c: 900, d: 'Every shot explodes', m: { splash: 24 } },
       { n: 'Rocket Storm', c: 3200, d: 'Twin barrels, even faster', m: { count: 1, rateX: 0.7 } }]] },
  ace: { name: 'Sky Ace', key: 'G', cost: 800, desc: 'A plane that loops around, firing 8 darts at a time.',
    base: { kind: 'ace', range: 9999, rate: 1.0, dmg: 1, pierce: 4, type: 'sharp', spd: 450, life: 0.55, count: 8, orbit: 75, size: 1 },
    paths: [
      [{ n: 'Rapid Fire', c: 450, d: 'Fires 30% faster', m: { rateX: 0.7 } },
       { n: 'Bomb Drop', c: 800, d: 'Drops a bomb with every volley', m: { drop: true } },
       { n: 'Sky Fortress', c: 4000, d: '16 darts, +1 damage', m: { count: 8, dmg: 1 } }],
      [{ n: 'Wide Loop', c: 200, d: 'Flies a bigger loop', m: { orbit: 35 } },
       { n: 'Spy Plane', c: 350, d: 'Darts hit camo', m: { camo: true } },
       { n: 'Fighter Jet', c: 2500, d: 'Twice as fast, +3 pierce', m: { rateX: 0.5, pierce: 3 } }]] },
  hyper: { name: 'Hyper Chimp', key: 'H', cost: 2400, desc: 'Throws darts at incredible speed with huge range.',
    base: { kind: 'dart', range: 165, rate: 0.07, dmg: 1, pierce: 1, type: 'sharp', spd: 820, life: 0.35, count: 1, spread: 0.25, size: 1 },
    paths: [
      [{ n: 'Laser Eyes', c: 2000, d: 'Lasers: +1 pierce, pop lead', m: { proj: 'laser', type: 'energy', pierce: 1 } },
       { n: 'Plasma Blasts', c: 4000, d: '+1 damage, +2 pierce', m: { proj: 'plasma', dmg: 1, pierce: 2 } },
       { n: 'Solar Form', c: 16000, d: '+3 damage, much faster', m: { proj: 'sun', dmg: 3, pierce: 3, rateX: 0.6 } }],
      [{ n: 'Super Range', c: 900, d: '+50 range', m: { range: 50 } },
       { n: 'X-Ray Eyes', c: 1500, d: 'Sees camo', m: { camo: true } },
       { n: 'Twin Fists', c: 6000, d: 'Throws 2 at once', m: { count: 1 } }]] },
  ninja: { name: 'Shadow Chimp', key: 'J', cost: 400, desc: 'Fast shuriken thrower that sees camo.',
    base: { kind: 'dart', proj: 'shuri', range: 120, rate: 0.6, dmg: 1, pierce: 2, type: 'sharp', spd: 700, life: 0.45, count: 1, spread: 0.2, size: 1, camo: true },
    paths: [
      [{ n: 'Sharp Stars', c: 300, d: '+2 pierce, +1 damage', m: { pierce: 2, dmg: 1 } },
       { n: 'Seeking Stars', c: 350, d: 'Shuriken home in', m: { homing: true } },
       { n: 'Grand Master', c: 2600, d: '5 at once, twice as fast', m: { count: 4, rateX: 0.5 } }],
      [{ n: 'Swift Hands', c: 250, d: 'Throws 30% faster', m: { rateX: 0.7 } },
       { n: 'Flash Stars', c: 500, d: 'Shuriken burst on impact', m: { splash: 28 } },
       { n: 'Shadow Clone', c: 1900, d: '+2 damage, +40 range', m: { dmg: 2, range: 40 } }]] },
  potion: { name: 'Potion Chimp', key: 'K', cost: 550, desc: 'Throws flasks that splash acid over a group.',
    base: { kind: 'dart', proj: 'potion', range: 110, rate: 1.5, dmg: 1, pierce: 1, type: 'normal', spd: 420, life: 0.6, count: 1, spread: 0.2, size: 1, splash: 34 },
    paths: [
      [{ n: 'Stronger Acid', c: 300, d: '+1 damage', m: { dmg: 1 } },
       { n: 'Bigger Flasks', c: 450, d: 'Much bigger splash', m: { splash: 20 } },
       { n: 'Gold Brew', c: 2500, d: '+2 damage, +15 to blimps', m: { dmg: 2, bigBonus: 15 } }],
      [{ n: 'Quick Brew', c: 250, d: 'Throws 30% faster', m: { rateX: 0.7 } },
       { n: 'Double Flask', c: 600, d: '2 flasks at once', m: { count: 1 } },
       { n: 'Elixir Storm', c: 2200, d: 'Twice as fast again', m: { rateX: 0.5 } }]] },
  druid: { name: 'Thorn Druid', key: 'L', cost: 400, desc: 'Fires a spray of 5 thorns.',
    base: { kind: 'dart', proj: 'thorn', range: 110, rate: 1.1, dmg: 1, pierce: 1, type: 'sharp', spd: 520, life: 0.45, count: 5, spread: 0.14, size: 1 },
    paths: [
      [{ n: 'Hard Thorns', c: 250, d: '+1 pierce, pops lead', m: { pierce: 1, type: 'normal' } },
       { n: 'Heart of Storm', c: 900, d: 'Thorns turn into chain lightning', m: { chain: 3 } },
       { n: 'Storm of Nature', c: 3000, d: '+4 thorns, +1 damage, longer chains', m: { count: 4, chain: 2, dmg: 1 } }],
      [{ n: 'Fast Growth', c: 200, d: 'Fires 25% faster', m: { rateX: 0.75 } },
       { n: 'Long Vines', c: 250, d: '+25 range', m: { range: 25 } },
       { n: 'Ancient Grove', c: 2200, d: 'Twice as fast, 3 more thorns', m: { rateX: 0.5, count: 3 } }]] },
  spike: { name: 'Spike Maker', key: 'Z', cost: 900, desc: 'Drops spike piles on nearby track. Great last line.',
    base: { kind: 'spike', range: 85, rate: 1.8, dmg: 1, pierce: 5, type: 'sharp', life: 14, size: 1.6 },
    paths: [
      [{ n: 'Bigger Piles', c: 400, d: '+5 pierce', m: { pierce: 5 } },
       { n: 'Heavy Spikes', c: 700, d: '+1 damage, pops lead', m: { dmg: 1, type: 'normal' } },
       { n: 'Spike Mines', c: 2800, d: 'Piles explode for big damage', m: { mine: true, radius: 50, dmg: 3, pierce: 10 } }],
      [{ n: 'Faster Production', c: 450, d: 'Makes spikes 25% faster', m: { rateX: 0.75 } },
       { n: 'Long Life', c: 300, d: 'Spikes last much longer', m: { life: 12 } },
       { n: 'Spike Storm', c: 2400, d: 'Makes spikes 2.5x faster', m: { rateX: 0.4 } }]] },
  camp: { name: 'Chimp Camp', key: 'X', cost: 1200, desc: 'Gives nearby towers +10% range. Upgrades give more.',
    base: { kind: 'camp', range: 115, rangeB: 0.1 },
    paths: [
      [{ n: 'Drum Circle', c: 300, d: 'Nearby towers attack 15% faster', m: { rateBX: 0.85 } },
       { n: 'Radar Post', c: 1500, d: 'Nearby towers see camo', m: { camoB: true } },
       { n: 'War Camp', c: 4000, d: 'Faster again, +1 pierce for all', m: { rateBX: 0.8, pierceB: 1 } }],
      [{ n: 'Supply Crates', c: 600, d: '+$60 every round', m: { income: 60 } },
       { n: 'Blacksmith', c: 1000, d: 'Nearby sharp attacks pop lead', m: { leadB: true } },
       { n: 'Fortress', c: 3500, d: '+1 damage for all, +$140 per round', m: { dmgB: 1, income: 140 } }]] },
  engi: { name: 'Engineer Chimp', key: 'C', cost: 400, desc: 'A trusty nail gun with lots of pierce.',
    base: { kind: 'dart', proj: 'nail', range: 100, rate: 0.7, dmg: 1, pierce: 3, type: 'sharp', spd: 650, life: 0.4, count: 1, spread: 0.15, size: 1 },
    paths: [
      [{ n: 'Larger Nails', c: 250, d: '+3 pierce', m: { pierce: 3 } },
       { n: 'Heavy Nails', c: 500, d: '+1 damage, pops lead', m: { dmg: 1, type: 'normal' } },
       { n: 'Nail Storm', c: 1800, d: '3 nails at once, faster', m: { count: 2, rateX: 0.6 } }],
      [{ n: 'Sprockets', c: 200, d: 'Fires 30% faster', m: { rateX: 0.7 } },
       { n: 'Long Barrel', c: 250, d: '+30 range', m: { range: 30 } },
       { n: 'Foam Scanner', c: 900, d: 'Sees camo, twice as fast', m: { camo: true, rateX: 0.5 } }]] },
};
const CATS = { primary: 'Primary', military: 'Military', magic: 'Magic', support: 'Support' };
(() => {
  const meta = { dart: ['Dart Chimp', 'primary'], boomer: ['Boomer Chimp', 'primary'], bomb: ['Cannon Chimp', 'primary'], tack: ['Tack Turret', 'primary'], frost: ['Frost Chimp', 'primary'], glue: [0, 'primary'], sling: [0, 'primary'],
    sniper: ['Sniper Chimp', 'military'], mortar: [0, 'military'], gatling: [0, 'military'], ace: [0, 'military'],
    mage: ['Storm Wizard', 'magic'], hyper: [0, 'magic'], ninja: [0, 'magic'], potion: [0, 'magic'], druid: [0, 'magic'],
    farm: ['Fruit Farm', 'support'], spike: [0, 'support'], camp: [0, 'support'], engi: [0, 'support'] };
  const keys = 'Q W E R T Y U I O A D F G H J K L Z X C'.split(' ');
  const order = ['dart', 'boomer', 'bomb', 'tack', 'frost', 'glue', 'sling', 'sniper', 'mortar', 'gatling', 'ace', 'mage', 'hyper', 'ninja', 'potion', 'druid', 'farm', 'spike', 'camp', 'engi'];
  const old = Object.assign({}, TW); for (const k in TW) delete TW[k];
  order.forEach((k, i) => { TW[k] = old[k]; if (meta[k][0]) TW[k].name = meta[k][0]; TW[k].cat = meta[k][1]; TW[k].key = keys[i]; });
})();
const TKEYS = Object.keys(TW);
const AIMS = ['dart', 'bolt', 'boom', 'bomb', 'snipe', 'mortar'];
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
  if (G.fx.length < 350) G.fx.push({ k: 'pop', x: b.x, y: b.y, col: T.col === '#f0f' ? '#ff66cc' : T.col, t: 0, dur: T.big ? 0.7 : 0.35, r: T.r, big: !!T.big, pc: Array.from({ length: T.big ? 12 : 5 }, () => ({ a: Math.random() * TAU, v: 50 + Math.random() * 90, r: Math.random() * TAU })) });
  if (G.fx.length < 300 && (T.big || Math.random() < 0.03)) G.fx.push({ k: 'burst', x: b.x, y: b.y, s: T.big ? 'BOOM!' : ['POP!', 'POW!', 'BAM!'][Math.floor(Math.random() * 3)], t: 0, dur: 0.55, rot: (Math.random() - 0.5) * 0.6 });
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
    if (t.s.slowHit && b.glued > 0.3) v -= 1e12;
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
  bigBonus: t.s.bigBonus || 0, chain: t.s.chain || 0, splash: t.s.splash || 0, homing: !!t.s.homing, glaive: !!t.s.glaive, blade: !!t.s.blade,
  proj: t.s.proj, slowHit: t.s.slowHit || 0, slowT: t.s.slowT || 0, glueDmg: t.s.glueDmg || 0, glueBig: !!t.s.glueBig, mine: !!t.s.mine });
const mk = p => { p.rot = p.rot || 0; G.ps.push(p); return p; };

function updTower(t, dt) {
  const s = t.s; if (s.kind === 'farm' || s.kind === 'camp') return;
  if (s.kind === 'ace') t.pa = (t.pa || 0) + dt * 1.6;
  t.cd -= dt; if (t.cd > 0) return;
  if (s.kind === 'frost' || s.kind === 'ring') {
    const list = G.bs.filter(b => !b.dead && near(b, t.x, t.y, s.range)); if (!list.length) return;
    t.cd = s.rate; t.flash = 0.12;
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
  if (s.kind === 'spike') {
    if (!G.active) return; ensurePts(t); if (!t.pts.length) return;
    let n = 0; for (const p of G.ps) if (p.src === t && p.kind === 'spike') n++;
    if (n >= 40) { t.cd = 0.5; return; }
    t.cd = s.rate; t.flash = 0.12; const q = posAt(t.pts[Math.floor(Math.random() * t.pts.length)]);
    mk({ kind: 'spike', sx: t.x, sy: t.y, tx: q[0] + (Math.random() - 0.5) * 14, ty: q[1] + (Math.random() - 0.5) * 14, x: t.x, y: t.y, tt: 0, h: 0, life: s.life, seed: Math.random() * 6, ...common(t) }); return;
  }
  if (s.kind === 'ace') {
    if (!G.bs.length) return; t.cd = s.rate; t.flash = 0.12;
    const px = t.x + Math.cos(t.pa) * s.orbit, py = t.y + Math.sin(t.pa) * s.orbit * 0.75 - 6;
    for (let i = 0; i < s.count; i++) { const aa = i / s.count * TAU + t.pa; mk({ kind: 'dart', x: px, y: py, vx: Math.cos(aa) * s.spd, vy: Math.sin(aa) * s.spd, life: s.life, ...common(t) }); }
    if (s.drop) explode(px, py + 6, 45, 18, 1 + (s.dmg - 1), 3, t, 0, 'explode');
    return;
  }
  const tg = pickTarget(t, s.range); if (!tg) return;
  t.cd = s.rate; t.flash = 0.12;
  const a = Math.atan2(tg.y - t.y, tg.x - t.x);
  if (s.kind === 'tack') { for (let i = 0; i < s.count; i++) { const aa = i / s.count * TAU; mk({ kind: 'tack', x: t.x, y: t.y, vx: Math.cos(aa) * s.spd, vy: Math.sin(aa) * s.spd, life: s.range / s.spd, ...common(t) }); } t.flash = 0.1; return; }
  t.ang = a;
  if (s.kind === 'mortar') { const T = BT[tg.t], L = posAt(tg.d + T.spd * BASE * 0.7 * (tg.frozen > 0 ? 0 : 1) * (tg.slow > 0 ? tg.slowF : 1)); mk({ kind: 'shell', sx: t.x, sy: t.y, tx: L[0] + (Math.random() - 0.5) * 16, ty: L[1] + (Math.random() - 0.5) * 16, x: t.x, y: t.y, tt: 0, dur: 0.7, ...common(t) }); return; }
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
function ensurePts(t) {
  if (t.ptsR === t.s.range) return; t.pts = []; t.ptsR = t.s.range;
  for (let d = 0; d < G.path.len; d += 8) { const q = posAt(d); if (q[0] > 0 && q[1] > 0 && q[0] < W && q[1] < H && Math.hypot(q[0] - t.x, q[1] - t.y) <= t.s.range) t.pts.push(d); }
}
function glueB(b, p) {
  const T = BT[b.t]; if (T.big && !p.glueBig) return;
  b.glued = p.slowT; b.slow = Math.max(b.slow, p.slowT); b.slowF = Math.min(b.slowF, T.big ? Math.max(0.6, p.slowHit) : Math.max(0.15, p.slowHit));
  if (p.glueDmg) { b.acid = p.glueDmg; b.acidSrc = p.src; }
}
function updProj(p, dt) {
  if (p.kind === 'shell') { p.tt += dt / p.dur; const q = Math.min(1, p.tt); p.x = p.sx + (p.tx - p.sx) * q; p.y = p.sy + (p.ty - p.sy) * q; if (p.tt >= 1) { explode(p.tx, p.ty, p.radius, p.pierce, p.dmg, p.bigBonus, p.src, 0, p.type); p.dead = true; } return; }
  if (p.kind === 'spike') {
    if (p.tt < 1) { p.tt += dt / 0.35; const q = Math.min(1, p.tt); p.x = p.sx + (p.tx - p.sx) * q; p.y = p.sy + (p.ty - p.sy) * q; p.h = Math.sin(q * Math.PI) * 30; return; }
    p.h = 0; p.life -= dt; if (p.life <= 0) { p.dead = true; return; }
  } else if (p.kind === 'boom') {
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
    if (p.kind === 'bomb' || p.mine) { explode(p.x, p.y, p.radius, p.pierce, p.dmg, p.bigBonus, p.src, p.cluster, 'explode'); p.dead = true; return; }
    b.ig.add(p);
    if (p.chain) { lightning(p, b); p.dead = true; return; }
    const ok = dmgB(b, p.dmg + (T.big ? p.bigBonus : 0), p.type, p.src);
    if (p.slowHit && ok) glueB(b, p);
    if (p.splash) explode(p.x, p.y, p.splash, 8, Math.max(1, p.dmg), p.bigBonus, p.src, 0, 'fire');
    p.pierce--; if (!ok) p.pierce = 0;
    if (p.pierce <= 0) { p.dead = true; return; }
  }
}

// ---------------- rounds
function startRound() { if (!G || G.active || G.over) return; G.queue = buildQueue(G.round); G.rt = 0; G.active = true; G.fx.push({ k: 'banner', s: 'ROUND ' + G.round, t: 0, dur: 1.6 }); showInfo(); updUI(); }
function endRound() {
  G.active = false; const r = G.round, bonus = 100 + r; G.cash += bonus;
  for (const t of G.ts) if (t.s.income) { const inc = Math.round(t.s.income); G.cash += inc; floatText(t.x, t.y - 26, '+$' + inc, '#ffe066'); }
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
  G.time += dt; if (G.hurt > 0) G.hurt -= dt;
  if (G.active) { G.rt += dt; while (G.queue.length && G.queue[0].at <= G.rt) { const q = G.queue.shift(); spawnB(q.t, 0, q.camo, null); } }
  else if (G.auto && !G.over) { G.autoT -= dt; if (G.autoT <= 0) startRound(); }
  for (const b of G.bs) b.aura = 1;
  for (const t of G.ts) if (t.s.aura) for (const b of G.bs) if (!b.dead && near(b, t.x, t.y, t.s.range)) b.aura = Math.min(b.aura, 1 - t.s.aura);
  for (const b of G.bs) {
    if (b.dead) continue; const T = BT[b.t];
    if (b.frozen > 0) b.frozen -= dt;
    if (b.glued > 0) { b.glued -= dt; if (b.acid) { b.acidT = (b.acidT || 0) + dt; if (b.acidT >= 1) { b.acidT = 0; dmgB(b, b.acid, 'glue', b.acidSrc); if (b.dead) continue; } } }
    if (b.slow > 0) { b.slow -= dt; if (b.slow <= 0) b.slowF = 1; }
    let m = b.frozen > 0 ? 0 : 1; if (b.slow > 0) m *= b.slowF; m *= b.aura;
    b.d += T.spd * BASE * m * dt;
    if (b.d >= G.path.len) { b.dead = true; G.lives -= T.rbe - (T.hp - b.hp); G.hurt = 0.4; continue; }
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

// ---------------- chimp art (original designs, all drawn in code)
const FUR = '#8b5a2b', SKIN = '#f4cf9e';
function star(c, n, R, r) { c.beginPath(); for (let i = 0; i < n * 2; i++) { const an = -Math.PI / 2 + i * Math.PI / n, q = i % 2 ? r : R; c[i ? 'lineTo' : 'moveTo'](Math.cos(an) * q, Math.sin(an) * q); } c.closePath(); }
function flake(c, x, y, r) { c.strokeStyle = '#e8fbff'; c.lineWidth = 1.5; c.beginPath(); for (let i = 0; i < 3; i++) { const an = i / 3 * Math.PI; c.moveTo(x + Math.cos(an) * r, y + Math.sin(an) * r); c.lineTo(x - Math.cos(an) * r, y - Math.sin(an) * r); } c.stroke(); }
function chimp(c, o, tm) {
  const fur = o.fur || FUR, a = o.arm || 0, hx = 11 + a * 7;
  if (o.back) o.back(c);
  c.lineCap = 'round';
  c.strokeStyle = shade(fur, -25); c.lineWidth = 3.5; c.beginPath(); c.moveTo(-13, 3); c.bezierCurveTo(-22, 8 + Math.sin(tm * 3 + (o.seed || 0)) * 2, -25, -6, -18, -10); c.stroke();
  c.fillStyle = o.vest || fur; c.beginPath(); c.ellipse(-4, 0, 11, 12.5, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.ellipse(-6, -4, 5, 6, 0, 0, TAU); c.fill();
  c.strokeStyle = fur; c.lineWidth = 5.5; c.beginPath(); c.moveTo(-2, -9); c.quadraticCurveTo(5, -13, 9, -8); c.stroke();
  c.beginPath(); c.moveTo(-2, 9); c.quadraticCurveTo(5, 13, hx, 8); c.stroke();
  circ(c, 9, -8, 3.3, SKIN); circ(c, hx, 8, 3.3, SKIN);
  if (o.item) { c.save(); c.translate(hx, 8); o.item(c); c.restore(); }
  for (const s of [-1, 1]) { circ(c, 1, s * 10.5, 4.6, fur); circ(c, 1.6, s * 10.5, 2.5, SKIN); }
  const g = c.createRadialGradient(-1, -3, 1, 2, 0, 11); g.addColorStop(0, shade(fur, 40)); g.addColorStop(1, fur);
  c.fillStyle = g; c.beginPath(); c.arc(2, 0, 9.5, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.2; c.stroke();
  c.fillStyle = SKIN; c.beginPath(); c.ellipse(7, 0, 4.6, 7, 0, 0, TAU); c.fill();
  const blink = (tm * 0.7 + (o.seed || 0) * 0.37) % 4 < 0.1;
  for (const s of [-1, 1]) {
    if (blink) { c.strokeStyle = '#222'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(6.4, s * 3); c.lineTo(9.6, s * 3); c.stroke(); }
    else { circ(c, 7.6, s * 3, 2.3, o.eye || '#fff'); circ(c, 8.7, s * 3, 1.25, '#151515'); circ(c, 9.1, s * 3 - 0.5, 0.45, '#fff'); }
  }
  c.strokeStyle = '#6b3f1e'; c.lineWidth = 1; c.beginPath(); c.arc(9, 0, 2, -0.9, 0.9); c.stroke();
  if (o.hat) o.hat(c);
}
const cap = (col, rim) => c => { c.fillStyle = col; c.beginPath(); c.arc(1, 0, 10, 1.65, 4.63); c.fill(); if (rim) { c.strokeStyle = rim; c.lineWidth = 1.5; c.stroke(); } };
const ART = {
  dart: (c, u, a, tm) => chimp(c, { seed: 1, vest: u[1] >= 2 ? '#2e6db4' : '#b5793f', arm: a,
    item: c => {
      if (u[0] >= 3) { c.fillStyle = '#777'; for (let i = 0; i < 8; i++) { c.save(); c.rotate(i / 8 * TAU + tm * 3); c.beginPath(); c.moveTo(6, -2); c.lineTo(11, 0); c.lineTo(6, 2); c.fill(); c.restore(); } circ(c, 0, 0, 7, '#8d8d8d'); circ(c, -2, -2, 2.5, '#c9c9c9'); return; }
      const n = u[1] >= 3 ? 3 : 1;
      for (let i = 0; i < n; i++) { c.save(); c.rotate((i - (n - 1) / 2) * 0.35); c.fillStyle = u[0] >= 2 ? '#c0c7cf' : '#3a3a3a'; c.fillRect(0, -1.2, 13, 2.4); c.fillStyle = '#e33'; c.beginPath(); c.moveTo(1, 0); c.lineTo(-4, -3.5); c.lineTo(-4, 3.5); c.fill(); c.restore(); }
    },
    hat: c => {
      if (u[0] >= 1) { c.strokeStyle = '#d33'; c.lineWidth = 2.5; c.beginPath(); c.arc(2, 0, 9.6, 1.9, 4.4); c.stroke(); }
      if (u[1] >= 2) { c.fillStyle = '#222'; c.fillRect(5.5, -6.5, 2, 13); circ(c, 7.8, -3, 2.9, '#5fd4ff'); circ(c, 7.8, 3, 2.9, '#5fd4ff'); }
    } }, tm),
  boomer: (c, u, a, tm) => chimp(c, { seed: 2, vest: '#2fa39a', arm: a,
    item: c => {
      if (u[0] >= 2) { c.rotate(tm * (a > 0 ? 20 : 2)); c.fillStyle = '#dfe5ec'; poly(c, 6, 7); c.fill(); c.strokeStyle = '#8a96a3'; c.lineWidth = 1; c.stroke(); circ(c, 0, 0, 2.5, '#8a96a3'); }
      else { c.strokeStyle = u[0] >= 1 ? '#ffd34d' : '#e39b1c'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-2, -8); c.lineTo(6, 0); c.lineTo(-2, 8); c.stroke(); }
    },
    hat: c => {
      if (u[1] >= 1) { c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); c.arc(2, 0, 9.6, 2.2, 4.1); c.stroke(); }
      if (u[1] >= 3) { c.fillStyle = '#ff5a1f'; c.beginPath(); c.moveTo(-14, 0); c.lineTo(-24, -5 + Math.sin(tm * 20) * 2); c.lineTo(-21, 0); c.lineTo(-24, 5 - Math.sin(tm * 20) * 2); c.fill(); }
    } }, tm),
  bomb: (c, u, a, tm) => {
    chimp(c, { seed: 3, vest: '#555b66', arm: 0, hat: c => { cap('#3b4048')(c); c.fillStyle = '#ffcc33'; c.fillRect(-7, -1.2, 5, 2.4); } }, tm);
    const k = -a * 4, L = u[1] >= 2 ? 30 : 26;
    c.fillStyle = '#2b2f36'; rr(c, -8 + k, 3, L, 11, 5); c.fill(); c.fillStyle = '#4a515c'; c.fillRect(L - 11 + k, 2, 6, 13);
    if (u[0] >= 3) { c.fillStyle = '#ffcc33'; c.fillRect(-2 + k, 3, 3, 11); }
    if (u[1] >= 2) { c.fillStyle = '#c23b30'; rr(c, -6 + k, -15, 22, 7, 3); c.fill(); c.fillStyle = '#eee'; c.fillRect(14 + k, -14, 3, 5); }
    if (a > 0.4) { circ(c, L - 2 + k, 8.5, 7 * a, 'rgba(255,200,80,.85)'); circ(c, L - 2 + k, 8.5, 3.5 * a, '#fff6c0'); }
  },
  tack: (c, u, a, tm) => {
    const fire = u[1] >= 2, ring = u[1] >= 3, blade = u[0] >= 3;
    if (ring) { c.strokeStyle = `rgba(255,120,30,${0.35 + Math.sin(tm * 10) * 0.2})`; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 25, 0, TAU); c.stroke(); }
    c.save(); c.rotate(tm * (ring ? 4 : 1.2));
    const n = Math.min(16, 8 + (u[0] >= 2 ? 4 : 0) + (blade ? 4 : 0));
    for (let i = 0; i < n; i++) { c.save(); c.rotate(i / n * TAU); c.fillStyle = blade ? '#e8edf2' : fire ? '#ff8a2a' : '#cfd5dc'; c.beginPath(); c.moveTo(12, -3); c.lineTo(blade ? 22 : 19, 0); c.lineTo(12, 3); c.fill(); c.restore(); }
    c.restore();
    const g = c.createRadialGradient(-3, -4, 2, 0, 0, 15); g.addColorStop(0, ring ? '#ffb36b' : '#ff9ac2'); g.addColorStop(1, ring ? '#c4400c' : '#b02d63');
    c.fillStyle = g; poly(c, 8, 14, Math.PI / 8); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.stroke();
    for (let i = 0; i < 8; i++) { const an = i / 8 * TAU + Math.PI / 8; circ(c, Math.cos(an) * 10.5, Math.sin(an) * 10.5, 1.2, '#ffe3ee'); }
    circ(c, 0, 0, 5.5, ring ? '#ffe08a' : '#ffd1e2'); if (a > 0) circ(c, 0, 0, 14, `rgba(255,255,255,${a * 0.35})`);
  },
  frost: (c, u, a, tm) => {
    if (u[1] >= 3) { c.save(); c.rotate(tm); for (let i = 0; i < 6; i++) { c.rotate(TAU / 6); flake(c, 22, 0, 3.5); } c.restore(); }
    chimp(c, { seed: 4, vest: '#5fb8e6', arm: a,
      item: c => { circ(c, 2, 0, 6 + Math.sin(tm * 5), 'rgba(170,230,255,.45)'); circ(c, 2, 0, 3.6, '#e8fbff'); },
      hat: c => { const col = u[0] >= 3 ? '#e9f8ff' : '#2f7fc8'; cap(col, '#fff')(c); circ(c, -8.5, 0, 3.6, '#fff'); } }, tm);
  },
  glue: (c, u, a, tm) => chimp(c, { seed: 8, vest: '#c7c43a', arm: a,
    item: c => { const col = u[0] >= 3 ? '#6fd13a' : '#e8e15a'; c.fillStyle = col; rr(c, -6, -4, 12, 8, 3); c.fill(); c.strokeStyle = '#8a7d1e'; c.lineWidth = 1; c.stroke(); c.fillStyle = '#ddd'; c.beginPath(); c.moveTo(6, -2); c.lineTo(12, 0); c.lineTo(6, 2); c.fill(); if (a > 0.3) circ(c, 14, 0, 2.5 * a, col); },
    hat: c => { cap('#2e7d4f')(c); c.fillStyle = '#2e7d4f'; c.fillRect(-14, -3.5, 6, 7); } }, tm),
  sling: (c, u, a, tm) => chimp(c, { seed: 12, vest: '#a0522d', arm: a,
    item: c => { c.fillStyle = '#555'; c.fillRect(0, -1.8, 11, 3.6); c.fillStyle = '#6b4423'; rr(c, -5, -2.5, 6, 6, 2); c.fill(); if (a > 0.4) circ(c, 13, 0, 3.5 * a, '#fff3a0'); },
    hat: c => { c.fillStyle = '#7a4a22'; c.beginPath(); c.ellipse(0, 0, 9, 14, 0, 0, TAU); c.fill(); c.fillStyle = '#5a3416'; c.beginPath(); c.ellipse(-1, 0, 5.5, 7, 0, 0, TAU); c.fill(); c.fillStyle = u[1] >= 3 ? '#ffd54a' : '#c23b30'; c.fillRect(-4, -7, 2, 14); } }, tm),
  sniper: (c, u, a, tm) => chimp(c, { seed: 5, vest: '#5b7f3a', arm: -a * 0.4,
    item: c => { const L = u[0] >= 2 ? 36 : 30; c.fillStyle = '#222'; c.fillRect(-6, -1.7, L, 3.4); c.fillStyle = '#5a3a1e'; c.fillRect(-10, -2.4, 8, 4.8); c.fillStyle = '#333'; c.fillRect(2, -4.6, 9, 3); if (a > 0.4) circ(c, L - 4, 0, 4 * a, '#fff6b0'); },
    hat: c => { cap('#4d6b2e')(c); circ(c, -3, -4, 2, '#3a521f'); circ(c, -5, 3, 2.4, '#6f8f45'); if (u[1] >= 1) { c.fillStyle = '#1a1a1a'; c.fillRect(6, -6, 2, 12); circ(c, 8, -3, 2.6, '#3cff6a'); circ(c, 8, 3, 2.6, '#3cff6a'); } } }, tm),
  mortar: (c, u, a, tm) => {
    chimp(c, { seed: 11, vest: '#6b7d3a', arm: 0, hat: cap('#55652d', '#3d4a1e') }, tm);
    const big = u[0] >= 3, r = big ? 10 : 8.5;
    c.fillStyle = '#3d424a'; c.beginPath(); c.arc(17, 9, r, 0, TAU); c.fill(); c.strokeStyle = '#22262b'; c.lineWidth = 2; c.stroke(); circ(c, 17, 9, r * 0.6, '#0d0e10');
    if (u[1] >= 2) circ(c, 17, 9, 2.5, 'rgba(255,120,30,.9)');
    if (a > 0.1) { c.save(); c.globalAlpha *= a; circ(c, 17, 9, 13, 'rgba(235,235,235,.8)'); c.restore(); }
  },
  gatling: (c, u, a, tm, t) => {
    chimp(c, { seed: 13, vest: '#7a6a4a', arm: 0, hat: c => { cap('#3a3f46')(c); c.fillStyle = '#ffd54a'; c.fillRect(-2, -10, 3, 3); } }, tm);
    const laser = u[0] >= 2; c.fillStyle = laser ? '#5a5f9a' : '#4a4f57'; rr(c, 4, -6, 14, 12, 3); c.fill();
    c.save(); c.translate(18, 0); const sp = (t && t.flash > 0) ? tm * 40 : tm * 2;
    for (let i = 0; i < 3; i++) { const o = Math.sin(sp + i * 2.1) * 3; c.fillStyle = laser ? '#9aa0ff' : '#2b2f36'; c.fillRect(0, o - 1.2, 14, 2.4); }
    c.restore(); if (a > 0.2) circ(c, 33, 0, 4, laser ? '#ff5a8a' : '#fff3a0');
  },
  ace: (c, u, a, tm, t) => {
    c.fillStyle = '#6b7280'; rr(c, -18, -8, 36, 16, 4); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(-14, 0); c.lineTo(14, 0); c.stroke(); c.setLineDash([]);
    circ(c, -16, -10, 3, '#e33'); circ(c, 16, -10, 3, Math.sin(tm * 6) > 0 ? '#3f3' : '#151');
    const an = t ? t.pa : -0.6, R = t ? t.s.orbit : 0, px = t ? Math.cos(an) * R : 4, py = t ? Math.sin(an) * R * 0.75 : -4, hd = t ? an + Math.PI / 2 : -0.6;
    c.save(); c.translate(px, py - 6); c.rotate(hd);
    c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(4, 14, 14, 4, 0, 0, TAU); c.fill();
    const col = u[1] >= 3 ? '#3a3f4a' : '#d9d2b0';
    c.fillStyle = col; c.beginPath(); c.moveTo(16, 0); c.lineTo(-12, -4); c.lineTo(-12, 4); c.fill();
    c.beginPath(); c.moveTo(4, 0); c.lineTo(-4, -18); c.lineTo(-8, -18); c.lineTo(-4, 0); c.lineTo(-8, 18); c.lineTo(-4, 18); c.fill();
    c.beginPath(); c.moveTo(-10, 0); c.lineTo(-15, -7); c.lineTo(-17, -7); c.lineTo(-14, 0); c.lineTo(-17, 7); c.lineTo(-15, 7); c.fill();
    c.fillStyle = '#c23b30'; for (const s of [-1, 1]) circ(c, -5, s * 15, 2.2, '#c23b30');
    circ(c, 5, 0, 3.4, FUR); circ(c, 6.5, 0, 1.8, SKIN); c.fillStyle = '#5fd4ff'; c.fillRect(7, -2, 1.5, 4);
    if (u[0] >= 2) { c.fillStyle = '#222'; c.fillRect(-6, -10, 6, 3); c.fillRect(-6, 7, 6, 3); }
    c.restore();
  },
  mage: (c, u, a, tm) => chimp(c, { seed: 6, vest: '#6a3fc2', arm: a,
    item: c => {
      c.strokeStyle = '#7a5230'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-8, 0); c.lineTo(6, 0); c.stroke();
      const col = u[1] >= 1 ? '255,140,40' : '190,150,255', pul = 1 + Math.sin(tm * 6) * 0.15;
      circ(c, 8, 0, 7 * pul, `rgba(${col},.35)`); circ(c, 8, 0, 3.8, u[1] >= 1 ? '#ffd08a' : '#f1e6ff');
      if (u[0] >= 2) { c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 3; i++) { const an = tm * 9 + i * 2; c.moveTo(8, 0); c.lineTo(8 + Math.cos(an) * 9, Math.sin(an) * 9); } c.stroke(); }
    },
    hat: c => { c.fillStyle = u[0] >= 3 ? '#2a1a5e' : '#4b2a8f'; c.beginPath(); c.arc(-3, 0, 10.5, 0, TAU); c.fill(); c.fillStyle = u[0] >= 3 ? '#3d2a8a' : '#7a4fd6'; c.beginPath(); c.arc(-4, 0, 6, 0, TAU); c.fill(); c.save(); c.translate(-4, 0); c.rotate(tm * 0.8); c.fillStyle = '#ffd54a'; star(c, 5, 4.5, 2); c.fill(); c.restore(); } }, tm),
  hyper: (c, u, a, tm) => {
    const sun = u[0] >= 3;
    if (sun) { const g = c.createRadialGradient(0, 0, 4, 0, 0, 32); g.addColorStop(0, 'rgba(255,230,120,.6)'); g.addColorStop(1, 'rgba(255,200,60,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 32, 0, TAU); c.fill(); }
    chimp(c, { seed: 9, vest: sun ? '#f2c230' : '#2f6fd6', arm: a, eye: u[0] >= 1 ? '#ffb0b0' : '#fff',
      back: c => { c.fillStyle = sun ? '#fff2b0' : '#d42f3a'; c.beginPath(); c.moveTo(-2, -11); c.lineTo(-24, -15 + Math.sin(tm * 7) * 2); c.lineTo(-27, Math.sin(tm * 7 + 1) * 2); c.lineTo(-24, 15 + Math.sin(tm * 7 + 2) * 2); c.lineTo(-2, 11); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.stroke(); },
      item: c => circ(c, 0, 0, 3.9, SKIN),
      hat: c => { c.save(); c.translate(-7, 0); c.fillStyle = '#ffd54a'; star(c, 5, 3.6, 1.5); c.fill(); c.restore(); if (u[0] >= 1 && a > 0.2) { c.strokeStyle = 'rgba(255,60,60,.9)'; c.lineWidth = 2; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(9, s * 3); c.lineTo(32, s * 1); c.stroke(); } } } }, tm);
  },
  ninja: (c, u, a, tm) => chimp(c, { seed: 7, fur: '#4b3a30', vest: u[1] >= 3 ? '#3a1d4f' : '#23232d', arm: a,
    item: c => { c.rotate(tm * (a > 0 ? 25 : 3)); c.fillStyle = '#c9d1da'; star(c, 4, 7, 2.4); c.fill(); circ(c, 0, 0, 1.5, '#333'); },
    hat: c => { c.strokeStyle = u[0] >= 3 ? '#ffd54a' : '#d8282c'; c.lineWidth = 3; c.beginPath(); c.arc(2, 0, 9.6, 0.9, TAU - 0.9); c.stroke(); c.lineWidth = 2.5; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(-7, s * 2); c.quadraticCurveTo(-14, s * 4 + Math.sin(tm * 8 + s) * 3, -21, s * 3 + Math.sin(tm * 8 + s + 1) * 4); c.stroke(); } } }, tm),
  potion: (c, u, a, tm) => chimp(c, { seed: 14, vest: '#f0f0f0', arm: a,
    item: c => { const col = u[0] >= 3 ? '#ffd54a' : '#7ad13a'; c.fillStyle = 'rgba(220,240,255,.8)'; c.beginPath(); c.arc(2, 0, 5.5, 0, TAU); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(2, 0, 4.2, 0.3, Math.PI * 2 - 0.3); c.fill(); c.fillStyle = '#8a5a2e'; c.fillRect(6.5, -1.5, 4, 3); circ(c, 2 + Math.sin(tm * 7) * 1.5, -1, 0.9, '#fff'); },
    hat: c => { c.fillStyle = '#333'; c.fillRect(5.5, -7, 1.6, 14); circ(c, 7.5, -3, 2.6, '#ffb347'); circ(c, 7.5, 3, 2.6, '#ffb347'); c.fillStyle = '#6a3a1a'; c.beginPath(); c.arc(1, 0, 10, 1.8, 4.5); c.fill(); } }, tm),
  druid: (c, u, a, tm) => chimp(c, { seed: 10, vest: '#5a8a3a', arm: a,
    item: c => { c.strokeStyle = '#6b4423'; c.lineWidth = 3; c.beginPath(); c.moveTo(-9, 0); c.lineTo(9, 0); c.stroke(); c.fillStyle = '#4fbf4a'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(9, s * 3, 4, 2, s * 0.6, 0, TAU); c.fill(); } if (u[0] >= 2) circ(c, 11, 0, 3 + Math.sin(tm * 10), 'rgba(200,220,255,.85)'); },
    hat: c => { for (let i = 0; i < 7; i++) { const an = Math.PI / 2 + i / 6 * Math.PI; c.fillStyle = i % 2 ? '#3f9a3a' : '#64c25a'; c.beginPath(); c.ellipse(2 + Math.cos(an) * 9, Math.sin(an) * 9, 4, 2.2, an, 0, TAU); c.fill(); } if (u[1] >= 3) circ(c, -6, 0, 2.5, '#ff7ab6'); } }, tm),
  farm: (c, u, a, tm) => {
    c.fillStyle = '#7a4d26'; rr(c, -20, -18, 40, 36, 6); c.fill(); c.strokeStyle = '#5a3418'; c.lineWidth = 2; c.stroke();
    const gold = u[0] >= 3;
    for (let i = 0; i < 3; i++) { c.fillStyle = '#5ea83a'; c.fillRect(-16, -14 + i * 10, 32, 6); for (let j = 0; j < 5; j++) { const bob = Math.sin(tm * 2 + i + j) * 0.8; c.fillStyle = gold ? '#fff2a8' : '#ffd23f'; c.beginPath(); c.ellipse(-13 + j * 6.5, -11 + i * 10 + bob, 2.6, 1.6, 0.5, 0, TAU); c.fill(); } }
    if (u[1] >= 1) { c.fillStyle = '#d2423f'; c.beginPath(); c.moveTo(10, -27); c.lineTo(22, -20); c.lineTo(10, -13); c.lineTo(-2, -20); c.fill(); }
    if (u[1] >= 3) { circ(c, -17, -20, 6, '#ffd54a'); c.fillStyle = '#8a5a00'; c.font = 'bold 8px sans-serif'; c.textAlign = 'center'; c.fillText('$', -17, -17); }
    c.save(); c.translate(18, 15); c.scale(0.55, 0.55); c.rotate(-2.4); chimp(c, { seed: 15, vest: '#3d6fb3', arm: Math.max(0, Math.sin(tm * 3)), hat: c => { circ(c, 1, 0, 12, '#e7c36a'); circ(c, 1, 0, 7, '#d4a84a'); } }, tm); c.restore();
  },
  spike: (c, u, a, tm) => {
    const ga = c.globalAlpha;
    c.fillStyle = '#8a5a2e'; rr(c, -17, -15, 34, 30, 5); c.fill(); c.strokeStyle = '#5c3a1c'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-17, i * 8); c.lineTo(17, i * 8); c.stroke(); }
    c.save(); c.translate(-6, -4); c.rotate(tm * (1 + a * 6)); c.fillStyle = '#9aa3ad'; poly(c, 8, 7); c.fill(); circ(c, 0, 0, 3, '#5d666f'); c.restore();
    c.fillStyle = '#2b2f36'; c.fillRect(6, -14, 7, 9);
    for (let i = 0; i < 3; i++) { const q = (tm * 0.7 + i / 3) % 1; c.globalAlpha = ga * (1 - q) * 0.5; circ(c, 9.5 + q * 4, -16 - q * 16, 3 + q * 4, '#ddd'); } c.globalAlpha = ga;
    c.fillStyle = u[1] >= 2 ? '#ff8a2a' : u[0] >= 3 ? '#d33' : '#cfd5dc';
    for (let i = 0; i < 5; i++) { const sx = -8 + i * 4, sy = 9; c.beginPath(); c.moveTo(sx - 2, sy + 3); c.lineTo(sx, sy - 4); c.lineTo(sx + 2, sy + 3); c.fill(); }
  },
  camp: (c, u, a, tm) => {
    for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#f2ede0' : (u[1] >= 3 ? '#d4a52a' : '#c8423a'); c.beginPath(); c.moveTo(0, 0); const a1 = i / 6 * TAU, a2 = (i + 1) / 6 * TAU; c.lineTo(Math.cos(a1) * 19, Math.sin(a1) * 19); c.lineTo(Math.cos(a2) * 19, Math.sin(a2) * 19); c.fill(); }
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; poly(c, 6, 19); c.stroke(); circ(c, 0, 0, 3, '#6b4423');
    c.strokeStyle = '#5a3a20'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -27); c.stroke();
    const w = Math.sin(tm * 6); c.fillStyle = u[0] >= 2 ? '#3cc1ff' : '#ffd54a'; c.beginPath(); c.moveTo(0, -27); c.quadraticCurveTo(7, -28 + w * 2, 13, -24 + w); c.quadraticCurveTo(7, -22 + w, 0, -20); c.fill();
    if (u[0] >= 1) { circ(c, -15, 12, 5, '#a5682a'); circ(c, -15, 12, 3.5, '#e9d3a8'); }
    if (u[0] >= 2) { c.save(); c.translate(15, 12); c.rotate(tm * 2); c.fillStyle = '#ccd'; c.beginPath(); c.ellipse(0, 0, 6, 2.5, 0, 0, TAU); c.fill(); c.restore(); }
    if (u[1] >= 1) { c.fillStyle = '#9a6a35'; rr(c, 10, -18, 9, 8, 1.5); c.fill(); }
    const fl = 0.6 + Math.random() * 0.4; circ(c, -12, -13, 3 * fl, 'rgba(255,150,40,.85)'); circ(c, -12, -13, 1.6 * fl, '#ffe08a');
  },
  engi: (c, u, a, tm) => chimp(c, { seed: 16, vest: '#e07b1c', arm: a,
    item: c => { c.fillStyle = '#ffcc33'; rr(c, -4, -3.5, 12, 7, 2); c.fill(); c.fillStyle = '#333'; c.fillRect(8, -1.5, 5, 3); c.fillRect(-2, 3, 3, 5); if (a > 0.4) circ(c, 14, 0, 2.5, '#fff'); },
    hat: c => { c.fillStyle = '#ffcc33'; c.beginPath(); c.arc(1, 0, 10.5, 1.6, 4.68); c.fill(); c.strokeStyle = '#c99a10'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-9, 0); c.lineTo(0, 0); c.stroke(); if (u[1] >= 3) { c.fillStyle = '#5fd4ff'; c.fillRect(5.5, -6.5, 2, 13); } } }, tm),
};
const SPR = { t: {}, b: {} };
const MACH = { tack: 1, spike: 1, farm: 1, camp: 1, ace: 1 };
function drawTower(c, type, x, y, ang, up, k = 1, flash = 0, t = null) {
  const tm = G ? G.time : performance.now() / 1000, a = Math.max(0, Math.min(1, flash / 0.12));
  let sc = k * (1 + Math.sin(tm * 2.4 + x * 0.1) * 0.025);
  if (t) { const age = tm - t.born; if (age < 0.45) { const q = age / 0.45 - 1; sc *= Math.max(0.05, 1 + 2.7 * q * q * q + 1.7 * q * q); } }
  const ga = c.globalAlpha;
  c.save(); c.translate(x, y);
  if (up[0] === 3 || up[1] === 3) { c.save(); c.rotate(tm * 0.8); c.strokeStyle = 'rgba(255,215,80,.6)'; c.lineWidth = 3; c.setLineDash([6, 6]); c.beginPath(); c.arc(0, 0, 25 * k, 0, TAU); c.stroke(); c.setLineDash([]); c.restore(); }
  if (t && tm - t.upT < 0.5) { const q = (tm - t.upT) / 0.5; c.fillStyle = `rgba(255,255,200,${(1 - q) * 0.6})`; c.beginPath(); c.arc(0, 0, (18 + q * 22) * k, 0, TAU); c.fill(); }
  c.scale(sc, sc);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(2, 7, 19, 12, 0, 0, TAU); c.fill();
  const SP = SPR.t[type];
  if (SP) {
    if (SP.face !== 'none') c.rotate(ang + FACE[SP.face]);
    const w = 46 * SP.s * (1 + a * 0.08), h = w * SP.img.height / SP.img.width;
    c.drawImage(SP.img, -w / 2, -h / 2, w, h);
  } else {
    if (!MACH[type]) c.rotate(ang);
    ART[type](c, up, a, tm, t);
  }
  c.restore(); c.globalAlpha = ga;
  if (t) for (let p = 0; p < 2; p++) for (let i = 0; i < up[p]; i++) { const px = x + (p ? 4 + i * 6 : -16 + i * 6), py = y + 21 * k; circ(c, px, py, 2.8, '#000a'); circ(c, px, py, 2.1, p ? '#4ad7ff' : '#ffc93c'); }
}

const FACE = { right: 0, up: Math.PI / 2, left: Math.PI, down: -Math.PI / 2, none: 0 };
function drawBalloon(c, b) {
  const SP = SPR.b[b.t]; if (!SP) return drawBalloon0(c, b);
  const T = BT[b.t], tm = G ? G.time : performance.now() / 1000, y = b.y + Math.sin(tm * 3 + b.wob) * 1.2;
  const iw = SP.img.width, ih = SP.img.height, ga = c.globalAlpha;
  c.save(); c.translate(b.x, y);
  if (T.big && SP.face !== 'none') c.rotate((b.ang || 0) + FACE[SP.face]);
  let w, h; if (T.big) { w = T.r * 3.4 * SP.s; h = w * ih / iw; } else { h = T.r * 2.6 * SP.s; w = h * iw / ih; }
  if (b.camo) c.globalAlpha = ga * 0.55;
  c.drawImage(SP.img, -w / 2, -h / 2, w, h);
  c.globalAlpha = ga;
  if (b.frozen > 0) { c.fillStyle = 'rgba(180,235,255,.45)'; c.beginPath(); c.arc(0, 0, Math.max(w, h) * 0.5, 0, TAU); c.fill(); }
  if (b.glued > 0) { c.fillStyle = 'rgba(200,230,60,.35)'; c.beginPath(); c.arc(0, 0, Math.max(w, h) * 0.45, 0, TAU); c.fill(); }
  c.restore();
}
function drawBalloon0(c, b) {
  const T = BT[b.t], tm = G ? G.time : performance.now() / 1000, x = b.x, y = b.y + Math.sin(tm * 3 + b.wob) * 1.2;
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
  else if (T.col.length === 7) { const g = c.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r * 1.1); g.addColorStop(0, shade(T.col, 70)); g.addColorStop(0.45, T.col); g.addColorStop(1, shade(T.col, -45)); c.fillStyle = g; }
  else c.fillStyle = T.col;
  c.fill();
  if (b.t === 'zebra') { c.save(); c.clip(); c.strokeStyle = '#222'; c.lineWidth = 3; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-r, i * 6 - 4); c.lineTo(r, i * 6 + 4); c.stroke(); } c.restore(); }
  if (b.t === 'ceramic') { const dmg = 1 - b.hp / T.hp; c.strokeStyle = '#5a2e0c'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-r * 0.5, -r * 0.6); c.lineTo(-r * 0.1, -r * 0.1); c.lineTo(r * 0.3, -r * 0.4); if (dmg > 0.3) { c.moveTo(-r * 0.1, -r * 0.1); c.lineTo(-r * 0.2, r * 0.5); } if (dmg > 0.6) { c.moveTo(r * 0.5, 0); c.lineTo(r * 0.1, r * 0.4); c.lineTo(r * 0.4, r * 0.7); } c.stroke(); }
  if (b.camo) { c.save(); c.beginPath(); c.ellipse(0, 0, r * 0.86, r, 0, 0, TAU); c.clip(); c.globalAlpha = 0.55; circ(c, -4, -3, r * 0.45, '#3e5a2a'); circ(c, 5, 4, r * 0.4, '#7a6a3a'); circ(c, 3, -6, r * 0.3, '#2d4520'); c.restore(); }
  c.beginPath(); c.ellipse(0, 0, r * 0.86, r, 0, 0, TAU); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-r * 0.32, -r * 0.42, r * 0.22, r * 0.32, -0.5, 0, TAU); c.fill();
  if (b.glued > 0) { c.fillStyle = b.acid ? 'rgba(120,210,60,.6)' : 'rgba(225,220,70,.6)'; c.beginPath(); c.ellipse(0, r * 0.25, r * 0.85, r * 0.65, 0, 0, TAU); c.fill(); circ(c, r * 0.3, r * 0.95, 2.2, c.fillStyle); }
  if (b.frozen > 0) { c.fillStyle = 'rgba(170,230,255,.55)'; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 0, r * 1.05, r * 1.15, 0, 0, TAU); c.fill(); c.stroke(); }
  c.restore();
}
function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, v + amt)); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; }

function drawProj(c, p) {
  c.save(); c.translate(p.x, p.y - (p.h || 0));
  if (p.proj && p.kind === 'dart') {
    switch (p.proj) {
      case 'shuri': c.rotate(p.rot * 2); c.fillStyle = '#d5dbe2'; star(c, 4, 6, 2); c.fill(); circ(c, 0, 0, 1.2, '#555'); break;
      case 'glue': circ(c, 0, 0, 5, p.glueDmg ? '#7ad13a' : '#e8e15a'); circ(c, -1.5, -1.5, 1.8, 'rgba(255,255,255,.6)'); break;
      case 'laser': c.rotate(Math.atan2(p.vy, p.vx)); c.fillStyle = '#ff4060'; c.fillRect(-11, -1.6, 22, 3.2); c.fillStyle = '#ffd0d8'; c.fillRect(-9, -0.6, 18, 1.2); break;
      case 'plasma': circ(c, 0, 0, 7, 'rgba(255,80,220,.35)'); circ(c, 0, 0, 4, '#ffc2f4'); break;
      case 'sun': circ(c, 0, 0, 9, 'rgba(255,220,80,.4)'); circ(c, 0, 0, 5, '#fff6c0'); break;
      case 'thorn': c.rotate(Math.atan2(p.vy, p.vx)); c.fillStyle = '#3f8f2a'; c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -2.5); c.lineTo(-5, 2.5); c.fill(); break;
      case 'bullet': c.rotate(Math.atan2(p.vy, p.vx)); c.fillStyle = 'rgba(255,240,150,.5)'; c.fillRect(-10, -1, 10, 2); circ(c, 1, 0, 2.2, '#c9a227'); break;
      case 'nail': c.rotate(Math.atan2(p.vy, p.vx)); c.fillStyle = '#9aa3ad'; c.fillRect(-6, -1, 11, 2); c.fillRect(-6, -2.5, 2, 5); break;
      case 'potion': c.rotate(p.rot); c.fillStyle = 'rgba(220,240,255,.85)'; c.beginPath(); c.arc(0, 1, 5, 0, TAU); c.fill(); circ(c, 0, 1.5, 3.5, '#7ad13a'); c.fillStyle = '#8a5a2e'; c.fillRect(-1.5, -6, 3, 3); break;
    }
    c.restore(); return;
  }
  switch (p.kind) {
    case 'spike': { const col = p.mine ? '#d33' : p.type === 'fire' ? '#ff8a2a' : p.type === 'normal' ? '#7a828c' : '#aab2bb'; if (!p.h) { c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(1, 3, 8, 4, 0, 0, TAU); c.fill(); } if (p.life < 1.5) c.globalAlpha = Math.max(0.2, p.life / 1.5); c.fillStyle = col; for (let i = 0; i < 5; i++) { const an = i / 5 * TAU + p.seed; c.beginPath(); c.moveTo(Math.cos(an) * 3 - 2, Math.sin(an) * 3 + 2); c.lineTo(Math.cos(an) * 6, Math.sin(an) * 6 - 3); c.lineTo(Math.cos(an) * 3 + 2, Math.sin(an) * 3 + 2); c.fill(); } if (p.mine) circ(c, 0, 0, 3, '#ffcf3a'); break; }
    case 'shell': { const h = Math.sin(p.tt * Math.PI); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(0, 0, 5, 0, TAU); c.fill(); circ(c, 0, -h * 60, 6 + h * 5, '#2b2f36'); circ(c, -2, -h * 60 - 2, 2, '#777'); break; }
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
    case 'pop': {
      c.globalAlpha = a; if (k < 0.35) { c.fillStyle = `rgba(255,255,255,${(1 - k / 0.35) * 0.8})`; c.beginPath(); c.arc(f.x, f.y, f.r * (0.6 + k * 1.5), 0, TAU); c.fill(); }
      c.fillStyle = f.col; for (const q of f.pc) { const d = q.v * f.t * (f.big ? 2 : 1); c.save(); c.translate(f.x + Math.cos(q.a) * d, f.y + Math.sin(q.a) * d + f.t * f.t * 140); c.rotate(q.r + f.t * 10); c.beginPath(); c.moveTo(-3.5, -2); c.lineTo(3.5, -1); c.lineTo(1, 3); c.closePath(); c.fill(); c.restore(); }
      break; }
    case 'burst': { const sc = Math.min(1, k * 5) * (1 - k * 0.3); c.save(); c.translate(f.x, f.y - 12 - k * 12); c.scale(sc, sc); c.rotate(f.rot); c.globalAlpha = Math.min(1, a * 2); c.fillStyle = '#fff36b'; star(c, 10, 24, 14); c.fill(); c.strokeStyle = '#e0442a'; c.lineWidth = 2.5; c.stroke(); c.font = 'bold 15px "Trebuchet MS",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#e0442a'; c.fillText(f.s, 0, 1); c.textBaseline = 'alphabetic'; c.restore(); break; }
    case 'banner': {
      const q = k, e = Math.min(1, q / 0.2), x = q < 0.2 ? -200 + (W / 2 + 200) * e * (2 - e) : q > 0.8 ? W / 2 + (W / 2 + 260) * ((q - 0.8) / 0.2) ** 2 : W / 2;
      c.save(); c.translate(x, H * 0.42); c.rotate(-0.04);
      c.fillStyle = 'rgba(0,0,0,.35)'; rr(c, -156, -24, 320, 62, 14); c.fill();
      const g = c.createLinearGradient(0, -30, 0, 30); g.addColorStop(0, '#ffe066'); g.addColorStop(1, '#f08a1c'); c.fillStyle = g; rr(c, -160, -30, 320, 60, 14); c.fill(); c.strokeStyle = '#7a3d00'; c.lineWidth = 4; c.stroke();
      c.font = 'bold 40px "Trebuchet MS",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 7; c.strokeStyle = '#7a3d00'; c.strokeText(f.s, 0, 2); c.fillStyle = '#fff'; c.fillText(f.s, 0, 2); c.textBaseline = 'alphabetic'; c.restore(); break; }
    case 'spark': c.globalAlpha = a; for (const q of f.pc) { const d = q.v * k; c.fillStyle = q.c; c.save(); c.translate(f.x + Math.cos(q.a) * d, f.y + Math.sin(q.a) * d - k * 22); c.rotate(k * 6); star(c, 5, 4.5, 2); c.fill(); c.restore(); } break;
    case 'dust': c.globalAlpha = a * 0.7; for (let i = 0; i < 9; i++) { const an = i / 9 * TAU; circ(c, f.x + Math.cos(an) * (12 + k * 20), f.y + 6 + Math.sin(an) * (6 + k * 10), 5.5 * (1 - k * 0.5), '#f1e8d4'); } break;
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
let menuBg = null, menuBgI = -1, menuBs = [], frameDt = 0.016;
function drawMenuScene() {
  if (menuBgI !== menuMap) { menuBg = makeBg(MAPS[menuMap]); menuBgI = menuMap; }
  ctx.drawImage(menuBg.cv, 0, 0); const tm = performance.now() / 1000, dt = frameDt;
  if (menuBs.length < 26 && Math.random() < 0.1) { const t = ORDER[Math.floor(Math.random() * 11)]; menuBs.push({ t, x: Math.random() * W, bx: 0, y: H + 30, v: 40 + Math.random() * 50, wob: Math.random() * TAU, hp: 1, camo: false, frozen: 0 }); }
  for (const b of menuBs) { b.y -= b.v * dt; b.x += Math.sin(tm + b.wob) * 0.4; drawBalloon(ctx, b); }
  menuBs = menuBs.filter(b => b.y > -40);
  ['dart', 'ninja', 'mage', 'hyper', 'sniper', 'druid', 'boomer', 'bomb'].forEach((k, i) => drawTower(ctx, k, 120 + i * 103, H - 60 + Math.sin(tm * 3 + i) * 4, -Math.PI / 2 + Math.sin(tm * 2 + i) * 0.4, [0, 0], 1.6, Math.max(0, Math.sin(tm * 4 + i * 1.3)) * 0.12));
}
function draw() {
  if (!G) { if (window.R3D && R3D.hide) R3D.hide(); drawMenuScene(); return; }
  if (window.R3D && R3D.on) { try { R3D.render(); ctx.clearRect(0, 0, W, H); draw3dOverlay(); return; } catch (er) { console.error(er); R3D.on = false; R3D.hide(); } }
  if (window.R3D && R3D.hide) R3D.hide();
  ctx.drawImage(bg.cv, 0, 0);
  for (let i = 0; i < 3; i++) { const cx = ((G.time * 14 + i * 420) % (W + 500)) - 250, cy = 110 + i * 190; ctx.fillStyle = 'rgba(0,0,0,.06)'; ctx.beginPath(); ctx.ellipse(cx, cy, 120, 50, 0, 0, TAU); ctx.ellipse(cx + 70, cy + 15, 80, 40, 0, 0, TAU); ctx.fill(); }
  const sel = G.sel;
  if (sel && sel.s.range < 2000) { ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sel.x, sel.y, sel.s.range, 0, TAU); ctx.fill(); ctx.stroke(); }
  const smalls = G.bs.filter(b => !BT[b.t].big), bigs = G.bs.filter(b => BT[b.t].big);
  for (const b of smalls) drawBalloon(ctx, b);
  for (const b of bigs) drawBalloon(ctx, b);
  for (const t of G.ts) drawTower(ctx, t.type, t.x, t.y, t.ang, t.up, 1, t.flash, t);
  if (sel) { ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sel.x, sel.y, 21, 0, TAU); ctx.stroke(); }
  for (const p of G.ps) drawProj(ctx, p);
  for (const f of G.fx) drawFx(ctx, f);
  if (G.place && G.mouse) {
    const D = TW[G.place], ok = canPlace(G.mouse.x, G.mouse.y) && G.cash >= price(D.cost), r = D.base.range;
    if (r < 2000) { ctx.fillStyle = ok ? 'rgba(255,255,255,.15)' : 'rgba(255,60,60,.25)'; ctx.strokeStyle = ok ? '#fff' : '#ff5a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(G.mouse.x, G.mouse.y, r, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.globalAlpha = 0.75; drawTower(ctx, G.place, G.mouse.x, G.mouse.y, -Math.PI / 2, [0, 0]); ctx.globalAlpha = 1;
  }
  if (G.hurt > 0) { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,0,0,${G.hurt})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (!G.active && !G.over) banner(`Round ${G.round} ready — press Start or Space`);
  if (G.paused) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(0, 0, W, H); banner('Paused — press P to resume', H / 2); }
}
function draw3dOverlay() {
  for (const b of G.bs) { const T = BT[b.t]; if (!T.big) continue; const q = R3D.project(b.x, b.y, T.r * 2.4 + 26); if (!q) continue; const w = T.r * 1.6; ctx.fillStyle = '#000a'; ctx.fillRect(q.x - w / 2 - 1, q.y - 1, w + 2, 6); ctx.fillStyle = b.t === 'titan' ? '#ff5a4a' : '#5ad15a'; ctx.fillRect(q.x - w / 2, q.y, w * Math.max(0, b.hp / T.hp), 4); }
  for (const f of G.fx) { if (f.k === 'banner') drawFx(ctx, f); else if (f.k === 'txt' || f.k === 'burst' || f.k === 'clink') { const q = R3D.project(f.x, f.y, 30); if (q) drawFx(ctx, Object.assign({}, f, { x: q.x, y: q.y })); } }
  if (G.hurt > 0) { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,0,0,${G.hurt})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (!G.active && !G.over) banner(`Round ${G.round} ready — press Start or Space`);
  if (G.paused) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(0, 0, W, H); banner('Paused — press P to resume', H / 2); }
}
function banner(s, y = H - 28) { ctx.font = 'bold 20px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = '#000b'; ctx.strokeText(s, W / 2, y); ctx.fillStyle = '#fff'; ctx.fillText(s, W / 2, y); }

// ---------------- UI
const ICON = new Map();
function icon(type, up, size = 72) {
  const key = type + up.join('') + size; if (ICON.has(key)) return ICON.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size * 2; const x = c.getContext('2d'); x.scale(2, 2);
  drawTower(x, type, size / 2, size / 2 + 3, -0.6, up, size / 42, 0);
  const u = c.toDataURL(); ICON.set(key, u); return u;
}
let shopCat = 'all';
function buildShop() {
  const tabs = $('tabs');
  tabs.innerHTML = ['all', ...Object.keys(CATS)].map(c => `<button data-c="${c}" class="${c}${c === shopCat ? ' on' : ''}">${c === 'all' ? 'All' : CATS[c]}</button>`).join('');
  tabs.onclick = e => { const b = e.target.closest('[data-c]'); if (b) { shopCat = b.dataset.c; buildShop(); updUI(); } };
  const sh = $('shop'); sh.innerHTML = '';
  for (const k of TKEYS) {
    const D = TW[k]; if (shopCat !== 'all' && D.cat !== shopCat) continue;
    const b = document.createElement('button'); b.className = 'tw ' + D.cat; b.dataset.t = k; b.title = D.name + ' - ' + D.desc;
    b.innerHTML = `<img src="${icon(k, [0, 0])}" alt=""><b>${D.name}</b><span class="pr">$${price(D.cost).toLocaleString()}</span><i>${D.key}</i>`;
    b.onclick = () => choosePlace(k); sh.appendChild(b);
  }
}
function choosePlace(k) { if (!G || G.over) return; G.place = G.place === k ? null : k; G.sel = null; showInfo(); updUI(); }
function groupsText(n) { return waveGroups(n).slice().reverse().map(g => `${g.c} ${g.camo ? 'camo ' : ''}${BT[g.t].name || g.t}`).join(', '); }
function bchip(g) {
  const T = BT[g.t], bgc = g.t === 'rainbow' ? 'linear-gradient(#ff3b3b,#ffe14a,#4fd34f,#3fa0ff,#a85cff)' : g.t === 'zebra' ? 'repeating-linear-gradient(45deg,#fff 0 3px,#222 3px 6px)' : T.col;
  return `<span class="bchip"><i style="background:${bgc}"></i>${g.c}× ${g.camo ? 'camo ' : ''}${T.name || g.t}</span>`;
}
function showInfo() {
  const el = $('info'); if (!G) { el.innerHTML = ''; return; }
  if (G.place) {
    const D = TW[G.place];
    el.innerHTML = `<div class="thead ${D.cat}"><img src="${icon(G.place, [0, 0])}"><div><h2>${D.name}</h2><div class="dim">${CATS[D.cat]} · $${price(D.cost).toLocaleString()}</div></div></div><p>${D.desc}</p><p class="dim">Click the grass to place it. Hold Shift to place several. Right-click or Esc to cancel.</p>`;
    return;
  }
  const t = G.sel;
  if (!t) {
    el.innerHTML = `<h2>${G.active ? 'Round ' + G.round : 'Next up: round ' + G.round}</h2><div class="bchips">${waveGroups(G.round).slice().reverse().map(bchip).join('')}</div>
      <p class="dim" style="margin-top:8px">💡 Lead ignores sharp attacks. Black ignores explosions, white can't be frozen. Camo needs a tower that can see camo (or a Chimp Camp with Radar Post).</p>`;
    return;
  }
  const D = TW[t.type];
  let h = `<div class="thead ${D.cat}"><img src="${icon(t.type, t.up)}"><div><h2>${D.name}</h2><div class="dim">${CATS[D.cat]} · ${t.up[0]}-${t.up[1]} · Popped ${t.pops.toLocaleString()}</div>${t.buffed ? '<span class="buff">⛺ Camp boost</span>' : ''}</div></div>`;
  for (let p = 0; p < 2; p++) {
    const i = t.up[p], blocked = i === 2 && t.up[1 - p] === 3;
    h += `<div class="upath p${p}"><div class="ucards">` + D.paths[p].map((u, j) => {
      const st = j < i ? 'own' : (j === i && !blocked) ? 'next' : 'lock', u2 = p ? [0, j + 1] : [j + 1, 0];
      return `<div class="uc ${st}" title="${u.n}: ${u.d}"><img src="${icon(t.type, u2, 40)}" alt=""><span>${u.n}</span></div>`;
    }).join('') + `</div>`;
    if (i >= 3) h += `<div class="maxed">★ Path maxed ★</div>`;
    else if (blocked) h += `<div class="locked">🔒 Locked: the other path is at tier 3</div>`;
    else { const u = D.paths[p][i]; h += `<button class="buy" data-up="${p}" data-c="${price(u.c)}"><span>${u.n}<small>${u.d}</small></span><b>$${price(u.c).toLocaleString()}</b></button>`; }
    h += `</div>`;
  }
  if (t.s.income) h += `<p>Earns <b>$${Math.round(t.s.income)}</b> every round.</p>`;
  if (AIMS.includes(t.s.kind)) h += `<div class="row tgt">${TARGETS.map(m => `<button data-tg="${m}" class="${t.target === m ? 'on' : ''}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div>`;
  h += `<div class="row" style="margin-top:8px"><button class="red" data-sell="1">Sell for $${Math.round(t.spent * 0.7).toLocaleString()}</button></div>`;
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
  G.cash -= c; t.spent += c; t.up[p]++; applyBuffs(); t.upT = G.time;
  G.fx.push({ k: 'spark', x: t.x, y: t.y, t: 0, dur: 0.7, pc: Array.from({ length: 12 }, (_, i) => ({ a: i / 12 * TAU, v: 30 + Math.random() * 25, c: p ? '#4ad7ff' : '#ffd54a' })) });
  floatText(t.x, t.y - 30, 'UPGRADE!', '#fff36b', 0.9);
  showInfo(); updUI();
}
function sell(t) { G.cash += Math.round(t.spent * 0.7); G.ts = G.ts.filter(x => x !== t); G.sel = null; applyBuffs(); G.fx.push({ k: 'dust', x: t.x, y: t.y, t: 0, dur: 0.5 }); floatText(t.x, t.y, '+$' + Math.round(t.spent * 0.7), '#ffe066'); showInfo(); updUI(); }
function place(x, y) {
  const D = TW[G.place], c = price(D.cost);
  if (G.cash < c || !canPlace(x, y)) return false;
  const t = { type: G.place, x, y, up: [0, 0], spent: c, cd: 0, ang: -Math.PI / 2, pops: 0, target: D.base.target || 'first', flash: 0, born: G.time, upT: -9, pa: Math.random() * TAU };
  G.ts.push(t); applyBuffs(); G.cash -= c; G.fx.push({ k: 'dust', x, y, t: 0, dur: 0.5 }); return t;
}
function applyBuffs() {
  for (const t of G.ts) calcStats(t);
  const camps = G.ts.filter(t => t.s.kind === 'camp').sort((a, b) => (b.up[0] + b.up[1]) - (a.up[0] + a.up[1]));
  for (const t of G.ts) {
    t.buffed = false; if (t.s.kind === 'camp' || t.s.kind === 'farm') continue;
    const c = camps.find(c => Math.hypot(c.x - t.x, c.y - t.y) <= c.s.range); if (!c) continue;
    const s = t.s, b = c.s; t.buffed = true;
    if (s.range < 2000) s.range *= 1 + (b.rangeB || 0.1);
    if (b.rateB && s.rate) s.rate *= b.rateB;
    if (b.camoB) s.camo = true;
    if (b.pierceB && s.pierce) s.pierce += b.pierceB;
    if (b.dmgB && s.dmg) s.dmg += b.dmgB;
    if (b.leadB && s.type === 'sharp') s.type = 'normal';
  }
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
function toGame(e) { if (window.R3D && R3D.on && G) return R3D.pick(e.clientX, e.clientY) || { x: -9999, y: -9999 }; const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
cv.addEventListener('pointermove', e => { if (G) G.mouse = toGame(e); });
cv.addEventListener('pointerleave', () => { if (G && e_pointerType !== 'touch') G.mouse = null; });
let e_pointerType = 'mouse';
cv.addEventListener('pointerdown', e => {
  e_pointerType = e.pointerType;
  if (!G || G.over) return; const m = toGame(e); G.mouse = m;
  if (e.button === 1) return;
  if (e.button === 2) { if (window.R3D && R3D.on) return; G.place = null; showInfo(); updUI(); return; }
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
  const dt = Math.min(0.05, (now - last) / 1000); last = now; frameDt = dt;
  if (G && !G.paused && !G.over) for (let i = 0; i < G.speed; i++) { step(dt); if (G.over) break; }
  draw();
  uiT += dt; if (uiT > 0.15) { uiT = 0; updUI(); }
  requestAnimationFrame(frame);
}
// ---------------- custom sprites (optional, uploaded with sprite-upload.html)
fetch('sprites/manifest.json?v=' + Date.now()).then(r => r.ok ? r.json() : null).then(m => {
  if (!m) return; const jobs = [];
  for (const [g, key, def] of [['t', 'towers', 'up'], ['b', 'balloons', 'right']]) for (const [k, v] of Object.entries(m[key] || {})) {
    if (!v || !v.file) continue;
    jobs.push(new Promise(res => { const img = new Image(); img.onload = () => { SPR[g][k] = { img, face: FACE[v.face] !== undefined ? v.face : def, s: +v.scale || 1 }; res(); }; img.onerror = res; img.src = 'sprites/' + v.file + '?v=' + (m.v || 0); }));
  }
  Promise.all(jobs).then(() => { ICON.clear(); if (G) { buildShop(); showInfo(); updUI(); } });
}).catch(() => { });
openMenu(); requestAnimationFrame(frame);
window.PD3 = { W, H, TW, BT, MACH, canPlace, price, get G() { return G; }, get bg() { return bg; }, cancel() { if (G) { G.place = null; showInfo(); updUI(); } } };
window.PopDefense = { spawn: (t, d) => spawnB(t, d || 0), SPR, get G() { return G; }, newGame, startRound, place: (type, x, y) => { G.place = type; const t = place(x, y); G.place = null; return t; }, buyUp, step, TW, BT, waveGroups };
})();
