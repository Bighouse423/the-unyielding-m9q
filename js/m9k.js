// ===== m9k: Battle Axe only - swing fists re-baked to read like real first-person weapon swings (Hexen FAXE, Heretic staff,
// UE FPP axe refs: fist seen from the side, finger knuckles stacked toward the camera, thumb over the haft, forearm from the
// lower right and foreshortened). The 4 wind-up / transition frames of the gauntlet (2, 4, 5, 6) come from vm_rh3d_axe, baked
// with the same 3D gauntlet model + m6 repaint as all other frames (tools/m9k/build_axe_sheet.py); their grip axis/forearm
// anchor come from AXF. Frames 0, 1, 3 (incl. the approved idle), 7, 8, every other weapon and both left hands are untouched.
// Grip centre (c), frame choice (nearest k), swing timing, poses and FX are unchanged; outfits recolour the sheet. =====
(function () {
  const AXF = {"2": {"c": [64.0, 64.0], "ang": -1.072, "arm": [115.5, 100.4], "aw": 19.0}, "4": {"c": [64.0, 64.0], "ang": 0.027, "arm": [117.8, 99.2], "aw": 16.7}, "5": {"c": [64.0, 64.0], "ang": 0.53, "arm": [117.2, 110.8], "aw": 16.7}, "6": {"c": [64.0, 64.0], "ang": 0.644, "arm": [105.2, 116.3], "aw": 15.5}};
  window.M9K = { off: false, AXF };
  const on = () => !M9K.off && P.wpn && P.wpn.sword === 'axe' && Engine.imgs.vm_rh3d_axe && Engine.imgs.vm_rh3d_axe.width;
  const _f = h3dFrame;
  h3dFrame = function (name, R) {
    const r = _f.apply(this, arguments);
    if (name !== 'vm_rh3d' || !on()) return r;
    const a = AXF[r[2]]; if (!a) return r;
    return [r[0], Object.assign({}, r[1], a), r[2]];
  };
  const _d = drawH3D;
  drawH3D = function (ctx, name, X, Y, R) {
    if (name !== 'vm_rh3d' || !on() || !AXF[_f('vm_rh3d', R)[2]]) return _d.apply(this, arguments);
    const orig = Engine.imgs.vm_rh3d, alt = (window.M9 && M9.outfitImg && M9.outfit) ? (M9.outfitImg(M9.outfit, 'vm_rh3d_axe') || Engine.imgs.vm_rh3d_axe) : Engine.imgs.vm_rh3d_axe;
    Engine.imgs.vm_rh3d = alt;
    try { return _d.apply(this, arguments); } finally { Engine.imgs.vm_rh3d = orig; }
  };
})();
