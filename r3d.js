'use strict';
// Pop Defense 3D renderer - a tiny dependency-free WebGL engine with original models for every tower and balloon.
(() => {
const API = window.PD3; if (!API) return;
const { W, H, TW, BT, MACH } = API;
const HW = W / 2, HH = H / 2, PI = Math.PI, TAU = PI * 2;
const cv2 = document.getElementById('game'), stage = cv2.parentElement;
const cv = document.createElement('canvas'); cv.id = 'g3d';
cv.style.cssText = 'position:absolute;pointer-events:none;border-radius:inherit;display:none';
stage.style.position = 'relative'; stage.insertBefore(cv, cv2);
cv2.style.position = 'relative'; cv2.style.zIndex = '1';
const gl = cv.getContext('webgl', { antialias: true, alpha: false });
const R3D = window.R3D = { on: false, ok: !!gl, missing: [], free: false };
if (!gl) return;

// ---------- maths (column-major 4x4)
const m4 = () => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; };
function mul(a, b, o = new Float32Array(16)) { for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
function trs(px, py, pz, ry = 0, rz = 0, rx = 0, sx = 1, sy = 1, sz = 1) {
  // T * Ry * Rz * Rx * S
  const cy = Math.cos(ry), sy_ = Math.sin(ry), cz = Math.cos(rz), sz_ = Math.sin(rz), cx = Math.cos(rx), sx_ = Math.sin(rx);
  const Ry = [cy, 0, -sy_, 0, 0, 1, 0, 0, sy_, 0, cy, 0, 0, 0, 0, 1], Rz = [cz, sz_, 0, 0, -sz_, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], Rx = [1, 0, 0, 0, 0, cx, sx_, 0, 0, -sx_, cx, 0, 0, 0, 0, 1];
  const m = mul(mul(Ry, Rz), Rx); for (let i = 0; i < 3; i++) { m[i] *= sx; m[4 + i] *= sy; m[8 + i] *= sz; } m[12] = px; m[13] = py; m[14] = pz; return m;
}
function persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2), m = new Float32Array(16); m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m; }
function lookAt(e, c) {
  let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  let xx = zz, xy = 0, xz = -zx; l = Math.hypot(xx, xz) || 1; xx /= l; xz /= l; // up = (0,1,0)
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
}
function inv(m) {
  const o = new Float32Array(16), [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d; o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
  o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d; o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
  o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d; o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
  o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d; o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
  return o;
}
const xf = (m, x, y, z, w = 1) => [m[0] * x + m[4] * y + m[8] * z + m[12] * w, m[1] * x + m[5] * y + m[9] * z + m[13] * w, m[2] * x + m[6] * y + m[10] * z + m[14] * w, m[3] * x + m[7] * y + m[11] * z + m[15] * w];
const hexc = h => { if (Array.isArray(h)) return h; if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]; const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

// ---------- shaders
const VS = `attribute vec3 aP;attribute vec3 aN;attribute vec2 aT;uniform mat4 uMVP,uM;varying vec3 vN,vL;varying vec2 vT;
void main(){gl_Position=uMVP*vec4(aP,1.);vN=mat3(uM)*aN;vL=aP;vT=aT;}`;
const FS = `precision mediump float;uniform vec4 uC;uniform float uMode,uE;uniform sampler2D uTex;varying vec3 vN,vL;varying vec2 vT;
vec3 hue(float h){return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);}
void main(){vec3 b=uC.rgb;
if(uMode>.5&&uMode<1.5)b=texture2D(uTex,vT).rgb;
else if(uMode<2.5&&uMode>1.5)b=hue(floor((1.-(vL.y*.5+.5))*6.)/6.*.83);
else if(uMode<3.5&&uMode>2.5)b=mix(vec3(.96),vec3(.12),step(.5,fract(vL.y*2.2+vL.x*.7)));
else if(uMode<4.5&&uMode>3.5)b=mix(b,vec3(.24,.35,.16),step(.25,sin(vL.x*7.)*sin(vL.y*6.+vL.z*5.)));
else if(uMode<5.5&&uMode>4.5)b=b*(.8+.25*step(.5,fract(vL.y*3.)));
vec3 n=normalize(vN);float d=max(dot(n,normalize(vec3(-.5,1.,.45))),0.);d=smoothstep(.05,.75,d);float rim=pow(1.-abs(n.z*.6+n.y*.8),3.)*.18;
vec3 c=b*(.5+.58*d+.08*n.y)+rim;c=mix(c,b,uE);gl_FragColor=vec4(c,uC.a);}`;
function sh(t, s) { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
const A = { P: gl.getAttribLocation(prog, 'aP'), N: gl.getAttribLocation(prog, 'aN'), T: gl.getAttribLocation(prog, 'aT') };
const U = {}; for (const n of ['uMVP', 'uM', 'uC', 'uMode', 'uE', 'uTex']) U[n] = gl.getUniformLocation(prog, n);

// ---------- meshes (unit sized)
function mesh(p, n, t) { const mk = d => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d), gl.STATIC_DRAW); return b; }; return { p: mk(p), n: mk(n), t: mk(t), c: p.length / 3 }; }
function tri(P, N, T, a, b, c) { for (const v of [a, b, c]) { P.push(v[0], v[1], v[2]); N.push(v[3], v[4], v[5]); T.push(v[6] || 0, v[7] || 0); } }
function sphere(lo = 16, la = 11) { const P = [], N = [], T = [], v = (i, j) => { const th = i / lo * TAU, ph = j / la * PI, x = Math.sin(ph) * Math.cos(th), y = Math.cos(ph), z = Math.sin(ph) * Math.sin(th); return [x, y, z, x, y, z, i / lo, j / la]; };
  for (let i = 0; i < lo; i++) for (let j = 0; j < la; j++) { const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1); tri(P, N, T, a, c, b); tri(P, N, T, a, d, c); } return mesh(P, N, T); }
