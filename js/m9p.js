// ===== m9p: two hands, not three. When the Consecrated Sidearm fires, the left hand puts the whip / shield away and holds the
// gun - exactly what the crossbow does (the left-hand item is not drawn while the shot is out, the weapon rises from below the
// screen in 0.06 s and drops away from 0.62 s to 0.8 s, then the whip / shield is back). The right hand keeps the blade.
// The gun is held in the left fist again: m9n's gothic sidearm art + the old sprite's own fist (pixels untouched), on the
// crossbow's raise / kick / settle / lower timeline. m9o's nerf (22 dmg, 0.8 s, 8 mana, range 22) is unchanged.
(function () {
  if (!window.M9O) return;
  M9O.center = false;                       // m9o's hand-free bottom-centre gun is off; the game's own left-hand pistol branch draws it
  const Q = window.M9P = { off: false };
  const on = () => !Q.off && P.pistol && !P.pistol.xb && !(P.wpn && P.wpn.ranged === 'crossbow');
  let OFF = null;                           // this frame's raise/lower offset (screen px), shared by the gun and its muzzle flash
  const _dr = drawRot;
  drawRot = function (ctx, img, px, py, x, y) {
    if (!on() || !img) return _dr.apply(this, arguments);
    if (img === Engine.imgs.vm_pistol) {
      const pt = P.pistol.t, dur = P.pistol.dur || 0.8, sc = dur / 0.8;   // the crossbow's phases (drawCrossbow), scaled to the shot
      const raise = Math.min(1, pt / (0.06 * sc)), lower = clamp((pt - 0.62 * sc) / (0.18 * sc), 0, 1);
      OFF = Math.round((1 - raise) * 70 + lower * 150);
      const a = Array.prototype.slice.call(arguments); a[5] = y + OFF; return _dr.apply(this, a);
    }
    if (img === Engine.imgs.muzzle && OFF !== null) { const a = Array.prototype.slice.call(arguments); a[5] = y + OFF; OFF = null; return _dr.apply(this, a); }
    return _dr.apply(this, arguments);
  };
  if (typeof UPG !== 'undefined') { const u = UPG.find(q => q.id === 'sidearm'); if (u) u.desc = 'A holy pistol for the off hand. R / Square fires (8 mana a shot): 22 dmg, one foe, hurts ghosts. The crossbow outclasses it.'; }
})();
