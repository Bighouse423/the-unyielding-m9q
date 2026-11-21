// M9c - "a smidge harder, more distinct enemies, all your caps before the boss".
// Normal (non-boss) areas only: nothing here touches a boss, a boss's HP/damage/patterns, or anything once the boss gate seals.
// 1) pressure: a little denser rooms, a few more elites later on, foes re-engage a bit faster, ~1/4 fewer free room vials.
// 2) identity: every common foe gets one telegraphed signature move (readable: windup pose + coloured floor/air tell + sound).
// 3) one named CHAMPION per stage (stage 2+): a unique, gold-plated elite with its own name and a shard purse.
// 4) [m9n: OFF - see section 4] caps before bosses: when you reach the boss gate, every upgrade still lying in the open (relics, caches, chalices, shards,
//    elite spoils) is carried to the gate so you pick it up BEFORE the fight, and anything still left when the gate seals is
//    granted on the spot (before the boss intro); you are told about unfound secrets / an uncleared
//    elite room while you can still turn back (the gate only seals once you step through).
(function () {
  if (typeof updateEnemy !== 'function' || typeof stageCfg !== 'function') return;
  const ST = { sig: {}, offered: 0, leftAtSeal: null, champs: 0, vialsCut: 0 };
  window.M9C = { ST, on: true, caps: false };
  const sealed = () => { const g = LEVEL && LEVEL.doors && LEVEL.doors.gate; return !!(g && g.state === 'sealed'); };
  const active = () => RUN.on && !RUN.hub && M9C.on;
  const count = k => { ST.sig[k] = (ST.sig[k] || 0) + 1; };

  // ---------- 1) pressure ----------
  const _sc = stageCfg;
  stageCfg = function (n) {
    const c = _sc(n);
    if (n >= 2 && !c.abyss) { c.dens = Math.min(1, c.dens + 0.05); c.promote = Math.min(0.75, c.promote + 0.03); if (n >= 6) c.elite = Math.min(0.5, c.elite + 0.03); }
    return c;
  };
  if (window.GAME && GAME.rogue) GAME.rogue.stageCfg = stageCfg;
  if (RUN && RUN.cfg) RUN.cfg = stageCfg(RUN.stage || 1);

  const UPG = { reliq: 1, cache: 1, chalice: 1, shard: 1, shards: 1, spoils: 1, blade: 1, pistol: 1, m9lore: 1 };
  const inBox = (p, b) => p.x >= b[0] && p.x <= b[2] && p.y >= b[1] && p.y <= b[3];
  const inSecret = p => (LEVEL.secrets || []).some(s => !s.found && inBox(p, s.box));
  const NAMES = {
    nave: ['SEXTON GRAEL', 'BELL-WARDEN'], crypt: ['GRAVE-WARDEN', 'SEXTON VASH'], ossuary: ['MARROW KING', 'BONE-MONK HESK'],
    courtyard: ['HEDGE-HOUND', 'GREY MAULKIN'], belfry: ['THE RINGER', 'BRASS-JAW'], arena: ['VARRUS', 'RED LANISTA'],
    necropolis: ['HOLLOW PRIOR', 'SISTER CINDER'], kennels: ['KENNEL-MASTER', 'ASHMAW'], cathedral: ['SCOURGED SAINT', 'FATHER LASH'],
    throne: ["LICH'S HERALD", 'SIR ASHEN'], abyss: ['NAMELESS THING', 'DEEP WARDEN'],
  };
  const _post = rogueStagePost;
  rogueStagePost = function () {
    _post();
    if (!active()) return;
    const c = RUN.cfg; ST.leftAtSeal = null; ST.offered = 0; LEVEL.m9cGate = null;
    // ~1 in 4 free room vials gone (never inside secrets/vaults or the boss arena, never on stage 1)
    if (c.n >= 2 && LEVEL.pickups) { let k = 0; LEVEL.pickups = LEVEL.pickups.filter(p => { const A = LEVEL.arena; if (p.type !== 'vial' || inSecret(p) || (A && p.x > A.x0 - 1 && p.x < A.x1 + 1 && p.y > A.y0 - 1 && p.y < A.y1 + 1)) return true; return (k++ % 4) !== 1 ? true : (ST.vialsCut++, false); }); }
    // the stage champion
    if (c.n >= 2) {
      const L = G.enemies.filter(e => e.alive && !e.d.boss && !e.eliteRoom && !e.elite && !e.hidden && e.d.hp >= 40 && Math.hypot(e.x - LEVEL.start.x, e.y - LEVEL.start.y) > 12);
      if (L.length) {
        L.sort((a, b) => Math.hypot(b.x - LEVEL.start.x, b.y - LEVEL.start.y) - Math.hypot(a.x - LEVEL.start.x, a.y - LEVEL.start.y));
        const e = L[Math.min(L.length - 1, (L.length * 0.3) | 0)];
        const pool = Object.keys(ELITES).sort(() => Math.random() - 0.5);
        makeElite(e, pool.slice(0, 2)); e.champ = true;
        const nm = NAMES[c.theme] || NAMES.crypt; e.plateName = nm[(RUN.seed + c.n) & 1] || nm[0]; e.plateCol = '#ffe080'; ST.champs++;
      }
    }
  };

  // ---------- 2) signature moves ----------
  const SIG = {
    azombie: 'slam', gladiator: 'charge', royalguard: 'charge', ghost: 'blink', voidshade: 'blink', imp: 'volley', acolyte: 'summon',
    fzombie: 'double', werewolf: 'double', hellhound: 'double', spiderling: 'double', skeleton: 'sidestep', gargoyle: 'stoneskin', penitent: 'frenzy',
    bat: 'pack', zombie: 'rot',
  };
  const COL = { slam: [255, 214, 120], charge: [255, 190, 80], blink: [140, 240, 255], volley: [255, 150, 40], summon: [120, 255, 150], stoneskin: [200, 200, 220] };
  const grounded = () => P.z - groundUnder(P.x, P.y, 0.1) < 0.3;
  const ring = (x, y, z, r, c, n, vz) => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU; addP({ k: 'spark', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, z, vx: 0, vy: 0, vz: vz || 0.6, size: 0.05, col: RGB(c[0], c[1], c[2]), life: 0.22 }); } };
  const free = (x, y) => { const c = cellAt(x, y); return c >= 0 && !SOLID[c] && FH[c] > -0.5 && FH[c] < 0.5 && !blocked(x, y, FH[c], 0.4, 0.33); };
  let summons = 0;
  function startAct(e, kind, dur, extra) { e.m9.act = Object.assign({ kind, t: 0, dur }, extra || {}); e.state = 'windup'; e.st = 0; count(kind); }
  function tryStart(e, dist, los) {
    const k = SIG[e.type]; const m = e.m9; if (!k || m.sc > 0 || !los) return;
    const champ = e.champ ? 0.55 : 1;
    if (k === 'slam' && dist < 3.0) { startAct(e, 'slam', 1.0); SFX.play('groan', 0.6); m.sc = rand(7, 9) * champ; }
    else if (k === 'charge' && dist > 3.4 && dist < 8.5) { startAct(e, 'charge', 0.75, { a: Math.atan2(P.y - e.y, P.x - e.x) }); SFX.play('windup', 0.7); m.sc = rand(7, 9) * champ; }
    else if (k === 'blink' && dist > 2.6 && dist < 9) {
      const side = e.d.ranged ? (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2 : Math.PI + rand(-0.6, 0.6); const r = e.d.ranged ? 4.2 : 2.0;
      for (let i = 0; i < 10; i++) { const a = P.ang + (i < 5 ? side + rand(-0.4, 0.4) : (i & 1 ? 1 : -1) * rand(1.2, 1.9)); const x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r; if (free(x, y) && losTo(P.x, P.y, x, y)) { startAct(e, 'blink', 0.7, { x, y }); SFX.play('ghost', 0.7); m.sc = rand(6, 9) * champ; return; } }
      m.sc = 1.5;
    }
    else if (k === 'volley' && dist < e.d.range && dist > 2.5) { startAct(e, 'volley', 0.65); SFX.play('giggle', 0.8); m.sc = rand(8, 10) * champ; }
    else if (k === 'summon' && dist < 9 && summons < 4 && !m.did) {
      for (let i = 0; i < 6; i++) { const a = rand(0, TAU), x = e.x + Math.cos(a) * 1.4, y = e.y + Math.sin(a) * 1.4; if (free(x, y)) { m.did = true; summons++; startAct(e, 'summon', 1.15, { x, y }); SFX.play('ghost', 0.5); m.sc = 99; return; } }
      m.sc = 2;
    }
  }
  function runAct(e, dt, dist) {
    const a = e.m9.act; a.t += dt; const d = e.d; const c = COL[a.kind] || [255, 255, 255]; const fz = floorAt(e.x, e.y);
    if (a.kind === 'charge' && a.t >= a.dur) { // the rush itself
      const sp = 7.5, ox = e.x, oy = e.y; moveEntity(e, Math.cos(a.a) * sp * dt, Math.sin(a.a) * sp * dt, e.r * 0.8, 0.33, false);
      if (Math.random() < 0.7) dust(e.x, e.y, fz, 1);
      if (!a.hit && dist < e.r + 0.75) { a.hit = true; hurtPlayer(Math.round(d.dmg * 0.75), e.x, e.y, { src: e }); P.vx += Math.cos(a.a) * 4; P.vy += Math.sin(a.a) * 4; }
      const stuck = Math.hypot(e.x - ox, e.y - oy) < sp * dt * 0.3;
      e.state = 'strike'; e.st = 0;
      if (a.t >= a.dur + 0.55 || stuck || a.hit) { e.m9.act = null; e.state = 'recover'; e.st = 0; if (stuck) { G.shake += 1; SFX.play('land', 0.5); } }
      return;
    }
    e.state = 'windup'; e.st = 0;
    const k = a.t / a.dur;
    if (a.kind === 'slam') ring(e.x, e.y, fz + 0.04, 2.4, c, 2 + (k * 5) | 0, 0.3 + k);
    else if (a.kind === 'charge') { if (Math.random() < 0.5) dust(e.x, e.y, fz, 1); ring(e.x + Math.cos(a.a) * 1.2, e.y + Math.sin(a.a) * 1.2, fz + 0.05, 0.25, c, 2, 0.4); }
    else if (a.kind === 'blink') { ring(a.x, a.y, floorAt(a.x, a.y) + 0.05, 0.45, c, 3, 1.4); e.flash = Math.max(e.flash, 0.3 * k); }
    else if (a.kind === 'volley') ring(e.x, e.y, e.z + e.h * 0.5, 0.35, c, 3, 0.2);
    else if (a.kind === 'summon') { ring(a.x, a.y, floorAt(a.x, a.y) + 0.04, 0.6, c, 3, 0.9); ring(e.x, e.y, e.z + e.h * 0.8, 0.25, c, 1, 0.5); }
    else if (a.kind === 'stone') { e.armorMul = 0.3; if (Math.random() < 0.4) ring(e.x, e.y, e.z + e.h * 0.5, 0.3, COL.stoneskin, 1, 0.1); }
    if (a.t < a.dur) return;
    // resolve
    e.m9.act = null; e.state = 'recover'; e.st = 0;
    if (a.kind === 'slam') {
      G.shake += 2.5; SFX.play('land', 0.9); dust(e.x, e.y, fz, 10); ring(e.x, e.y, fz + 0.1, 1.2, c, 14, 2); ring(e.x, e.y, fz + 0.1, 2.4, c, 18, 1.2);
      if (dist < 2.55 && grounded() && Math.abs(P.z - e.z) < 1) hurtPlayer(Math.round(d.dmg * 0.5), e.x, e.y, { src: e });
    } else if (a.kind === 'blink') {
      ring(e.x, e.y, e.z + e.h * 0.5, 0.4, c, 10, 1); e.x = a.x; e.y = a.y; if (!d.fly) e.z = floorAt(a.x, a.y); ring(e.x, e.y, e.z + e.h * 0.5, 0.4, c, 12, 1);
      e.state = 'chase'; e.cd = Math.max(0.35, Math.min(e.cd, 0.45));
    } else if (a.kind === 'volley') {
      const ez = e.z + e.h * 0.5, sp = 6.5; const base = Math.atan2(P.y - e.y, P.x - e.x); const dz = (P.z + 1.0) - ez;
      for (const o of [-0.24, 0, 0.24]) G.projectiles.push({ type: 'fireball', x: e.x, y: e.y, z: ez, vx: Math.cos(base + o) * sp, vy: Math.sin(base + o) * sp, vz: dz / Math.max(0.5, dist) * sp, dmg: Math.round(d.dmg * 0.5), owner: e, life: 4 });
      SFX.play('fire'); e.st = 0;
    } else if (a.kind === 'summon') {
      const s = makeEnemy('skeleton', a.x, a.y, { rise: true }); s.summoned = true; s.awake = true; s.riseT = 0; s.d.speed *= RUN.cfg.spd || 1; G.enemies.push(s);
      ring(a.x, a.y, floorAt(a.x, a.y) + 0.1, 0.6, c, 16, 2); SFX.play('rattle', 0.8);
    } else if (a.kind === 'stone') { e.armorMul = a.prevArmor; e.state = 'chase'; e.cd = 0; }
  }
  const _ue = updateEnemy;
  updateEnemy = function (e, dt) {
    if (!active() || e.d.boss || !e.alive || e.dead || e.hidden || sealed()) { if (e.m9 && e.m9.act && e.m9.act.kind === 'stone') e.armorMul = e.m9.act.prevArmor; if (e.m9) e.m9.act = null; return _ue(e, dt); }
    const m = e.m9 || (e.m9 = { sc: rand(1.5, 4), hp: e.hp, hits: [], prev: e.state, awake: e.awake });
    const prev = e.state, wasAwake = e.awake;
    _ue(e, dt);
    if (!e.alive || e.dead) return;
    const dist = Math.hypot(P.x - e.x, P.y - e.y);
    // interrupted? (stagger / knockdown / stun / freeze cancel any signature move - your counterplay)
    if (m.act && (e.stagger > 0 || e.downT > 0 || e.stun > 0 || e.freezeT > 0 || e.iceT > 0 || e.frozen)) { if (m.act.kind === 'stone') e.armorMul = m.act.prevArmor; m.act = null; }
    if (m.act) { runAct(e, dt, dist); return; }
    // a touch quicker to re-engage after an attack
    if (prev === 'recover' && e.state === 'chase') e.cd *= RUN.cfg.n >= 2 ? 0.88 : 0.95;
    if (!e.awake) return;
    m.sc -= dt;
    const k = SIG[e.type], los = losTo(e.x, e.y, P.x, P.y);
    if (k === 'double' && prev === 'strike' && e.state === 'recover' && !m.dbl && Math.random() < (e.champ ? 0.5 : 0.25)) { // a second lunge, short tell
      m.dbl = true; e.state = 'windup'; e.st = e.d.windup * 0.35; SFX.play('windup', 0.7); count('double'); dmgNum(e.x, e.y, e.z + e.h + 0.3, '!', '#ffb050');
    } else if (k === 'double' && e.state === 'chase') m.dbl = false;
    if (k === 'pack' && prev !== 'windup' && e.state === 'windup') { let n = 0; for (const o of G.enemies) if (o !== e && o.type === 'bat' && o.alive && !o.hidden && o.awake && o.state === 'chase' && Math.hypot(o.x - e.x, o.y - e.y) < 4 && n < 2) { o.cd = Math.min(o.cd, rand(0.15, 0.35)); n++; } if (n) count('pack'); }
    if (k === 'sidestep' && P.sw && !m.ss && dist < 2.0 && e.state === 'chase' && G.time > (m.ssT || 0) && Math.random() < (e.champ ? 0.3 : 0.15)) { m.ssT = G.time + 4; const a = Math.atan2(P.y - e.y, P.x - e.x) + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2; e.kbx += Math.cos(a) * 5; e.kby += Math.sin(a) * 5; dust(e.x, e.y, e.z, 4); SFX.play('rattle', 0.4); m.ss = true; count('sidestep'); }
    if (!P.sw) m.ss = false;
    if (k === 'frenzy' && !m.fr && e.hp < e.maxhp * 0.5) { m.fr = true; e.d.windup *= 0.8; e.d.recover *= 0.7; e.d.speed *= 1.15; dmgNum(e.x, e.y, e.z + e.h + 0.4, 'FRENZY', '#ffb050'); SFX.play('roar', 0.35); count('frenzy'); }
    if (e.type === 'werewolf' && !wasAwake && e.awake && !m.howl) { m.howl = true; SFX.play('roar', 0.5); dmgNum(e.x, e.y, e.z + e.h + 0.4, 'HOWL', '#ffd080'); count('howl'); for (const o of G.enemies) if (o !== e && o.alive && !o.d.boss && Math.hypot(o.x - e.x, o.y - e.y) < 5) { o.awake = true; if (!o.m9h) { o.m9h = true; o.d.speed *= 1.08; } } }
    if (k === 'stoneskin') {
      if (e.hp < m.hp - 0.01) { m.hits.push(G.time); m.hits = m.hits.filter(t => G.time - t < 1.6); if (m.hits.length >= 2 && m.sc <= 0 && Math.random() < 0.5) { m.hits = []; startAct(e, 'stone', 1.1, { prevArmor: e.armorMul }); dmgNum(e.x, e.y, e.z + e.h + 0.3, 'STONESKIN', '#d0d0e8'); SFX.play('clink'); m.sc = 6; } }
      m.hp = e.hp; return;
    }
    m.hp = e.hp;
    if (e.state === 'chase' && e.cd > 0.15) tryStart(e, dist, los);
  };


  // floor / body tells for signature moves (same additive glow sprites the venom pools use)
  const _cs = collectSprites;
  collectSprites = function (cam) {
    const S = _cs(cam);
    if (!active() || sealed()) return S;
    const t = G.time;
    for (const e of G.enemies) {
      const a = e.m9 && e.m9.act; if (!a || !e.alive || e.hidden) continue; const k = Math.min(1, a.t / a.dur), c = COL[a.kind] || COL.stoneskin, pl = 0.15 * Math.sin(t * 30);
      const G1 = (x, y, w, h, al) => S.push({ tex: 'glow_w', x, y, z: floorAt(x, y) - 0.12, w, h, add: true, alpha: al, lit: false, tint: [c[0], c[1], c[2], 1] });
      if (a.kind === 'slam') G1(e.x, e.y, 1.2 + 3.8 * k, 0.25 + 0.3 * k, 0.25 + 0.35 * k + pl);
      else if (a.kind === 'charge' && a.t < a.dur) for (let i = 1; i <= 3; i++) G1(e.x + Math.cos(a.a) * i * 1.3, e.y + Math.sin(a.a) * i * 1.3, 0.8, 0.22, (0.2 + 0.35 * k) * (1 - i * 0.18) + pl);
      else if (a.kind === 'blink' || a.kind === 'summon') G1(a.x, a.y, 0.6 + 0.7 * k, 0.28, 0.25 + 0.4 * k + pl);
      else if (a.kind === 'volley') S.push({ tex: 'glow_w', x: e.x, y: e.y, z: e.z + e.h * 0.2, w: 0.7 + 0.5 * k, h: 0.7 + 0.5 * k, add: true, alpha: 0.3 + 0.4 * k + pl, lit: false, tint: [c[0], c[1], c[2], 1] });
    }
    return S;
  };

  // zombie rot-burst + champion purse
  const _kill = killEnemy;
  killEnemy = function (e, o) {
    const was = e.alive; const r = _kill(e, o);
    if (was && active() && !e.d.boss && !sealed()) {
      if (e.type === 'zombie' && Math.random() < 0.4) { G.hazards.push({ x: e.x, y: e.y, t: -0.9, dmg: 5, kind: 'venom' }); count('rot'); }
      if (e.champ) { ST.champKilled = (ST.champKilled || 0) + 1; const p = mkPickup('shards', e.x, e.y); p.amt = 25; G.pickups.push(p); toast('CHAMPION SLAIN', e.plateName || '', '#ffe080', 2.6); SFX.play('secret', 0.6); }
    }
    return r;
  };

  // ---------- 4) caps before bosses ----------
  // m9n: the catch-up is gone. Nothing is carried to the gate and nothing is granted when it seals: upgrades you skipped stay
  // where they lie (and are lost once the gate seals). You still get a warning at the gate while you can turn back.
  // M9C.caps = true restores the old m9c behaviour (testing only).
  const _up = updatePickups;
  updatePickups = function (dt) {
    _up(dt);
    if (!active() || !LEVEL.doors || !LEVEL.doors.gate || !G.boss) return;
    const g = LEVEL.doors.gate, prev = LEVEL.m9cGate; LEVEL.m9cGate = g.state;
    if (prev === 'closed' && g.state === 'open') offer();
    if (prev === 'open' && g.state === 'sealed') {
      ST.leftBehind = G.pickups.filter(p => !p.taken && UPG[p.type] && !inSecret(p)).length;
      if (!M9C.caps) { ST.granted = 0; ST.leftAtSeal = ST.leftBehind; return; }
      // anything you walked past on the open path follows you in: granted now, before the boss wakes
      const left = G.pickups.filter(p => !p.taken && UPG[p.type] && !inSecret(p)); ST.leftBehind = left.length; let n = 0; const tl = G.toasts.length, bt = G.bigText;
      for (const p of left) {
        try { if (p.type === 'spoils') { if (typeof grantRandomRelic === 'function') grantRandomRelic(true); if (typeof shardGain === 'function') shardGain(6, null); p.taken = true; n++; }
              else if (PICK[p.type] && PICK[p.type].f(p)) { p.taken = true; n++; } } catch (err) { console.warn('m9c grant', err); }
      }
      ST.granted = n; ST.leftAtSeal = G.pickups.filter(p => !p.taken && UPG[p.type] && !inSecret(p)).length;
      if (n) { G.toasts.length = Math.min(G.toasts.length, tl); G.bigText = bt; toast('YOUR SPOILS FOLLOW YOU', n + (n > 1 ? ' upgrades claimed' : ' upgrade claimed') + ' before the fight.', '#ffe080', 3); }
    }
  };
  function offer() {
    const cp = (LEVEL.checkpoints && LEVEL.checkpoints[1]) || { x: P.x, y: P.y, ang: P.ang };
    const left = G.pickups.filter(p => !p.taken && UPG[p.type] && !inSecret(p) && Math.hypot(p.x - cp.x, p.y - cp.y) > 2.2);
    const g = LEVEL.doors.gate, A = LEVEL.arena, used = [];
    const okSpot = (x, y) => free(x, y) && losTo(cp.x, cp.y, x, y) && Math.hypot(x - g.x - 0.5, y - g.y - 0.5) > 1.1 && !(A && x > A.x0 && x < A.x1 && y > A.y0 && y < A.y1) && used.every(u => Math.hypot(u[0] - x, u[1] - y) > 0.7);
    const spots = []; for (const r of [1.1, 1.6, 2.1, 2.6, 3.1]) for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; spots.push([cp.x + Math.cos(a) * r, cp.y + Math.sin(a) * r]); }
    let n = 0;
    if (!M9C.caps) {   // m9n: no carrying - just tell the player what they are about to leave behind
      ST.offered = 0; ST.leftOpen = left.length;
      const sec = (LEVEL.secrets || []).filter(s => !s.found).length, er = LEVEL.eliteRoom && !LEVEL.eliteRoom.cleared && G.enemies.some(e => e.eliteRoom && e.alive);
      const bits = []; if (left.length) bits.push(left.length + (left.length > 1 ? ' upgrades' : ' upgrade') + ' left behind - they will not follow you.');
      if (sec) bits.push(sec + (sec > 1 ? ' secrets' : ' secret') + ' still hidden.'); if (er) bits.push('Elites guard spoils.');
      if (bits.length) toast('BEFORE YOU ENTER', bits.join(' '), '#c8b0ff', 3.6);
      return;
    }
    for (const p of left) {
      const sp = spots.find(q => okSpot(q[0], q[1])); if (!sp) break;
      used.push(sp); p.x = sp[0]; p.y = sp[1]; p.z = floorAt(sp[0], sp[1]) + 1.2; p.drop = true; p.vz = 1; ring(sp[0], sp[1], p.z, 0.3, [255, 220, 120], 10, 1.2); n++;
    }
    ST.offered = n;
    const sec = (LEVEL.secrets || []).filter(s => !s.found).length, er = LEVEL.eliteRoom && !LEVEL.eliteRoom.cleared && G.enemies.some(e => e.eliteRoom && e.alive);
    const bits = []; if (sec) bits.push(sec + (sec > 1 ? ' secrets' : ' secret') + ' still hidden.'); if (er) bits.push('Elites guard spoils.');
    if (n) toast('YOUR SPOILS AWAIT', n + (n > 1 ? ' upgrades were' : ' upgrade was') + ' carried to the gate.', '#ffe080', 3.2);
    if (bits.length) setTimeout(() => { if (G.state === 'play' && LEVEL.doors.gate.state === 'open') toast('BEFORE YOU ENTER', bits.join(' '), '#c8b0ff', 3.4); }, n ? 900 : 0);
  }
})();
