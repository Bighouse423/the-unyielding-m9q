// ===== m9m: idle shield forearm cleanup (on top of m9l's straightened idle fist, vm_ls3d frame 0).
// 1) m9l's re-baked fist put its wrist anchor ~5.9 px (screen) off the old one, so the vambrace strip the game draws from that
//    anchor slid sideways off the shield's enarme strap: one strap rivet ended up on the forearm, the other floated beside the
//    wrist with the strap's dark shadow showing. Fix at the source of that offset: the fist's grip point. The fist slides along
//    the shield's hand-grip (the shift is 1.1 px across the grip, 5.8 px along it) so its wrist lands exactly where the
//    vambrace + strap were designed to meet (m9k anchor). Fist pixels, its angle (straight wrist) and the grip stay as in m9l.
// 2) In this low idle view the vambrace's first enamel gem panel landed half under the wrist lame and half under the HUD,
//    cut off at a slant. For frame 0 only, the vambrace strip uses its own plain armour rows there (same cylinder shading,
//    spine ridge, edge rivets at the same 9-row pitch), so the forearm runs clean off-screen. The raised pose (frame 1),
//    where the gem sits fully on the forearm, is untouched. Outfits recolour the vambrace as before (built from the image given).
// Right hands, every weapon, block/bash, shield art: untouched. =====
(function () {
  window.M9M = { off: false, cut: 0.6 };
  let REC = null;
  const C0 = [64 + 4.874 / 0.836, 64 + 3.30 / 0.836];
  if (window.M9L && M9L.ALT && M9L.ALT[0]) M9L.ALT[0].c = [Math.round(C0[0] * 10) / 10, Math.round(C0[1] * 10) / 10];
  let LF = -1; const CACHE = new Map();
  const _f = h3dFrame;
  h3dFrame = function (name) { const r = _f.apply(this, arguments); if (name === 'vm_ls3d') LF = r[2]; return r; };
  function plain(src) {
    let c = CACHE.get(src); if (c) return c;
    c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d'); x.drawImage(src, 0, 0);
    x.clearRect(0, 20, src.width, 25);
    for (let r = 20; r < 45; r++) x.drawImage(src, 0, 5 + (r - 20) % 18, src.width, 1, 0, r, src.width, 1);   // plain rows 5-22 (rivet pitch 9 kept)
    c._src = 'vm_larm3d'; CACHE.set(src, c); return c;   // m9o: tag only (lets the weapon contact sheet map this derived vambrace back to its sprite)
  }
  const _a = drawArm3;
  drawArm3 = function (ctx, img, w, sx, sy) {
    if (M9M.off || img !== Engine.imgs.vm_larm3d || !img || !img.width || P.off !== 'shield' || LF !== 0) return _a.apply(this, arguments);
    REC = [w[0], w[1], w[2], sx, sy];
    const alt = plain(img), keep = Engine.imgs.vm_larm3d; Engine.imgs.vm_larm3d = alt;
    try { return _a.call(this, ctx, alt, w, sx, sy); } finally { Engine.imgs.vm_larm3d = keep; }
  };
  // 3) the fist frame's baked forearm stub ran on past the wrist and ended in a flat cut across the vambrace, burying the strap's
  //    middle so only its rivets showed. End the fist square to the vambrace just past the wrist (as m9i does for the axe), so the
  //    strap visibly crosses the forearm from rivet to rivet.
  const _d = drawH3D;
  drawH3D = function (ctx, name) {
    if (name !== 'vm_ls3d' || M9M.off || !REC || LF !== 0 || P.off !== 'shield') { if (name === 'vm_ls3d') REC = null; return _d.apply(this, arguments); }
    const [wx, wy, ww, sx, sy] = REC; REC = null; const th = Math.atan2(-(sx - wx), sy - wy), cut = ww * M9M.cut;
    ctx.save(); ctx.translate(Math.round(wx), Math.round(wy)); ctx.rotate(th); ctx.beginPath(); ctx.rect(-400, -400, 800, 400 + cut); ctx.rotate(-th); ctx.translate(-Math.round(wx), -Math.round(wy)); ctx.clip();
    try { return _d.apply(this, arguments); } finally { ctx.restore(); }
  };
})();