function cyl(seg = 16, top = 1, caps = true) { const P = [], N = [], T = [], sl = 1 - top, nl = Math.hypot(1, sl);
  for (let i = 0; i < seg; i++) { const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    const n0 = [c0 / nl, sl / nl, s0 / nl], n1 = [c1 / nl, sl / nl, s1 / nl];
    const A0 = [c0, 0, s0, ...n0], A1 = [c1, 0, s1, ...n1], B0 = [c0 * top, 1, s0 * top, ...n0], B1 = [c1 * top, 1, s1 * top, ...n1];
    tri(P, N, T, A0, B1, A1); if (top > 0) tri(P, N, T, A0, B0, B1);
    if (caps) { tri(P, N, T, [0, 0, 0, 0, -1, 0], A0.slice(0, 3).concat([0, -1, 0]), A1.slice(0, 3).concat([0, -1, 0])); if (top > 0) tri(P, N, T, [0, 1, 0, 0, 1, 0], B1.slice(0, 3).concat([0, 1, 0]), B0.slice(0, 3).concat([0, 1, 0])); } }
  return mesh(P, N, T); }
function box() { const P = [], N = [], T = []; const f = (n, u, v) => { const c = (a, b) => [n[0] * .5 + u[0] * a + v[0] * b, n[1] * .5 + u[1] * a + v[1] * b, n[2] * .5 + u[2] * a + v[2] * b, ...n]; const p = [c(-.5, -.5), c(.5, -.5), c(.5, .5), c(-.5, .5)]; tri(P, N, T, p[0], p[2], p[1]); tri(P, N, T, p[0], p[3], p[2]); };
  f([1, 0, 0], [0, 0, 1], [0, 1, 0]); f([-1, 0, 0], [0, 1, 0], [0, 0, 1]); f([0, 1, 0], [1, 0, 0], [0, 0, -1]); f([0, -1, 0], [0, 0, -1], [1, 0, 0]); f([0, 0, 1], [0, 1, 0], [1, 0, 0]); f([0, 0, -1], [1, 0, 0], [0, 1, 0]); return mesh(P, N, T); }
function ring(seg = 48, inner = 0.9) { const P = [], N = [], T = []; for (let i = 0; i < seg; i++) { const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU, o0 = [Math.cos(a0), 0, Math.sin(a0), 0, 1, 0], o1 = [Math.cos(a1), 0, Math.sin(a1), 0, 1, 0], i0 = [o0[0] * inner, 0, o0[2] * inner, 0, 1, 0], i1 = [o1[0] * inner, 0, o1[2] * inner, 0, 1, 0]; tri(P, N, T, i0, o1, o0); tri(P, N, T, i0, i1, o1); } return mesh(P, N, T); }
function plane() { const P = [], N = [], T = [], v = (x, z) => [x, 0, z, 0, 1, 0, (x + HW) / W, (z + HH) / H]; tri(P, N, T, v(-HW, -HH), v(HW, HH), v(HW, -HH)); tri(P, N, T, v(-HW, -HH), v(-HW, HH), v(HW, HH)); return mesh(P, N, T); }
const MS = { S: sphere(), s: sphere(8, 6), C: cyl(16), c: cyl(7), K: cyl(16, 0), k: cyl(6, 0), B: box(), D: ring(32, 0), R: ring(64, 0.92), P: plane(), T: cyl(4, 0.75) };

// ---------- draw queue
let VP = m4(), Q = [], QT = [];
function put(mk, M, col, a = 1, mode = 0, e = 0) { (a < 1 ? QT : Q).push([MS[mk], M, hexc(col), a, mode, e]); }
let tex = null, texBg = null;
function drawQ(list) { let last = null; for (const [m, M, c, a, mode, e] of list) {
  if (m !== last) { last = m; gl.bindBuffer(gl.ARRAY_BUFFER, m.p); gl.vertexAttribPointer(A.P, 3, gl.FLOAT, false, 0, 0); gl.bindBuffer(gl.ARRAY_BUFFER, m.n); gl.vertexAttribPointer(A.N, 3, gl.FLOAT, false, 0, 0); gl.bindBuffer(gl.ARRAY_BUFFER, m.t); gl.vertexAttribPointer(A.T, 2, gl.FLOAT, false, 0, 0); }
  gl.uniformMatrix4fv(U.uMVP, false, mul(VP, M)); gl.uniformMatrix4fv(U.uM, false, M); gl.uniform4f(U.uC, c[0], c[1], c[2], a); gl.uniform1f(U.uMode, mode); gl.uniform1f(U.uE, e);
  gl.drawArrays(gl.TRIANGLES, 0, m.c); } }

