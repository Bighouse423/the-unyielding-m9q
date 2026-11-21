'use strict';
// ===== M9: "THE FULL GAME" pass - feel, Lich phases, meta (feats/outfits/trials/stats/hidden boss), story, codex, title.
// No base balance changes: every number that matters for the default run is untouched. Trials are opt-in and only harder.
// Progress lives in SAVE.m9 (added on load, so older saves just gain an empty block).

// ---------- core: save block, run stats, event bus ----------
(function () {
  const D = { v: 1, ach: {}, lore: {}, outfit: 'baron', trials: {}, fin: 0, parries: 0, bestCombo: 0, introSeen: false, endSeen: false, saint: 0, abyssBest: 0 };
  SAVE.m9 = Object.assign({}, D, SAVE.m9 || {});
  for (const k of ['ach', 'lore', 'trials']) SAVE.m9[k] = Object.assign({}, SAVE.m9[k] || {});
  const M9 = window.M9 = { save: SAVE.m9, ev: {}, on(n, f) { (this.ev[n] = this.ev[n] || []).push(f); }, emit(n, a, b) { for (const f of (this.ev[n] || [])) { try { f(a, b); } catch (e) { console.warn('m9 ' + n, e); } } } };
  M9.write = () => { try { writeSave(); } catch (e) { } };
  M9.newStats = () => ({ trials: Object.assign({}, SAVE.m9.trials), dmg: 0, taken: 0, fin: 0, parries: 0, combo: 0, lore: 0, stTaken: 0, bossT: {}, saint: false });
  RUN.m9 = M9.newStats();
  const _newRun = newRun;
  newRun = function () { RUN.m9 = M9.newStats(); _newRun.apply(this, arguments); M9.emit('stage'); M9.emit('runStart'); };
  GAME.rogue.newRun = newRun;
  const _next = nextStage;
  nextStage = function () { const r = _next.apply(this, arguments); RUN.m9.stTaken = 0; M9.emit('stage'); return r; };
  GAME.rogue.nextStage = nextStage;
  const _kill = killEnemy;
  killEnemy = function (e, o) { const r = _kill.apply(this, arguments); M9.emit('kill', e, o || {}); return r; };
  const _dmg = damageEnemy;
  damageEnemy = function (e, dmg, o) { const h0 = e.hp; const r = _dmg.apply(this, arguments); if (RUN.m9 && e && h0 > 0) RUN.m9.dmg += Math.max(0, Math.min(h0, h0 - Math.max(0, e.hp))); return r; };
  GAME.dbg.damageEnemy = damageEnemy;
  const _hurt = hurtPlayer;
  hurtPlayer = function (dmg, sx, sy, opt) {
    if (RUN.on && M9.trial('glass')) dmg = dmg * 1.5;
    const h0 = P.hp; const r = _hurt.call(this, dmg, sx, sy, opt);
    const lost = Math.max(0, h0 - P.hp); if (lost > 0 && RUN.m9) { RUN.m9.taken += lost; RUN.m9.stTaken += lost; }
    return r;
  };
  const _upd = update;
  let lastPF = 0;
  update = function (dt) {
    _upd.apply(this, arguments);
    if (P.parryFlash > lastPF + 0.5 && RUN.m9) { RUN.m9.parries++; SAVE.m9.parries++; M9.emit('parry'); }
    lastPF = P.parryFlash || 0;
    if (G.combo > (RUN.m9 ? RUN.m9.combo : 0) && RUN.m9) { RUN.m9.combo = G.combo; if (G.combo > SAVE.m9.bestCombo) SAVE.m9.bestCombo = G.combo; }
    M9.emit('tick', dt);
  };
  M9.trial = id => !!(RUN.m9 && RUN.m9.trials && RUN.m9.trials[id]);
  M9.anyTrial = () => !!(RUN.m9 && RUN.m9.trials && Object.keys(RUN.m9.trials).some(k => RUN.m9.trials[k]));
})();

// ---------- ACHIEVEMENTS (stored locally in SAVE.m9.ach) ----------
(function () {
  const BOSSN = { vknight: 'THE VAMPIRE KNIGHT', spider: 'THE BROOD MOTHER', colossus: 'THE OSSUARY COLOSSUS', alphawolf: 'THE BLOOD MOON ALPHA', matriarch: 'THE GARGOYLE MATRIARCH', minotaur: 'THE MINOTAUR', witch: 'MORWEN THE WITCH', cerberax: 'CERBERAX', uknight: 'SIR VALCOR', lich: 'THE LICH KING' };
  const L = [
    ['firstblood', 'FIRST BLOOD', 'Slay your first foe.'],
    ['butcher', 'THE BUTCHER', 'Slay 500 foes across all runs.'],
    ['executioner', 'EXECUTIONER', 'Land 25 finishers.'],
    ['parry1', 'NOT TODAY', 'Parry an attack.'],
    ['parry50', 'IRON WALL', 'Parry 50 attacks.'],
    ['combo15', 'CHAIN OF PAIN', 'Reach a 15-hit chain.'],
    ['combo30', 'MERCILESS', 'Reach a 30-hit chain.'],
  ];
  for (const k in BOSSN) L.push(['boss_' + k, k === 'lich' ? 'REGICIDE' : 'FELLED: ' + BOSSN[k].replace(/^THE /, ''), 'Defeat ' + (k === 'lich' ? 'the Lich King.' : BOSSN[k].toLowerCase().replace(/^the /, 'the ').replace(/\b(\w)/g, (m, c, i) => i ? m : m.toUpperCase()) + '.')]);
  L.push(
    ['elites25', 'ELITE HUNTER', 'Slay 25 elite foes.'],
    ['secrets10', 'TOMB RAIDER', 'Find 10 secret rooms.'],
    ['lore5', 'SCHOLAR OF ASH', 'Collect 5 lore pages.'],
    ['loreall', 'THE BLACK ARCHIVE', 'Collect every lore page.'],
    ['win', 'THE UNYIELDING', 'Claim the Black Reliquary.'],
    ['abyss1', 'INTO THE ABYSS', 'Descend into the Abyss.'],
    ['abyss5', 'ABYSS WALKER', 'Reach Abyss depth 5.'],
    ['saint', 'HOLLOW NO MORE', 'Find and destroy the Hollow Saint.'],
    ['untouched', 'UNTOUCHED', 'Clear a stage without taking damage.'],
    ['swift', 'SWIFT JUDGMENT', 'Clear a stage in under 2:30.'],
    ['trial', 'TRIAL BY FIRE', 'Clear a stage with a Trial active.'],
    ['martyr', 'MARTYR', 'Fell the Lich King under a Trial.'],
    ['outfit', 'DRESSED TO KILL', 'Wear a new outfit.'],
  );
  const ACH = window.ACH = { list: L.map(([id, n, d]) => ({ id, n, d })), q: [], cur: null, t: 0 };
  const S = () => SAVE.m9;
  ACH.has = id => !!S().ach[id];
  ACH.unlock = function (id) {
    if (S().ach[id] || !ACH.list.find(a => a.id === id)) return false;
    S().ach[id] = Date.now(); M9.write(); ACH.q.push(id);
    try { SFX.ev('ui_click', 0.6, ['glint']); SFX.play('glint', 0.6); } catch (e) { }
    M9.emit('ach', id); return true;
  };
  ACH.count = () => ACH.list.filter(a => S().ach[a.id]).length;
  // older saves: credit what the lifetime record already proves (silently, no popups). Boss order is fixed (STAGE_PIN),
  // so reaching stage N means bosses 1..N-1 fell.
  (function retro() {
    const st = SAVE.stats || {}, b = SAVE.best || {}, give = id => { if (!S().ach[id] && ACH.list.find(a => a.id === id)) { S().ach[id] = Date.now(); return 1; } return 0; };
    let n = 0; const order = ['vknight', 'spider', 'colossus', 'alphawolf', 'matriarch', 'minotaur', 'witch', 'cerberax', 'uknight', 'lich'];
    const felled = (st.wins || b.win) ? 10 : Math.max(0, Math.min(9, (b.stage || 1) - 1));
    for (let i = 0; i < felled; i++) n += give('boss_' + order[i]);
    if ((st.kills || 0) > 0) n += give('firstblood'); if ((st.kills || 0) >= 500) n += give('butcher');
    if ((st.elites || 0) >= 25) n += give('elites25'); if ((st.secrets || 0) >= 10) n += give('secrets10');
    if (st.wins || b.win) n += give('win');
    if (n) M9.write();
  })();
  const life = () => SAVE.stats.kills + RUN.kills + (G.kills || 0);
  M9.on('kill', (e, o) => {
    if (!RUN.on) return;
    if (!e.summoned || e.d.boss) ACH.unlock('firstblood');
    if (life() >= 500) ACH.unlock('butcher');
    if (e.elite && SAVE.stats.elites + (RUN.elites || 0) >= 25) ACH.unlock('elites25');
    if (e.d.boss && BOSSN[e.type]) { ACH.unlock('boss_' + e.type); if (e.type === 'lich' && RUN.on) { if (M9.anyTrial()) ACH.unlock('martyr'); } }
  });
  M9.on('parry', () => { ACH.unlock('parry1'); if (S().parries >= 50) ACH.unlock('parry50'); });
  M9.on('tick', () => {
    if (!RUN.on) return;
    if (G.combo >= 15) ACH.unlock('combo15'); if (G.combo >= 30) ACH.unlock('combo30');
    if (SAVE.stats.secrets + (RUN.secrets || 0) >= 10) ACH.unlock('secrets10');
    const d = typeof abyssDepth === 'function' ? abyssDepth() : 0;
    if (d >= 1) ACH.unlock('abyss1'); if (d >= 5) ACH.unlock('abyss5');
    if (d > S().abyssBest) S().abyssBest = d;
  });
  // a stage is cleared when its boon pick opens (or the win screen)
  const _sp = startPick;
  startPick = function (mini) {
    if (!mini && RUN.on && G.state === 'play' && !RUN.m9.clearedAt) {
      RUN.m9.clearedAt = RUN.stage;
      if ((RUN.m9.stTaken || 0) <= 0) ACH.unlock('untouched');
      if ((G.time || 0) < 150) ACH.unlock('swift');
      if (M9.anyTrial()) ACH.unlock('trial');
    }
    return _sp.apply(this, arguments);
  };
  GAME.rogue.startPick = startPick;
  M9.on('stage', () => { if (RUN.m9) RUN.m9.clearedAt = 0; });
  const _sw = startWin;
  startWin = function () { const r = _sw.apply(this, arguments); ACH.unlock('win'); return r; };
  // popup (bottom right, above the HUD; waits while a tip is up)
  M8DRAW.push(function (ctx, rdt) {
    if (G.state !== 'play' && !ACH.cur) return false;
    if (!ACH.cur && ACH.q.length && !(window.TIPS && TIPS.cur)) { ACH.cur = ACH.q.shift(); ACH.t = 0; }
    if (!ACH.cur) return false;
    ACH.t += rdt; if (ACH.t > 3.6) { ACH.cur = null; return false; }
    if (OPT.open || G.state !== 'play') return false;
    const a = ACH.list.find(x => x.id === ACH.cur); const k = Math.min(1, ACH.t * 5, (3.6 - ACH.t) * 3);
    const w = 196, h = 30, x = Math.round(W - w - 6 + (1 - k) * 60), y = H - 33 - h - 8 - (M9.subOn && M9.subOn() ? 32 : 0);
    ctx.save(); ctx.globalAlpha = k; goldFrame(ctx, x, y, w, h, '#30e090');
    text(ctx, 'FEAT UNLOCKED', x + 6, y + 4, '#80ffb0');
    fitBlock(ctx, a.n, x + 6, y + 16, w - 12, 9, '#ffe080', 'left');
    ctx.restore(); return true;
  });
})();

