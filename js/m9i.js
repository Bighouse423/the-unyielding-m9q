// ===== m9i: Battle Axe only - a short articulated wrist lame over the fist/vambrace join, so the gauntlet and forearm
// read as one continuous armoured arm (the baked fist frame ends in a straight cut where the vambrace strip begins).
// Built at runtime from the vambrace art itself (same palette + light direction; outfits recolour it automatically).
// Drawn on top of the right fist only while the axe is equipped; fist frames, pivot, timing and FX are untouched. =====
(function () {
  window.M9I = { off: false, cut: 0.1, wk: 1.15, wkF: { 5: 1.3, 6: 1.3 }, up: 1, shield: true, sdist: 1.8, swk: 1.35 };
  const LAST = {}; const CACHE = new Map();
  const _a3 = drawArm3;
  drawArm3 = function (ctx, img, w, sx, sy) { if (img === Engine.imgs.vm_rarm3d) LAST.r = [w[0], w[1], w[2], sx, sy]; return _a3.apply(this, arguments); };
  // shield hand: the baked fist's cuff runs off in its own direction and its lower edge crosses the vambrace in a hard straight cut.
  // Seat a curved lame on the vambrace right where it leaves that cuff, drawn BEFORE strap + fist, so the fist's cuff overlaps the lame
  // and the lame overlaps the vambrace (stacked articulated plates). Fist, fingers and shield pixels are not touched.
  const _a3b = drawArm3;
  drawArm3 = function (ctx, img, w, sx, sy) {
    const r = _a3b.apply(this, arguments);
    if (!M9I.off && M9I.shield && img === Engine.imgs.vm_larm3d && P.off === 'shield' && img && img.width) {
      const th = Math.atan2(-(sx - w[0]), sy - w[1]), L = lame(img), k = 2 * w[2] / (img.width - 4) * M9I.swk;
      ctx.save(); ctx.translate(Math.round(w[0]), Math.round(w[1])); ctx.rotate(th); ctx.translate(0, w[2] * M9I.sdist); ctx.scale(k, k); ctx.drawImage(L, -L.width / 2, -L.height / 2); ctx.restore();
    }
    return r; };
  function lame(src) {
    let c = CACHE.get(src); if (c) return c;
    const W = src.width, H = 16, ARC = 3; c = document.createElement('canvas'); c.width = W; c.height = H + ARC; const x = c.getContext('2d');
    const t = document.createElement('canvas'); t.width = W; t.height = H; const y = t.getContext('2d');
    y.drawImage(src, 0, 10, W, 9, 0, 1, W, 9);                         // plate rows 1-9: the vambrace's own cylinder shading + side trim
    y.drawImage(src, 0, 0, W, 3, 0, 10, W, 3);                         // gold edge band rows 10-12 (same trim as the cuffs)
    y.globalCompositeOperation = 'source-atop';
    y.fillStyle = 'rgba(255,255,255,0.25)'; y.fillRect(0, 1, W, 2);    // lit upper rim (light from above, like the fist)
    y.fillStyle = 'rgba(10,0,20,0.22)'; y.fillRect(0, 8, W, 2);         // turning away under the band
    y.globalCompositeOperation = 'source-over';
    y.fillStyle = 'rgb(22,6,34)'; y.fillRect(1, 0, W - 2, 1); y.fillRect(1, 13, W - 2, 1);   // outlines
    y.fillStyle = 'rgba(10,0,20,0.35)'; y.fillRect(2, 14, W - 4, 2);    // soft drop shadow onto the vambrace below
    // curve it: centre columns ride up toward the hand -> reads as a round plate wrapping the wrist
    for (let i = 0; i < W; i++) { const u = (i - (W - 1) / 2) / ((W - 1) / 2), dy = Math.round(ARC * (1 - u * u)); x.drawImage(t, i, 0, 1, H, i, ARC - dy, 1, H); }
    c._src = 'vm_rarm3d'; CACHE.set(src, c); return c;
  }
  const _d = drawH3D;
  // axe only: end the baked fist frame on a line square to the vambrace, just past the forearm anchor (the frame's own cuff
  // otherwise runs on below in its own direction and ends in a flat cut across the strip), then seat a curved wrist lame over
  // that joint so fist cuff and vambrace read as one overlapping armour run.
  // m9i+: the shield (left) fist gets the same join -- its vambrace runs along the shield back (vm_larm3d); fist/fingers/shield untouched.
  function join(ctx, args, rec, img, cutK, wk, up) {
    const [wx, wy, ww, sx, sy] = rec, th = Math.atan2(-(sx - wx), sy - wy), cut = ww * cutK;
    ctx.save(); ctx.translate(Math.round(wx), Math.round(wy)); ctx.rotate(th); ctx.beginPath(); ctx.rect(-400, -400, 800, 400 + cut); ctx.rotate(-th); ctx.translate(-Math.round(wx), -Math.round(wy)); ctx.clip();
    const r = _d.apply(null, args); ctx.restore();
    if (args.length <= 6 && img && img.width) {
      const L = lame(img), k = 2 * ww / (img.width - 4) * wk;
      ctx.save(); ctx.translate(Math.round(wx), Math.round(wy)); ctx.rotate(th); ctx.translate(0, cut); ctx.scale(k, k); ctx.drawImage(L, -L.width / 2, -L.height / 2 - up); ctx.restore();
    }
    return r;
  }
  drawH3D = function (ctx, name) {
    if (M9I.off) return _d.apply(this, arguments);
    if (name === 'vm_rh3d' && P.wpn && P.wpn.sword === 'axe' && LAST.r) {
      const fi = h3dFrame('vm_rh3d', arguments[4])[2];   // the swing2/heavy fist's cuff is boxier -> a wider lame
      return join(ctx, arguments, LAST.r, Engine.imgs.vm_rarm3d, M9I.cut, M9I.wkF[fi] || M9I.wk, M9I.up);
    }
    return _d.apply(this, arguments); };
})();