// ---------- models.  Part: [mesh, colour, x, y, z, sx, sy, sz, ry, rz, rx, alpha, emissive]. +x = facing direction, y = up.
const FUR = '#7a4a2a', SKIN = '#e9c39a', DARK = '#22252b', WHITE = '#ffffff', GOLD = '#f2c230', GREY = '#9aa3ad', WOOD = '#8a5a2e', RED = '#e0403a';
const p = (m, c, x, y, z, sx, sy = sx, sz = sx, ry = 0, rz = 0, rx = 0, a = 1, e = 0) => [m, c, x, y, z, sx, sy, sz, ry, rz, rx, a, e];
const FWD = -PI / 2; // rz that turns a y-axis cylinder to point along +x
function chimp(shirt, o = {}) {
  const fur = o.fur || FUR, skin = o.skin || SKIN;
  const L = [
    p('S', fur, 1, 2, 5, 4, 2.2, 3), p('S', fur, 1, 2, -5, 4, 2.2, 3),
    p('c', fur, -7, 5, 0, 1.2, 11, 1.2, 0, 0.9),
    p('S', shirt, 0, 13, 0, 9.5, 11, 9.5), p('S', skin, 4.6, 12, 0, 5, 7, 6.5),
    p('S', fur, 5, 15, 8, 3.2), p('S', fur, 5, 15, -8, 3.2),
    p('S', fur, 1, 27, 0, 8.5, 8, 8.5), p('S', skin, 6, 25.5, 0, 4.6, 4, 6.2),
    p('S', skin, 0, 28.5, 8.6, 2, 3, 2), p('S', skin, 0, 28.5, -8.6, 2, 3, 2),
    p('S', WHITE, 7.3, 29.2, 2.8, 1.9), p('S', WHITE, 7.3, 29.2, -2.8, 1.9), p('S', DARK, 8.9, 29.2, 2.8, 1), p('S', DARK, 8.9, 29.2, -2.8, 1),
    p('S', '#5a3420', 10.2, 26.2, 0, 1.2, 0.9, 1.7),
  ];
  L.forEach((q, i) => q[13] = i < 2 ? 'f' : i < 5 ? 'b' : i < 7 ? 'a' : 'h');
  return L;
}
const dartHand = (c = '#33363c', fin = RED) => [p('c', c, 7, 16, 8, 0.7, 10, 0.7, 0, FWD), p('k', fin, 6, 16, 8, 2.2, -3, 2.2, 0, FWD)];
const MODELS = {
  dart: () => [...chimp('#c98b4b'), p('C', RED, 1, 31, 0, 8.8, 2.2, 8.8), p('B', RED, -8, 31, 2, 4, 1.5, 1.5, 0.4), ...dartHand()],
  boomer: () => [...chimp('#2fa39a'), p('C', '#1f7a72', 1, 34, 0, 6, 1.5, 6), p('B', GOLD, 9, 17, 9, 9, 1.6, 2.6, 0.6), p('B', GOLD, 9, 17, 5, 9, 1.6, 2.6, -0.6)],
  bomb: () => [p('B', WOOD, 0, 4, 0, 26, 8, 22), p('C', DARK, 0, 8, 11, 6, 2.5, 6, 0, 0, PI / 2), p('C', DARK, 0, 8, -9, 6, 2.5, 6, 0, 0, PI / 2), p('S', '#555b66', -2, 15, 0, 9), p('C', '#555b66', 0, 15, 0, 7, 22, 7, 0, FWD), p('C', DARK, 20, 15, 0, 8, 3, 8, 0, FWD), p('C', DARK, 22, 15, 0, 5, 1.2, 5, 0, FWD, 0, 1, 0.6), p('c', GOLD, -10, 20, 0, 0.6, 6, 0.6, 0, 0.6)],
  tack: () => { const L = [p('C', '#9c2d56', 0, 0, 0, 15, 7, 15), p('C', '#d6457a', 0, 7, 0, 13, 8, 13), p('S', '#f07aa8', 0, 15, 0, 10, 7, 10), p('S', WHITE, 0, 20, 0, 3)]; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; L.push(p('k', GREY, Math.cos(a) * 12, 10, Math.sin(a) * 12, 1.8, 9, 1.8, -a, FWD)); } return L; },
  frost: () => [p('C', '#5aa9cc', 0, 0, 0, 15, 6, 15), p('C', '#bfe9fb', 0, 6, 0, 11, 8, 11), p('K', '#7fd3f7', 0, 14, 0, 9, 22, 9, 0, 0, 0, 0.9, 0.2), p('K', '#d9f4ff', 6, 12, 5, 4, 12, 4, 0, -0.3, 0.3, 0.9, 0.3), p('K', '#d9f4ff', -5, 12, -5, 4, 11, 4, 0, 0.3, -0.3, 0.9, 0.3), p('S', WHITE, 0, 37, 0, 3, 3, 3, 0, 0, 0, 1, 0.8)],
  sniper: () => [...chimp('#4d7a3a'), p('S', '#3c5f2c', 1, 31, 0, 9.5, 5, 9.5), p('C', '#3c5f2c', 1, 30, 0, 11, 1, 11), p('C', DARK, 2, 16, 4, 1.4, 30, 1.4, 0, FWD), p('C', '#555', 10, 19, 4, 1.8, 7, 1.8, 0, FWD), p('B', WOOD, 1, 15, 4, 8, 3, 3)],
  mage: () => [...chimp('#7a4fd6'), p('C', '#5b34b0', 0, 0, 0, 11, 10, 11, 0, 0, 0, 1), p('K', '#5b34b0', 1, 32, 0, 9, 20, 9, 0, 0.25), p('C', '#5b34b0', 1, 32, 0, 12, 1.2, 12), p('S', GOLD, -2, 41, 0, 1.6), p('c', WOOD, 9, 2, -9, 0.9, 30, 0.9), p('S', '#c9a5ff', 9, 33, -9, 3.5, 3.5, 3.5, 0, 0, 0, 0.9, 0.8)],
  farm: () => { const L = [p('B', '#7fbf45', 0, 1, 0, 40, 2, 34), p('B', '#c8342d', -6, 10, -4, 20, 16, 16), p('B', WHITE, 4.2, 8, -4, 0.6, 9, 7), p('T', '#7a2a24', -6, 18, -4, 15.5, 9, 12.5, PI / 4), p('C', '#e2b33c', 11, 2, 9, 3, 9, 3)];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) L.push(p('S', '#f2d23a', 8 + i * 3.6, 4, 2 + j * 4 + (i % 2), 1.8)); L.push(p('S', '#4c9a2e', 14, 14, 12, 6), p('c', WOOD, 14, 2, 12, 1.2, 9, 1.2), p('S', GOLD, 12, 15, 16, 1.8), p('S', GOLD, 17, 13, 9, 1.8)); return L; },
  glue: () => [...chimp('#c9c23a'), p('C', '#8a8a2a', 6, 14, 7, 3, 13, 3, 0, FWD), p('S', '#d8e04a', 2, 18, 9, 4.5, 4.5, 4.5, 0, 0, 0, 0.85), p('C', '#d8e04a', 18, 14, 7, 1.8, 2, 1.8, 0, FWD, 0, 1, 0.4)],
  sling: () => [...chimp('#b5473a'), p('C', '#6b4423', 1, 32, 0, 13, 0.9, 13), p('C', '#6b4423', 1, 32, 0, 6.5, 6, 6.5), p('C', '#3e2817', 1, 33, 0, 6.8, 1.6, 6.8), p('B', '#444', 10, 16, 8, 8, 2, 2), p('B', '#444', 10, 16, -8, 8, 2, 2), p('B', WOOD, 7, 14, 8, 2, 4, 2), p('B', WOOD, 7, 14, -8, 2, 4, 2)],
  mortar: () => { const L = [p('C', '#7a6a4a', 0, 0, 0, 16, 5, 16), p('C', '#4a4f57', 0, 4, 0, 8, 22, 8, 0, -0.45), p('C', DARK, 9.5, 24, 0, 9, 2, 9, 0, -0.45)]; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; L.push(p('S', '#c9b27a', Math.cos(a) * 16, 4, Math.sin(a) * 16, 5, 4, 4, -a)); } return L; },
  gatling: () => { const L = [...chimp('#6a7a8a'), p('S', '#d9a53a', 1, 31, 0, 9.3, 4.5, 9.3), p('C', '#3a3f47', 4, 14, 0, 5, 8, 5, 0, FWD), p('B', '#3a3f47', 6, 8, 0, 3, 12, 3)]; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; L.push(p('c', DARK, 11, 14 + Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0.9, 16, 0.9, 0, FWD)); } return L; },
  ace: () => [p('D', '#9aa3ad', 0, 0.5, 0, 16), p('R', WHITE, 0, 0.7, 0, 13), p('B', GOLD, 0, 0.8, 0, 2, 0.4, 14), p('B', GOLD, 0, 0.8, 0, 14, 0.4, 2)],
  acePlane: () => [p('S', '#d94a3a', 0, 0, 0, 13, 4.2, 4.2), p('B', '#b8382c', -1, 0, 0, 7, 1.2, 30), p('B', '#b8382c', -11, 0, 0, 3.5, 1, 11), p('B', '#b8382c', -11, 4, 0, 4, 7, 1), p('S', '#9fd8ff', 5, 3, 0, 4, 2.5, 2.5, 0, 0, 0, 0.9), p('C', DARK, 12.5, 0, 0, 2, 1.5, 2, 0, FWD), p('B', '#444', 14.3, 0, 0, 0.4, 13, 1.4)],
  hyper: () => [...chimp('#2f6fe0'), p('B', RED, -7, 15, 0, 2, 20, 18, 0, 0.18), p('S', RED, 0, 14, 0, 9.7, 3, 9.7), p('B', DARK, 7.6, 29.3, 0, 2.6, 2.4, 10), p('S', GOLD, 9.3, 15, 0, 2, 2, 3.2)],
  ninja: () => [...chimp('#2b2b3a', { fur: '#3a2a22' }), p('C', '#d23a3a', 1, 29, 0, 8.8, 2, 8.8), p('B', '#d23a3a', -8, 29, 2, 6, 1.4, 1.4, 0.3, 0.3), p('B', '#2b2b3a', 6.2, 24.5, 0, 4, 3.5, 12), p('B', '#d5dbe2', 9, 17, 8, 7, 0.8, 1.8, 0.785), p('B', '#d5dbe2', 9, 17, 8, 7, 0.8, 1.8, -0.785)],
  potion: () => [...chimp('#e8eef4'), p('C', '#3a3f47', 1, 30, 0, 8.9, 2.2, 8.9), p('S', '#9fd8ff', 8, 30, 3, 2.4, 2.4, 2.4, 0, 0, 0, 1, 0.3), p('S', '#9fd8ff', 8, 30, -3, 2.4, 2.4, 2.4, 0, 0, 0, 1, 0.3), p('S', '#dff4ff', 9, 17, 8, 4.5, 4.5, 4.5, 0, 0, 0, 0.6), p('S', '#7ad13a', 9, 16.5, 8, 3.4, 3.4, 3.4, 0, 0, 0, 1, 0.5), p('c', WOOD, 9, 20, 8, 1.2, 3, 1.2)],
  druid: () => { const L = [...chimp('#6b5233'), p('C', '#5a4429', 0, 0, 0, 11, 10, 11), p('c', WOOD, 9, 1, -9, 1.1, 34, 1.1, 0, 0.08), p('S', '#3f8f2a', 10.5, 35, -9, 4.5)]; for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; L.push(p('S', i % 2 ? '#3f8f2a' : '#6cc04a', 1 + Math.cos(a) * 7.5, 33, Math.sin(a) * 7.5, 3)); } return L; },
  spike: () => { const L = [p('B', '#6d7680', 0, 9, 0, 26, 18, 22), p('B', '#4f5760', 0, 19, 0, 28, 2, 24), p('C', '#4f5760', -7, 18, -6, 3, 14, 3), p('B', '#f2c230', 13.2, 7, 0, 0.6, 9, 12), p('S', '#8a939d', 3, 24, 4, 5.5)]; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; L.push(p('k', '#c5ccd4', 3 + Math.cos(a) * 5, 24, 4 + Math.sin(a) * 5, 1.4, 5, 1.4, -a, FWD)); } L.push(p('k', '#c5ccd4', 3, 29, 4, 1.4, 4, 1.4)); return L; },
  camp: () => [p('D', '#a2834f', 0, 0.4, 0, 22), p('T', '#e07a2e', -3, 0, 0, 16, 22, 16, PI / 4), p('B', '#5a2e0c', 9.5, 5, 0, 0.6, 9, 6), p('c', WOOD, 12, 0, 12, 0.8, 32, 0.8), p('B', '#3fa0ff', 12, 28, 16, 0.6, 6, 8), p('S', '#ff9a2a', -14, 3, 13, 3.5, 4, 3.5, 0, 0, 0, 1, 0.8), p('B', WOOD, -14, 1, 13, 9, 1.6, 1.6, 0.6), p('B', WOOD, -14, 1, 13, 9, 1.6, 1.6, -0.6)],
  engi: () => [...chimp('#e88a1a'), p('S', '#f2d23a', 1, 31, 0, 9.3, 5, 9.3), p('C', '#f2d23a', 3, 30.5, 0, 9.8, 1, 9.8), p('B', '#3a3f47', 9, 16, 7, 10, 4, 4), p('B', '#3a3f47', 6, 12, 7, 3, 6, 3), p('B', '#f2d23a', 4, 6, -11, 6, 6, 6)],
};
const BUILT = {}; const LOCAL = new Map();
function model(key) { if (BUILT[key]) return BUILT[key]; const f = MODELS[key]; if (!f) { if (!R3D.missing.includes(key)) R3D.missing.push(key); return model('dart'); }
  const raw = f(), isC = raw.some(q => q[13]);
  return BUILT[key] = raw.map(q => ({ m: q[0], c: q[1], a: q[11], e: q[12], g: q[13] || (!isC ? 'm' : q[3] >= 26 ? 'h' : q[2] < 0 ? 'b' : 'w'), L: trs(q[2], q[3], q[4], q[8], q[9], q[10], q[5], q[6], q[7]) })); }