// ---------- FEEL: crunchier finishers, kill hitstop, per-family death animations ----------
(function () {
  // finisher: longer impact freeze, camera kick, shock ring, layered impact sounds
  const _uf = updateFinisher;
  updateFinisher = function (dt) {
    const F = G.finisher, was = F && F.done;
    _uf.apply(this, arguments);
    if (F && F.done && !was) {
      const e = F.e;
      if (RUN.m9) { RUN.m9.fin++; SAVE.m9.fin++; if (SAVE.m9.fin >= 25) ACH.unlock('executioner'); }
      G.hitstop = Math.max(G.hitstop, 0.2); G.zoom += 0.08; G.roll += (Math.random() < 0.5 ? -1 : 1) * 0.07; G.shake += 3;
      try { SFX.play('heavy', 0.9); SFX.play('gib', 0.7); } catch (er) { }
      const z = e.z + e.h * 0.55;
      for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; addP({ k: 'spark', x: e.x, y: e.y, z, vx: Math.cos(a) * 6.5, vy: Math.sin(a) * 6.5, vz: rand(-0.3, 0.6), size: 0.045, col: i % 3 ? RGB(255, 220, 140) : RGB(255, 60, 70), life: rand(0.25, 0.45) }); }
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; addP({ k: 'dust', x: e.x + Math.cos(a) * 0.3, y: e.y + Math.sin(a) * 0.3, z: floorAt(e.x, e.y) + 0.05, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, vz: 0.2, size: rand(0.08, 0.14), col: RGB(190, 160, 200), life: 0.6 }); }
      dmgNum(e.x, e.y, e.z + e.h + 0.7, 'EXECUTED', '#ff3040');
    }
  };
  // every heavy / ranged kill gets a short impact freeze (the whole world pauses, so it never changes a fight)
  M9.on('kill', (e, o) => { if (!e.d.boss && (o.heavy || o.src === 'pistol' || o.finisher)) G.hitstop = Math.max(G.hitstop, o.finisher ? 0.06 : 0.045); });
  // death styles by family
  const FAM = { hellhound: 'ash', werewolf: 'ash', imp: 'ash', fzombie: 'ash', gargoyle: 'crumble', ghost: 'dissolve', voidshade: 'dissolve', wclone: 'dissolve', acolyte: 'bats', penitent: 'bats', royalguard: 'bonefall', gladiator: 'bonefall' };
  const BATS = window.M9BATS = [];
  M9.on('kill', (e, o) => {
    if (e.d.boss || e.type === 'phyl') return;
    const f = FAM[e.type]; if (!f) return;
    if (e.deathType === 'burst' && f !== 'dissolve' && f !== 'bats') return;   // finisher / heavy gibs stay as they are
    if (e.deathType === 'bones' || e.deathType === 'gone') return;
    e.deathType = 'm9' + f; e.deathT = 0; e.m9fx = 0;
    const cx = e.x, cy = e.y, cz = e.z + e.h * 0.5;
    if (f === 'crumble' && typeof stoneBurst === 'function') { stoneBurst(cx, cy, cz, 12, 1); SFX.play('stone', 0.7); }
    if (f === 'bats') { for (let i = 0; i < 9; i++) { const a = rand(0, TAU); BATS.push({ x: cx, y: cy, z: cz + rand(-0.3, 0.4), vx: Math.cos(a) * rand(1.5, 3.5), vy: Math.sin(a) * rand(1.5, 3.5), vz: rand(0.8, 2.4), t: 0, life: rand(1.1, 1.7), ph: rand(0, 6) }); } SFX.play('screech', 0.35); }
    if (f === 'bonefall') { gibs(cx, cy, cz, 6, 'bone', 0.9); SFX.play('rattle', 0.7); }
    if (f === 'ash') SFX.play('fire', 0.4);
    if (f === 'dissolve') SFX.play('ghost', 0.5);
  });
  M9.on('tick', dt => {
    for (let i = BATS.length - 1; i >= 0; i--) { const b = BATS[i]; b.t += dt; if (b.t > b.life) { BATS.splice(i, 1); continue; } b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vx += rand(-4, 4) * dt; b.vy += rand(-4, 4) * dt; }
    for (const e of G.enemies) {
      if (!e.dead || !e.deathType || e.deathType.slice(0, 2) !== 'm9') continue;
      const k = e.deathT; if (k > 2) continue;
      if (e.deathType === 'm9ash' && k < 1.1 && Math.random() < dt * 40) addP({ k: 'ember', x: e.x + rand(-0.35, 0.35), y: e.y + rand(-0.35, 0.35), z: e.z + rand(0, e.h * (1 - k / 1.2)), vx: 0, vy: 0, vz: rand(0.6, 1.8), size: 0.04, col: Math.random() < 0.5 ? RGB(255, 140, 40) : RGB(255, 60, 20), life: rand(0.5, 1) });
      if (e.deathType === 'm9ash' && k < 1.2 && Math.random() < dt * 10) addP({ k: 'smoke', x: e.x + rand(-0.3, 0.3), y: e.y + rand(-0.3, 0.3), z: e.z + rand(0.2, e.h), vx: 0, vy: 0, vz: 0.5, size: rand(0.12, 0.2), col: RGB(50, 30, 40), life: 0.8 });
      if (e.deathType === 'm9dissolve' && k < 1.0 && Math.random() < dt * 45) addP({ k: 'ecto', x: e.x + rand(-0.4, 0.4), y: e.y + rand(-0.4, 0.4), z: e.z + rand(0, e.h), vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3), vz: rand(0.8, 2.2), size: rand(0.04, 0.08), col: Math.random() < 0.5 ? RGB(140, 240, 255) : RGB(190, 120, 255), life: 0.7 });
      if (e.deathType === 'm9crumble' && k > 0.15 && k < 0.8 && Math.random() < dt * 14) addP({ k: 'dust', x: e.x + rand(-0.3, 0.3), y: e.y + rand(-0.3, 0.3), z: e.z + rand(0, 0.4), vx: rand(-0.4, 0.4), vy: rand(-0.4, 0.4), vz: rand(0.1, 0.5), size: rand(0.06, 0.12), col: RGB(170, 160, 190), life: 0.7 });
    }
  });
  const _ev = enemyVisual;
  enemyVisual = function (e) {
    if (!(e.dead && e.deathType && e.deathType.slice(0, 2) === 'm9')) return _ev.apply(this, arguments);
    if (e.hidden) return null;
    const t = e.deathT, d = e.d; let h = e.h, w = e.w, z = e.z, tint = null, alpha = d.mat === 'ecto' ? 0.7 : 1, flash = 0, wave = 0, skew = 0, tex = d.spr;
    switch (e.deathType) {
      case 'm9ash': { if (t > 1.25) return null; const k = Math.min(1, t / 1.2); flash = Math.max(0, 0.7 - t * 5); tint = [40, 10, 12, 0.35 + 0.55 * k]; h *= 1 - 0.85 * k; w *= 1 + 0.15 * k; skew = Math.sin(t * 40) * 0.03 * (1 - k); break; }
      case 'm9crumble': { if (t > 1.0) return null; const k = Math.min(1, t / 0.95); tint = [150, 145, 175, 0.6]; z -= h * 0.9 * k * k; skew = Math.sin(t * 55) * 0.05; flash = Math.max(0, 0.5 - t * 4); break; }
      case 'm9dissolve': { if (t > 1.0) return null; const k = t / 1.0; alpha *= 1 - k; wave = 0.08 + 0.5 * k; z += k * 0.5; h *= 1 + 0.3 * k; w *= 1 - 0.3 * k; tint = [170, 230, 255, 0.4]; break; }
      case 'm9bats': { if (t > 0.28) return null; flash = 1; w *= 1 + t * 1.5; alpha = 1 - t / 0.28; break; }
      case 'm9bonefall': { if (t < 0.32) { const k = t / 0.32; h *= 1 - 0.55 * k; skew = Math.sin(t * 60) * 0.08; tint = [235, 225, 200, 0.3 * k]; flash = Math.max(0, 0.6 - t * 4); } else { tex = 'bonepile'; w = 0.95; h = 0.34; } break; }
      default: return null;
    }
    return { tex, x: e.x, y: e.y, z, w, h, flip: e.flip, skew, lean: 0, wave, waveF: 9, waveP: 0, legs: 0, tint, flash, blood: 0, alpha, sub: null };
  };
  GAME.dbg.enemyVisual = enemyVisual;
  // extra billboards (bats, auras, lore pages, the lectern...) join the sorted sprite list
  const _cs = collectSprites;
  collectSprites = function (cam) {
    const S = _cs.apply(this, arguments), X = [];
    for (const b of BATS) { const f = 1 - b.t / b.life; X.push({ tex: 's_bat', x: b.x, y: b.y, z: b.z, w: 0.42 * (0.85 + 0.15 * Math.sin(b.t * 30 + b.ph)), h: 0.26, flip: Math.sin(b.t * 6 + b.ph) > 0, alpha: Math.min(1, f * 2), lit: false, glow: 0.1 }); }
    M9.emit('sprites', X, G.t);
    if (!X.length) return S;
    const dx = Math.cos(cam.ang), dy = Math.sin(cam.ang);
    for (const s of X) { s.dep = (s.x - cam.x) * dx + (s.y - cam.y) * dy; if (s.dep > 0.42 && Engine.tex[s.tex]) S.push(s); }
    S.sort((a, b) => b.dep - a.dep); return S;
  };
})();

