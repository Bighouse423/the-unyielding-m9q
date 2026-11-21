// ===== M9D: boss fight song ("Shadow Blades", BEER-FAST) =====
// The song itself lives in audio/audio.json -> tracks.shadowblades (lazy) and the "boss" / "boss_abyss" music slots, so
// SFX.fileMusic crossfades stage music <-> boss song whenever SFX.mus.boss flips. This file only keeps that flag honest:
//  - loads the lazy track once a stage is being played (never on the title screen)
//  - boss flag ON while the arena gate is sealed and the boss lives (backs up every boss intro, incl. Abyss bosses)
//  - boss flag OFF on boss kill, player death, results / pick / title, so the song fades out and stage music returns
// No gameplay / balance / visual changes.
(function () {
  const M9D = window.M9D = { log: [], st: 'off', poll: 0 };
  const sealed = () => { const g = typeof LEVEL !== 'undefined' && LEVEL && LEVEL.doors && LEVEL.doors.gate; return !!(g && g.state === 'sealed'); };
  const bossAlive = () => { const b = typeof G !== 'undefined' && G.boss; return !!(b && b.alive && !b.dead && b.hp > 0); };
  const note = (ev) => { M9D.log.push({ ev, t: +(performance.now() / 1000).toFixed(2), stage: typeof RUN !== 'undefined' ? RUN.stage : null, state: G.state, cur: SFX.fm ? SFX.fm.name : null }); if (M9D.log.length > 60) M9D.log.shift(); };
  function tick() {
    try {
      if (typeof SFX === 'undefined' || !SFX.ctx || !SFX.mus || typeof G === 'undefined') return;
      const play = G.state === 'play';
      if (play && SFX.lazyQ && SFX.lazyQ.length) { SFX.loadLazy(); note('lazyload'); }
      const m = SFX.mus;
      if (m.boss && (!play || !bossAlive() || (typeof P !== 'undefined' && P.hp <= 0))) { m.boss = false; note('boss-off'); }
      else if (!m.boss && play && sealed() && bossAlive() && !(typeof P !== 'undefined' && P.hp <= 0)) { m.boss = true; note('boss-on(seal)'); }
      const st = m.boss ? 'boss' : 'stage';
      if (st !== M9D.st) { if (st === 'boss' && M9D.log.length && M9D.log[M9D.log.length - 1].ev !== 'boss-on(seal)') note('boss-on(intro)'); M9D.st = st; }
      const cur = SFX.fm ? SFX.fm.name : null;
      if (cur !== M9D.cur) { M9D.cur = cur; note('track:' + cur); }
    } catch (e) { }
  }
  setInterval(tick, 200);
  // debug / bot read-out
  M9D.state = () => ({ boss: !!(SFX.mus && SFX.mus.boss), track: SFX.fm ? SFX.fm.name : null, gain: SFX.fm ? +SFX.fm.g.gain.value.toFixed(3) : null,
    lazy: SFX.lazyState || null, queued: (SFX.lazyQ || []).length, muted: !!SFX.muted, musicOn: SFX.musicOn !== false });
})();
