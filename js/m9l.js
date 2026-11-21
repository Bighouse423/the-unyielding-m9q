// ===== m9l: idle shield hand - the wrist no longer reads bent backward. The idle fist (vm_ls3d frame 0) is re-baked with the
// same v2.6 enarme shield_frame() 3D gauntlet + m6 repaint (tools/m9l/build_shield_sheet.py); only its forearm direction and a
// natural wrist deviation changed, so the fist's own cuff now runs straight along the vambrace strip the game draws (was a 20 deg
// kink). Same grip on the shield's hand-grip (no extra rotation), same strap, same m9i wrist lame. Raised/block frame, both right
// hands and every weapon untouched; outfits recolour the new frame (M9.outfitImg). =====
(function () {
  const ALT = {"0": {"c": [64.0, 64.0], "ang": -0.786, "arm": [36.8, 107.2], "aw": 13.6}};
  window.M9L = { off: false, ALT };
  const on = () => !M9L.off && Engine.imgs.vm_ls3d_idle && Engine.imgs.vm_ls3d_idle.width;
  const _f = h3dFrame;
  h3dFrame = function (name, R) {
    const r = _f.apply(this, arguments);
    if (name !== 'vm_ls3d' || !on()) return r;
    const a = ALT[r[2]]; if (!a) return r;
    return [r[0], Object.assign({}, r[1], a), r[2]];
  };
  const _d = drawH3D;
  drawH3D = function (ctx, name, X, Y, R) {
    if (name !== 'vm_ls3d' || !on() || !ALT[_f('vm_ls3d', R)[2]]) return _d.apply(this, arguments);
    const orig = Engine.imgs.vm_ls3d, alt = (window.M9 && M9.outfitImg && M9.outfit) ? (M9.outfitImg(M9.outfit, 'vm_ls3d_idle') || Engine.imgs.vm_ls3d_idle) : Engine.imgs.vm_ls3d_idle;
    Engine.imgs.vm_ls3d = alt;
    try { return _d.apply(this, arguments); } finally { Engine.imgs.vm_ls3d = orig; }
  };
})();