// ---------- LICH KING: phase pips, phase-change beat, per-phase aura + arena; boss lines for every boss ----------
(function () {
  const ROMAN = ['', 'I', 'II', 'III'];
  const PHN = ['', 'THE THRONE', 'THE PHYLACTERY', 'THE UNYIELDING DEAD'];
  let beat = null, lastPh = 0, lastBoss = null;
  M9.beat = () => beat;
  M9.on('tick', dt => {
    const b = G.boss;
    if (beat) { beat.t += dt; if (beat.t > 2.6) beat = null; }
    if (!b || b.type !== 'lich' || !b.awake) { lastPh = 0; return; }
    const ph = b.alive ? (b.ph || 1) : lastPh;
    if (lastPh && ph > lastPh) {
      beat = { t: 0, ph };
      G.hitstop = Math.max(G.hitstop, 0.3); G.zoom += 0.12; G.shake += 4;
      if (ph === 2) { HAZE[0] = 60; HAZE[1] = 130; HAZE[2] = 110; }
      M9.emit('lichPhase', ph);
    }
    lastPh = ph;
    if (!b.alive) return;
    // aura: phase 1 a slow green crown of motes, phase 2 twin green/violet orbit, phase 3 a violet storm + falling soul-ash over the arena
    const n = ph === 1 ? 4 : ph === 2 ? 9 : 14;
    if (Math.random() < dt * n * 2) {
      const a = G.t * (ph === 3 ? 3.2 : 1.6) + (Math.random() < 0.5 ? 0 : Math.PI), r = ph === 1 ? 0.7 : 0.95;
      addP({ k: 'ecto', x: b.x + Math.cos(a) * r, y: b.y + Math.sin(a) * r, z: b.z + rand(0.4, b.h * 0.9), vx: -Math.sin(a) * 0.8, vy: Math.cos(a) * 0.8, vz: rand(0.2, 0.9), size: ph === 3 ? 0.1 : 0.07, col: ph === 1 ? RGB(110, 255, 150) : ph === 2 ? (Math.random() < 0.5 ? RGB(110, 255, 150) : RGB(190, 110, 255)) : RGB(200, 90, 255), life: 0.9 });
    }
    if (ph === 3 && Math.random() < dt * 22) addP({ k: 'ember', x: P.x + rand(-7, 7), y: P.y + rand(-7, 7), z: floorAt(P.x, P.y) + rand(2.2, 3.2), vx: rand(-0.2, 0.2), vy: rand(-0.2, 0.2), vz: rand(-1.2, -0.6), size: 0.035, col: Math.random() < 0.6 ? RGB(190, 120, 255) : RGB(120, 255, 170), life: 2.4 });
  });
  // pips + phase thresholds on the boss bar (overlay)
  M8DRAW.push(function (ctx) {
    const b = G.boss;
    if (G.state !== 'play' || !b || !b.awake || !(b.alive || (b.deathType === 'boss' && !b.burst))) return false;
    let drew = false;
    if (b.type === 'lich') {
      for (const f of [0.66, 0.33]) { const x = Math.round(90 + 300 * f); ctx.fillStyle = '#1a0410'; ctx.fillRect(x - 1, 18, 3, 9); ctx.fillStyle = '#e0b0ff'; ctx.fillRect(x, 17, 1, 11); }
      const ph = b.alive ? (b.ph || 1) : 4;
      for (let i = 1; i <= 3; i++) {
        const x = 240 + (i - 2) * 12 - 3, y = 28, done = ph > i, cur = ph === i;
        ctx.fillStyle = '#1a0410'; ctx.fillRect(x - 1, y - 1, 8, 8);
        ctx.fillStyle = done ? '#4a2060' : cur ? (i === 3 ? '#c070ff' : i === 2 ? '#90ffc0' : '#ffd060') : '#2a1030'; ctx.fillRect(x, y, 6, 6);
        if (cur) { ctx.fillStyle = '#fff4d0'; ctx.fillRect(x + 1, y + 1, 2, 2); }
        if (done) { ctx.fillStyle = '#ff3040'; ctx.fillRect(x + 1, y + 2, 4, 2); }
      }
      drew = true;
    }
    return drew;
  });
  // the phase beat: a black vignette closes in, a gold roman numeral and the phase name
  M8DRAW.push(function (ctx) {
    if (!beat || G.state !== 'play' || G.paused) return false;
    const t = beat.t, k = Math.min(1, t / 0.25) * Math.min(1, (2.6 - t) / 0.5);
    const bh = Math.round(16 * k);
    ctx.fillStyle = '#000'; ctx.fillRect(0, H - 33 - bh, W, bh);
    ctx.globalAlpha = k;
    const y = 64, num = ROMAN[beat.ph], hw = 40 + Math.round(30 * Math.min(1, t / 0.4));
    ctx.fillStyle = 'rgba(10,0,20,0.72)'; ctx.fillRect(W / 2 - hw, y - 4, hw * 2, 36);
    ctx.fillStyle = '#e0b850'; ctx.fillRect(W / 2 - hw, y - 4, hw * 2, 1); ctx.fillRect(W / 2 - hw, y + 31, hw * 2, 1);
    text(ctx, num, W / 2, y, beat.ph === 3 ? '#e0a0ff' : '#90ffc0', 'center', 2);
    text(ctx, 'PHASE', W / 2, y + 20, '#c8a860', 'center');
    ctx.globalAlpha = 1; return true;
  });

  // ----- boss lines: one at the intro, one at the death -----
  const LINES = {
    vknight: ['"Another pilgrim for the nave. Kneel, and I will make it quick."', '"The blood... it was never mine to keep."'],
    spider: ['"Little fly. My children are so hungry."', '"Eat... him... my... sweet..."'],
    colossus: ['"I am built from ten thousand who tried before you."', '"Put me back... in the ground..."'],
    alphawolf: ['"The moon is ours, Baron. Run."', '"The pack... will remember your scent."'],
    matriarch: ['"Stone does not bleed. Stone does not forgive."', '"The belfry falls silent at last."'],
    minotaur: ['"The crowd wants your head, Baron. I aim to please."', '"No... cheering...?"'],
    witch: ['"Your bones will make a fine servant, Kael."', '"He promised... I would never die..."'],
    cerberax: ['"Three heads. Three deaths. Choose."', '"The kennel gate... is open..."'],
    uknight: ['"I swore an oath to him. I have kept it for four hundred years."', '"Go then. Do what I could not."'],
    lich: ['"Kneel, Baron. Even kings kneel to me."', '"The crown... was always... heavier... than the skull..."'],
  };
  M9.LINES = LINES;
  let sub = null; const said = {};
  M9.subOn = () => !!sub;
  M9.say = (who, line, col, dur) => { sub = { who, line, col: col || '#f0e0ff', t: 0, dur: dur || 4.2 }; };
  M9.on('stage', () => { for (const k in said) delete said[k]; sub = null; });
  M9.on('tick', dt => {
    const tipUp = window.TIPS && TIPS.cur;
    if (sub && !tipUp) { sub.t += dt; if (sub.t > sub.dur) sub = null; }
    const b = G.boss; if (!b || !LINES[b.type]) return;
    const id = b.type + ':' + (RUN.stage || 0);
    if (b.awake && b.alive && !said[id + 'i'] && b.state !== 'dormant') { said[id + 'i'] = 1; setTimeout(() => M9.say(b.d.title || b.type, LINES[b.type][0], '#ffd8a0'), b.type === 'lich' ? 3600 : 900); }
    if (!b.alive && b.awake && !said[id + 'd']) { said[id + 'd'] = 1; M9.say(b.d.title || b.type, LINES[b.type][1], '#e0c0ff', 4.6); }
  });
  M8DRAW.push(function (ctx) {
    if (!sub || G.state !== 'play' || G.paused || OPT.open || (window.TIPS && TIPS.cur)) return false;
    const k = Math.min(1, sub.t / 0.3) * Math.min(1, (sub.dur - sub.t) / 0.4);
    const y = H - 62;
    ctx.globalAlpha = 0.75 * k; ctx.fillStyle = '#0a0010'; ctx.fillRect(40, y - 3, W - 80, 23); ctx.globalAlpha = k;
    fitBlock(ctx, sub.who, W / 2, y - 1, W - 92, 9, '#a08070', 'center', 1, 9);
    fitBlock(ctx, sub.line, W / 2, y + 9, W - 92, 10, sub.col, 'center', 1, 9);
    ctx.globalAlpha = 1; return true;
  });
})();

