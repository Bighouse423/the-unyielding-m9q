// M7B debug launch: index.html?stage=9&kit=beefy  -> skips title + Chapel, drops a strong late-run Baron straight into that stage.
// Debug runs never write saved progress (shards, unlocks, best stage): every localStorage write except pad settings is ignored.
(function () {
  const Q = new URLSearchParams(location.search), KIT = Q.get('kit') || '';
  // M8a: stage=abyss (&depth=N) starts right after the Lich King, as if you picked DESCEND INTO THE ABYSS
  const ABY = (Q.get('stage') || '').toLowerCase() === 'abyss', DEPTH = Math.max(1, Math.min(20, parseInt(Q.get('depth') || '1', 10) || 1));
  const ST = ABY ? (typeof M7_LAST !== 'undefined' ? M7_LAST : 10) + DEPTH : parseInt(Q.get('stage') || '0', 10);
  if (!(ST >= 1) && !KIT) return;
  window.DEBUGRUN = { stage: Math.max(1, Math.min(30, ST || 1)), kit: KIT, abyss: ABY ? DEPTH : 0 };
  const _set = Storage.prototype.setItem, _rm = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) { if (k === 'tu_pad') return _set.call(this, k, v); };
  Storage.prototype.removeItem = function () { };
  const KITS = {
    beefy: ['crossbow', 'rubysword', 'bloodwhip', 'saintsedge', 'whetstone', 'whetstone', 'ironheart', 'ironheart', 'ironheart', 'martyrcup', 'bloodletter',
      'quicksilver', 'soulvessel', 'rosary', 'silverbolts', 'repeater', 'thornmail', 'moonrose', 'soulsiphon', 'hellfang', 'lastrites'],
  };
  function go() {
    if (typeof G === 'undefined' || G.state !== 'title') { setTimeout(go, 100); return; }
    try { SFX.init(); } catch (e) { }
    newRun();
    for (const id of (KITS[KIT] || [])) { const u = UPG.find(x => x.id === id); if (u) { u.take(); RUN.picks.push(u.id); } }
    if (KIT === 'beefy') { P.maxhp = Math.max(P.maxhp, 250); P.off = 'shield'; }
    const n = window.DEBUGRUN.stage;
    if (n > 10) { RUN.won = true; RUN.winScreen = false; RUN.retired = false; }
    if (n > 1) { RUN.stage = n - 1; nextStage(); }
    RUN.shardsRun = 0; P.hp = P.maxhp; P.mana = P.maxmana; G.toasts.length = 0;
    if (ABY) { try { SFX.ev('abyss_descend', 1, ['ghost', 'heavy']); } catch (e) { } }
    toast('DEBUG RUN', (ABY ? 'Abyss depth ' + DEPTH : 'Stage ' + n) + (KIT ? '  -  kit: ' + KIT.toUpperCase() : '') + '  -  progress is NOT saved', '#80ffb0', 4);
    // a click anywhere unlocks audio (browsers need a gesture)
    addEventListener('pointerdown', () => { try { SFX.init(); if (SFX.ctx && SFX.ctx.resume) SFX.ctx.resume(); } catch (e) { } }, { once: true });
  }
  go();
})();
