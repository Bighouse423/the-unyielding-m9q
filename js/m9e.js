// ===== M9E: atmosphere II, wayfinding, weapon FX II  (VISUAL ONLY) =====
// Nothing here touches the simulation: no Math.random (own PRNG), no sim timing, no hitboxes. Light added to the lightmap
// for a frame is saved texel-by-texel and restored before postFX, so anything reading lightAt outside rendering sees m9d values.
// Settings: VIDEO > ATMOSPHERE (OFF/LITE/FULL), WAYFINDING (OFF/SUBTLE/FULL), MINIMAP (ON/OFF); WEAPON FX (m9b) gates the weapon parts.
// All three new settings OFF + WEAPON FX OFF == m9d pixel for pixel. The GFX governor (GFX.q) scales everything down.
(function () {
  const Q = n => { const m = new RegExp('[?&]' + n + '=([012])').exec(location.search); return m ? +m[1] : null; };
  const QA = Q('atm'), QN = Q('nav'), QM = Q('mmap'), QW = Q('wfx');
  let sd = 13579; const fr = () => (sd = (sd * 16807) % 2147483647) / 2147483647, fa = (a, b) => a + (b - a) * fr();
  const S = () => (window.OPT && OPT.S) || {};
  const gq = () => (typeof GFX === 'undefined' ? 2 : GFX.q);
  const atm = () => { if (!FX.on || gq() < 1) return 0; const v = QA !== null ? QA : (S().atm === undefined ? 2 : S().atm); return Math.min(v, gq()); };
  const wfx = () => { if (!FX.on || gq() < 1) return 0; const v = QW !== null ? QW : (S().wfx === undefined ? 2 : S().wfx); return Math.min(v, gq()); };
  const nav = () => QN !== null ? QN : (S().nav === undefined ? 1 : S().nav);
  const mmap = () => QM !== null ? QM > 0 : S().mmap !== false;
  const flashK = () => (window.OPT && OPT.flashK ? OPT.flashK() : 1);
  const playing = () => G.state === 'play' || G.state === 'dead';
  const HDK = () => (RK > 1 ? 0.6 : 1);          // HD buffers cost 4x per pixel -> fewer heavy items
  const TAU = Math.PI * 2;
  const pack = (r, g, b) => (Math.min(255, b | 0) << 16) | (Math.min(255, g | 0) << 8) | Math.min(255, r | 0);
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const M9E = window.M9E = { ST: { lights: 0, texels: 0, ap: 0, halos: 0, trail: 0, fx2: 0 }, on: { atm, wfx, nav, mmap } };
  // real-time clock for decay (render side only)
  let now = 0, rdt = 0, lastPN = 0;
  const tick = () => { const pn = performance.now(); rdt = lastPN ? Math.min(0.05, Math.max(0, (pn - lastPN) / 1000)) : 0; lastPN = pn; if (M9E.freeze) rdt = 0; now += rdt; };

  // ============ 1. DYNAMIC LIGHT (weapon glow, projectiles, impacts, torch pools, landmarks) ============
  const DL = [];       // transient: {x,y,r,c,i,t,life,los}
  const addL = (x, y, r, c, i, life, los = true) => { if (DL.length < 20) DL.push({ x, y, r, c, i, t: 0, life, los }); };
  let SI = new Int32Array(4096), SR = new Float32Array(4096), SG = new Float32Array(4096), SB = new Float32Array(4096), nS = 0, applied = false;
  const grow = () => { const n = SI.length * 2, a = new Int32Array(n), b = new Float32Array(n), c = new Float32Array(n), d = new Float32Array(n); a.set(SI); b.set(SR); c.set(SG); d.set(SB); SI = a; SR = b; SG = c; SB = d; };
  function light(x, y, R, c, k, los, mask) {
    const LW = MW * LR, LH = MH * LR;
    if (mask) { for (let j = 0; j < mask.n; j++) { const idx = mask.i[j], f = mask.w[j] * k; if (nS >= SI.length) grow(); SI[nS] = idx; SR[nS] = LMr[idx]; SG[nS] = LMg[idx]; SB[nS] = LMb[idx]; nS++; LMr[idx] += c[0] * f; LMg[idx] += c[1] * f; LMb[idx] += c[2] * f; } return; }
    const x0 = Math.max(0, Math.floor((x - R) * LR)), x1 = Math.min(LW - 1, Math.ceil((x + R) * LR)), y0 = Math.max(0, Math.floor((y - R) * LR)), y1 = Math.min(LH - 1, Math.ceil((y + R) * LR));
    for (let ly = y0; ly <= y1; ly++) for (let lx = x0; lx <= x1; lx++) {
      const wx = (lx + 0.5) / LR, wy = (ly + 0.5) / LR, d = Math.hypot(wx - x, wy - y); if (d > R) continue;
      const ci = (wy | 0) * MW + (wx | 0); if (SOLID[ci] === 1) continue;
      if (los && d > 0.6 && !losCells(x, y, wx, wy)) continue;
      let f = 1 - d / R; f = f * f * k; const idx = ly * LW + lx;
      if (nS >= SI.length) grow(); SI[nS] = idx; SR[nS] = LMr[idx]; SG[nS] = LMg[idx]; SB[nS] = LMb[idx]; nS++;
      LMr[idx] += c[0] * f; LMg[idx] += c[1] * f; LMb[idx] += c[2] * f;
    }
  }
  function restore() { if (!applied) return; for (let j = nS - 1; j >= 0; j--) { const i = SI[j]; LMr[i] = SR[j]; LMg[i] = SG[j]; LMb[i] = SB[j]; } nS = 0; applied = false; }
  // static masks (torches, landmarks): LOS once per level
  const MASKS = new Map(); let maskLM = null;
  function maskOf(key, x, y, R) {
    if (maskLM !== LMr) { MASKS.clear(); maskLM = LMr; }
    let m = MASKS.get(key); if (m) return m;
    const LW = MW * LR, LH = MH * LR, I = [], Wt = [];
    const x0 = Math.max(0, Math.floor((x - R) * LR)), x1 = Math.min(LW - 1, Math.ceil((x + R) * LR)), y0 = Math.max(0, Math.floor((y - R) * LR)), y1 = Math.min(LH - 1, Math.ceil((y + R) * LR));
    for (let ly = y0; ly <= y1; ly++) for (let lx = x0; lx <= x1; lx++) {
      const wx = (lx + 0.5) / LR, wy = (ly + 0.5) / LR, d = Math.hypot(wx - x, wy - y); if (d > R) continue;
      const ci = (wy | 0) * MW + (wx | 0); if (ci < 0 || SOLID[ci] === 1) continue; if (d > 0.6 && !losCells(x, y, wx, wy)) continue;
      const f = 1 - d / R; I.push(ly * LW + lx); Wt.push(f * f);
    }
    m = { i: Int32Array.from(I), w: Float32Array.from(Wt), n: I.length }; MASKS.set(key, m); return m;
  }
  const SPC = { base: [0.6, 0.35, 1.0], frost: [0.4, 0.8, 1.0], storm: [0.6, 0.55, 1.0], crimson: [1.0, 0.25, 0.35], skull: [0.35, 1.0, 0.5], axe: [1.0, 0.4, 0.2], rapier: [1.0, 0.3, 0.5] };
  const WPC = { base: [0.65, 0.4, 1.0], fire: [1.0, 0.5, 0.15], chain: [0.5, 0.75, 1.0], blood: [1.0, 0.3, 0.55] };
  const PJC = { fireball: [1.0, 0.45, 0.15], wisp: [0.4, 1.0, 0.6], bloodwave: [1.0, 0.2, 0.4], web: null };
  const swordKind = () => (P.wpn && P.wpn.sword) || 'base', whipKind = () => (P.wpn && P.wpn.whip) || 'base';
  function applyAll() {
    restore(); M9E.ST.lights = 0;
    if (!LMr || G.state === 'title' || !LEVEL || !LEVEL.props) return;
    const A = atm(), Wf = wfx(), N = nav(); if (!A && !Wf && !N) return;
    applied = true; const t = G.t;
    // torch light pools that breathe (nearest 6 torches/braziers)
    if (A) {
      const T = []; for (const pr of LEVEL.props) { if (pr.type !== 'torch' && pr.type !== 'brazier') continue; const d = Math.abs(pr.x - P.x) + Math.abs(pr.y - P.y); if (d < 13) T.push([d, pr]); }
      T.sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < Math.min(T.length, A > 1 ? 6 : 3); i++) {
        const pr = T[i][1], br = pr.type === 'brazier', ph = pr.x * 3.1 + pr.y * 1.7;
        const fl = 0.55 + 0.25 * Math.sin(t * 7.7 + ph) * Math.sin(t * 3.1 + ph * 2) + 0.2 * Math.max(0, Math.sin(t * 1.3 + ph)) ** 6;
        const c = pr.green ? [0.25, 0.9, 0.45] : [1.0, 0.55, 0.22];
        light(0, 0, 0, c, (br ? 0.32 : 0.24) * fl, false, maskOf(pr, pr.x, pr.y, br ? 3.6 : 3.0)); M9E.ST.lights++;
      }
      // projectiles + crossbow bolt trails cast coloured light
      for (const p of G.projectiles || []) { const c = PJC[p.type] === undefined ? [0.7, 0.4, 1.0] : PJC[p.type]; if (!c) continue; if (Math.abs(p.x - P.x) + Math.abs(p.y - P.y) > 16) continue; light(p.x, p.y, 2.2, c, 0.5, true); M9E.ST.lights++; }
    }
    if (Wf && typeof BOLTS !== 'undefined') for (const b of BOLTS) { if (b.t > b.dur) continue; const k = 1 - b.t / b.dur; let c = [0.5, 0.8, 1.0]; if (typeof b.col === 'string' && b.col[0] === '#') { const h = hex(b.col); c = [h[0] / 255, h[1] / 255, h[2] / 255]; } light(b.b[0], b.b[1], 2.4, c, 0.7 * k, true); M9E.ST.lights++; }
    // weapon glow on walls/floor around you (sword aura; whip lash tip)
    if (Wf && G.state === 'play') {
      const sw = P.sw ? 1 : 0, c = SPC[swordKind()] || SPC.base, pul = 0.8 + 0.2 * Math.sin(t * 2.6);
      light(P.x + Math.cos(P.ang) * 0.5, P.y + Math.sin(P.ang) * 0.5, sw ? 2.8 : 1.8, c, (sw ? 0.3 : 0.08) * pul * (Wf > 1 ? 1 : 0.7), true); M9E.ST.lights++;
      if (P.whip && P.off === 'whip') { const wt = P.whip.t; if (wt > 0.06 && wt < 0.32) { const k = Math.min(1, (wt - 0.06) / 0.08) * (wt > 0.22 ? (0.32 - wt) / 0.1 : 1); const L = 2.6; light(P.x + Math.cos(P.ang) * L, P.y + Math.sin(P.ang) * L, 2.6, WPC[whipKind()] || WPC.base, 0.55 * k, true); M9E.ST.lights++; } }
    }
    // transient lights (impact flashes, kill bursts, landmarks pulses)
    for (let i = DL.length - 1; i >= 0; i--) { const L = DL[i]; L.t += rdt; if (L.t > L.life) { DL.splice(i, 1); continue; } const k = 1 - L.t / L.life; light(L.x, L.y, L.r, L.c, L.i * k * k, L.los); M9E.ST.lights++; }
    // wayfinding landmarks: the boss gate antechamber + the checkpoint font glow
    if (N && LEVEL.doors && LEVEL.doors.gate && LEVEL.checkpoints && LEVEL.checkpoints[1] && LEVEL.doors.gate.state !== 'sealed' && LEVEL.kind !== 'hub') {
      const cp = LEVEL.checkpoints[1], g = LEVEL.doors.gate, open = g.state === 'open';
      const pul = 0.75 + 0.25 * Math.sin(t * 2.2);
      light(0, 0, 0, open ? [1.0, 0.85, 0.35] : [0.3, 1.0, 0.55], 0.45 * pul, false, maskOf('gate', cp.x, cp.y, 3.4)); M9E.ST.lights++;
    }
    M9E.ST.texels = nS;
  }

  // ============ 2. ROOM COLOUR IDENTITY (wayfinding; baked into the lightmap once per level, never secret rooms) ============
  const RPAL = [[0.05, 0.0, 0.09], [0.0, 0.06, 0.05], [0.07, 0.01, 0.05], [0.06, 0.04, 0.0], [0.01, 0.03, 0.08]];
  let tintLM = null, tintOn = false, tintD = null;
  function roomTint() {
    const want = nav() > 0 && LMr && LEVEL && LEVEL.rooms && LEVEL.kind === 'crypt';
    if (LMr !== tintLM) { tintLM = LMr; tintOn = false; tintD = null; }
    if (!want && !tintOn) return; if (want && tintOn) return;
    if (!tintD) {
      const LW = MW * LR, I = [], C = [];
      for (const r of LEVEL.rooms) {
        if (r.kind === 'secret') continue; const c = r.kind === 'elite' ? [0.08, -0.01, 0.0] : RPAL[r.id % RPAL.length];
        for (let ly = r.y0 * LR; ly < (r.y1 + 1) * LR; ly++) for (let lx = r.x0 * LR; lx < (r.x1 + 1) * LR; lx++) {
          // soft edge: fades over the outer half cell so doorways blend
          const ex = Math.min(lx - r.x0 * LR, (r.x1 + 1) * LR - 1 - lx), ey = Math.min(ly - r.y0 * LR, (r.y1 + 1) * LR - 1 - ly), e = Math.min(1, (Math.min(ex, ey) + 1) / 3);
          I.push(ly * LW + lx); C.push(c[0] * e, c[1] * e, c[2] * e);
        }
      }
      tintD = { I, C };
    }
    const s = want ? 1 : -1, { I, C } = tintD;
    for (let j = 0; j < I.length; j++) { const i = I[j]; LMr[i] += C[j * 3] * s; LMg[i] += C[j * 3 + 1] * s; LMb[i] += C[j * 3 + 2] * s; }
    tintOn = want;
  }

  // ============ 3. COLOUR GRADE (per stage accent from the stage haze; rebuilt when ATMOSPHERE changes) ============
  let lastGrd = null, graded = -1;
  const _lut = buildLUT;
  buildLUT = function (grd) {
    lastGrd = grd === undefined ? null : grd; _lut(grd); graded = atm(); if (!graded || !FX.lut) return;
    // second pass on the finished LUT: mid-tone accent toward the stage haze + a touch more local punch
    const L = FX.lut, ac = [HAZE[0] / 255, HAZE[1] / 255, HAZE[2] / 255], am = graded > 1 ? 0.07 : 0.04;
    for (let i = 0; i < L.length; i++) {
      const q = L[i]; let r = (q & 255) / 255, g = ((q >> 8) & 255) / 255, b = ((q >> 16) & 255) / 255;
      const l = 0.299 * r + 0.587 * g + 0.114 * b, mid = 4 * l * (1 - l);
      r += (ac[0] - l) * mid * am; g += (ac[1] - l) * mid * am; b += (ac[2] - l) * mid * am;
      const c = graded > 1 ? 0.06 : 0.03; r = r + (r - 0.5) * c; g = g + (g - 0.5) * c; b = b + (b - 0.5) * c;
      L[i] = 0xff000000 | (Math.max(0, Math.min(255, b * 255)) << 16) | (Math.max(0, Math.min(255, g * 255)) << 8) | Math.max(0, Math.min(255, r * 255));
    }
  };
  M9E.regrade = () => { if (graded !== atm()) buildLUT(lastGrd); };

  // ============ 4. AMBIENT PARTICLES, ENEMY BACKLIGHT, GOD RAYS, BEACON, TRAIL (pre-postFX, so graded) ============
  const STY = {   // per stage: colour, drift (vz), count, size
    castle: [[90, 70, 140], 0.02, 1, 0.014], crypt: [[40, 130, 70], 0.06, 1, 0.016], ossuary: [[110, 95, 80], 0.01, 1, 0.014],
    hub: [[130, 100, 50], 0.03, 0.7, 0.014], courtyard: [[95, 85, 110], -0.09, 1, 0.018], belfry: [[100, 90, 130], -0.04, 1, 0.014],
    arena: [[170, 70, 20], 0.16, 1, 0.012], necropolis: [[50, 140, 80], 0.07, 1.1, 0.016], kennels: [[110, 75, 55], 0.01, 0.8, 0.014],
    cathedral: [[150, 120, 50], 0.03, 1, 0.013], throne: [[120, 50, 170], 0.12, 1.1, 0.013], abyss: [[85, 35, 130], -0.07, 1.3, 0.017], victory: [[150, 120, 50], 0.03, 0.8, 0.013]
  };
  const AP = [];   // {x,y,z,vx,vy,vz,t,life,c,sz,tw}
  const KP = [];   // kill dissolve embers
  function ambient(cam, A) {
    const st = STY[SFX.stageKey] || STY.castle, max = ((A > 1 ? 70 : 28) * st[2] * HDK()) | 0;
    const spawn = Math.min(6, Math.ceil(max * rdt / 3));
    for (let k = 0; k < spawn && AP.length < max; k++) {
      const a = fr() * TAU, d = fa(0.8, 6.5), x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d, ci = cellAt(x, y); if (ci < 0 || SOLID[ci]) continue;
      const fz = FH[ci], cz = CH[ci] < 50 ? CH[ci] : fz + 3.2, vz = st[1] * fa(0.6, 1.4);
      AP.push({ x, y, z: vz < 0 ? Math.min(cz - 0.1, fz + fa(1.6, 3.0)) : fz + fa(0.1, 2.2), vx: fa(-0.08, 0.08), vy: fa(-0.08, 0.08), vz, t: 0, life: fa(2.5, 5.5), c: st[0], sz: st[3] * fa(0.7, 1.4), tw: fr() * TAU, fz });
    }
    for (let i = AP.length - 1; i >= 0; i--) {
      const p = AP[i]; p.t += rdt; if (p.t > p.life || p.z < p.fz) { AP.splice(i, 1); continue; }
      p.x += (p.vx + 0.05 * Math.sin(now * 0.9 + p.tw)) * rdt; p.y += (p.vy + 0.05 * Math.cos(now * 0.7 + p.tw)) * rdt; p.z += p.vz * rdt;
      const k = Math.min(1, p.t / 0.8, (p.life - p.t) / 0.8) * (0.6 + 0.4 * Math.sin(now * 3 + p.tw));
      drawParticle(cam, p.x, p.y, p.z, p.sz, pack(p.c[0] * k, p.c[1] * k, p.c[2] * k), true);
    }
    M9E.ST.ap = AP.length;
  }
  function killEmbers(cam) {
    for (let i = KP.length - 1; i >= 0; i--) {
      const p = KP[i]; p.t += rdt; if (p.t > p.life) { KP.splice(i, 1); continue; }
      p.x += p.vx * rdt; p.y += p.vy * rdt; p.z += p.vz * rdt; p.vz += 0.4 * rdt; p.vx *= 0.97; p.vy *= 0.97;
      const k = 1 - p.t / p.life, w = (((now * 30) | 0) + i) & 3 ? 1 : 1.6;
      drawParticle(cam, p.x, p.y, p.z, p.sz * (0.6 + k * 0.6), pack(p.c[0] * k * w, p.c[1] * k * w, p.c[2] * k * w), true);
    }
  }
  function backlight(cam, A) {
    const dx = Math.cos(cam.ang), dy = Math.sin(cam.ang); const L = [];
    for (const e of G.enemies) {
      if (!e.alive || e.hidden || e.dead) continue; const rx = e.x - cam.x, ry = e.y - cam.y, dep = rx * dx + ry * dy; if (dep < 0.8 || dep > 9) continue;
      if (A < 2 && !e.elite && !e.d.boss && !e.champ) continue; L.push([dep, e]);
    }
    L.sort((a, b) => a[0] - b[0]); let n = 0;
    for (const [dep, e] of L) {
      if (n >= (A > 1 ? 7 : 3)) break; n++;
      const hh = (e.h || 1.2), col = e.champ ? [200, 160, 60] : e.elite && typeof ELITES !== 'undefined' && ELITES[e.elite[0]] ? hex(ELITES[e.elite[0]].c) : e.d.boss ? [200, 120, 255] : [110, 70, 230];
      const ux = (e.x - cam.x) / Math.max(0.01, Math.hypot(e.x - cam.x, e.y - cam.y)), uy = (e.y - cam.y) / Math.max(0.01, Math.hypot(e.x - cam.x, e.y - cam.y));
      const pul = 0.85 + 0.15 * Math.sin(now * 2.4 + e.x);
      drawWisp(cam, e.x + ux * 0.8, e.y + uy * 0.8, (e.z || 0) + hh * 0.55, Math.max(0.35, (e.r || 0.4) * 1.6) * (e.d.boss ? 1.4 : 1), hh * 0.62, col[0], col[1], col[2], (e.d.boss ? 0.42 : 0.34) * pul);
    }
    M9E.ST.halos = n;
  }
  // god rays: one faint slanted shaft in every 3rd big room (crypt stages), drifting dust inside
  let RAYS = null, raysFor = null;
  function rays() {
    if (raysFor === LEVEL) return RAYS; raysFor = LEVEL; RAYS = [];
    if (LEVEL.rooms && LEVEL.kind === 'crypt') for (const r of LEVEL.rooms) { if (r.kind !== 'path' || r.id % 3 !== 1) continue; const st = STY[SFX.stageKey] || STY.castle;
      RAYS.push({ x: (r.x0 + r.x1 + 1) / 2, y: (r.y0 + r.y1 + 1) / 2, w: 1.1, z0: 0, z1: 4.6, c: [st[0][0] * 0.9 + 40, st[0][1] * 0.9 + 30, st[0][2] * 0.9 + 60], i: 0.13, slant: (r.id & 1) ? 0.3 : -0.3, ph: r.id }); }
    return RAYS;
  }
  // wayfinding: gate beacon shaft + trail wisps along the walkable path when you've been lost a while
  const gateShaft = { x: 0, y: 0, w: 0.75, z0: 0, z1: 3.8, c: [70, 255, 140], i: 0.2, slant: 0, ph: 0.5 };
  let EXP = null, expFor = null, expN = 0, lastNew = 0, expT = 0, gateKnown = false, PATH = [], pathT = 0;
  function explore() {
    if (expFor !== LEVEL || !EXP || EXP.length !== MW * MH) { expFor = LEVEL; EXP = new Uint8Array(MW * MH); expN = 0; lastNew = now; gateKnown = false; PATH = []; }
    if (now - expT < 0.2 || G.state !== 'play') return; expT = now;
    const px = P.x | 0, py = P.y | 0, R = 7; let add = 0;
    for (let y = Math.max(0, py - R); y <= Math.min(MH - 1, py + R); y++) for (let x = Math.max(0, px - R); x <= Math.min(MW - 1, px + R); x++) {
      const i = y * MW + x; if (EXP[i]) continue; const d = Math.hypot(x + 0.5 - P.x, y + 0.5 - P.y); if (d > R) continue;
      let tx = x + 0.5, ty = y + 0.5; if (SOLID[i]) { const k = 0.62 / d; tx += (P.x - tx) * k; ty += (P.y - ty) * k; } if (d < 1.6 || losCells(P.x, P.y, tx, ty)) { EXP[i] = 1; if (!SOLID[i]) add++; }
    }
    if (add) { expN += add; lastNew = now; }
    const g = LEVEL.doors && LEVEL.doors.gate; if (g && !gateKnown && EXP[g.y * MW + g.x]) gateKnown = true;
  }
  function bfsPath() {
    if (now - pathT < 0.5) return PATH; pathT = now; PATH = [];
    const cp = LEVEL.checkpoints && LEVEL.checkpoints[1]; if (!cp) return PATH;
    const s = (P.y | 0) * MW + (P.x | 0), tg = (cp.y | 0) * MW + (cp.x | 0); if (s === tg) return PATH;
    const prev = new Int32Array(MW * MH).fill(-1); const q = [s]; prev[s] = s; let h = 0;
    while (h < q.length) { const c = q[h++]; if (c === tg) break; const cx = c % MW, cy = (c / MW) | 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + ox, ny = cy + oy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue; const n = ny * MW + nx; if (prev[n] >= 0 || SOLID[n] === 1 || FH[n] > FH[c] + 1.2) continue; prev[n] = c; q.push(n); } }
    if (prev[tg] < 0) return PATH; for (let c = tg; c !== s; c = prev[c]) PATH.push(c); PATH.reverse(); return PATH;
  }
  function wayfind(cam) {
    const N = nav(); if (!N || !LEVEL.doors || !LEVEL.doors.gate || LEVEL.kind === 'hub') return;
    const g = LEVEL.doors.gate, cp = LEVEL.checkpoints && LEVEL.checkpoints[1]; if (!cp || g.state === 'sealed') return;
    // beacon: a narrow column of light at the gate once you've seen it (or when close)
    if (gateKnown || Math.hypot(cp.x - P.x, cp.y - P.y) < 9) {
      gateShaft.x = (g.x + 0.5 + cp.x) / 2; gateShaft.y = (g.y + 0.5 + cp.y) / 2; const open = g.state === 'open';
      gateShaft.c = open ? [255, 210, 90] : [70, 255, 140]; gateShaft.i = 0.16 + 0.06 * Math.sin(now * 2.2); drawShaft(cam, gateShaft, now);
      for (let k = 0; k < 3; k++) { const ph = (now * 0.35 + k / 3) % 1; drawParticle(cam, gateShaft.x + 0.25 * Math.sin(now + k * 2), gateShaft.y + 0.25 * Math.cos(now * 1.3 + k), ph * 3.4, 0.02, open ? pack(200, 160, 60) : pack(50, 200, 110), true); }
    }
    // trail: a faint wisp drifts along the walkable route toward the gate. SUBTLE: only after 45 s with nothing new explored.
    const lost = now - lastNew > 45 && g.state === 'closed';
    if (!(N > 1 || lost) || G.state !== 'play') { M9E.ST.trail = 0; return; }
    const path = bfsPath(); M9E.ST.trail = path.length; if (path.length < 2) return;
    const n = Math.min(path.length, 12), head = (now * 2.6) % (n + 4);
    for (let j = 0; j < n; j++) {
      const c = path[j], x = (c % MW) + 0.5, y = ((c / MW) | 0) + 0.5, d = head - j; if (d < 0 || d > 4) continue;
      const k = (1 - d / 4) * (N > 1 ? 0.8 : 0.6), z = FH[c] + 0.35 + 0.08 * Math.sin(now * 3 + j);
      drawParticle(cam, x, y, z, 0.03, pack(60 * k, 200 * k, 120 * k), true);
      if (d < 1) drawWisp(cam, x, y, FH[c] + 0.15, 0.5, 0.14, 40, 160, 100, 0.35 * k);
    }
  }
  const _atm = renderAtmos;
  renderAtmos = function (cam) {
    _atm(cam);
    try {
      if (G.state === 'title' || !LEVEL || !LEVEL.props) return;
      explore();
      const A = atm();
      if (A) { if (A > 1) for (const s of rays()) drawShaft(cam, s, now); if (playing()) { backlight(cam, A); ambient(cam, A); } }
      if (KP.length) killEmbers(cam);
      wayfind(cam);
    } catch (e) { if (!M9E.err) { M9E.err = String(e); console.warn('m9e atmos', e); } }
  };

  // ============ 5. WEAPON FX II: element bursts, impact light, kill dissolve, crit flare, edge pulses ============
  const EL = { base: ['#b080ff', '#60ffb0', '#ffffff'], frost: ['#60d0ff', '#e0faff', '#8090ff'], storm: ['#b060ff', '#60c0ff', '#f0f0ff'], crimson: ['#ff3050', '#ff9070', '#ffe0e0'],
    skull: ['#70ff90', '#d0ffd0', '#b080ff'], axe: ['#ff5020', '#ffb060', '#fff0c0'], rapier: ['#ff4070', '#ffd0e0', '#ffffff'], fire: ['#ff7020', '#ffd060', '#fff0c0'], chain: ['#80c0ff', '#e0f0ff', '#b090ff'],
    blood: ['#ff5090', '#ffb0d0', '#c060ff'], pistol: ['#60e0ff', '#b070ff', '#ffffff'], bash: ['#ffd060', '#60ffb0', '#ffffff'], finisher: ['#ffe080', '#ffffff', '#ff9ae0'] };
  const SHAPE = { base: 'rune', frost: 'ice', storm: 'arc', crimson: 'drops', skull: 'ghost', axe: 'flame', rapier: 'drops', fire: 'flame', chain: 'arc', blood: 'drops', pistol: 'spiral', bash: 'ripple', finisher: 'rune' };
  const FX2 = []; let VG = { a: 0, c: '#b080ff' }, CF = null;
  const _de = damageEnemy;
  damageEnemy = function (e, dmg, o) {
    const hp0 = e.hp, al0 = e.alive; const r = _de(e, dmg, o);
    try {
      const L = wfx();
      if (L && al0 && o && !o.dot && e.hp < hp0) {
        const src = o.src || 'sword', kill = !e.alive, crit = !!o.heavy || src === 'finisher';
        const el = src === 'sword' ? swordKind() : src === 'whip' ? (whipKind() === 'base' ? 'storm' : whipKind()) : (EL[src] ? src : 'base');
        const pal = EL[el] || EL.base, rgb = hex(pal[0]).map(v => v / 255);
        addL(e.x, e.y, kill ? 3.2 : crit ? 2.8 : 2.2, rgb, kill ? 0.7 : crit ? 0.55 : 0.35, kill ? 0.32 : crit ? 0.26 : 0.18);
        if (FX2.length < 24) FX2.push({ x: e.x - Math.cos(P.ang) * (e.r || 0.4) * 0.6, y: e.y - Math.sin(P.ang) * (e.r || 0.4) * 0.6, z: (e.z || 0) + (e.h || 1.2) * (o.hz || 0.62), t: 0, dur: kill ? 0.6 : crit ? 0.48 : 0.34, kill, crit, boss: !!e.d.boss, el, shape: SHAPE[el] || 'rune', pal, rot: fr() * TAU, seed: fr() * 1000 });
        const fk = flashK();
        if (fk > 0 && (kill || crit || e.d.boss)) { const a = (kill ? 0.3 : crit ? 0.36 : 0.12) * fk * (L > 1 ? 1 : 0.6); if (a >= VG.a) VG = { a, c: pal[0] }; }
        if (fk > 0 && L > 1 && (crit || (kill && (o.heavy || src === 'pistol')))) CF = { t: 0, dur: 0.16, x: e.x, y: e.y, z: (e.z || 0) + (e.h || 1.2) * 0.6, pal };
        if (kill && !e.d.boss) { const n = ((L > 1 ? 16 : 7) * HDK()) | 0, hh = e.h || 1.2; for (let i = 0; i < n && KP.length < 90; i++) { const c = hex(pal[i % 3 === 2 ? 1 : 0]); KP.push({ x: e.x + fa(-0.25, 0.25), y: e.y + fa(-0.25, 0.25), z: (e.z || 0) + fa(0.1, hh), vx: fa(-0.3, 0.3), vy: fa(-0.3, 0.3), vz: fa(0.2, 0.8), t: 0, life: fa(0.5, 1.1), c, sz: fa(0.018, 0.03) }); } }
        M9E.ST.fx2++;
      }
    } catch (err) { }
    return r;
  };
  function burst(ctx, h, cx, cy, sk, k, L) {
    const P0 = h.pal[0], P1 = h.pal[1], P2 = h.pal[2], big = h.kill ? 1.4 : h.crit ? 1.2 : 1, full = L > 1; let s = h.seed;
    const R = () => (s = (s * 16807 + 11) % 2147483647) / 2147483647;
    ctx.lineWidth = 1;
    switch (h.shape) {
      case 'flame': for (let i = 0; i < (full ? 6 : 3); i++) { const ox = (R() - 0.5) * 22 * sk * big, ht = (8 + R() * 14) * sk * big * (1 - k * 0.6), y0 = cy - k * 14 * sk; ctx.globalAlpha = 0.85 * (1 - k); ctx.fillStyle = i & 1 ? P1 : P0; ctx.beginPath(); ctx.moveTo(cx + ox - 3 * sk, y0); ctx.quadraticCurveTo(cx + ox + 4 * sk * Math.sin(now * 20 + i), y0 - ht * 0.6, cx + ox, y0 - ht); ctx.quadraticCurveTo(cx + ox + 1, y0 - ht * 0.4, cx + ox + 3 * sk, y0); ctx.fill(); } break;
      case 'ice': for (let i = 0; i < (full ? 7 : 4); i++) { const an = h.rot + i * TAU / (full ? 7 : 4), l = (6 + 14 * Math.min(1, k * 4)) * sk * big; const x1 = cx + Math.cos(an) * l, y1 = cy + Math.sin(an) * l; ctx.globalAlpha = 0.9 * (1 - k); ctx.strokeStyle = i & 1 ? P1 : P0; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x1, y1); ctx.stroke(); ctx.fillStyle = P2; ctx.beginPath(); ctx.moveTo(x1, y1 - 2); ctx.lineTo(x1 + 2, y1); ctx.lineTo(x1, y1 + 2); ctx.lineTo(x1 - 2, y1); ctx.fill(); } break;
      case 'arc': if (k < 0.7) for (let b = 0; b < (full ? 3 : 2); b++) { const an = h.rot + b * 2.1 + now * 3, l = (14 + 10 * R()) * sk * big; let x = cx, y = cy; ctx.globalAlpha = 0.9 * (1 - k / 0.7); ctx.strokeStyle = b & 1 ? P1 : P2; ctx.lineWidth = h.crit ? 2 : 1; ctx.beginPath(); ctx.moveTo(x, y); for (let j = 1; j <= 4; j++) { x = cx + Math.cos(an) * l * j / 4 + (R() - 0.5) * 7 * sk; y = cy + Math.sin(an) * l * j / 4 + (R() - 0.5) * 7 * sk; ctx.lineTo(x, y); } ctx.stroke(); } break;
      case 'drops': for (let i = 0; i < (full ? 9 : 4); i++) { const an = h.rot + i * 0.7, sp = (30 + R() * 50) * sk, tt = h.t; const x = cx + Math.cos(an) * sp * tt, y = cy + (Math.sin(an) * sp * 0.5 - 20) * tt * sk + 160 * tt * tt * sk; ctx.globalAlpha = 1 - k; ctx.fillStyle = i % 3 ? P0 : P1; ctx.fillRect(Math.round(x), Math.round(y), 2, 2 + (i & 1)); }
        ctx.globalAlpha = 0.7 * (1 - k); ctx.strokeStyle = P0; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, (6 + 16 * k) * sk * big, h.rot, h.rot + 2.2); ctx.stroke(); break;
      case 'ghost': for (let i = 0; i < (full ? 4 : 2); i++) { const an = h.rot + i * TAU / 4 + k * 4, rr = (4 + 18 * k) * sk * big; ctx.globalAlpha = 0.8 * (1 - k); ctx.fillStyle = i & 1 ? P1 : P0; ctx.beginPath(); ctx.arc(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr - k * 8 * sk, (2.5 - k * 1.5) * sk * 2, 0, TAU); ctx.fill(); } break;
      case 'spiral': { ctx.globalAlpha = 0.85 * (1 - k); ctx.strokeStyle = P0; ctx.beginPath(); for (let j = 0; j <= 18; j++) { const an = h.rot + j * 0.55 + k * 6, rr = j * (0.6 + 1.2 * k) * sk * big; const x = cx + Math.cos(an) * rr, y = cy + Math.sin(an) * rr * 0.8; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); break; }
      case 'ripple': for (let i = 0; i < (full ? 3 : 2); i++) { const kk = Math.max(0, k - i * 0.15); if (kk <= 0) continue; const rr = (4 + 24 * kk) * sk * big; ctx.globalAlpha = 0.8 * (1 - kk); ctx.strokeStyle = i & 1 ? P1 : P0; ctx.strokeRect(Math.round(cx - rr), Math.round(cy - rr * 0.7), Math.round(rr * 2), Math.round(rr * 1.4)); } break;
      default: { const n = full ? 6 : 4, rr = (6 + 14 * Math.sqrt(k)) * sk * big; ctx.globalAlpha = 0.9 * (1 - k); for (let i = 0; i < n; i++) { const an = h.rot + now * 4 + i * TAU / n; ctx.fillStyle = i & 1 ? P1 : P0; ctx.fillRect(Math.round(cx + Math.cos(an) * rr) - 1, Math.round(cy + Math.sin(an) * rr * 0.85) - 1, 2, 2); } }
    }
    // impact light-flash streak on the nearest surface: a short horizontal glare line (reads as light hitting the wall)
    if (h.t < 0.08) { const a = (1 - h.t / 0.08) * flashK() * (h.kill || h.crit ? 0.7 : 0.4); ctx.globalAlpha = a; ctx.fillStyle = P2; const w = (18 + 18 * big) * sk; ctx.fillRect(Math.round(cx - w), Math.round(cy), Math.round(w * 2), 1); }
  }
  function drawFX2(ctx, cam) {
    const L = wfx(); if (!L) { FX2.length = 0; KP.length = 0; VG.a = 0; CF = null; return; }
    if (!FX2.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = FX2.length - 1; i >= 0; i--) {
      const h = FX2[i]; h.t += rdt; if (h.t > h.dur) { FX2.splice(i, 1); continue; }
      const pr = project(cam, h.x, h.y, h.z); if (!pr) continue; const cx = pr.x, cy = pr.y; if (cx < -60 || cx > W + 60 || cy < -60 || cy > H + 60) continue;
      const zx = Math.max(0, Math.min(W - 1, cx | 0)), zy = Math.max(0, Math.min(H - 1, cy | 0));
      if (ZB[RK === 1 ? zy * W + zx : (zy * RK) * EW + zx * RK] < pr.d - 0.8) continue;
      burst(ctx, h, cx, cy, Math.max(0.45, Math.min(1.15, pr.s / 200)), h.t / h.dur, L);
    }
    ctx.restore();
  }
  // crit flare ("impact frame", visual only) + coloured screen-edge pulse; drawn under the hands
  const VGC = {};
  function vigImg(col) {
    if (VGC[col]) return VGC[col]; const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); const [r, g, b] = hex(col);
    const gr = x.createRadialGradient(W / 2, H / 2, H * 0.36, W / 2, H / 2, W * 0.6); gr.addColorStop(0, `rgba(${r},${g},${b},0)`); gr.addColorStop(0.75, `rgba(${r},${g},${b},0.35)`); gr.addColorStop(1, `rgba(${r},${g},${b},0.9)`);
    x.fillStyle = gr; x.fillRect(0, 0, W, H); VGC[col] = c; return c;
  }
  function screenFX(ctx, cam) {
    if (!wfx() || G.state === 'title') return;
    if (CF) {
      CF.t += rdt; if (CF.t > CF.dur) CF = null; else {
        const pr = project(cam, CF.x, CF.y, CF.z), k = CF.t / CF.dur, fk = flashK(); const cx = pr ? pr.x : W / 2, cy = pr ? pr.y : H / 2;
        ctx.save(); if (CF.t < 0.05) { ctx.globalAlpha = 0.28 * fk; ctx.fillStyle = '#14001e'; ctx.fillRect(0, 0, W, H); }
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.75 * (1 - k) * fk; ctx.lineWidth = 1; let s = 7;
        for (let i = 0; i < 22; i++) { s = (s * 16807) % 2147483647; const an = (s / 2147483647) * TAU, r0 = 26 + 30 * k + (i % 4) * 9, r1 = r0 + 30 + (i % 3) * 22; ctx.strokeStyle = i & 1 ? CF.pal[0] : CF.pal[2]; ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0); ctx.lineTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1); ctx.stroke(); }
        ctx.restore();
      }
    }
    if (VG.a > 0.005) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(0.5, VG.a); ctx.drawImage(vigImg(VG.c), 0, 0); ctx.restore(); VG.a *= Math.pow(0.0025, rdt); }
  }
  const _sl = drawSlashes;
  drawSlashes = function (ctx, cam, rdt_) { const r = _sl(ctx, cam, rdt_); try { if (G.state !== 'title') drawFX2(ctx, cam); } catch (e) { } return r; };
  if (typeof drawBolts === 'function') { const _db = drawBolts; drawBolts = function (ctx, cam, rdt_) { const r = _db(ctx, cam, rdt_); try { screenFX(ctx, cam); } catch (e) { } return r; }; }

  // ============ 6. MINIMAP (explored cells only; secrets stay hidden; gate shown once seen) ============
  function minimap(ctx) {
    if (!mmap() || !EXP || G.state !== 'play' || !LEVEL || LEVEL.kind === 'hub') return;
    const g = LEVEL.doors && LEVEL.doors.gate; if (g && g.state === 'sealed') return;
    const CW = 24, CHh = 16, PX = 3, bw = CW * PX, bh = CHh * PX, X0 = W - bw - 6, Y0 = 18;
    const ox = Math.floor(P.x) - (CW >> 1), oy = Math.floor(P.y) - (CHh >> 1);
    ctx.save(); const A0 = ctx.globalAlpha; ctx.globalAlpha = 0.82 * A0; ctx.fillStyle = 'rgba(12,2,24,0.72)'; ctx.fillRect(X0 - 1, Y0 - 1, bw + 2, bh + 2);
    ctx.strokeStyle = '#5a3a8a'; ctx.lineWidth = 1; ctx.strokeRect(X0 - 1.5, Y0 - 1.5, bw + 3, bh + 3);
    for (let cy = 0; cy < CHh; cy++) for (let cx = 0; cx < CW; cx++) {
      const x = ox + cx, y = oy + cy; if (x < 0 || y < 0 || x >= MW || y >= MH) continue; const i = y * MW + x; if (!EXP[i]) continue;
      if (SOLID[i]) { let edge = false; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + b) * MW + x + a; if (x + a >= 0 && y + b >= 0 && x + a < MW && y + b < MH && EXP[j] && !SOLID[j]) edge = true; } if (!edge) continue; ctx.fillStyle = '#7a62b0'; }
      else { let fr_ = false; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + b) * MW + x + a; if (x + a >= 0 && y + b >= 0 && x + a < MW && y + b < MH && !EXP[j] && !SOLID[j]) fr_ = true; } ctx.fillStyle = fr_ ? '#2f7a56' : '#2a1a48'; }
      ctx.fillRect(X0 + cx * PX, Y0 + cy * PX, PX, PX);
    }
    // gate + checkpoint (only once seen)
    const pulse = 0.6 + 0.4 * Math.sin(G.t * 4);
    if (g && gateKnown) {
      const gx = X0 + (g.x - ox) * PX, gy = Y0 + (g.y - oy) * PX, inside = g.x >= ox && g.x < ox + CW && g.y >= oy && g.y < oy + CHh;
      ctx.fillStyle = g.state === 'open' ? '#ffd060' : '#60ffa0';
      if (inside) { ctx.globalAlpha = (0.6 + 0.4 * pulse) * A0; ctx.fillRect(gx - 1, gy - 1, PX + 2, PX + 2); }
      else { const a = Math.atan2(g.y + 0.5 - P.y, g.x + 0.5 - P.x), cxm = X0 + bw / 2, cym = Y0 + bh / 2; const t = Math.min((bw / 2 - 2) / Math.max(0.01, Math.abs(Math.cos(a))), (bh / 2 - 2) / Math.max(0.01, Math.abs(Math.sin(a))));
        const ex = cxm + Math.cos(a) * t, ey = cym + Math.sin(a) * t; ctx.globalAlpha = (0.5 + 0.5 * pulse) * A0; ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * 2, ey + Math.sin(a) * 2); ctx.lineTo(ex + Math.cos(a + 2.4) * 3, ey + Math.sin(a + 2.4) * 3); ctx.lineTo(ex + Math.cos(a - 2.4) * 3, ey + Math.sin(a - 2.4) * 3); ctx.fill(); }
    }
    ctx.globalAlpha = A0;
    const px = X0 + (P.x - ox) * PX, py = Y0 + (P.y - oy) * PX;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
    ctx.fillStyle = '#ffe080'; for (let j = 2; j <= 4; j++) ctx.fillRect(Math.round(px + Math.cos(P.ang) * j) - 0.5 | 0, Math.round(py + Math.sin(P.ang) * j) - 0.5 | 0, 1, 1);
    ctx.restore();
  }
  // drawn inside the run HUD pass: under toasts / big text; fades out while the hit-chain counter (same corner) is up
  let mmA = 1;
  if (typeof drawRunHUD === 'function') { const _rh = drawRunHUD; drawRunHUD = function (ctx) { const r = _rh(ctx); try { const busy = G.combo >= 3 && G.comboT > 0; mmA = Math.max(0, Math.min(1, mmA + (busy ? -rdt * 6 : rdt * 3))); if (mmA > 0.02) { ctx.save(); ctx.globalAlpha = mmA; minimap(ctx); ctx.restore(); } } catch (e) { } return r; }; }

  // ============ hooks into the frame ============
  const _rw = renderWorld;
  renderWorld = function (cam) { tick(); try { roomTint(); applyAll(); } catch (e) { restore(); if (!M9E.err) { M9E.err = String(e); console.warn('m9e light', e); } } return _rw(cam); };
  const _pf = postFX;
  postFX = function () { restore(); if (graded >= 0 && graded !== atm() && G.state !== 'title') M9E.regrade(); return _pf(); };
  M9E.dbg = () => ({ ...M9E.ST, atm: atm(), wfx: wfx(), nav: nav(), mmap: mmap(), expN, gateKnown, lostFor: +(now - lastNew).toFixed(1), path: PATH.length, DL: DL.length, FX2: FX2.length, KP: KP.length });
})();