// ---------- META: outfits (gauntlet palette swaps), trials, the run record, the Hollow Saint ----------
(function () {
  // OUTFITS: recolour copies of the gauntlet art. Alpha is copied untouched, so every pose and pixel shape is identical;
  // only the three material families change hue: the blue-black plate, the gold trim, the ruby gems.
  const HAND = ['vm_larm', 'vm_larm3d', 'vm_lfist', 'vm_lgrip', 'vm_ls3d', 'vm_lw3d', 'vm_rarm', 'vm_rarm3d', 'vm_rh3d', 'vm_rhand'];
  // per family: [hue (0..1) or null=keep, sat mul, val mul, val add]
  const OUTFITS = [
    { id: 'baron', n: 'THE BARON', d: 'Gold, black and ruby. The house colours.', how: 'Always yours.', ok: () => true },
    { id: 'bone', n: 'BONE KNIGHT', d: 'Ivory plate, silver trim, cold blue eyes.', how: 'Fell the Ossuary Colossus.', ok: () => ACH.has('boss_colossus'), plate: [0.11, 0.25, 1.9, 0.12], gold: [0.6, 0.08, 1.05, 0.05], gem: [0.55, 1, 1.1, 0] },
    { id: 'blood', n: 'BLOOD PRINCE', d: 'Crimson plate, dark gold, black gems.', how: 'Slay 500 foes.', ok: () => ACH.has('butcher'), plate: [0.975, 2.6, 1.2, 0.03], gold: [0.09, 1, 0.85, 0], gem: [0.8, 0.3, 0.45, 0] },
    { id: 'void', n: 'VOID HERALD', d: 'Violet plate, grave-green trim and gems.', how: 'Destroy the Lich King.', ok: () => ACH.has('win'), plate: [0.77, 1.1, 1.35, 0.03], gold: [0.37, 0.9, 1, 0], gem: [0.4, 1, 1.15, 0.05] },
    { id: 'warden', n: 'GRAVE WARDEN', d: 'Moss-iron plate, bronze trim, amber gems.', how: 'Find 10 secret rooms.', ok: () => ACH.has('secrets10'), plate: [0.4, 0.45, 1.15, 0.02], gold: [0.06, 0.8, 0.8, 0], gem: [0.1, 1, 1.1, 0.05] },
  ];
  M9.OUTFITS = OUTFITS;
  const ORIG = {}, CACHE = {};
  function rgb2hsv(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; if (h < 0) h += 1; } return [h, mx ? d / mx : 0, mx]; }
  function hsv2rgb(h, s, v) { const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s); const m = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6]; return m; }
  function recolor(img, o) {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const [h, s, v] = rgb2hsv(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
      let fam = null;
      if (s >= 0.25 && v >= 0.12) { const hb = h * 12; fam = hb >= 0.5 && hb < 2.2 ? o.gold : hb >= 6 && hb < 10 ? o.plate : (hb >= 10.4 || hb < 0.5) ? o.gem : null; }
      else if (v < 0.3 || s < 0.25) fam = o.plate && s < 0.25 && v < 0.6 ? [null, 1, o.plate[2] * 0.9 + 0.1, o.plate[3]] : null;
      if (!fam) continue;
      const nh = fam[0] === null ? h : fam[0], ns = Math.min(1, s * fam[1]), nv = Math.min(1, v * fam[2] + fam[3]);
      const [r, g, b] = fam[0] === null ? [d[i] / 255 * fam[2] + fam[3], d[i + 1] / 255 * fam[2] + fam[3], d[i + 2] / 255 * fam[2] + fam[3]] : hsv2rgb(nh, ns, nv);
      d[i] = Math.max(0, Math.min(255, r * 255)); d[i + 1] = Math.max(0, Math.min(255, g * 255)); d[i + 2] = Math.max(0, Math.min(255, b * 255));
    }
    x.putImageData(id, 0, 0); return c;
  }
  M9.applyOutfit = function (id) {
    const o = OUTFITS.find(q => q.id === id) || OUTFITS[0];
    for (const n of HAND) {
      if (!Engine.imgs[n]) continue;
      if (!ORIG[n]) ORIG[n] = Engine.imgs[n];
      if (o.id === 'baron') Engine.imgs[n] = ORIG[n];
      else Engine.imgs[n] = CACHE[o.id + n] || (CACHE[o.id + n] = recolor(ORIG[n], o));
    }
    for (const k in VM) if (VM[k] && HAND.includes(VM[k]._src)) delete VM[k];   // tinted copies (hurt flash) rebuild from the new art
    M9.outfit = o.id;
  };
  M9.outfitImg = function (id, n) { const o = OUTFITS.find(q => q.id === id); const src = ORIG[n] || Engine.imgs[n]; if (!o || !src) return null; if (o.id === 'baron') return src; return CACHE[o.id + n] || (CACHE[o.id + n] = recolor(src, o)); };
  M9.setOutfit = function (id) { const o = OUTFITS.find(q => q.id === id); if (!o || !o.ok()) return false; SAVE.m9.outfit = id; M9.write(); M9.applyOutfit(id); if (id !== 'baron') ACH.unlock('outfit'); return true; };
  // apply once the art is in (assets load async)
  const tryApply = () => { if (Engine.imgs.vm_rh3d && Engine.imgs.vm_rh3d.width) { const o = OUTFITS.find(q => q.id === SAVE.m9.outfit); M9.applyOutfit(o && o.ok() ? o.id : 'baron'); return true; } return false; };
  if (!tryApply()) { const iv = setInterval(() => { if (tryApply()) clearInterval(iv); }, 250); }

  // TRIALS: opt-in, off by default, only ever harder. No extra rewards beyond their feats.
  const TRIALS = [
    { id: 'glass', n: 'GLASS BONES', d: 'You take 50% more damage.' },
    { id: 'famine', n: 'FAMINE', d: 'All healing is halved.' },
    { id: 'tide', n: 'BLACK TIDE', d: 'Foes have 30% more health.' },
    { id: 'haste', n: 'FEVERED DEAD', d: 'Foes move 15% faster.' },
  ];
  M9.TRIALS = TRIALS;
  M9.trialsOpen = () => ACH.has('boss_vknight') || SAVE.stats.bosses > 0;
  const _mk = makeEnemy;
  makeEnemy = function (type, x, y, opt) {
    const e = _mk.apply(this, arguments);
    if (RUN.on && !RUN.hub && e && !e.d.boss && type !== 'phyl') {
      if (M9.trial('tide')) { e.hp = e.maxhp = Math.round(e.maxhp * 1.3); }
      if (M9.trial('haste')) e.d.speed *= 1.15;
    }
    return e;
  };
  let lastHp = null;
  M9.on('tick', () => {
    if (!RUN.on || RUN.hub || !M9.trial('famine')) { lastHp = null; return; }
    if (lastHp !== null && P.hp > lastHp && P.hp > 0) P.hp = lastHp + (P.hp - lastHp) * 0.5;
    lastHp = P.hp;
  });
  M9.on('stage', () => { lastHp = null; });

  // THE RUN RECORD: a second page on the results screen (TAB / pad Y flips it)
  const fmt = s => { s = s | 0; return ((s / 60) | 0) + ':' + String(s % 60).padStart(2, '0'); };
  M9.recordRows = function () {
    const r = RUN.m9 || M9.newStats(), relics = (RUN.picks || []).filter(id => { const u = UPG.find(q => q.id === id); return u && u.kind === 'RELIC'; }).length;
    const tr = TRIALS.filter(t => r.trials && r.trials[t.id]).map(t => t.n).join(', ');
    return [
      ['TIME', fmt(RUN.time), '#ffffff'], ['KILLS', String(RUN.kills), '#ffb0b0'], ['DAMAGE DEALT', String(Math.round(r.dmg)), '#ffd060'],
      ['DAMAGE TAKEN', String(Math.round(r.taken)), '#ff8090'], ['BOSSES FELLED', String(RUN.bosses || 0) + (r.saint ? '  + THE HOLLOW SAINT' : ''), '#e0b0ff'],
      ['RELICS', String(relics) + '   (' + (RUN.picks || []).length + ' boons)', '#a0ffd0'], ['BEST CHAIN', r.combo + ' HITS', '#ffe080'],
      ['FINISHERS', String(r.fin), '#ff6060'], ['PARRIES', String(r.parries), '#80d0ff'], ['SECRETS', String(RUN.secrets || 0), '#a0ffd0'],
      ['LORE PAGES', String(r.lore), '#d8c0a0'], ['TRIALS', !tr ? 'none' : tr.length > 26 ? tr.split(', ').length + ' ACTIVE' : tr, tr ? '#ff9a40' : '#806878'],
    ];
  };
  M9.drawRecord = function (ctx, x0, y0, colon) {
    let y = y0;
    for (const [k, v, c] of M9.recordRows()) { text(ctx, k, colon, y, '#f0c040', 'right'); fitBlock(ctx, v, colon + 12, y, W - colon - 30, 9, c, 'left'); y += 12; }
    return y;
  };
  let page = 0;
  const _ri = resultsInput;
  resultsInput = function (rdt) {
    if (!RUN.winScreen && RUN.resT > 0.5 && (KP.Tab || KP.PadY)) { page = page ? 0 : 1; SFX.play('swing', 0.25); }
    return _ri.apply(this, arguments);
  };
  const _dr = drawResults;
  drawResults = function (ctx) {
    if (RUN.winScreen || !page || RUN.resT < 0.3) { _dr.apply(this, arguments); if (!RUN.winScreen && RUN.resT > 1.2) { if (G.inputMode === 'pad') promptRow(ctx, ['{triangle}', ' RUN RECORD'], W - 6, 4, '#c8b8e0', 'right'); else text(ctx, 'TAB - RUN RECORD', W - 6, 4, '#c8b8e0', 'right'); } return; }
    ctx.fillStyle = RUN.won ? 'rgba(20,0,32,0.92)' : 'rgba(40,0,8,0.9)'; ctx.fillRect(0, 0, W, H);
    goldFrame(ctx, 70, 6, W - 140, H - 30, RUN.won ? '#ffd848' : '#d04060');
    text(ctx, 'RUN RECORD', W / 2 + 1, 13, '#2a0638', 'center', 2); text(ctx, 'RUN RECORD', W / 2, 12, '#ffe080', 'center', 2);
    M9.drawRecord(ctx, 90, 36, 226);
    if (G.inputMode === 'pad') promptRow(ctx, ['{triangle}', ' SUMMARY    ', '{cross}', ' THE CHAPEL'], W / 2, H - 16, '#ffffff', 'center');
    else text(ctx, 'TAB - SUMMARY     ENTER - THE CHAPEL', W / 2, H - 16, '#ffffff', 'center');
  };
  M9.on('runStart', () => { page = 0; });

  // THE HOLLOW SAINT: optional hidden boss. On one stage per run (5-8), the first secret room you break into holds him.
  const saintStage = () => 5 + ((RUN.seed >>> 3) % 4);
  M9.saintStage = saintStage;
  let found0 = 0;
  M9.on('stage', () => { found0 = 0; });
  M9.spawnSaint = function (x, y) {
    const e = makeEnemy('royalguard', x, y); makeElite(e, ['armored']);
    e.armorMul = 1; e.hp = e.maxhp = Math.round(1100 * (1 + 0.1 * (typeof abyssDepth === 'function' ? abyssDepth() : 0))); e.dmgMul = 1.3; e.w *= 1.15; e.h *= 1.15;
    e.saint = true; e.plateName = 'THE HOLLOW SAINT'; e.plateCol = '#e0c0ff'; e.awake = true; e.d.speed *= 1.1; e.noShards = false;
    G.enemies.push(e); RUN.m9.saintUp = true;
    SFX.play('toll'); SFX.play('ghost', 0.7); G.shake += 4; G.flashG = 0.4;
    toast('THE HOLLOW SAINT', '"I prayed here until the god left. Then I stayed."', '#e0c0ff', 4);
    for (let i = 0; i < 30; i++) addP({ k: 'ecto', x: e.x + rand(-0.6, 0.6), y: e.y + rand(-0.6, 0.6), z: e.z + rand(0, 2.4), vx: rand(-0.5, 0.5), vy: rand(-0.5, 0.5), vz: rand(0.5, 2), size: 0.09, col: RGB(220, 180, 255), life: 1.2 });
    return e;
  };
  M9.on('tick', () => {
    if (!RUN.on || RUN.hub || RUN.stage !== saintStage() || RUN.m9.saintUp || !LEVEL.secrets) return;
    const f = LEVEL.secrets.filter(q => q.found);
    if (f.length > found0) {
      const s = f[f.length - 1], b = s.box; let best = null, bd = 0;
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, rm = (LEVEL.rooms || []).find(r => r.kind === 'secret' && cx >= r.x0 && cx <= r.x1 + 1 && cy >= r.y0 && cy <= r.y1 + 1);
      const x0 = rm ? rm.x0 : b[0], x1 = rm ? rm.x1 + 1 : b[2], y0 = rm ? rm.y0 : b[1], y1 = rm ? rm.y1 + 1 : b[3];
      for (let y = Math.floor(y0); y < y1; y++) for (let x = Math.floor(x0); x < x1; x++) { const i = y * MW + x; if (SOLID[i]) continue; const d = Math.hypot(x + 0.5 - P.x, y + 0.5 - P.y); if (d > bd) { bd = d; best = [x + 0.5, y + 0.5]; } }
      found0 = f.length; if (best) { RUN.m9.saintUp = true; RUN.m9.saintAt = best; setTimeout(() => { if (RUN.on && RUN.stage === saintStage() && G.state === 'play') M9.spawnSaint(best[0], best[1]); }, 2600); }
    }
  });
  M9.on('kill', e => {
    if (!e.saint) return;
    RUN.m9.saint = true; SAVE.m9.saint = (SAVE.m9.saint || 0) + 1; ACH.unlock('saint');
    if (typeof shardGain === 'function') shardGain(40, null);
    grantRandomRelic(true); M9.say && M9.say('THE HOLLOW SAINT', '"Tell the god... I kept the candles lit..."', '#e0c0ff', 4.5);
    if (M9.giveLore) M9.giveLore('saint');
    G.hitstop = Math.max(G.hitstop, 0.25); G.shake += 6;
  });
  const _ev = enemyVisual;
  enemyVisual = function (e) { const v = _ev.apply(this, arguments); if (v && e.saint && !e.dead) { v.tint = [200, 160, 255, 0.4]; v.glow = Math.max(v.glow || 0, 0.25); } return v; };
  GAME.dbg.enemyVisual = enemyVisual;
})();