const about = (px, py, pz, rz, sy = 1, sx = 1) => mul(trs(px, py, pz, 0, rz, 0, sx, sy, sx), trs(-px, -py, -pz));
function drawModel(key, X, Y, Z, ry, k, alpha = 1, flash = 0, an = null) {
  const T = trs(X, Y, Z, ry, 0, 0, k, k, k);
  let G = null;
  if (an) { const lean = about(0, 2, 0, an.lean), br = about(0, 0, 0, 0, 1 + an.br);
    G = { f: m4(), b: mul(lean, br), h: mul(lean, mul(br, trs(an.nod * 2, an.br * 30 + an.bob, 0, 0, an.nod * 0.04))), a: mul(lean, mul(br, about(5, 16, 0, an.sw))), w: mul(lean, mul(br, about(5, 16, 0, an.sw))),
      m: mul(trs(-an.rec, 0, 0, an.spin), about(0, 0, 0, 0, 1 - an.sq, 1 + an.sq * 0.5)) }; }
  for (const q of model(key)) put(q.m, G ? mul(T, mul(G[q.g], q.L)) : mul(T, q.L), q.c, Math.min(q.a, alpha), 0, Math.max(q.e, flash));
}
const shadow = (X, Z, r, a = 0.22, h = 0) => { const ox = 3 + h * 0.35, oz = 2 + h * 0.3; put('D', trs(X + ox, 0.5, Z + oz, 0, 0, 0, r * 1.25, 1, r * 1.05), '#000000', a * 0.45); put('D', trs(X + ox * 0.8, 0.6, Z + oz * 0.8, 0, 0, 0, r * 0.95, 1, r * 0.8), '#000000', a * 0.6); };
const WX = x => x - HW, WZ = y => y - HH;

