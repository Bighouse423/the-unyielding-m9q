// M9b WEAPON FX: glowing, colour-shifting blades, crackling whip, glowing bolts, shield ripples and much wilder hit bursts.
// PURELY VISUAL. Rules kept:
//  - everything is an additive overlay layer; the locked hand/arm pixels are masked OUT of that layer every frame,
//    so the hands look exactly as before; weapon base pixels are only ever added on top of, never edited.
//  - never calls Math.random / rand (own PRNG) -> gameplay RNG sequence is untouched; no damage/timing/hitbox changes.
//  - Settings > WEAPON FX: FULL / LITE / OFF (OFF = exactly m9a). Also off with GLOW & COLOUR FX off or the GFX governor at 0,
//    flashes scale with the SCREEN FLASHES setting.
(function () {
  let sd = 987654321; const fr = () => (sd = (sd * 16807) % 2147483647) / 2147483647, fa = (a, b) => a + (b - a) * fr();
  const QW = (() => { const m = /[?&]wfx=([012])/.exec(location.search); return m ? +m[1] : null; })();   // test override
  if (/[?&]fxlock=1/.test(location.search) && typeof GFX !== 'undefined') setInterval(() => { GFX.q = 2; GFX.n = 0; }, 30);   // test only: keep full GFX on the slow box
  const lvl = () => { if (!FX.on || (typeof GFX !== 'undefined' && GFX.q < 1)) return 0; if (QW !== null) return QW; const S = window.OPT && OPT.S; const v = S && S.wfx !== undefined ? S.wfx : 2; return v; };
  const flashK = () => (window.OPT && OPT.flashK ? OPT.flashK() : 1);
  const TAU2 = Math.PI * 2;
  // ---------- palettes ----------
  const SPAL = { base: ['#a050ff', '#50ffb0', '#60d0ff', '#ff60e0'], frost: ['#60d0ff', '#e0faff', '#8090ff'], storm: ['#b060ff', '#60c0ff', '#f0f0ff'],
    rapier: ['#ff70b0', '#ffd0f0', '#c070ff'], crimson: ['#ff5080', '#ffb050', '#c050ff'], skull: ['#60ff90', '#d0ff60', '#40ffd0'], axe: ['#ff8040', '#ffd060', '#ff50c0'],
    ruby: ['#ff5090', '#ffc060', '#d050ff'], great: ['#ff7050', '#ffe080', '#b060ff'], void: ['#a040ff', '#40ffa0', '#6050ff', '#ff50ff'] };
  const WPAL = { base: ['#b080ff', '#50ffb0', '#f0e0ff'], fire: ['#ff7020', '#ffd060', '#fff0c0'], chain: ['#80c0ff', '#e0f0ff', '#b090ff'], blood: ['#ff5090', '#ffb0d0', '#c060ff'] };
  const palAt = (P_, t, sp) => { const n = P_.length, h = t * sp, i = Math.floor(h) % n; return [P_[i], P_[(i + 1) % n], h - Math.floor(h)]; };
  // ---------- glow canvases: dilated, dithered halo of a sprite's silhouette (padded so it can spill past the image) ----------
  const GC = {}, PAD = 10;
  function glowOf(name, col, wash) {
    const key = name + col + wash; if (GC[key]) return GC[key];
    const im = Engine.imgs[name]; if (!im || !im.width) return null;
    const w = im.width + PAD * 2, h = im.height + PAD * 2;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, PAD, PAD); const id = x.getImageData(0, 0, w, h), d = id.data;
    const D = new Uint8Array(w * h).fill(255);
    for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 100) D[i] = 0;
    for (let r = 1; r <= 8; r++) for (let y = 1; y < h - 1; y++) for (let xx = 1; xx < w - 1; xx++) { const i = y * w + xx; if (D[i] !== 255) continue; if (D[i - 1] === r - 1 || D[i + 1] === r - 1 || D[i - w] === r - 1 || D[i + w] === r - 1) D[i] = r; }
    const R = parseInt(col.slice(1, 3), 16), G_ = parseInt(col.slice(3, 5), 16), B = parseInt(col.slice(5, 7), 16);
    const A = [wash, 1, 0.85, 0.66, 0.5, 0.36, 0.25, 0.16, 0.09];
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { const i = y * w + xx, r = D[i]; let a = r <= 8 ? A[r] : 0; if (r >= 4 && ((xx + y) & 1)) a *= 0.45;   // pixel-art dither on the outer rings
      d[i * 4] = R; d[i * 4 + 1] = G_; d[i * 4 + 2] = B; d[i * 4 + 3] = Math.round(a * 255); }
    x.clearRect(0, 0, w, h); x.putImageData(id, 0, 0); GC[key] = c; return c;
  }
  // edge pixels of a sprite (for the running rune-light), in image coordinates
  const EDG = {};
  function edgesOf(name) {
    if (EDG[name]) return EDG[name]; const im = Engine.imgs[name]; if (!im || !im.width) return [];
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data, w = c.width, h = c.height, op = (xx, y) => xx >= 0 && y >= 0 && xx < w && y < h && d[(y * w + xx) * 4 + 3] > 100;
    const out = []; for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) if (op(xx, y) && (!op(xx - 1, y) || !op(xx + 1, y) || !op(xx, y - 1) || !op(xx, y + 1))) out.push([xx, y]);
    EDG[name] = out; return out;
  }
  // ---------- the overlay layer + the hand/arm mask ----------
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return { c, x: c.getContext('2d', { willReadFrequently: true }) }; };
  let LY = null, MK = null, MD = null, active = false, base = null, lastT = 0, fdt = 0;
  const VX = [];   // overlay particles: {x,y,vx,vy,t,life,c,sz,g,sig}
  const lay = (ctx) => { const x = LY.x; if (ctx && ctx.getTransform) x.setTransform(ctx.getTransform()); else x.setTransform(1, 0, 0, 1, 0, 0); return x; };
  const OFFS = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
  const _arm = drawArm3; drawArm3 = function (ctx, img, w, sx, sy) { _arm(ctx, img, w, sx, sy); if (active && ctx === base) { MK.x.setTransform(1, 0, 0, 1, 0, 0); _arm(MK.x, img, w, sx, sy); } };
  const _h3 = drawH3D; drawH3D = function (ctx, name, X, Y, R, S, alpha = 1, op) { _h3(ctx, name, X, Y, R, S, alpha, op); if (active && ctx === base) { MK.x.setTransform(1, 0, 0, 1, 0, 0); _h3(MK.x, name, X, Y, R, S, 1, null); } };
  const _dvm = drawViewModel;
  drawViewModel = function (ctx, cam) {
    const L = lvl(); if (!L) { VX.length = 0; return _dvm(ctx, cam); }
    if (!LY) { LY = mk(); MK = mk(); MD = mk(); }
    fdt = Math.max(0, Math.min(0.05, G.t - lastT)); lastT = G.t;
    LY.x.setTransform(1, 0, 0, 1, 0, 0); LY.x.globalCompositeOperation = 'source-over'; LY.x.globalAlpha = 1; LY.x.clearRect(0, 0, W, H);
    MK.x.setTransform(1, 0, 0, 1, 0, 0); MK.x.globalCompositeOperation = 'source-over'; MK.x.globalAlpha = 1; MK.x.clearRect(0, 0, W, H);
    MK.x.imageSmoothingEnabled = ctx.imageSmoothingEnabled !== false;   // the mask matches how the hands are rasterised (crisp in game)
    active = true; base = ctx;
    try { _dvm(ctx, cam); } finally { active = false; }
    // particles (screen space, drawn into the layer)
    const x = LY.x; x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'lighter';
    for (let i = VX.length - 1; i >= 0; i--) {
      const q = VX[i]; q.t += fdt; if (q.t > q.life) { VX.splice(i, 1); continue; }
      q.x += q.vx * fdt; q.y += q.vy * fdt; q.vy += (q.g || 0) * fdt; const k = 1 - q.t / q.life;
      x.globalAlpha = k * (q.a || 1);
      if (q.sig) { sigil(x, q.x, q.y, q.sz * (0.7 + 0.3 * k), q.c, q.t * 4, 1); continue; }
      x.fillStyle = (q.c2 && ((q.t * 30) | 0) & 1) ? q.c2 : q.c; const s = q.sz || 1; x.fillRect(Math.round(q.x), Math.round(q.y), s, s);
    }
    // cut the hands/arms out of the layer, then add it on top
    MD.x.setTransform(1, 0, 0, 1, 0, 0); MD.x.globalCompositeOperation = 'copy'; MD.x.drawImage(MK.c, 0, 0); MD.x.globalCompositeOperation = 'source-over'; for (let i = 1; i < OFFS.length; i++) MD.x.drawImage(MK.c, OFFS[i][0], OFFS[i][1]);   // 1px dilation of the hand mask
    x.globalAlpha = 1; x.globalCompositeOperation = 'destination-out'; x.drawImage(MD.c, 0, 0); x.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(LY.c, 0, 0); ctx.restore();
  };
  const vpush = (q) => { if (VX.length < (lvl() > 1 ? 220 : 90)) VX.push(q); };
  // tiny rune sigil: ring + rotating triangle + ticks (pixel-art lines)
  function sigil(x, cx, cy, r, col, rot, a) {
    x.save(); x.globalAlpha *= a; x.strokeStyle = col; x.lineWidth = 1;
    x.beginPath(); x.ellipse(Math.round(cx) + 0.5, Math.round(cy) + 0.5, r, r, 0, 0, TAU2); x.stroke();
    x.beginPath(); for (let k = 0; k < 4; k++) { const an = rot + k * TAU2 / 3; const px = cx + Math.cos(an) * r * 0.7, py = cy + Math.sin(an) * r * 0.7; k ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
    x.fillStyle = col; for (let k = 0; k < 4; k++) { const an = -rot * 1.5 + k * Math.PI / 2; x.fillRect(Math.round(cx + Math.cos(an) * (r + 2)), Math.round(cy + Math.sin(an) * (r + 2)), 1, 1); }
    x.restore();
  }
  // ---------- SWORD: colour-shifting aura, running edge light, ghost blades + aurora trail, embers & sigils ----------
  const _w = window.wpnFX;
  window.wpnFX = function (ctx, name, kind, X, Y, R, S, VFY_, t) {
    if (_w) _w(ctx, name, kind, X, Y, R, S, VFY_, t);
    const L = lvl(); if (!L || !active) return;
    const x = lay(ctx), PL = SPAL[kind] || SPAL.base, [ca, cb, f] = palAt(PL, t, 0.45);
    const sw = !!(P.sw || G.finisher), pulse = 0.5 + 0.5 * Math.sin(t * 2.6);
    const aA = sw ? 1 : 0.5 + 0.22 * pulse;
    const gA = glowOf(name, ca, 0.14), gB = glowOf(name, cb, 0.14);
    if (gA) drawRot(x, gA, SW_PIV[0] + PAD, SW_PIV[1] + PAD, X, Y, R, S, aA * (1 - f), 'lighter', VFY_);
    if (gB) drawRot(x, gB, SW_PIV[0] + PAD, SW_PIV[1] + PAD, X, Y, R, S, aA * f, 'lighter', VFY_);
    // running edge light: two bands climbing the blade
    const E = edgesOf(name), cs = Math.cos(R), sn = Math.sin(R);
    const b1 = (t * 0.55) % 1.3, b2 = (t * 0.9 + 0.6) % 1.3, hh = SW_PIV[1];
    x.save(); x.setTransform(ctx.getTransform()); x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < E.length; i++) {
      const q = E[i], v = (hh - q[1]) / hh; const d1 = Math.abs(v - b1), d2 = Math.abs(v - b2); const d = Math.min(d1, d2); if (d > 0.05 && !(sw && (i & 3) === 0)) continue;
      const u = (q[0] - SW_PIV[0]) * S, w = (q[1] - SW_PIV[1]) * S * VFY_;
      x.globalAlpha = d <= 0.05 ? 1 - d / 0.05 : 0.45; x.fillStyle = d1 < d2 ? '#ffffff' : cb;
      x.fillRect(Math.round(X + u * cs - w * sn), Math.round(Y + u * sn + w * cs), 1, 1);
    }
    x.restore();
    // swing: ghost blades + aurora ribbon beyond the tip + tip sparks
    if (P.sw && SWK[P.sw.step]) {
      const keys = SWK[P.sw.step], st = P.sw.t / SWING[P.sw.step].dur, cur = samplePose(keys, st), ox = X - cur[0], oy = Y - cur[1];
      if (L > 1) for (let g = 1; g <= 3; g++) { const pp = samplePose(keys, Math.max(0, st - g * 0.045)); const gi = glowOf(name, PL[(g + ((t * 0.45) | 0)) % PL.length], 0.4); if (gi) drawRot(x, gi, SW_PIV[0] + PAD, SW_PIV[1] + PAD, pp[0] + ox, pp[1] + oy, pp[2], pp[3] * VSC, 0.3 * (1 - g / 4), 'lighter', VFY_); }
      x.save(); x.setTransform(ctx.getTransform()); x.globalCompositeOperation = 'lighter';
      let prev = null; const N = 12;
      for (let i = 0; i <= N; i++) {
        const pp = samplePose(keys, Math.max(0, st - 0.16 + 0.16 * i / N)); pp[0] += ox; pp[1] += oy;
        const a = tipOf(pp, 1.12), b = tipOf(pp, 0.9);
        if (prev) { const k = Math.pow(i / N, 1.5); x.globalAlpha = 0.32 * k; x.fillStyle = PL[i % PL.length]; x.beginPath(); x.moveTo(prev[0][0], prev[0][1]); x.lineTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(prev[1][0], prev[1][1]); x.closePath(); x.fill(); }
        prev = [a, b];
      }
      x.restore();
      const tip = tipOf([X, Y, R, S / VSC], 1), mid = tipOf([X, Y, R, S / VSC], fa(0.4, 1));
      for (let k = 0; k < (L > 1 ? 3 : 1); k++) vpush({ x: k ? mid[0] : tip[0], y: k ? mid[1] : tip[1], vx: fa(-70, 70), vy: fa(-80, 30), g: 140, t: 0, life: fa(0.2, 0.45), c: PL[(fr() * PL.length) | 0], c2: '#ffffff', sz: fr() < 0.3 ? 2 : 1 });
    }
    { const ph = (t * 0.8) % 1, tp = tipOf([X, Y, R, S / VSC], 0.97); if (ph < 0.25) { const k = Math.sin(ph / 0.25 * Math.PI), r = Math.round(3 + 6 * k); x.save(); x.setTransform(ctx.getTransform()); x.globalCompositeOperation = 'lighter'; x.globalAlpha = k; x.fillStyle = '#ffffff'; x.fillRect(Math.round(tp[0]) - r, Math.round(tp[1]), r * 2 + 1, 1); x.fillRect(Math.round(tp[0]), Math.round(tp[1]) - r, 1, r * 2 + 1); x.fillStyle = cb; x.fillRect(Math.round(tp[0]) - 1, Math.round(tp[1]) - 1, 3, 3); x.restore(); } }
    // idle: embers + the odd rune sigil drifting off the blade
    if (fr() < fdt * (L > 1 ? 14 : 5)) { const p = tipOf([X, Y, R, S / VSC], fa(0.2, 1)); vpush({ x: p[0] + fa(-3, 3), y: p[1], vx: fa(-8, 8), vy: fa(-30, -12), g: -6, t: 0, life: fa(0.5, 1.1), c: fr() < 0.5 ? ca : cb, c2: fr() < 0.3 ? '#ffffff' : null, sz: 1 }); }
    if (L > 1 && fr() < fdt * 1.4) { const p = tipOf([X, Y, R, S / VSC], fa(0.35, 0.95)); vpush({ x: p[0] + fa(-6, 6), y: p[1], vx: fa(-5, 5), vy: fa(-18, -8), t: 0, life: 0.9, c: cb, sz: 3, sig: true, a: 0.8 }); }
  };
  // ---------- WHIP: glowing handle, energy cord, crackling lightning, a tip crack with a double shockwave ----------
  const wkind = () => (P.wpn && P.wpn.whip) || 'base';
  window.WFX = {
    whipHandle(ctx, img, hx, hy, hr, wsc, lash) {
      const L = lvl(); if (!L || !active) return; const t = G.t, PL = WPAL[wkind()] || WPAL.base, [ca, cb, f] = palAt(PL, t, 0.6);
      const x = lay(ctx), hot = lash !== null && lash > 0.08 && lash < 0.3 ? 1 : 0, a = 0.3 + 0.18 * Math.sin(t * 3.4) + hot * 0.5;
      const gA = glowOf(img, ca, 0.1), gB = glowOf(img, cb, 0.1);
      if (gA) drawRot(x, gA, 62 + PAD, 62 + PAD, hx, hy, hr, wsc, a * (1 - f), 'lighter'); if (gB) drawRot(x, gB, 62 + PAD, 62 + PAD, hx, hy, hr, wsc, a * f, 'lighter');
    },
    coil(ctx, pts, c, t) {
      const L = lvl(); if (!L || !active || pts.length < 4) return; const x = lay(ctx), PL = WPAL[wkind()] || WPAL.base, [ca, cb] = palAt(PL, t, 0.6);
      x.save(); x.globalCompositeOperation = 'lighter'; x.lineCap = 'round'; x.lineJoin = 'round';
      const line = (wd, col, al) => { x.globalAlpha = al; x.strokeStyle = col; x.lineWidth = wd; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (const p of pts) x.lineTo(p[0], p[1]); x.stroke(); };
      line(7, ca, 0.2 + 0.08 * Math.sin(t * 3)); line(3, cb, 0.25);
      // beads of light running round the coil
      for (let k = 0; k < 3; k++) { const i = Math.floor(((t * 0.7 + k / 3) % 1) * (pts.length - 1)), p = pts[i]; x.globalAlpha = 0.9; x.fillStyle = k ? cb : '#ffffff'; x.fillRect(Math.round(p[0]) - 1, Math.round(p[1]) - 1, 2, 2); }
      if (L > 1 && ((t * 1.7) % 1) < 0.08) { const i = 2 + ((t * 13) | 0) % (pts.length - 4); bolt(x, pts[i], [pts[i][0] + fa(-9, 9), pts[i][1] + fa(-9, 9)], 3, cb, 0.8); }
      x.restore();
    },
    lash(ctx, pts, wt) {
      const L = lvl(); if (!L || !active || pts.length < 4) return; const t = G.t, x = lay(ctx), PL = WPAL[wkind()] || WPAL.base, [ca, cb] = palAt(PL, t, 1.2), n = pts.length, tip = pts[n - 1];
      const energy = wt < 0.085 ? wt / 0.085 * 0.6 : wt < 0.3 ? 1 : Math.max(0, 1 - (wt - 0.3) / 0.16);
      x.save(); x.globalCompositeOperation = 'lighter'; x.lineCap = 'round'; x.lineJoin = 'round';
      const line = (wd, col, al) => { x.globalAlpha = al * energy; x.strokeStyle = col; x.lineWidth = wd; x.beginPath(); x.moveTo(pts[1][0], pts[1][1]); for (let i = 2; i < n; i++) x.lineTo(pts[i][0], pts[i][1]); x.stroke(); };
      line(9, ca, 0.14); line(5, cb, 0.22); line(2, '#ffffff', 0.45);
      // crackling lightning along the cord
      if (energy > 0.3) { const nb = L > 1 ? 3 : 1; for (let b = 0; b < nb; b++) { const i0 = 3 + ((fr() * (n - 10)) | 0), i1 = Math.min(n - 1, i0 + 4 + ((fr() * 6) | 0)); bolt(x, pts[i0], pts[i1], 5, b & 1 ? ca : cb, 0.9 * energy, L > 1); } }
      // travelling sparks off the cord
      if (energy > 0.5) for (let k = 0; k < (L > 1 ? 2 : 1); k++) { const p = pts[2 + ((fr() * (n - 3)) | 0)]; vpush({ x: p[0], y: p[1], vx: fa(-40, 40), vy: fa(-50, 20), g: 90, t: 0, life: fa(0.15, 0.35), c: fr() < 0.5 ? ca : cb, c2: '#ffffff', sz: 1 }); }
      // the crack: flash, double shockwave, radial streaks, shards + a sigil
      if (wt > 0.15 && wt < 0.27) {
        const k = 1 - Math.abs(wt - 0.18) / 0.09, fk = flashK(), age = wt - 0.15;
        if (fk > 0) { x.globalAlpha = 0.5 * k * fk; x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(tip[0], tip[1], 7 * k + 2, 6 * k + 2, 0, 0, TAU2); x.fill(); }
        for (let r = 0; r < 2; r++) { const rr = 5 + age * (r ? 330 : 520); x.globalAlpha = 0.7 * (1 - age / 0.12); x.strokeStyle = r ? ca : cb; x.lineWidth = r ? 1 : 2; x.beginPath(); x.ellipse(tip[0], tip[1], rr, rr * 0.72, 0, 0, TAU2); x.stroke(); }
        x.globalAlpha = 0.8 * k; x.strokeStyle = '#ffffff'; x.lineWidth = 1;
        for (let r = 0; r < 8; r++) { const an = r * Math.PI / 4 + 0.2, l0 = 4 + age * 120, l1 = l0 + 6 + 10 * k; x.beginPath(); x.moveTo(tip[0] + Math.cos(an) * l0, tip[1] + Math.sin(an) * l0 * 0.75); x.lineTo(tip[0] + Math.cos(an) * l1, tip[1] + Math.sin(an) * l1 * 0.75); x.stroke(); }
        if (!WFX._crack || WFX._crack !== P.whip) { WFX._crack = P.whip;
          for (let s = 0; s < (L > 1 ? 18 : 8); s++) { const an = fr() * TAU2, sp = fa(60, 190); vpush({ x: tip[0], y: tip[1], vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.8, g: 160, t: 0, life: fa(0.2, 0.5), c: PL[(fr() * PL.length) | 0], c2: '#ffffff', sz: fr() < 0.4 ? 2 : 1 }); }
          if (L > 1) vpush({ x: tip[0], y: tip[1], vx: 0, vy: -14, t: 0, life: 0.5, c: ca, sz: 7, sig: true, a: 0.9 });
        }
      }
      x.restore();
    },
    shield(ctx, sx, sy, rot, sc, ex) {
      const L = lvl(); if (!L || !active) return; const t = G.t, x = lay(ctx);
      const up = P.shieldUp ? P.raise || 1 : 0, col = up ? '#60ffb0' : '#c090ff', col2 = '#ffd060';
      const g = glowOf('vm_shield_in', col, 0), g2 = glowOf('vm_shield_in', col2, 0); const im = Engine.imgs.vm_shield_in; if (!g || !im) return;
      x.save(); x.translate(Math.round(sx), Math.round(sy)); x.rotate(rot); x.scale(sc * ex, sc); x.globalCompositeOperation = 'lighter';
      x.globalAlpha = 0.22 + 0.12 * Math.sin(t * 2.2) + 0.25 * up; x.drawImage(g, -PAD, -PAD);
      const cx = im.width / 2, cy = im.height / 2;
      if (P.bash) { const k = Math.min(1, P.bash.t / 0.38); x.globalAlpha = 0.6 * (1 - k); x.drawImage(g2, -PAD, -PAD);
        for (let r = 0; r < 3; r++) { const kk = k * 1.4 - r * 0.18; if (kk <= 0 || kk >= 1) continue; x.globalAlpha = 0.7 * (1 - kk); x.strokeStyle = r === 1 ? '#60ffb0' : col2; x.lineWidth = 2 / sc; x.beginPath(); x.ellipse(cx, cy, 30 + kk * 120, 36 + kk * 140, 0, 0, TAU2); x.stroke(); } }
      if (P.parryFlash > 0) { const k = P.parryFlash; x.globalAlpha = 0.8 * k * Math.max(0.3, flashK()); x.drawImage(g2, -PAD, -PAD); x.strokeStyle = '#fff0b0'; x.lineWidth = 1.5 / sc;
        for (let r = 0; r < 10; r++) { const an = r * TAU2 / 10 + t; x.beginPath(); x.moveTo(cx + Math.cos(an) * 70, cy + Math.sin(an) * 82); x.lineTo(cx + Math.cos(an) * (80 + 50 * k), cy + Math.sin(an) * (92 + 55 * k)); x.stroke(); } }
      x.restore();
    },
  };
  // jagged lightning between two screen points (+ optional branch)
  function bolt(x, a, b, jit, col, al, branch) {
    const n = 5, pts = [a]; const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    for (let i = 1; i < n; i++) { const o = fa(-jit, jit); pts.push([a[0] + dx * i / n + nx * o, a[1] + dy * i / n + ny * o]); } pts.push(b);
    const st = (wd, c, A) => { x.globalAlpha = A; x.strokeStyle = c; x.lineWidth = wd; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (const p of pts) x.lineTo(p[0], p[1]); x.stroke(); };
    st(3, col, 0.35 * al); st(1, '#ffffff', al);
    if (branch) { const p = pts[2], q = [p[0] + nx * fa(-12, 12) + fa(-5, 5), p[1] + ny * fa(-12, 12) + fa(-5, 5)]; x.globalAlpha = 0.6 * al; x.strokeStyle = col; x.lineWidth = 1; x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); x.stroke(); }
  }
  // ---------- CROSSBOW: glowing stock + bolt tip, a rune ring when it fires ----------
  let BT = null;
  const _xb = window.xbowFX;
  window.xbowFX = function (ctx, t, name, kick) {
    if (_xb) _xb(ctx, t, name, kick);
    const L = lvl(); if (!L || !active) return; const x = lay(ctx), [ca, cb, f] = palAt(['#b070ff', '#60e0ff', '#60ffb0'], t, 0.5);
    const gA = glowOf(name, ca, 0), gB = glowOf(name, cb, 0);
    x.save(); x.globalCompositeOperation = 'lighter';
    const a = 0.22 + 0.1 * Math.sin(t * 3) + kick * 0.6; if (gA) { x.globalAlpha = a * (1 - f); x.drawImage(gA, -PAD, -PAD); } if (gB) { x.globalAlpha = a * f; x.drawImage(gB, -PAD, -PAD); }
    if (!BT) { const e = edgesOf('vm_crossbow_bolt'); let m = null; for (const q of e) if (!m || q[1] < m[1]) m = q; BT = m || [116, 2]; }
    if (name === 'vm_crossbow') { const tw = 0.6 + 0.4 * Math.sin(t * 7); x.globalAlpha = 0.9 * tw; x.fillStyle = '#ffffff'; x.fillRect(BT[0] - 3, BT[1], 7, 1); x.fillRect(BT[0], BT[1] - 3, 1, 7); x.globalAlpha = 0.5 * tw; x.fillStyle = cb; x.fillRect(BT[0] - 1, BT[1] - 1, 3, 3); }
    if (kick > 0) { const k = 1 - kick; x.globalAlpha = 0.8 * kick; sigil(x, BT[0], BT[1] - 4, 6 + k * 18, cb, t * 6, 1); x.strokeStyle = ca; x.lineWidth = 2; x.beginPath(); x.ellipse(BT[0], BT[1] - 4, 10 + k * 40, 5 + k * 18, 0, 0, TAU2); x.stroke(); }
    x.restore();
  };
  // ---------- crossbow bolts in the world: glowing helix trail ----------
  const _db = drawBolts;
  drawBolts = function (ctx, cam, rdt) {
    const L = lvl(); const keep = L ? BOLTS.filter(b => b.straight).map(b => ({ b, t: b.t })) : null;
    _db(ctx, cam, rdt); if (!L || !keep || !keep.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const { b } of keep) {
      if (b.t > b.dur) continue; const pa = project(cam, ...b.a), pb = project(cam, ...b.b); if (!pa || !pb) continue;
      const k = 1 - b.t / b.dur, dx = pb.x - pa.x, dy = pb.y - pa.y, Ln = Math.hypot(dx, dy) || 1, nx = -dy / Ln, ny = dx / Ln, N = Math.min(80, Math.ceil(Ln / 3));
      ctx.globalAlpha = 0.18 * k; ctx.strokeStyle = '#80a0ff'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      for (let j = 0; j <= N; j++) { const f = j / N, ph = f * 18 + G.t * 50; for (const s of [1, -1]) { const o = Math.sin(ph) * s * (2 + 3 * f) * k; ctx.globalAlpha = k * (0.5 + 0.5 * f); ctx.fillStyle = s > 0 ? (j % 3 ? '#60e0ff' : '#ffffff') : (j % 3 ? '#b070ff' : '#60ffb0'); ctx.fillRect(Math.round(pa.x + dx * f + nx * o), Math.round(pa.y + dy * f + ny * o), 1, 1); } }
      ctx.globalAlpha = 0.8 * k; sigil(ctx, pb.x, pb.y, 4 + (1 - k) * 10, '#60e0ff', G.t * 8, 1);
    }
    ctx.restore();
  };
  // ---------- HIT FX: wild impact bursts in the world ----------
  const HITS = [];
  const SRCPAL = { sword: null, finisher: ['#ffe080', '#ffffff', '#ff9ae0'], whip: null, pistol: ['#60e0ff', '#b070ff', '#ffffff'], bash: ['#ffd060', '#60ffb0', '#ffffff'] };
  const _de = damageEnemy;
  damageEnemy = function (e, dmg, o) {
    const hp0 = e.hp, al0 = e.alive; const r = _de(e, dmg, o);
    try {
      if (lvl() && al0 && o && !o.dot && e.hp < hp0 && HITS.length < 40) {
        const src = o.src || 'sword', kill = !e.alive, crit = !!o.heavy || src === 'finisher';
        let pal = SRCPAL[src];
        if (!pal) pal = src === 'whip' ? (WPAL[wkind()] || WPAL.base) : (SPAL[(P.wpn && P.wpn.sword) || 'base'] || SPAL.base);
        if (e.elite && typeof ELITES !== 'undefined' && ELITES[e.elite[0]]) pal = [ELITES[e.elite[0]].c, pal[0], '#ffffff'];
        if (e.d.boss) pal = ['#ffd060', pal[0], '#ffffff'];
        const px = e.x - Math.cos(P.ang) * e.r * 0.6, py = e.y - Math.sin(P.ang) * e.r * 0.6, pz = e.z + e.h * (o.hz || 0.62);
        const h = { x: px, y: py, z: pz, t: 0, dur: kill ? 0.7 : crit ? 0.5 : 0.36, kill, crit, boss: !!e.d.boss, elite: !!e.elite, src, pal, rot: fr() * TAU2, sh: [] };
        const ns = (lvlNow() > 1 ? 1 : 0.5) * (kill ? 18 : crit ? 12 : 7);
        for (let i = 0; i < ns; i++) { const an = fr() * TAU2, sp = fa(40, kill ? 150 : 110); h.sh.push([Math.cos(an) * sp, Math.sin(an) * sp - 30, fr() < 0.35 ? 2 : 1, pal[(fr() * pal.length) | 0], fa(0.6, 1)]); }
        HITS.push(h);
      }
    } catch (err) { }
    return r;
  };
  const lvlNow = lvl;
  function drawHits(ctx, cam, rdt) {
    if (!HITS.length) return; const L = lvl(); if (!L) { HITS.length = 0; return; }
    const fk = flashK();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = HITS.length - 1; i >= 0; i--) {
      const h = HITS[i]; h.t += rdt; if (h.t > h.dur) { HITS.splice(i, 1); continue; }
      const pr = project(cam, h.x, h.y, h.z); if (!pr) continue;
      const cx = pr.x, cy = pr.y; if (cx < -60 || cx > W + 60 || cy < -60 || cy > H + 60) continue;
      const zx = Math.max(0, Math.min(W - 1, cx | 0)), zy = Math.max(0, Math.min(H - 1, cy | 0));
      if (ZB[RK === 1 ? zy * W + zx : (zy * RK) * EW + zx * RK] < pr.d - 0.8) continue;   // behind a wall
      const sk = Math.max(0.45, Math.min(1.15, pr.s / 200)), k = h.t / h.dur, P0 = h.pal[0], P1 = h.pal[1], P2 = h.pal[2] || '#ffffff';
      const big = h.kill ? 1.5 : h.crit ? 1.25 : 1;
      // core star (brief; scaled by the flashes setting)
      if (h.t < 0.09 && fk > 0) { const a = (1 - h.t / 0.09) * fk, r = (5 + 5 * big) * sk; ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(cx - r), Math.round(cy), Math.round(r * 2), 1); ctx.fillRect(Math.round(cx), Math.round(cy - r), 1, Math.round(r * 2)); ctx.fillStyle = P1; ctx.fillRect(Math.round(cx - 1), Math.round(cy - 1), 3, 3); }
      // burst rays
      const nr = h.crit || h.kill ? 10 : 7, e1 = Math.min(1, k * 3.2);
      ctx.lineWidth = h.crit || h.kill ? 2 : 1;
      if (h.t < 0.07 && fk > 0) { ctx.globalAlpha = 0.4 * fk * (1 - h.t / 0.07); ctx.fillStyle = P0; const r = 9 * sk * big; ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath(); ctx.fill(); }
      for (let r = 0; r < nr; r++) { const an = h.rot + r * TAU2 / nr + (r & 1) * 0.15, l0 = (3 + 16 * e1) * sk * big, l1 = l0 + (5 + 10 * (1 - k)) * sk * big; ctx.globalAlpha = 0.85 * (1 - k); ctx.strokeStyle = r & 1 ? P0 : P2;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * l0, cy + Math.sin(an) * l0); ctx.lineTo(cx + Math.cos(an) * l1, cy + Math.sin(an) * l1); ctx.stroke(); }
      // shockwave ring(s): crits get a chromatic split ring
      const rr = (4 + 26 * Math.sqrt(k)) * sk * big; ctx.globalAlpha = 0.7 * (1 - k); ctx.strokeStyle = P0; ctx.lineWidth = h.crit || h.kill ? 2 : 1; ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 0.8, 0, 0, TAU2); ctx.stroke(); ctx.lineWidth = 1;
      if (h.crit || h.boss) { ctx.strokeStyle = '#ff60e0'; ctx.beginPath(); ctx.ellipse(cx - 1.5, cy, rr * 1.15, rr * 0.92, 0, 0, TAU2); ctx.stroke(); ctx.strokeStyle = '#60e0ff'; ctx.beginPath(); ctx.ellipse(cx + 1.5, cy, rr * 1.15, rr * 0.92, 0, 0, TAU2); ctx.stroke(); }
      if (h.src === 'whip' && L > 1 && h.t < 0.2) for (let b = 0; b < 2; b++) { const an = fr() * TAU2, l = fa(8, 18) * sk; bolt(ctx, [cx, cy], [cx + Math.cos(an) * l, cy + Math.sin(an) * l], 3, P0, 0.8 * (1 - k)); }
      // pixel shards with gravity
      for (const s of h.sh) { const tt = h.t * s[4]; const x = cx + s[0] * tt * sk, y = cy + (s[1] * tt + 220 * tt * tt) * sk; ctx.globalAlpha = 1 - k; ctx.fillStyle = (((h.t * 40) | 0) & 1) ? '#ffffff' : s[3]; ctx.fillRect(Math.round(x), Math.round(y), s[2], s[2]); }
      // rune sigil: kills / crits (bosses + elites always), pops in and spins out
      if (L > 1 && (h.kill || h.crit || h.elite)) { const pop = Math.min(1, k * 4), r = (6 + (h.kill ? 12 : 7) * pop) * sk * (h.boss ? 1.3 : 1); ctx.globalAlpha = 0.9 * (1 - k); sigil(ctx, cx, cy - (h.kill ? 6 : 0) * sk, r, h.kill ? P1 : P0, h.rot + h.t * 5, 1);
        if (h.kill) { ctx.globalAlpha = 0.5 * (1 - k); ctx.strokeStyle = P2; ctx.beginPath(); ctx.ellipse(cx, cy, rr * 1.6, rr * 1.3, 0, 0, TAU2); ctx.stroke(); } }
    }
    ctx.restore();
  }
  const _sl = drawSlashes;
  drawSlashes = function (ctx, cam, rdt) { const r = _sl(ctx, cam, rdt); if (G.state !== 'title') drawHits(ctx, cam, rdt); return r; };
  window.WFXDBG = { HITS, VX, lvl };
})();