// ---------- STORY: lore pages, the prologue and the epilogue ----------
(function () {
  const LORE = [
    ['s1', 'THE FIRST CANDLE', 'They lit a candle for every pilgrim who walked into the cathedral. The candles ran out in the first winter. The pilgrims did not.'],
    ['s2', 'THE WEEPING WALLS', 'The catacomb stones sweat salt. The monks said it was grief. The Brood Mother says it is seasoning.'],
    ['s3', 'ON THE COLOSSUS', 'Ten thousand bones, one will. When the Lich called, the dead of the ossuary did not rise one by one. They rose as one.'],
    ['s4', 'THE BLOOD MOON', 'The moon turned red the night the Reliquary was taken. The wolves have not stopped singing about it since.'],
    ['s5', 'THE SILENT BELL', 'The great bell was cast to ring the day the Lich King falls. It has hung silent for four hundred years. Keep climbing.'],
    ['s6', 'BREAD AND BLOOD', 'The dead still fill the arena seats. They have no tongues to cheer with, so they knock their jaws together. It sounds like rain.'],
    ['s7', "MORWEN'S LEDGER", 'Every name in this city is written in her book, and beside each one a price. Beside yours she has written: not for sale.'],
    ['s8', 'THE HELLFORGE', 'Cerberax was a lapdog once, a gift to a queen. Then the queen died, and the dog kept eating.'],
    ['s9', "SIR VALCOR'S OATH", '"I swore to guard the throne until the last king died. Nobody told me the king would refuse to."'],
    ['s10', 'THE BLACK RELIQUARY', 'It holds the last sunrise. He locked it away so the dead would never see their own shadows. Take it back, Baron.'],
    ['saint', 'THE HOLLOW SAINT', 'He prayed so long that the god stopped listening. He kept praying anyway, to the silence. One night, the silence answered.'],
  ];
  M9.LORE = LORE;
  const S = () => SAVE.m9;
  M9.giveLore = function (id) {
    const L = LORE.find(q => q[0] === id); if (!L) return;
    const fresh = !S().lore[id]; S().lore[id] = 1; if (RUN.m9) RUN.m9.lore++; M9.write();
    SFX.play('glint', 0.7); SFX.play('pickup', 0.5);
    toast('LORE: ' + L[1], fresh ? 'A page for the Chapel lectern.' : 'You already know this one.', '#e8d8b0', 3);
    const n = LORE.filter(q => S().lore[q[0]]).length;
    if (n >= 5) ACH.unlock('lore5'); if (n >= LORE.length) ACH.unlock('loreall');
  };
  // procedural pixel art: a parchment page and the Chapel lectern
  function mkTex(n, w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x); Engine.imgs[n] = c; const dd = x.getImageData(0, 0, w, h); Engine.tex[n] = { w, h, d: new Uint32Array(dd.data.buffer) }; }
  const R = (x, c, a, b, w, h) => { x.fillStyle = c; x.fillRect(a, b, w, h); };
  mkTex('p_m9lore', 14, 18, x => {
    R(x, '#5a3a20', 1, 1, 12, 16); R(x, '#e8d8b0', 2, 1, 10, 15); R(x, '#c8b088', 2, 14, 10, 2); R(x, '#fff0d0', 3, 2, 8, 1);
    for (let i = 0; i < 5; i++) R(x, '#806048', 3, 4 + i * 2, i % 2 ? 6 : 8, 1);
    R(x, '#b01020', 8, 12, 4, 4); R(x, '#ff4050', 9, 13, 2, 1); R(x, '#600010', 8, 15, 4, 1);
  });
  mkTex('p_m9lectern', 24, 36, x => {
    R(x, '#2a140c', 9, 14, 6, 18); R(x, '#4a2614', 10, 14, 3, 18); R(x, '#2a140c', 4, 31, 16, 4); R(x, '#5a3018', 5, 31, 14, 2);
    R(x, '#3a1c0e', 1, 9, 22, 6); R(x, '#6a3a1c', 2, 9, 20, 2);
    R(x, '#e8d8b0', 2, 4, 9, 6); R(x, '#e8d8b0', 13, 4, 9, 6); R(x, '#c8b088', 11, 5, 2, 5); R(x, '#fff4d8', 3, 4, 7, 1); R(x, '#fff4d8', 14, 4, 7, 1);
    for (let i = 0; i < 2; i++) { R(x, '#806048', 3, 6 + i * 2, 6, 1); R(x, '#806048', 14, 6 + i * 2, 6, 1); }
    R(x, '#b01020', 11, 9, 2, 4); R(x, '#e0b850', 9, 13, 6, 1);
  });
  PICK.m9lore = { tex: 'p_m9lore', h: 0.42, gc: [255, 220, 150], f(p) { M9.giveLore(p.lore); return true; } };
  // one page per stage, in a far room off the main path
  M9.on('stage', () => {
    if (!RUN.on || RUN.hub || !(RUN.stage >= 1 && RUN.stage <= 10) || !LEVEL || !G.pickups) return;
    let sd = ((RUN.seed || 1) ^ (RUN.stage * 2654435761)) >>> 0; const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
    const ok = (x, y) => { const i = y * MW + x; return x > 0 && y > 0 && x < MW - 1 && !SOLID[i] && FH[i] === 0 && (typeof FT === 'undefined' || FT[i] !== 6); };
    const cand = [];
    for (const r of (LEVEL.rooms || [])) { if (r.kind === 'secret' || r.style === 'start') continue; for (let y = r.y0 + 1; y < r.y1; y++) for (let x = r.x0 + 1; x < r.x1; x++) if (ok(x, y)) { const d = Math.hypot(x + 0.5 - P.x, y + 0.5 - P.y); if (d > 8) cand.push([x, y, d]); } }
    if (!cand.length) for (let k = 0; k < 400; k++) { const x = 1 + ((rnd() * (MW - 2)) | 0), y = 1 + ((rnd() * (MH - 2)) | 0); if (ok(x, y) && Math.hypot(x - P.x, y - P.y) > 6 && (!G.boss || Math.hypot(x - G.boss.x, y - G.boss.y) > 9)) cand.push([x, y, 0]); }
    if (!cand.length) return;
    const c = cand[(rnd() * cand.length) | 0];
    const pk = mkPickup('m9lore', c[0] + 0.5, c[1] + 0.5); pk.drop = false; pk.vz = 0; pk.lore = 's' + RUN.stage; G.pickups.push(pk); M9.lorePk = pk;
  });

  // ----- the scenes (pixel panels, typed text) -----
  const SCENES = {
    intro: [
      { art: 'castle', lines: ['The year the sun went out, the Lich King took the Black Reliquary,', 'and the last sunrise with it.'] },
      { art: 'eyes', lines: ['Ten lieutenants guard the way down.', 'Cathedral. Catacomb. Ossuary. Belfry. Arena. Throne.'] },
      { art: 'kael', lines: ['Baron Kael has died three times already.', 'He keeps getting up. They call him THE UNYIELDING.'] },
    ],
    ending: [
      { art: 'crown', lines: ['The crown hits the floor.', 'For the first time in four hundred years, the throne is empty.'] },
      { art: 'dawn', lines: ['Kael opens the Reliquary.', 'The sky remembers how to be morning.'] },
      { art: 'kael', lines: ['But under the throne, something is still breathing.', 'The Unyielding does not rest.'] },
    ],
  };
  M9.SCENES = SCENES;
  const ART = {
    castle(ctx, t) {
      const g = ctx.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, '#0a0014'); g.addColorStop(1, '#3a0a3a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 200);
      ctx.fillStyle = '#d8c8f0'; ctx.beginPath(); ctx.arc(360, 52, 22, 0, TAU); ctx.fill(); ctx.fillStyle = '#0a0014'; ctx.beginPath(); ctx.arc(368, 48, 20, 0, TAU); ctx.fill();
      for (let i = 0; i < 40; i++) { ctx.fillStyle = i % 4 ? '#6a4a8a' : '#c0a0ff'; ctx.fillRect((i * 83) % W, (i * 37) % 120, 1, 1); }
      ctx.fillStyle = '#120618'; ctx.beginPath(); ctx.moveTo(0, 200); ctx.lineTo(80, 150); ctx.lineTo(200, 160); ctx.lineTo(300, 140); ctx.lineTo(480, 170); ctx.lineTo(480, 200); ctx.fill();
      ctx.fillStyle = '#05000a'; for (const [x, w, h] of [[150, 18, 70], [176, 40, 50], [222, 14, 90], [242, 36, 56], [284, 16, 74]]) { ctx.fillRect(x, 150 - h, w, h + 50); ctx.beginPath(); ctx.moveTo(x - 2, 150 - h); ctx.lineTo(x + w / 2, 150 - h - 16); ctx.lineTo(x + w + 2, 150 - h); ctx.fill(); }
      for (let i = 0; i < 6; i++) { ctx.fillStyle = Math.sin(t * 3 + i) > 0 ? '#90ffb0' : '#40a060'; ctx.fillRect(155 + i * 26, 118 + (i % 2) * 10, 2, 3); }
      for (let i = 0; i < 30; i++) { const y = (t * (12 + i % 7) + i * 29) % 200, x = (i * 61 + Math.sin(t + i) * 8) % W; ctx.fillStyle = 'rgba(160,140,180,0.6)'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
    },
    eyes(ctx, t) {
      ctx.fillStyle = '#05000a'; ctx.fillRect(0, 0, W, 200);
      const fl = Math.sin(t * 7) > 0.96; if (fl) { ctx.fillStyle = 'rgba(180,140,255,0.25)'; ctx.fillRect(0, 0, W, 200); }
      for (let i = 0; i < 10; i++) { const x = 40 + i * 44, y = 70 + Math.sin(i * 1.7) * 26, on = t * 3 > i; if (!on) continue; const a = Math.min(1, t * 3 - i);
        ctx.globalAlpha = a; ctx.fillStyle = i === 9 ? '#90ffb0' : '#ff2a40'; ctx.fillRect(x - 6, y, 4, 2); ctx.fillRect(x + 2, y, 4, 2); ctx.fillStyle = 'rgba(255,40,60,0.15)'; ctx.fillRect(x - 10, y - 3, 20, 8); ctx.globalAlpha = 1; }
    },
    kael(ctx, t) {
      const g = ctx.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, '#1a0010'); g.addColorStop(1, '#4a0818'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 200);
      ctx.fillStyle = 'rgba(255,60,60,0.18)'; ctx.beginPath(); ctx.arc(W / 2, 120, 70 + Math.sin(t * 2) * 4, 0, TAU); ctx.fill();
      const k = Engine.imgs.s_kael; if (k) { const sc = 160 / k.height; ctx.drawImage(k, Math.round(W / 2 - k.width * sc / 2), 200 - 160 + Math.round(Math.sin(t * 1.3) * 2), Math.round(k.width * sc), 160); }
      for (let i = 0; i < 24; i++) { const y = 200 - ((t * (18 + i % 5 * 6) + i * 23) % 200), x = (i * 47) % W; ctx.fillStyle = i % 3 ? '#ff6030' : '#ffd060'; ctx.fillRect(x, Math.round(y), 1, 2); }
    },
    crown(ctx, t) {
      ctx.fillStyle = '#08000e'; ctx.fillRect(0, 0, W, 200);
      ctx.fillStyle = '#1a0a24'; ctx.fillRect(170, 40, 140, 160); ctx.fillStyle = '#2a1238'; ctx.fillRect(180, 50, 120, 150);
      const y = Math.min(150, 20 + t * t * 120), sp = y >= 150 ? 0 : t * 6;
      ctx.save(); ctx.translate(W / 2, y); ctx.rotate(sp * 0.3);
      ctx.fillStyle = '#e0b850'; ctx.fillRect(-18, 0, 36, 10); for (const dx of [-18, -8, 2, 12]) { ctx.beginPath(); ctx.moveTo(dx, 0); ctx.lineTo(dx + 3, -12); ctx.lineTo(dx + 6, 0); ctx.fill(); }
      ctx.fillStyle = '#30e090'; ctx.fillRect(-3, 3, 6, 4); ctx.restore();
      if (y >= 150) { for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, r = Math.min(40, (t - 1.1) * 60); ctx.fillStyle = '#90ffb0'; ctx.fillRect(Math.round(W / 2 + Math.cos(a) * r), Math.round(156 + Math.sin(a) * r * 0.3), 2, 2); } }
    },
    dawn(ctx, t) {
      const k = Math.min(1, t / 3), g = ctx.createLinearGradient(0, 0, 0, 200);
      g.addColorStop(0, `rgb(${30 + 60 * k | 0},${10 + 20 * k | 0},${60 + 30 * k | 0})`); g.addColorStop(0.7, `rgb(${120 + 120 * k | 0},${40 + 90 * k | 0},${80 + 20 * k | 0})`); g.addColorStop(1, '#ffd080'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 200);
      ctx.fillStyle = '#fff0a0'; ctx.beginPath(); ctx.arc(W / 2, 200 - 30 * k, 26, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#1a0818'; ctx.beginPath(); ctx.moveTo(0, 200); ctx.lineTo(0, 168); ctx.lineTo(120, 176); ctx.lineTo(240, 164); ctx.lineTo(360, 178); ctx.lineTo(480, 166); ctx.lineTo(480, 200); ctx.fill();
      for (let i = 0; i < 12; i++) { ctx.fillStyle = `rgba(255,240,180,${0.15 * k})`; ctx.fillRect(W / 2 - 1, 0, 2, 200); ctx.save(); ctx.translate(W / 2, 200); ctx.rotate((i - 5.5) * 0.18); ctx.fillRect(-1, -260, 2, 260); ctx.restore(); }
    },
  };
  // modal UI piggybacks on the settings overlay (it already blocks game input and has its own canvas)
  const UI = M9.ui = { kind: null };
  M9.openScene = function (id, then) {
    UI.kind = 'scene'; UI.scene = SCENES[id]; UI.sid = id; UI.p = 0; UI.t = 0; UI.then = then || null;
    OPT.open = true; OPT.page = 'm9'; OPT.from = OPT.from || 'm9'; OPT.anim = 1; releaseAll && releaseAll();
  };
  M9.closeUI = function () {
    const then = UI.then; UI.kind = null; UI.then = null; OPT.open = false; OPT.page = 'main'; for (const k in KP) delete KP[k]; MBP[0] = false;
    if (then) then();
  };
  M9.sceneInput = function (rdt) {
    UI.t += rdt; const pn = UI.scene[UI.p], full = pn.lines.join(' ').length, shown = UI.t * 42;
    if (KP.Escape || KP.PadBack) { if (UI.sid === 'intro') S().introSeen = true; if (UI.sid === 'ending') S().endSeen = true; M9.write(); M9.closeUI(); return; }
    if (KP.Enter || KP.Space || KP.PadOK || MBP[0]) {
      if (shown < full) UI.t = full / 42 + 0.01;
      else if (UI.p < UI.scene.length - 1) { UI.p++; UI.t = 0; SFX.play('swing', 0.2); }
      else { if (UI.sid === 'intro') S().introSeen = true; if (UI.sid === 'ending') S().endSeen = true; M9.write(); M9.closeUI(); }
    }
  };
  M9.sceneDraw = function (ctx) {
    const pn = UI.scene[UI.p]; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.beginPath(); ctx.rect(20, 14, W - 40, 186); ctx.clip(); ctx.translate(0, 14); try { ART[pn.art](ctx, UI.t); } catch (e) { } ctx.restore();
    ctx.fillStyle = '#e0b850'; ctx.fillRect(20, 13, W - 40, 1); ctx.fillRect(20, 200, W - 40, 1);
    const k = Math.min(1, UI.t * 2); ctx.fillStyle = `rgba(0,0,0,${1 - k})`; ctx.fillRect(20, 14, W - 40, 186);
    let n = Math.floor(UI.t * 42), y = 210;
    for (const l of pn.lines) { const s = l.slice(0, Math.max(0, n)); n -= l.length + 1; if (s) fitBlock(ctx, s, W / 2 - fitW(l) / 2, y, W - 40, 9, '#f0e0ff', 'left'); y += 13; }
    ctx.fillStyle = '#806090'; for (let i = 0; i < UI.scene.length; i++) ctx.fillRect(W / 2 - UI.scene.length * 5 + i * 10, 242, 6, 2), i === UI.p && (ctx.fillStyle = '#ffe080', ctx.fillRect(W / 2 - UI.scene.length * 5 + i * 10, 242, 6, 2), ctx.fillStyle = '#806090');
    if (G.inputMode === 'pad') promptRow(ctx, ['{cross}', ' NEXT    ', '{circle}', ' SKIP'], W / 2, 252, '#a090b0', 'center');
    else text(ctx, 'ENTER - NEXT     ESC - SKIP', W / 2, 252, '#a090b0', 'center');
  };
  const fitW = l => Math.min(W - 40, typeof tfWidth === 'function' ? tfWidth(l, W - 40) : l.length * 8);
  // the prologue plays the first time you reach the Chapel; the epilogue before the first victory screen
  const _eh = enterHub;
  enterHub = function () {
    const r = _eh.apply(this, arguments);
    if (!S().introSeen && !(navigator.webdriver && !/[?&]scenes=1/.test(location.search)) && !/[?&]stage=/.test(location.search)) setTimeout(() => { if (G.state === 'play' && RUN.hub && !OPT.open) M9.openScene('intro'); }, 400);
    return r;
  };
  const _sw = startWin;
  startWin = function () {
    const r = _sw.apply(this, arguments);
    if (!S().endSeen && !(navigator.webdriver && !/[?&]scenes=1/.test(location.search))) M9.openScene('ending');
    return r;
  };
})();