// ---------- camera
const CAM0 = { yaw: 0, pitch: 0.95, dist: 880, tx: 0, tz: 25 };
let cam = Object.assign({}, CAM0);
try { Object.assign(cam, JSON.parse(localStorage.getItem('popdef_cam') || '{}')); } catch (e) { }
const saveCam = () => { try { localStorage.setItem('popdef_cam', JSON.stringify(cam)); } catch (e) { } };
const TILT = 0.62;
function camMats() {
  if (!R3D.free) { VP = new Float32Array([1 / HW, 0, 0, 0, 0, TILT / HH, -1 / 900, 0, 0, -1 / HH, -TILT / 900, 0, 0, 0, 0, 1]); return; }
  const cp = Math.cos(cam.pitch), e = [cam.tx + Math.sin(cam.yaw) * cp * cam.dist, Math.sin(cam.pitch) * cam.dist, cam.tz + Math.cos(cam.yaw) * cp * cam.dist];
  VP = mul(persp(0.75, W / H, 20, 5000), lookAt(e, [cam.tx, 0, cam.tz]));
}
R3D.pick = (cx, cy) => {
  const b0 = cv2.getBoundingClientRect(), r = { left: b0.left + cv2.clientLeft, top: b0.top + cv2.clientTop, width: cv2.clientWidth, height: cv2.clientHeight }, nx = (cx - r.left) / r.width * 2 - 1, ny = 1 - (cy - r.top) / r.height * 2, I = inv(VP);
  const a = xf(I, nx, ny, -1), b = xf(I, nx, ny, 1); for (const v of [a, b]) { v[0] /= v[3]; v[1] /= v[3]; v[2] /= v[3]; }
  if (Math.abs(b[1] - a[1]) < 1e-6) return null; const t = -a[1] / (b[1] - a[1]); if (t < 0) return null;
  return { x: a[0] + (b[0] - a[0]) * t + HW, y: a[2] + (b[2] - a[2]) * t + HH };
};
R3D.project = (x, y, h = 0) => { const v = xf(VP, WX(x), h, WZ(y)); if (v[3] <= 0) return null; return { x: (v[0] / v[3] + 1) / 2 * W, y: (1 - v[1] / v[3]) / 2 * H }; };
R3D.rotate = d => { cam.yaw += d; saveCam(); };
R3D.zoom = f => { cam.dist = Math.max(320, Math.min(1600, cam.dist * f)); saveCam(); };
R3D.reset = () => { cam = Object.assign({}, CAM0); saveCam(); };
// mouse: right-drag = rotate/tilt, middle-drag or shift+right-drag = pan, wheel = zoom, right-click (no drag) = cancel placing
let drag = null;
cv2.addEventListener('pointerdown', e => { if (!R3D.on || !R3D.free || !API.G || (e.button !== 2 && e.button !== 1)) return; drag = { x: e.clientX, y: e.clientY, b: e.button, pan: e.button === 1 || e.shiftKey, moved: 0 }; try { cv2.setPointerCapture(e.pointerId); } catch (er) { } }, true);
window.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.pan) { const s = cam.dist / 700, c = Math.cos(cam.yaw), si = Math.sin(cam.yaw); cam.tx = Math.max(-500, Math.min(500, cam.tx - (dx * c + dy * si) * s)); cam.tz = Math.max(-350, Math.min(350, cam.tz - (-dx * si + dy * c) * s)); }
  else { cam.yaw -= dx * 0.008; cam.pitch = Math.max(0.3, Math.min(1.5, cam.pitch + dy * 0.006)); } });
window.addEventListener('pointerup', () => { if (!drag) return; drag = null; saveCam(); });
cv2.addEventListener('wheel', e => { if (!R3D.on || !R3D.free || !API.G) return; e.preventDefault(); R3D.zoom(e.deltaY > 0 ? 1.1 : 1 / 1.1); }, { passive: false });

