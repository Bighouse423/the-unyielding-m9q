// ===== m9o: the Consecrated Sidearm is the starter step up to the crossbow, and fires the way the crossbow does. =====
// 1) Nerf (pistol only; crossbow untouched): 45 -> 22 dmg per shot, 0.42 s -> 0.8 s per shot (the crossbow's cycle), range 25 -> 22
//    tiles, single target, no stagger, 8 mana (unchanged). Single-target: 27.5 dmg/s vs the crossbow's 50 (55%),
//    0.36 mana per damage vs the crossbow's 0.15. Relic interactions as before (punish x2, quiver, repeater second shot, silver).
// 2) Fires like the crossbow: it rises from the bottom centre (no hand), kicks, settles and lowers on the crossbow's timeline,
//    and the left-hand whip / shield and the right-hand blade stay drawn the whole time (before, the pistol replaced the
//    left-hand item while it was out). Art: m9n's gothic sidearm (vm_pistol_m9n, gun only); muzzle flash = overlay.
(function () {
  const O = window.M9O = { off: false, center: true, dmg: 22, dur: 0.8, range: 22, mana: 8 };   // center: m9o's hand-free bottom-centre draw (m9p turns it off)
  const xb = () => P.wpn && P.wpn.ranged === 'crossbow';
  const _fp = firePistol;
  firePistol = function () {
    if (O.off || xb()) return _fp.apply(this, arguments);
    const cost = O.mana - 2 * ((P.mods && P.mods.quiver) || 0);
    if (!P.hasPistol || P.pistol || P.mana < cost || P.latch) return;
    P.mana -= cost; P.pistol = { t: 0, dur: O.dur, m9o: 1 }; SFX.play('pistol'); G.shake += 3; P.kick += 6;
    const a = aimVec(); const wall = rayMarch(O.range);
    const hits = enemiesOnRay(wall.d, 0.15);
    if (hits.length) {
      damageEnemy(hits[0].e, O.dmg * (P.punish > 0 ? 2 : 1) * ((P.mods && P.mods.ranged) || 1), { dx: a.x, dy: a.y, dz: 0.2, kb: 2, heavy: true, src: 'pistol', col: '#a0ffc8' });
      if (P.punish > 0) P.punish = 0;
    } else if (!hitCracked(wall.x, wall.y)) sparks(wall.px || wall.x, wall.py || wall.y, wall.z, 12, RGB(170, 255, 200));
    for (let i = 0; i < 6; i++) addP({ k: 'smoke', x: P.x + a.x * 0.6, y: P.y + a.y * 0.6, z: eyeZ() - 0.15, vx: rand(-0.3, 0.3) + a.x * 0.6, vy: rand(-0.3, 0.3) + a.y * 0.6, vz: rand(0.1, 0.5), size: 0.1, col: RGB(200, 230, 215), life: 0.7 });
    if (P.mods && P.mods.repeater && !P.repeating) P.repeatQ = 0.14;   // m4's repeater, as before (m4 wrapped the old function)
  };
  // ---- view model: draw everything as if the pistol were holstered, then the pistol on top, braced at the bottom centre
  const on = () => !O.off && O.center && P.pistol && !P.pistol.xb && !xb() && P.hasPistol && Engine.imgs.vm_pistol_m9n && Engine.imgs.vm_pistol_m9n.width;
  const _dvm = drawViewModel;
  drawViewModel = function (ctx, cam) {
    if (!on()) return _dvm.apply(this, arguments);
    const pp = P.pistol; P.pistol = null;
    try { _dvm.apply(this, arguments); } finally { P.pistol = pp; }
    drawSidearm(ctx, pp);
  };
  function drawSidearm(ctx, pp) {
    const t = G.t, pt = pp.t, dur = pp.dur || O.dur, sc = dur / 0.8;   // same phases as drawCrossbow, scaled to this shot's length
    let bx = Math.sin(P.bob) * 7 * P.bobAmt + Math.sin(t * 1.3) * 1.5 + P.sway;
    let by = Math.abs(Math.cos(P.bob)) * 6 * P.bobAmt + Math.sin(t * 1.6) * 1.6 + clamp(-P.vz * 2.2, -8, 12) + P.landDip * 140 - 8;
    if (P.hurtT > 0) { bx += Math.sin(t * 60) * 3; by += 4; }
    const raise = Math.min(1, pt / (0.06 * sc)), lower = clamp((pt - 0.62 * sc) / (0.18 * sc), 0, 1), kick = Math.max(0, 1 - pt / 0.14);
    const img = Engine.imgs.vm_pistol_m9n;
    const ax = Math.round(W / 2 + 8 + bx * 0.7), ay = Math.round(H - 28 + by * 0.6 + (1 - raise) * 70 + lower * 150 - kick * 10 + Math.sin(pt * 40) * kick * 2);
    const rot = -0.06 * kick + 0.03 * Math.sin(clamp((pt - 0.2) / 0.3, 0, 1) * Math.PI) + 0.02;
    drawRot(ctx, img, 52.5, 104, ax, ay, rot, 1);              // pivot = bottom of the breech
    // muzzle (bore at sprite 52.5, 8.6)
    const d = 104 - 8.6, mx = ax + Math.sin(rot) * d, my = ay - Math.cos(rot) * d;
    if (pt < 0.07) drawRot(ctx, Engine.imgs.muzzle, 20, 20, mx, my - 2, 0, 1.3 + Math.random() * 0.4, 1, 'lighter');
    if (pt < 0.12) {
      const k = 1 - pt / 0.12, R = 7 + 9 * k;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, R);
      g.addColorStop(0, 'rgba(235,255,240,' + (0.95 * k) + ')'); g.addColorStop(0.35, 'rgba(80,240,160,' + (0.75 * k) + ')'); g.addColorStop(0.7, 'rgba(150,70,230,' + (0.45 * k) + ')'); g.addColorStop(1, 'rgba(90,30,160,0)');
      ctx.fillStyle = g; ctx.fillRect(mx - R, my - R, R * 2, R * 2);
      const L = Math.round(4 + 6 * k); ctx.fillStyle = 'rgba(255,240,170,' + k + ')';
      ctx.fillRect(Math.round(mx) - L, Math.round(my), L * 2 + 1, 1); ctx.fillRect(Math.round(mx), Math.round(my) - L - 3, 1, L * 2 + 4);
      ctx.fillStyle = 'rgba(200,150,255,' + k + ')';
      for (let i = 0; i < 6; i++) { const aa = i * 1.047 + pt * 30, rr = R * (0.6 + 0.5 * ((i * 37) % 10) / 10) * (1.2 - k * 0.4); ctx.fillRect(Math.round(mx + Math.cos(aa) * rr), Math.round(my + Math.sin(aa) * rr * 0.7), 1, 1); }
      ctx.restore();
    }
    // soul vents breathe while it settles (overlay)
    if (pt > 0.1 && pt < 0.6 * sc) { const k = Math.sin((pt - 0.1) / (0.5 * sc) * Math.PI); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * k; ctx.fillStyle = '#50f0a0';
      for (const vy of [21, 41, 62]) { const yy = vy + 4; ctx.fillRect(Math.round(ax + Math.sin(rot) * (104 - yy)) - 1, Math.round(ay - Math.cos(rot) * (104 - yy)) - 4, 3, 9); } ctx.restore(); }
  }
  // the relic card / tooltip
  if (typeof UPG !== 'undefined') { const u = UPG.find(q => q.id === 'sidearm'); if (u) u.desc = 'A holy pistol. R / Square fires (8 mana a shot): 22 dmg, one foe, hurts ghosts. The crossbow outclasses it.'; }
})();