// ---------- POLISH: the Codex (record, feats, lore, outfits, trials, story, credits), title, Chapel lectern, settings ----------
(function () {
  const UI = M9.ui, S = () => SAVE.m9;
  const TABS = ['RECORD', 'FEATS', 'LORE', 'GARB', 'TRIALS', 'STORY', 'CREDITS'];
  const PX = 20, PY = 8, PW = W - 40, PH = H - 16, CY = PY + 42, VIS = 14, RH = 13;
  M9.openCodex = function (tab, from) {
    UI.kind = 'codex'; UI.tab = typeof tab === 'number' ? tab : Math.max(0, TABS.indexOf(tab || 'RECORD')); UI.sel = 0; UI.top = 0; UI.t = 0; UI.then = null;
    OPT.open = true; OPT.page = 'm9'; OPT.from = from || 'title'; OPT.anim = 0; releaseAll && releaseAll();
    if (document.exitPointerLock) try { document.exitPointerLock(); } catch (e) { }
    SFX.init && SFX.init(); SFX.play('glint', 0.5);
  };
  const fmt = s => { s = s | 0; return ((s / 60) | 0) + ':' + String(s % 60).padStart(2, '0'); };
  function rows() {
    const t = TABS[UI.tab];
    if (t === 'FEATS') return ACH.list.map(a => ({ a }));
    if (t === 'LORE') return M9.LORE.map(l => ({ l }));
    if (t === 'GARB') return M9.OUTFITS.map(o => ({ o }));
    if (t === 'TRIALS') return M9.trialsOpen() ? M9.TRIALS.map(r => ({ r })) : [];
    if (t === 'STORY') return [{ s: 'intro', n: 'THE PROLOGUE', ok: true }, { s: 'ending', n: 'THE EPILOGUE', ok: !!(S().endSeen || SAVE.best.win) }];
    return [];
  }
  function act(r) {
    if (!r) return;
    if (r.o) { if (M9.setOutfit(r.o.id)) { SFX.play('clink', 0.5); } else SFX.play('hurt', 0.2); }
    else if (r.r) { S().trials[r.r.id] = !S().trials[r.r.id]; M9.write(); SFX.play('clink', 0.5); }
    else if (r.s && r.ok) { const back = UI.tab; M9.openScene(r.s, () => M9.openCodex(back, OPT.from)); }
  }
  M9.codexInput = function (rdt) {
    UI.t += rdt; OPT.anim = Math.min(1, OPT.anim + rdt * 6);
    const L = rows();
    const tabMove = d => { UI.tab = (UI.tab + d + TABS.length) % TABS.length; UI.sel = 0; UI.top = 0; SFX.play('clink', 0.25); };
    if (KP.ArrowLeft || KP.KeyA || KP.KeyQ) tabMove(-1);
    if (KP.ArrowRight || KP.KeyD || KP.KeyE || KP.Tab) tabMove(1);
    if (L.length) {
      if (KP.ArrowUp || KP.KeyW) UI.sel = (UI.sel + L.length - 1) % L.length;
      if (KP.ArrowDown || KP.KeyS) UI.sel = (UI.sel + 1) % L.length;
      if (UI.t > 0.2 && (KP.Enter || KP.Space || KP.PadOK)) act(L[UI.sel]);
    }
    // mouse: click a tab, or a row
    const mx = OPT.mx, my = OPT.my;
    if (MBP[0] && mx >= 0) {
      const tw = Math.floor((PW - 12) / TABS.length);
      if (my >= PY + 24 && my < PY + 36 && mx >= PX + 6 && mx < PX + 6 + tw * TABS.length) { UI.tab = Math.floor((mx - PX - 6) / tw); UI.sel = 0; UI.top = 0; SFX.play('clink', 0.25); }
      else if (L.length && my >= CY && my < CY + VIS * RH && mx < (TABS[UI.tab] === 'FEATS' ? PX + PW : PX + 200)) { const i = UI.top + Math.floor((my - CY) / RH); if (L[i]) { if (UI.sel === i) act(L[i]); UI.sel = i; } }
    }
    if (UI.sel < UI.top) UI.top = UI.sel; if (UI.sel >= UI.top + VIS) UI.top = UI.sel - VIS + 1;
    if (KP.Escape || KP.PadBack || KP.Backspace || KP.KeyC) { SFX.play('clink', 0.25); M9.closeUI(); return; }
    if (KP.PadStart && OPT.from === 'pause') { M9.closeUI(); G.paused = false; }
  };
  function drawRows(ctx, L, x, w, draw) {
    for (let j = 0; j < VIS; j++) { const i = UI.top + j, r = L[i]; if (!r) break; const y = CY + j * RH, sel = i === UI.sel;
      if (sel) { ctx.fillStyle = 'rgba(160,80,255,0.32)'; ctx.fillRect(x, y - 2, w, RH); ctx.fillStyle = '#f0c040'; ctx.fillRect(x, y - 2, 2, RH); }
      draw(r, x + 6, y, sel); }
    if (L.length > VIS) { const h = VIS * RH, th = Math.max(10, h * VIS / L.length), ty = CY - 2 + (h - th) * UI.top / (L.length - VIS); ctx.fillStyle = 'rgba(154,124,200,0.3)'; ctx.fillRect(x + w + 2, CY - 2, 2, h); ctx.fillStyle = '#c8a0ff'; ctx.fillRect(x + w + 2, Math.round(ty), 2, Math.round(th)); }
  }
  M9.codexDraw = function (ctx) {
    const a = 0.35 + 0.65 * OPT.anim;
    ctx.fillStyle = `rgba(10,0,20,${(G.state === 'title' ? 0.97 : 0.88) * a})`; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = a;
    goldFrame(ctx, PX, PY, PW, PH, '#c060ff');
    text(ctx, 'CODEX', W / 2, PY + 7, '#ffe080', 'center', 2);
    const tw = Math.floor((PW - 12) / TABS.length);
    TABS.forEach((t, i) => { const x = PX + 6 + i * tw, on = i === UI.tab; ctx.fillStyle = on ? 'rgba(160,80,255,0.5)' : 'rgba(40,10,60,0.6)'; ctx.fillRect(x + 1, PY + 24, tw - 2, 12); if (on) { ctx.fillStyle = '#f0c040'; ctx.fillRect(x + 1, PY + 35, tw - 2, 1); } fitBlock(ctx, t, x + tw / 2, PY + 26, tw - 6, 9, on ? '#ffffff' : '#a890c8', 'center'); });
    const T = TABS[UI.tab], L = rows(), cx = PX + 12, cw = PW - 24;
    if (T === 'RECORD') {
      const st = SAVE.stats, b = SAVE.best, nLore = M9.LORE.filter(l => S().lore[l[0]]).length;
      const R2 = [['RUNS', st.runs], ['VICTORIES', st.wins || 0], ['FURTHEST', 'STAGE ' + (b.stage || 0)], ['FASTEST VICTORY', b.win ? fmt(b.win) : '--'], ['DEEPEST ABYSS', S().abyssBest ? 'DEPTH ' + S().abyssBest : '--'],
        ['FOES SLAIN', st.kills], ['ELITES SLAIN', st.elites], ['BOSSES FELLED', st.bosses], ['SECRETS FOUND', st.secrets], ['SHARDS EARNED', st.shards],
        ['FINISHERS', S().fin], ['PARRIES', S().parries], ['BEST CHAIN', S().bestCombo + ' HITS'], ['FEATS', ACH.count() + ' / ' + ACH.list.length], ['LORE PAGES', nLore + ' / ' + M9.LORE.length], ['HOLLOW SAINT', S().saint ? 'SLAIN x' + S().saint : 'unseen']];
      R2.forEach(([k, v], i) => { const col = i < 8 ? 0 : 1, y = CY + (i % 8) * 16, x = col ? 372 : 158; text(ctx, k, x, y, '#f0c040', 'right'); fitBlock(ctx, String(v), x + 8, y, col ? 70 : 76, 9, '#ffffff', 'left'); });
    } else if (T === 'FEATS') {
      text(ctx, ACH.count() + ' / ' + ACH.list.length + ' UNLOCKED', PX + PW - 14, PY + 7, '#80ffb0', 'right');
      drawRows(ctx, L, cx, cw - 6, (r, x, y, sel) => { const on = ACH.has(r.a.id);
        ctx.fillStyle = on ? '#30e090' : '#3a2048'; ctx.fillRect(x, y + 1, 7, 7); if (on) { ctx.fillStyle = '#d0ffe0'; ctx.fillRect(x + 2, y + 3, 3, 3); }
        fitBlock(ctx, r.a.n, x + 12, y, 160, 9, on ? '#ffe080' : (sel ? '#c8b8e0' : '#806890'), 'left'); fitBlock(ctx, r.a.d, x + 178, y, cw - 192, 9, on ? '#e8e0f0' : '#806890', 'left'); });
    } else if (T === 'LORE') {
      drawRows(ctx, L, cx, 176, (r, x, y, sel) => { const on = S().lore[r.l[0]]; fitBlock(ctx, on ? r.l[1] : '- unfound -', x, y, 164, 9, on ? (sel ? '#ffffff' : '#e8d8b0') : '#806890', 'left'); });
      const r = L[UI.sel], on = r && S().lore[r.l[0]]; const bx = cx + 190, bw = PX + PW - 12 - bx;
      ctx.fillStyle = 'rgba(232,216,176,0.08)'; ctx.fillRect(bx, CY - 2, bw, VIS * RH);
      if (on) { fitBlock(ctx, r.l[1], bx + bw / 2, CY + 4, bw - 12, 9, '#ffe080', 'center'); fitBlock(ctx, r.l[2], bx + bw / 2, CY + 22, bw - 16, 130, '#e8d8b0', 'center', 1, 11); }
      else fitBlock(ctx, r && r.l[0] === 'saint' ? 'Somewhere a saint still prays. Find him.' : 'One page waits on each stage. Look in the far rooms.', bx + bw / 2, CY + 40, bw - 16, 40, '#806890', 'center', 1, 11);
    } else if (T === 'GARB') {
      drawRows(ctx, L, cx, 176, (r, x, y, sel) => { const ok = r.o.ok(), wear = S().outfit === r.o.id; fitBlock(ctx, (wear ? '> ' : '') + r.o.n, x, y, 164, 9, ok ? (wear ? '#80ffb0' : sel ? '#ffffff' : '#e8e0f0') : '#806890', 'left'); });
      const r = L[UI.sel]; const bx = cx + 190, bw = PX + PW - 12 - bx;
      if (r) { const ok = r.o.ok();
        const im = M9.outfitImg ? M9.outfitImg(r.o.id, 'vm_rh3d') : null; if (im) { ctx.drawImage(im, 0, 0, 128, 128, Math.round(bx + bw / 2 - 52), CY - 6, 104, 104); }
        fitBlock(ctx, r.o.d, bx + bw / 2, CY + 104, bw - 12, 20, '#e8e0f0', 'center', 1, 10);
        fitBlock(ctx, ok ? (S().outfit === r.o.id ? 'WORN' : 'ENTER - WEAR') : 'LOCKED: ' + r.o.how, bx + bw / 2, CY + 132, bw - 12, 20, ok ? '#80ffb0' : '#ff9a60', 'center', 1, 10);
        fitBlock(ctx, 'Palette only. Same poses.', bx + bw / 2, CY + 160, bw - 12, 9, '#806890', 'center'); }
    } else if (T === 'TRIALS') {
      if (!L.length) fitBlock(ctx, 'Fell the Vampire Knight to open the Trials.', W / 2, CY + 60, cw - 40, 20, '#806890', 'center');
      else {
        drawRows(ctx, L, cx, cw - 6, (r, x, y, sel) => { const on = !!S().trials[r.r.id];
          ctx.fillStyle = on ? '#ff6030' : '#3a2048'; ctx.fillRect(x, y + 1, 7, 7); fitBlock(ctx, r.r.n, x + 12, y, 130, 9, on ? '#ffb060' : sel ? '#ffffff' : '#c8b8e0', 'left');
          fitBlock(ctx, r.r.d, x + 150, y, cw - 210, 9, '#e8e0f0', 'left'); text(ctx, on ? 'ON' : 'OFF', PX + PW - 22, y, on ? '#ff9a40' : '#806890', 'right'); });
        fitBlock(ctx, 'Trials are off by default and only make a run harder. They start with your next run.', W / 2, CY + 80, cw - 40, 20, '#a090b0', 'center', 1, 10);
      }
    } else if (T === 'STORY') {
      drawRows(ctx, L, cx, 200, (r, x, y, sel) => fitBlock(ctx, r.ok ? r.n : '- sealed -', x, y, 190, 9, r.ok ? (sel ? '#ffffff' : '#e8e0f0') : '#806890', 'left'));
      fitBlock(ctx, 'Replay the scenes you have earned.', cx + 300, CY + 4, 200, 20, '#a090b0', 'center', 1, 10);
    } else if (T === 'CREDITS') {
      let y = CY + 2; const C = (s, c, sc = 1) => { text(ctx, s, W / 2, y, c, 'center', sc); y += sc === 2 ? 20 : 12; };
      C('THE UNYIELDING', '#ff4060', 2); y += 2;
      C('CREATED BY', '#a090b0'); C('BEER-FAST', '#ffe080'); y += 4;
      C('MUSIC BY', '#a090b0'); C('BEER-FAST', '#ffe080'); y += 4;
      C('SOUND EFFECTS', '#a090b0'); C('made with ElevenLabs', '#e8e0f0'); y += 4;
      C('THANK YOU FOR PLAYING', '#a0ffb0');
    }
    const hint = G.inputMode === 'pad' ? null : (T === 'GARB' || T === 'TRIALS' || T === 'STORY' ? 'LEFT/RIGHT TABS   UP/DOWN   ENTER SELECT   ESC BACK' : 'LEFT/RIGHT TABS   UP/DOWN SCROLL   ESC BACK');
    if (hint) text(ctx, hint, W / 2, PY + PH - 14, '#a090b0', 'center'); else promptRow(ctx, ['D-PAD TABS    ', '{cross}', ' SELECT    ', '{circle}', ' BACK'], W / 2, PY + PH - 14, '#a090b0', 'center');
    ctx.restore();
  };
  // hook into the settings overlay
  const _oi = OPT.input, _od = OPT.draw;
  OPT.input = function (rdt) { if (this.page !== 'm9') return _oi.apply(this, arguments); if (UI.kind === 'scene') M9.sceneInput(rdt); else M9.codexInput(rdt); if (OPT.page === 'm9') { for (const k in KP) delete KP[k]; MBP[0] = false; } };
  OPT.draw = function (ctx) { if (this.page !== 'm9') return _od.apply(this, arguments); if (UI.kind === 'scene') M9.sceneDraw(ctx); else M9.codexDraw(ctx); };
  // entry points: title (C / pad square), pause menu, the Chapel lectern
  addEventListener('keydown', e => { if (e.code === 'KeyC' && G.state === 'title' && !OPT.open && !e.repeat) M9.openCodex('RECORD', 'title'); });
  const PM_I = PM_ITEMS.findIndex(i => i.id === 'sets');
  PM_ITEMS.splice(PM_I + 1, 0, { id: 'codex', label: () => 'CODEX  >' });
  const _pm = pmAct;
  pmAct = function (id, dir) { if (id === 'codex') { if (!dir || dir > 0) M9.openCodex('RECORD', 'pause'); return; } return _pm.apply(this, arguments); };
  // lectern in the Chapel's west aisle: walk up to it to read your lore
  const LX = 4.5, LY = 10.5; let armed = true;
  M9.on('sprites', X => { if (RUN.hub && LEVEL.kind === 'hub') X.push({ tex: 'p_m9lectern', x: LX, y: LY, z: floorAt(LX, LY), w: 0.8, h: 1.2, glow: 0.04 + 0.03 * Math.sin(G.t * 2) }); });
  M9.on('tick', () => {
    if (!RUN.hub || LEVEL.kind !== 'hub' || G.state !== 'play') return;
    const d = Math.hypot(P.x - LX, P.y - LY);
    if (!armed && d > 1.9) armed = true;
    if (armed && d < 1.05) { armed = false; M9.openCodex('LORE', 'hub'); }
    if (d < 2.6 && Math.random() < 0.08) addP({ k: 'ember', x: LX + rand(-0.2, 0.2), y: LY + rand(-0.2, 0.2), z: floorAt(LX, LY) + 1.2, vx: 0, vy: 0, vz: 0.4, size: 0.03, col: RGB(255, 220, 150), life: 0.8 });
  });
  // a pickup-style glint for lore pages so they read from across a room
  M9.on('tick', () => { const p = M9.lorePk; if (p && !p.taken && Math.random() < 0.12) addP({ k: 'spark', x: p.x + rand(-0.15, 0.15), y: p.y + rand(-0.15, 0.15), z: p.z + 0.5, vx: 0, vy: 0, vz: 0.6, size: 0.03, col: RGB(255, 230, 160), life: 0.6 }); });
  // settings: sound on/off now persists with the rest (tu_settings)
  if (OPT.S.muted !== undefined) SFX.muted = !!OPT.S.muted;
  const _r = render;
  let lastMute = SFX.muted;
  render = function (rdt) { if (G.state === 'title' && !OPT.open && KP.PadRestart) { delete KP.PadRestart; M9.openCodex('RECORD', 'title'); } if (lastMute !== SFX.muted) { lastMute = SFX.muted; OPT.S.muted = !!SFX.muted; try { OPT.save(); } catch (e) { } } return _r.apply(this, arguments); };
  // title: animated layer (lightning, drifting bats, rising souls) + the codex hint
  const bats = Array.from({ length: 7 }, (_, i) => ({ x: (i * 79) % W, y: 30 + (i * 23) % 60, s: 14 + i * 3, p: i }));
  M8DRAW.unshift(function (ctx, rdt) {
    if (G.state !== 'title' || OPT.open) return false;
    const t = G.t;
    const bolt = (Math.sin(t * 0.9) > 0.985) || (Math.sin(t * 1.37 + 1) > 0.992);
    if (bolt) { ctx.fillStyle = 'rgba(200,170,255,0.18)'; ctx.fillRect(0, 0, W, H); }
    for (const b of bats) { const x = ((b.x + t * b.s) % (W + 40)) - 20, y = b.y + Math.sin(t * 2 + b.p) * 6, f = Math.sin(t * 14 + b.p) > 0;
      ctx.fillStyle = '#12061a'; ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 2); ctx.fillRect(Math.round(x) - (f ? 5 : 4), Math.round(y) - (f ? 2 : 0), 4, 1); ctx.fillRect(Math.round(x) + 2, Math.round(y) - (f ? 2 : 0), 4, 1); }
    for (let i = 0; i < 18; i++) { const y = H - ((t * (10 + i % 6 * 4) + i * 37) % (H + 20)), x = 200 + (i * 53) % 280 + Math.sin(t + i) * 4; ctx.fillStyle = i % 3 ? 'rgba(140,255,170,0.55)' : 'rgba(200,140,255,0.6)'; ctx.fillRect(Math.round(x), Math.round(y), 1, 2); }
    if (G.inputMode === 'pad') promptRow(ctx, ['{square}', ' CODEX'], 6, 16, '#c8b8e0', 'left'); else text(ctx, 'C  CODEX', 6, 16, '#c8b8e0', 'left');
    const n = ACH.count(); if (n) text(ctx, n + '/' + ACH.list.length + ' FEATS', W - 6, H - 10, '#80c0a0', 'right');
    return true;
  });
  // pad square on the title opens the codex
})();
