// ===== m9n: "make the regular stages even harder (same health vials), missed upgrades stay missed, altar costs more,
// a cooler starter gun". =====
// 1) HARDER REGULAR STAGES (never the boss fight, never the Abyss): per stage n, regular foes hit harder, have more HP,
//    re-engage faster, move a little faster, and some come with a pack-mate. Pack-mates are added AFTER level generation with
//    their own seeded PRNG (level layout / vial placement untouched) and never drop vials (vial count/placement/heal identical).
//    Anything once the boss gate seals, any boss and anything a boss summons: untouched.
// 2) No more catch-up: the m9c "YOUR SPOILS AWAIT / FOLLOW YOU" gate code is off (see js/m9c.js section 4) - only upgrades you
//    actually pick up or buy reach the boss.
// 3) Altar prices x3 (rounded to 5): a whole-altar buyout went from 2770 to 8310 shards (~2-3 typical runs -> ~10+).
// 4) Consecrated Sidearm: new gothic viewmodel art (vm_pistol_m9n; the fist pixels are the old sprite's, byte for byte) plus a
//    soul-green / violet muzzle flare overlay. Stats unchanged.
(function () {
  const N = window.M9N = {
    off: false, gunOff: false, priceK: 3, TOP: 36, added: 0, stat: {},
    dmgX: n => 1.20 + 0.04 * (n - 1),                 // s1 x1.20  s4 x1.32  s7 x1.44  s10 x1.56 (on top of the old curve)
    hpX: n => 1.10 + 0.03 * (n - 1),                  // s1 x1.10  s4 x1.19  s7 x1.28  s10 x1.37
    spdX: n => Math.min(1.15, 1.06 + 0.01 * (n - 1)),
    cdX: n => Math.max(0.65, 0.80 - 0.015 * (n - 1)), // time between attacks after a recover
    packP: n => Math.min(0.5, 0.18 + 0.035 * (n - 1)),// chance a regular foe brings a pack-mate
  };
  const sealed = () => { const g = typeof LEVEL !== 'undefined' && LEVEL && LEVEL.doors && LEVEL.doors.gate; return !!(g && g.state === 'sealed'); };
  const bossOn = () => sealed() || !!(G.boss && G.boss.alive && G.boss.awake && !G.boss.hidden);
  const active = () => !N.off && RUN.on && !RUN.hub && RUN.cfg && !RUN.cfg.abyss && !(typeof abyssDepth === 'function' && abyssDepth());
  const inArena = e => { const A = LEVEL.arena; return !!(A && e.x > A.x0 - 1 && e.x < A.x1 + 1 && e.y > A.y0 - 1 && e.y < A.y1 + 1); };

  // ---------- 1a) damage ----------
  const _dmg = rogueEnemyDmg;
  rogueEnemyDmg = function (dmg, opt) {
    const v = _dmg(dmg, opt);
    if (!active() || opt.env || bossOn() || (opt.src && (opt.src.d.boss || opt.src.summoned))) return v;
    return Math.max(1, Math.round(v * N.dmgX(RUN.cfg.n)));
  };
  // ---------- 1b) HP / speed / pack-mates (stage build) ----------
  let seed = 1; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const _post = rogueStagePost;
  rogueStagePost = function () {
    _post();
    N.added = 0;
    if (!active()) return;
    const c = RUN.cfg, n = c.n; seed = ((RUN.seed | 0) * 7919 + n * 104729 + 17) >>> 0;
    const base = G.enemies.filter(e => e.alive && !e.d.boss && !e.summoned && !inArena(e));
    for (const e of base) { e.hp = e.maxhp = Math.round(e.maxhp * N.hpX(n)); e.d.speed *= N.spdX(n); }
    const add = [];
    for (const e of base) {
      if (e.hidden || e.ambush || e.eliteRoom || e.champ || e.d.fly && e.type !== 'bat') continue;
      if (rnd() >= N.packP(n)) continue;
      let spot = null;
      for (let i = 0; i < 10 && !spot; i++) {
        const a = rnd() * Math.PI * 2, r = 1.1 + rnd() * 0.8, x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
        const ci = cellAt(x, y);
        if (ci < 0 || isSolid(ci) || blocked(x, y, floorAt(e.x, e.y), 0.4, 0.33, !!e.d.fly) || Math.abs(floorAt(x, y) - floorAt(e.x, e.y)) > 0.3) continue;
        if (Math.hypot(x - LEVEL.start.x, y - LEVEL.start.y) < 6 || inArena({ x, y })) continue;
        spot = [x, y];
      }
      if (!spot) continue;
      const m = makeEnemy(e.type, spot[0], spot[1]);
      m.hp = m.maxhp = Math.round(m.maxhp * c.hp * N.hpX(n)); m.d.speed *= c.spd * N.spdX(n); m.m9nPack = true;
      if (n >= 2 && rnd() < c.elite * 0.5) { const pool = Object.keys(ELITES); const k = pool[(rnd() * pool.length) | 0]; makeElite(m, [k]); }
      add.push(m);
    }
    for (const m of add) G.enemies.push(m);
    N.added = add.length; G.totalEnemies = G.enemies.length;
  };
  // pack-mates never drop vials (vial count stays exactly the level's + the original foes' drops)
  const _kill = killEnemy;
  killEnemy = function (e, o) {
    if (!e || !e.m9nPack) return _kill.apply(this, arguments);
    const n0 = G.pickups.length; const r = _kill.apply(this, arguments);
    for (let i = G.pickups.length - 1; i >= n0; i--) if (G.pickups[i].type === 'vial' && G.pickups[i].drop) G.pickups.splice(i, 1);
    return r;
  };
  // ---------- 1c) aggression ----------
  const _ue = updateEnemy;
  updateEnemy = function (e, dt) {
    const prev = e.state; _ue(e, dt);
    if (!active() || e.d.boss || e.summoned || bossOn()) return;
    if (prev === 'recover' && e.state === 'chase') e.cd *= N.cdX(RUN.cfg.n);
  };

  // ---------- 3) altar prices ----------
  N.oldPrices = {};
  const r5 = v => Math.max(5, Math.round(v / 5) * 5);
  if (typeof ALTAR !== 'undefined' && ALTAR.items) for (const it of ALTAR.items) {
    if (it.cost) { N.oldPrices[it.id] = it.cost; it.cost = r5(it.cost * N.priceK); }
    if (it.costs) { N.oldPrices[it.id] = it.costs.slice(); it.costs = it.costs.map(v => r5(v * N.priceK)); }
  }

  // ---------- 4) Consecrated Sidearm art + flare overlay ----------
  const gun = () => !N.gunOff && Engine.imgs.vm_pistol_m9n && Engine.imgs.vm_pistol_m9n.width;
  const _dr = drawRot; let LAST = null, rot0 = 0, FIST = null, FSRC = null;
  const fistOf = img => { if (FSRC !== img) { FSRC = img; FIST = document.createElement('canvas'); FIST.width = img.width; FIST.height = img.height; const x = FIST.getContext('2d'); x.drawImage(img, 0, 0); x.clearRect(0, 0, img.width, 68); FIST._src = 'vm_pistol'; } return FIST; };
  drawRot = function (ctx, img, px, py, x, y, rot, sc) {
    if (img === Engine.imgs.muzzle && LAST && gun() && P.pistol && !P.pistol.xb) {   // the game's own muzzle flash: moved up to the new (longer) barrel's crown
      const a = Array.prototype.slice.call(arguments), d = (N.TOP - 8.6) * LAST.sc; LAST = null;
      a[4] = x + Math.sin(rot0) * d; a[5] = y - Math.cos(rot0) * d; return _dr.apply(this, a);
    }
    if (img !== Engine.imgs.vm_pistol || !img || !gun() || !P.pistol) return _dr.apply(this, arguments);
    LAST = { sc }; rot0 = rot;
    const a = Array.prototype.slice.call(arguments); a[1] = Engine.imgs.vm_pistol_m9n; a[3] = py + N.TOP; _dr.apply(this, a);   // taller canvas: pivot moved down so the fist stays put
    a[1] = fistOf(img); a[3] = py; _dr.apply(this, a);   // then the OLD sprite's own fist, same call as before -> fist pixels exactly as they were
    // overlay: soul-fire flare at the muzzle crown's bore (sprite px 52.5,8.6)
    const t = P.pistol.t; if (t > 0.12) return;
    const ox = (52.5 - px) * sc, oy = (8.6 - py - N.TOP) * sc, mx = Math.round(x) + ox * Math.cos(rot) - oy * Math.sin(rot), my = Math.round(y) + ox * Math.sin(rot) + oy * Math.cos(rot);
    const k = 1 - t / 0.12, R = 8 + 10 * k;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, R);
    g.addColorStop(0, 'rgba(235,255,240,' + (0.95 * k) + ')'); g.addColorStop(0.35, 'rgba(80,240,160,' + (0.75 * k) + ')'); g.addColorStop(0.7, 'rgba(150,70,230,' + (0.45 * k) + ')'); g.addColorStop(1, 'rgba(90,30,160,0)');
    ctx.fillStyle = g; ctx.fillRect(mx - R, my - R, R * 2, R * 2);
    // holy cross glint + a few violet sparks (pixel-sized)
    const L = Math.round(4 + 7 * k); ctx.fillStyle = 'rgba(255,240,170,' + k + ')';
    ctx.fillRect(Math.round(mx) - L, Math.round(my), L * 2 + 1, 1); ctx.fillRect(Math.round(mx), Math.round(my) - L - 3, 1, L * 2 + 4);
    ctx.fillStyle = 'rgba(200,150,255,' + k + ')';
    for (let i = 0; i < 6; i++) { const aa = i * 1.047 + t * 30, rr = R * (0.6 + 0.5 * ((i * 37) % 10) / 10) * (1.2 - k * 0.4); ctx.fillRect(Math.round(mx + Math.cos(aa) * rr), Math.round(my + Math.sin(aa) * rr * 0.7), 1, 1); }
    ctx.restore();
  };
})();