// on-screen controls
const ui = document.createElement('div'); ui.id = 'cam3d';
ui.style.cssText = 'position:absolute;right:10px;bottom:10px;z-index:2;display:none;gap:4px';
ui.innerHTML = ['&lt;|Rotate left|l', '&gt;|Rotate right|r', '+|Zoom in|i', '&minus;|Zoom out|o', 'B|Reset camera (B)|h'].map(s => { const [t, ti, a] = s.split('|'); return `<button data-a="${a}" title="${ti}" style="width:34px;height:34px;padding:0;font-size:17px">${t}</button>`; }).join('');
ui.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; ({ l: () => R3D.rotate(-PI / 8), r: () => R3D.rotate(PI / 8), i: () => R3D.zoom(1 / 1.2), o: () => R3D.zoom(1.2), h: R3D.reset })[b.dataset.a](); };
stage.appendChild(ui);
const tog = document.createElement('button'); tog.id = 'tog3d'; tog.title = '3D view on/off (V)';
const ctrl = document.querySelector('.ctrl'); if (ctrl) ctrl.appendChild(tog);
function setOn(v) { R3D.on = v; tog.textContent = v ? '3D' : '2D'; tog.classList.toggle('green', v); try { localStorage.setItem('popdef_3d', v ? '1' : '0'); } catch (e) { } if (!v) R3D.hide(); }
tog.onclick = () => setOn(!R3D.on);
document.addEventListener('keydown', e => { if (!API.G || /INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName)) return; const k = e.key.toUpperCase(); if (k === 'V') setOn(!R3D.on);  });
R3D.hide = () => { cv2.style.background = ''; cv.style.display = 'none'; ui.style.display = 'none'; };

