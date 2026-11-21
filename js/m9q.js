// ===== m9q: the sidearm pops up on the LEFT, swinging in from the lower middle, angled at the crosshair (a handheld gun, not an
// upright tube). Same two-hands rule as m9p (whip / shield put away while the shot is out, the left fist holds the gun) and the
// crossbow's timeline (pop in by 0.07 s, settle, drop away 0.62-0.8 s). Crossbow untouched; m9o nerf unchanged; m9n gun art
// (gun + the old sprite's own fist, drawn rotated as one piece - no pixel edits).
(function () {
  if (!window.M9P) return;
  const Q = window.M9Q = { off: false, sx: 128, sy: 250, srot: 0.66, fromX: 210, fromY: 320, fromRot: 0.5 };
  const on = () => !Q.off && P.pistol && !P.pistol.xb && !(P.wpn && P.wpn.ranged === 'crossbow');
  const ease = k => 1 - Math.pow(1 - k, 3);
  let POSE = null;
  const _dr = drawRot;
  drawRot = function (ctx, img, px, py, x, y, rot, sc) {
    if (!on() || !img) return _dr.apply(this, arguments);
    if (img === Engine.imgs.vm_pistol) {
      // game passes x = 70+bx+50, y = 150+by+28k+100 -> recover the sway (bx, by) and the kick k
      const pt = P.pistol.t, dur = P.pistol.dur || 0.8, s = dur / 0.8;
      const k = Math.max(0, 1 - pt / 0.16), bx = x - 120, by = y - 250 - 28 * k;
      const e = ease(Math.min(1, pt / (0.07 * s))), lower = ease(clamp((pt - 0.62 * s) / (0.18 * s), 0, 1));
      const kick = Math.max(0, 1 - pt / 0.14);
      const X = Math.round(lerp(Q.fromX, Q.sx, e) + bx + lower * 40), Y = Math.round(lerp(Q.fromY, Q.sy, e) + by + lower * 150 + kick * 8);
      const R = lerp(Q.fromRot, Q.srot, e) - 0.10 * kick - 0.25 * lower;
      POSE = { X, Y, R, sc };
      M9P.off = true; try { return _dr.call(this, ctx, img, px, py, X, Y, R, sc); } finally { M9P.off = false; }
    }
    if (img === Engine.imgs.muzzle && POSE) {   // the game's muzzle flash, re-aimed: hand m9n the old barrel top in this pose
      const p = POSE; POSE = null; const ox = 2 * p.sc, oy = -98 * p.sc;
      const a = Array.prototype.slice.call(arguments); a[4] = p.X + ox * Math.cos(p.R) - oy * Math.sin(p.R); a[5] = p.Y + ox * Math.sin(p.R) + oy * Math.cos(p.R);
      M9P.off = true; try { return _dr.apply(this, a); } finally { M9P.off = false; }
    }
    return _dr.apply(this, arguments);
  };
})();