// ---------- per-frame render
const PCOL = { shuri: '#d5dbe2', glue: '#e8e15a', laser: '#ff4060', plasma: '#ff9bea', sun: '#fff1a0', thorn: '#3f8f2a', bullet: '#c9a227', nail: '#9aa3ad', potion: '#7ad13a' };
function drawProj(q, tm) {
  const X = WX(q.x), Z = WZ(q.y), va = Math.atan2(q.vy || 0, q.vx || 0), ry = -va; let Y = 18 + (q.h || 0);
  if (q.proj && q.kind === 'dart') {
    const c = PCOL[q.proj] || '#333', glow = /laser|plasma|sun/.test(q.proj) ? 0.9 : 0.2;
    if (q.proj === 'laser') put('B', trs(X, Y, Z, ry, 0, 0, 22, 2.4, 2.4), c, 1, 0, 1);
    else if (q.proj === 'shuri') { put('B', trs(X, Y, Z, q.rot * 2, 0, 0, 10, 1, 2.6), c); put('B', trs(X, Y, Z, q.rot * 2 + PI / 2, 0, 0, 10, 1, 2.6), c); }
    else if (q.proj === 'thorn' || q.proj === 'nail' || q.proj === 'bullet') put('k', trs(X, Y, Z, ry, FWD, 0, 2, 10, 2), c, 1, 0, glow);
    else put('s', trs(X, Y, Z, 0, 0, 0, q.proj === 'sun' ? 7 : 5), q.proj === 'glue' && q.glueDmg ? '#7ad13a' : c, 1, 0, glow);
    return;
  }
  switch (q.kind) {
    case 'spike': { const col = q.mine ? '#d33' : q.type === 'fire' ? '#ff8a2a' : q.type === 'normal' ? '#7a828c' : '#aab2bb', a = q.life < 1.5 ? Math.max(0.25, q.life / 1.5) : 1; Y = q.h ? Y : 0; for (let i = 0; i < 5; i++) { const an = i / 5 * TAU + (q.x % 3); put('k', trs(X + Math.cos(an) * 3.5, Y, Z + Math.sin(an) * 3.5, 0, Math.cos(an) * 0.4, Math.sin(an) * 0.4, 2, 6, 2), col, a); } break; }
    case 'shell': { const h = Math.sin((q.tt || 0) * PI); shadow(X, Z, 5); put('s', trs(X, 8 + h * 80, Z, 0, 0, 0, 6 + h * 3), '#2b2f36'); break; }
    case 'dart': if (q.size > 1.2) { put('S', trs(X, Y, Z, 0, 0, 0, 7), '#888'); for (let i = 0; i < 6; i++) { const an = i / 6 * TAU + q.rot; put('k', trs(X, Y, Z, -an, FWD, 0, 2, 11, 2), '#666'); } } else { put('c', trs(X, Y, Z, ry, FWD, 0, 0.9, 12, 0.9), '#333'); put('k', trs(X, Y, Z, ry, FWD, 0, 2.6, -3.5, 2.6), RED); } break;
    case 'tack': put('k', trs(X, Y, Z, ry, FWD, 0, q.blade ? 3.5 : 1.6, q.blade ? 11 : 8, q.blade ? 1 : 1.6), q.blade ? '#e8edf2' : q.type === 'fire' ? '#ff8a2a' : '#555', 1, 0, q.type === 'fire' ? 0.7 : 0); break;
    case 'boom': put('B', trs(X, Y, Z, q.rot, 0, 0, 13, 1.6, 3.5), q.glaive ? '#dfe5ec' : GOLD); put('B', trs(X, Y, Z, q.rot + 1.6, 0, 0, 13, 1.6, 3.5), q.glaive ? '#dfe5ec' : GOLD); break;
    case 'bomb': put('S', trs(X, Y, Z, 0, 0, 0, 6 * (q.size || 1)), '#1d1f24'); put('s', trs(X, Y + 6 * (q.size || 1), Z, 0, 0, 0, 2), '#ffb020', 1, 0, 1); break;
    case 'bolt': put('s', trs(X, Y, Z, 0, 0, 0, 8), q.splash ? '#ff7828' : '#aa78ff', 0.4, 0, 1); put('s', trs(X, Y, Z, 0, 0, 0, 4.5), q.splash ? '#ffb347' : '#e6d6ff', 1, 0, 1); break;
    default: put('s', trs(X, Y, Z, 0, 0, 0, 4), '#555');
  }
}
const rgbs = s => s.split(',').map(v => +v / 255);
function beam(x1, y1, x2, y2, col, w) { const X1 = WX(x1), Z1 = WZ(y1), X2 = WX(x2), Z2 = WZ(y2), L = Math.hypot(X2 - X1, Z2 - Z1) || 1; put('B', trs((X1 + X2) / 2, 20, (Z1 + Z2) / 2, -Math.atan2(Z2 - Z1, X2 - X1), 0, 0, L, w, w), col, 1, 0, 1); }
function drawFx(f) {
  const k = f.t / f.dur, a = 1 - k, X = WX(f.x || 0), Z = WZ(f.y || 0);
  switch (f.k) {
    case 'pop': { if (k < 0.35) put('s', trs(X, 24, Z, 0, 0, 0, f.r * (0.6 + k * 1.5)), WHITE, (1 - k / 0.35) * 0.7, 0, 1);
      for (const q of f.pc || []) { const d = q.v * f.t * (f.big ? 2 : 1); put('B', trs(X + Math.cos(q.a) * d, Math.max(1, 24 + (f.big ? 20 : 0) + 40 * f.t - f.t * f.t * 260), Z + Math.sin(q.a) * d, q.r + f.t * 10, f.t * 8, 0, 5, 1.2, 4), f.col, Math.max(0.05, a)); } break; }
    case 'boom': put('s', trs(X, 10, Z, 0, 0, 0, f.r * (0.5 + k * 0.6)), rgbs(f.col), a * 0.55, 0, 1); put('R', trs(X, 1, Z, 0, 0, 0, f.r * (0.6 + k * 0.5)), '#fff3c4', a, 0, 1); break;
    case 'ring': put('R', trs(X, 1.2, Z, 0, 0, 0, f.r * (0.3 + 0.7 * k)), rgbs(f.col), a * 0.8, 0, 1); break;
    case 'shot': beam(f.x1, f.y1, f.x2, f.y2, '#fff6b0', 1.4); break;
    case 'zap': beam(f.x1, f.y1, f.x2, f.y2, '#d8c4ff', 2.4); break;
    case 'spark': for (const q of f.pc || []) { const d = q.v * k; put('s', trs(X + Math.cos(q.a) * d, 22 + k * 30, Z + Math.sin(q.a) * d, 0, 0, 0, 2.4), q.c || GOLD, Math.max(0.05, a), 0, 1); } break;
    case 'dust': for (let i = 0; i < 9; i++) { const an = i / 9 * TAU; put('s', trs(X + Math.cos(an) * (12 + k * 20), 3 + k * 6, Z + Math.sin(an) * (12 + k * 20), 0, 0, 0, 5 * (1 - k * 0.5)), '#f1e8d4', a * 0.7); } break;
  }
}
const BMODE = { rainbow: 2, zebra: 3, ceramic: 5 };
function drawBalloon(b, tm) {
  const T = BT[b.t], X = WX(b.x), Z = WZ(b.y), bob = Math.sin(tm * 3 + b.wob) * 1.6;
  if (T.big) {
    const L = T.r * 1.6, R = T.r * 0.72, Y = R + 22 + bob, ry = -b.ang, col = T.col, dark = b.t === 'titan' ? '#7a1d18' : '#1f5f94';
    shadow(X, Z, L * 0.9, 0.3, Y);
    const Tm = trs(X, Y, Z, ry, Math.sin(tm * 1.3 + b.wob) * 0.04, 0, 1, 1, 1);
    const part = (m, c, x, y, z, sx, sy, sz, rz = 0, rx = 0, a = 1, mode = 0) => put(m, mul(Tm, trs(x, y, z, 0, rz, rx, sx, sy, sz)), c, a, b.camo && m === 'S' ? 4 : mode);
    part('S', col, 0, 0, 0, L, R, R);
    part('C', dark, -L * 0.25, 0, 0, R * 1.01, 3, R * 1.01, FWD); part('C', dark, L * 0.3, 0, 0, R * 0.93, 3, R * 0.93, FWD);
    for (const [rx] of [[0], [PI / 2], [PI], [-PI / 2]]) part('B', dark, -L * 0.9, 0, 0, L * 0.35, 1.5, R * 1.3, 0, rx);
    part('B', '#333', 0, -R * 0.95, 0, L * 0.5, R * 0.35, R * 0.45);
    part('S', '#fff', L * 0.55, R * 0.35, 0, L * 0.25, R * 0.35, R * 0.5, 0, 0, 0.35);
    if (b.frozen > 0) part('S', '#aae6ff', 0, 0, 0, L * 1.06, R * 1.12, R * 1.12, 0, 0, 0.45);
    if (b.glued > 0) part('S', b.acid ? '#78d23c' : '#e1dc46', 0, -R * 0.3, 0, L * 1.02, R * 0.8, R * 1.04, 0, 0, 0.5);
    return;
  }
  const r = T.r * 1.08, Y = r + 20 + bob; shadow(X, Z, r * 0.7, 0.22, Y); const wq = Math.sin(tm * 6 + b.wob * 3) * 0.045;
  const mode = b.camo ? 4 : (BMODE[b.t] || 0), col = b.t === 'lead' ? '#a8b0b8' : b.t === 'rainbow' ? '#ffffff' : T.col;
  put('S', trs(X, Y, Z, 0, wq * 0.6, 0, r * 0.86 * (1 + wq), r * (1 - wq), r * 0.86 * (1 + wq)), col, 1, mode, b.t === 'lead' ? 0.05 : 0);
  put('s', trs(X - r * 0.3, Y + r * 0.42, Z - r * 0.3, 0, 0, 0, r * 0.18, r * 0.28, r * 0.18), WHITE, 0.6, 0, 1);
  put('k', trs(X, Y - r * 1.12, Z, 0, 0, 0, 2.6, 4, 2.6), b.t === 'rainbow' ? '#a04ad7' : b.t === 'white' || b.t === 'zebra' ? '#bbbbbb' : col, 1);
  put('c', trs(X, Y - r * 1.12 - 10, Z, 0, 0, 0, 0.3, 10, 0.3), '#444', 0.7);
  if (b.t === 'ceramic' && b.hp < T.hp) put('S', trs(X, Y, Z, 0, 0, 0, r * 0.88, r * 1.02, r * 0.88), '#5a2e0c', 0.25 * (1 - b.hp / T.hp) + 0.05);
  if (b.glued > 0) put('S', trs(X, Y - r * 0.25, Z, 0, 0, 0, r * 0.9, r * 0.7, r * 0.9), b.acid ? '#78d23c' : '#e1dc46', 0.6);
  if (b.frozen > 0) put('S', trs(X, Y, Z, 0, 0, 0, r * 1.02, r * 1.15, r * 1.02), '#aae6ff', 0.5, 0, 0.3);
}
function drawTower(t, tm, alpha = 1) {
  const type = t.type, X = WX(t.x), Z = WZ(t.y), up = t.up || [0, 0], born = t.born !== undefined ? tm - t.born : 9;
  const k = (1 + 0.05 * (up[0] + up[1])) * (born < 0.3 ? 0.6 + born / 0.3 * 0.4 + Math.sin(born / 0.3 * PI) * 0.15 : 1) * (1 + Math.max(0, t.flash || 0) * 0.08);
  const ry = MACH[type] || type === 'frost' ? 0 : -(t.ang || 0);
  shadow(X, Z, 17 * k, 0.3 * alpha, 8);
  if ((t.flash || 0) > (t._lf || 0) + 0.02) t._ft = tm; t._lf = t.flash || 0;
  const ph = t._ft !== undefined ? Math.min(1, (tm - t._ft) / 0.32) : 1, hit = Math.sin(ph * PI), seed = (t.x * 7 + t.y * 3) % 6.28;
  const spinT = type === 'tack' ? (t._sp = (t._sp || 0) + (ph < 1 ? 0.25 : 0.01)) : 0;
  const an = { br: Math.sin(tm * 2.4 + seed) * 0.03, bob: Math.sin(tm * 2.4 + seed + 0.6) * 0.5, nod: hit, lean: -0.22 * hit, sw: ph < 1 ? (ph < 0.35 ? ph / 0.35 * 1.1 : 1.1 - (ph - 0.35) / 0.65 * 2.3) * (1 - ph * 0.3) : Math.sin(tm * 1.7 + seed) * 0.06,
    rec: (type === 'bomb' || type === 'mortar' || type === 'gatling' ? 5 : 0) * hit, sq: (MACH[type] || type === 'frost' || type === 'bomb' || type === 'mortar' ? 0.12 : 0.04) * hit + Math.sin(tm * 3 + seed) * 0.015, spin: spinT * 0 };
  drawModel(type, X, 0, Z, ry + (type === 'tack' ? spinT : 0), k, alpha, (t.flash || 0) > 0 ? 0.2 : 0, alpha < 1 ? null : an);
  if (type === 'ace') { const an = tm * 1.6 + (t.pa || 0), R = 38; drawModel('acePlane', X + Math.cos(an) * R, 46 + Math.sin(tm * 2) * 3, Z + Math.sin(an) * R, -(an + PI / 2), 1, alpha); shadow(X + Math.cos(an) * R, Z + Math.sin(an) * R, 10, 0.2 * alpha, 46); }
  if (alpha === 1) for (let pth = 0; pth < 2; pth++) for (let i = 0; i < up[pth]; i++) put('s', trs(X + (pth ? 5 : -5), 44 * k + 4 + i * 6, Z, 0, 0, 0, 2.3), pth ? '#3fa0ff' : '#ff4d4d', 1, 0, 0.5);
}
function syncSize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv2.clientWidth, h = cv2.clientHeight;
  cv.style.left = (cv2.offsetLeft + cv2.clientLeft) + 'px'; cv.style.top = (cv2.offsetTop + cv2.clientTop) + 'px'; cv.style.width = cv2.clientWidth + 'px'; cv.style.height = cv2.clientHeight + 'px'; cv2.style.background = 'transparent';
  const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr)); if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
}
R3D.render = () => {
  const G = API.G, bg = API.bg; if (!G || !bg) return;
  cv.style.display = 'block'; ui.style.display = R3D.free ? 'flex' : 'none'; syncSize();
  if (texBg !== bg) { texBg = bg; if (!tex) tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bg.cv); for (const [pn, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, pn, v); }
  camMats(); Q = []; QT = []; const tm = G.time;
  if (R3D.free) put('B', trs(0, -18, 0, 0, 0, 0, W + 24, 36, H + 24), '#6b4a2b'); put('B', trs(0, -3, 0, 0, 0, 0, W + 12, 6, H + 12), '#4f8f2f');
  put('P', trs(0, 0.2, 0, 0, 0, 0, 1, 1, 1), WHITE, 1, 1);
  const sel = G.sel;
  if (sel && sel.s && sel.s.range < 2000) { put('D', trs(WX(sel.x), 0.9, WZ(sel.y), 0, 0, 0, sel.s.range, 1, sel.s.range), WHITE, 0.13, 0, 1); put('R', trs(WX(sel.x), 1, WZ(sel.y), 0, 0, 0, sel.s.range, 1, sel.s.range), WHITE, 0.7, 0, 1); }
  if (sel) put('R', trs(WX(sel.x), 1.1, WZ(sel.y), 0, 0, 0, 22, 1, 22), '#ffd54a', 1, 0, 1);
  for (const t of G.ts) drawTower(t, tm);
  for (const b of G.bs) drawBalloon(b, tm);
  for (const q of G.ps) drawProj(q, tm);
  for (const f of G.fx) drawFx(f);
  if (G.place && G.mouse && G.mouse.x > -999) { const D = TW[G.place], ok = API.canPlace(G.mouse.x, G.mouse.y) && G.cash >= API.price(D.cost), r = D.base.range;
    if (r < 2000) { put('D', trs(WX(G.mouse.x), 0.9, WZ(G.mouse.y), 0, 0, 0, r, 1, r), ok ? WHITE : '#ff3c3c', ok ? 0.15 : 0.25, 0, 1); put('R', trs(WX(G.mouse.x), 1, WZ(G.mouse.y), 0, 0, 0, r, 1, r), ok ? WHITE : '#ff5a5a', 0.8, 0, 1); }
    drawTower({ type: G.place, x: G.mouse.x, y: G.mouse.y, ang: -PI / 2, up: [0, 0] }, tm, 0.6); }
  gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0.55, 0.8, 0.95, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.enableVertexAttribArray(A.P); gl.enableVertexAttribArray(A.N); gl.enableVertexAttribArray(A.T);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U.uTex, 0);
  gl.disable(gl.BLEND); gl.depthMask(true); drawQ(Q);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); drawQ(QT); gl.depthMask(true);
  R3D.calls = Q.length + QT.length;
};
R3D.models = Object.keys(MODELS);
let want = true; try { want = localStorage.getItem('popdef_3d') !== '0'; } catch (e) { }
setOn(want);
})();
