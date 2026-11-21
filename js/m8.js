// M8 polish: SETTINGS (title + pause), key rebinding, FPS counter, blood amount, accessibility shake/flash scales.
// Saved in its own key (tu_settings) and applied live every frame. Nothing here touches balance.
(function () {
  const KEY = 'tu_settings';
  const DEF = { master: 1, music: 1, sfx: 1, sens: 1, invY: false, fov: 77, shake: 2, flash: 2, blood: 2, fx: true, fps: false, tips: true, hd: true, wfx: 2, atm: 2, nav: 1, mmap: true, binds: {} };
  const ACTS = [   // rebindable actions: [id, label, default code the game reads]
    ['fwd', 'MOVE FORWARD', 'KeyW'], ['back', 'MOVE BACK', 'KeyS'], ['left', 'STRAFE LEFT', 'KeyA'], ['right', 'STRAFE RIGHT', 'KeyD'],
    ['jump', 'JUMP', 'Space'], ['run', 'RUN (HOLD)', 'ShiftLeft'], ['sword', 'SWORD', 'KeyJ'], ['off', 'OFF-HAND', 'KeyK'],
    ['swap', 'SWAP WHIP / SHIELD', 'Tab'], ['shield', 'QUICK SHIELD', 'KeyF'], ['roll', 'ROLL', 'KeyV'], ['side', 'HOLY SIDEARM', 'KeyR'],
  ];
  const LV3 = ['OFF', 'LOW', 'FULL'], BL3 = ['MINIMAL', 'REDUCED', 'FULL'];
  let S = Object.assign({}, DEF, { binds: {} });
  try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && typeof o === 'object') { S = Object.assign(S, o); S.binds = Object.assign({}, o.binds || {}); } } catch (e) { }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const keyName = c => !c ? '-' : c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : ({ Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT', Tab: 'TAB', Enter: 'ENTER', Backspace: 'BKSP', CapsLock: 'CAPS', ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\' })[c] || c.replace(/^Numpad/, 'NUM ').toUpperCase().slice(0, 8);
  const bindOf = a => S.binds[a[0]] || a[2];
  function rebuildMap() {
    for (const k in KEYMAP) delete KEYMAP[k];
    for (const a of ACTS) { const cur = bindOf(a); if (cur !== a[2]) KEYMAP[cur] = a[2]; }
    for (const a of ACTS) { const cur = bindOf(a); if (cur !== a[2] && !(a[2] in KEYMAP)) KEYMAP[a[2]] = 'Unbound_' + a[2]; }
    if (typeof releaseAll === 'function') releaseAll();
  }
  function assign(id, code) {
    const a = ACTS.find(x => x[0] === id); const old = bindOf(a);
    const other = ACTS.find(x => x[0] !== id && bindOf(x) === code);
    if (other) { if (old === other[2]) delete S.binds[other[0]]; else S.binds[other[0]] = old; }   // swap so nothing is lost
    if (code === a[2]) delete S.binds[id]; else S.binds[id] = code;
    rebuildMap(); save();
  }
  // ---------- live application ----------
  const HDQ = (() => { const m = /[?&]hd=([01])/.exec(location.search); return m ? m[1] === '1' : null; })();
  if (/[?&]hdlock=1/.test(location.search) && (typeof GFX !== "undefined")) GFX.hdLock = true;
  const FOVK = f => (W / 2) / Math.tan(f * Math.PI / 360);
  let lastVol = '';
  function apply() {
    PROJ = S.fov === 77 ? 300 : FOVK(S.fov);   // 77 = the original 300px focal length, untouched
    if (G.sens !== S.sens) { if (OPT.syncSens) { S.sens = G.sens; save(); } else G.sens = S.sens; }
    OPT.syncSens = true;
    if (FX.on !== S.fx) { S.fx = FX.on; save(); }
    // M9a: HD world render (2x internal). ?hd=0/1 overrides for testing; a too-slow machine drops to Classic for the session
    if (typeof setRenderScale === 'function') { const want = HDQ !== null ? HDQ : (S.hd !== false && !((typeof GFX !== "undefined") && GFX.hdOff)); if (setRenderScale(want ? 2 : 1)) resize(); }
    if (SFX.ctx && SFX.out) {
      const v = S.master + ',' + S.music + ',' + S.sfx;
      if (v !== lastVol) { lastVol = v; const t = SFX.ctx.currentTime; SFX.out.gain.setTargetAtTime(0.6 * S.master * S.master, t, 0.03); SFX.master.gain.setTargetAtTime(S.sfx * S.sfx, t, 0.03); SFX.musVol.gain.setTargetAtTime(S.music * S.music, t, 0.03); }
    }
  }
  // blood amount: fewer particles / decals / screen splats (purely cosmetic)
  const BK = () => [0.25, 0.55, 1][S.blood];
  const pr = n => { const k = BK(); if (k >= 1) return n; const f = n * k; return Math.floor(f) + (Math.random() < f % 1 ? 1 : 0); };
  const _spray = spray; spray = function (x, y, z, dx, dy, dz, n, spd, spread, mat, big) { if (mat === undefined || mat === 'flesh' || mat === 'blood') n = pr(n); return _spray(x, y, z, dx, dy, dz, n, spd, spread, mat, big); };
  const _ss = screenSplat; screenSplat = function (n, big) { return _ss(pr(n), big); };
  const _pf = paintFloor; paintFloor = function (x, y, rad, amt) { if (S.blood < 2 && Math.random() > [0.3, 0.6][S.blood]) return; return _pf(x, y, rad, amt); };
  const _pw = paintWall; paintWall = function (key, u, z, rad, amt, drip) { if (S.blood < 2 && Math.random() > [0.3, 0.6][S.blood]) return; return _pw(key, u, z, rad, amt, drip); };
  // invert mouse Y
  const _up = updatePlayer; updatePlayer = function (dt) { if (S.invY) mouseDY = -mouseDY; return _up(dt); };

  // ---------- menu model ----------
  const R = [];   // rows of the current page: {t:'hdr'|'slider'|'opt'|'btn'|'key', ...}
  function rowsMain() {
    return [
      { t: 'hdr', l: 'AUDIO' },
      { t: 'slider', id: 'master', l: 'MASTER VOLUME' }, { t: 'slider', id: 'music', l: 'MUSIC VOLUME' }, { t: 'slider', id: 'sfx', l: 'SFX VOLUME' },
      { t: 'hdr', l: 'VIDEO' },
      { t: 'opt', id: 'hd', l: 'RESOLUTION', v: () => S.hd !== false ? ((typeof GFX !== "undefined") && GFX.hdOff ? 'CLASSIC (AUTO)' : 'HD 2X') : 'CLASSIC' },
      { t: 'opt', id: 'fov', l: 'FIELD OF VIEW', v: () => S.fov === 77 ? '77 DEFAULT' : S.fov + '' },
      { t: 'opt', id: 'shake', l: 'SCREEN SHAKE', v: () => LV3[S.shake] },
      { t: 'opt', id: 'flash', l: 'SCREEN FLASHES', v: () => LV3[S.flash] },
      { t: 'opt', id: 'blood', l: 'BLOOD AMOUNT', v: () => BL3[S.blood] },
      { t: 'opt', id: 'fx', l: 'GLOW & COLOUR FX', v: () => FX.on ? 'ON' : 'OFF' },
      { t: 'opt', id: 'wfx', l: 'WEAPON FX', v: () => ['OFF', 'LITE', 'FULL'][S.wfx === undefined ? 2 : S.wfx] },
      { t: 'opt', id: 'atm', l: 'ATMOSPHERE', v: () => ['OFF', 'LITE', 'FULL'][S.atm === undefined ? 2 : S.atm] },
      { t: 'opt', id: 'nav', l: 'WAYFINDING', v: () => ['OFF', 'SUBTLE', 'FULL'][S.nav === undefined ? 1 : S.nav] },
      { t: 'opt', id: 'mmap', l: 'MINIMAP', v: () => S.mmap === false ? 'OFF' : 'ON' },
      { t: 'opt', id: 'fps', l: 'SHOW FPS', v: () => S.fps ? 'ON' : 'OFF' },
      { t: 'opt', id: 'full', l: 'FULLSCREEN', v: () => document.fullscreenElement ? 'ON' : 'OFF' },
      { t: 'hdr', l: 'CONTROLS' },
      { t: 'opt', id: 'sens', l: 'MOUSE SENSITIVITY', v: () => (G.sens || 1).toFixed(1) },
      { t: 'opt', id: 'invY', l: 'INVERT MOUSE Y', v: () => S.invY ? 'ON' : 'OFF' },
      { t: 'btn', id: 'keys', l: 'KEY BINDINGS  >' },
      { t: 'btn', id: 'pad', l: 'CONTROLLER  >' },
      { t: 'hdr', l: 'HELP' },
      { t: 'opt', id: 'tips', l: 'FIRST-TIME TIPS', v: () => S.tips ? 'ON' : 'OFF' },
      { t: 'btn', id: 'rtips', l: 'SHOW ALL TIPS AGAIN' },
      { t: 'btn', id: 'reset', l: 'RESET SETTINGS TO DEFAULT' },
      { t: 'btn', id: 'back', l: '<  BACK' },
    ];
  }
  function rowsKeys() {
    const r = ACTS.map(a => ({ t: 'key', id: a[0], l: a[1], v: () => keyName(bindOf(a)) }));
    r.push({ t: 'btn', id: 'rkeys', l: 'RESET KEYS TO DEFAULT' }, { t: 'btn', id: 'kback', l: '<  BACK' });
    return r;
  }
  function rowsPad() {
    return PM_PAD.filter(it => it.id !== 'pback').map(it => ({ t: 'pad', id: it.id, l: it.label })).concat([{ t: 'btn', id: 'kback', l: '<  BACK' }]);
  }
  const OPT = window.OPT = {
    S, ACTS, open: false, from: null, page: 'main', sel: 1, top: 0, cap: null, msg: '', msgT: 0, mx: -1, my: -1, fps: 60, syncSens: false, anim: 0,
    shakeK: () => [0, 0.45, 1][S.shake], flashK: () => [0, 0.4, 1][S.flash], bloodK: BK, save, keyName, bindOf, apply,
    rows() { return this.page === 'keys' ? rowsKeys() : this.page === 'pad' ? rowsPad() : rowsMain(); },
    show(from) { this.open = true; this.from = from; this.page = 'main'; this.sel = 1; this.top = 0; this.cap = null; this.anim = 0; clearKeys(); if (typeof SFX !== 'undefined') { SFX.init(); tick(); } },
    close() { this.open = false; this.cap = null; clearKeys(); },
  };
  function clearKeys() { for (const k of ['Enter', 'Space', 'Escape', 'PadOK', 'PadBack', 'PadStart', 'PadY', 'Backspace', 'KeyS']) delete KP[k]; MBP[0] = false; }
  const sel1 = r => r.t !== 'hdr';
  function step(id, dir) {
    const cyc = (v, n) => (v + (dir < 0 ? n - 1 : 1)) % n;
    if (id === 'master' || id === 'music' || id === 'sfx') S[id] = Math.round(clamp01(S[id] + (dir || 1) * 0.1) * 10) / 10;
    else if (id === 'fov') { const F = [60, 65, 70, 77, 80, 85, 90, 95, 100]; let i = F.indexOf(S.fov); if (i < 0) i = 3; S.fov = F[Math.max(0, Math.min(F.length - 1, i + (dir || 1)))]; }
    else if (id === 'shake' || id === 'flash' || id === 'blood') S[id] = dir ? Math.max(0, Math.min(2, S[id] + dir)) : cyc(S[id], 3);
    else if (id === 'fx') { FX.on = !FX.on; S.fx = FX.on; }
    else if (id === 'fps') S.fps = !S.fps;
    else if (id === 'atm' || id === 'nav') { const d0 = id === 'atm' ? 2 : 1, v = S[id] === undefined ? d0 : S[id]; S[id] = dir ? Math.max(0, Math.min(2, v + dir)) : (v + 1) % 3; if (id === 'atm' && window.M9E) M9E.regrade(); }
    else if (id === 'mmap') S.mmap = S.mmap === false;
    else if (id === 'wfx') { const v = S.wfx === undefined ? 2 : S.wfx; S.wfx = dir ? Math.max(0, Math.min(2, v + dir)) : (v + 2) % 3; }
    else if (id === 'hd') { S.hd = S.hd === false; if ((typeof GFX !== "undefined")) { GFX.hdOff = false; GFX.n = 0; } }
    else if (id === 'invY') S.invY = !S.invY;
    else if (id === 'tips') S.tips = !S.tips;
    else if (id === 'sens') { G.sens = Math.round(Math.max(0.3, Math.min(3, (G.sens || 1) + (dir || 1) * 0.1)) * 10) / 10; S.sens = G.sens; }
    else if (id === 'full') { try { if (document.fullscreenElement) document.exitFullscreen(); else { const p = document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => { OPT.msg = 'FULLSCREEN NEEDS A KEY OR CLICK'; OPT.msgT = 2; }); } } catch (e) { } }
    save();
  }
  function act(r, dir) {
    if (!r) return;
    if (r.t === 'slider' || r.t === 'opt') { if (r.id === 'full' && dir) { if ((dir > 0) === !document.fullscreenElement) step('full', 0); } else step(r.id, dir); tick(); return; }
    if (r.t === 'pad') { pmAct(r.id, dir); tick(); return; }
    if (dir && r.t !== 'key') { if (dir < 0 && /back$/.test(r.id)) act(r, 0); else if (dir > 0 && (r.id === 'keys' || r.id === 'pad')) act(r, 0); return; }
    if (r.t === 'key') { if (!dir) { OPT.cap = r.id; } return; }
    tick();
    if (r.id === 'back') OPT.close();
    else if (r.id === 'keys') { OPT.page = 'keys'; OPT.sel = 0; OPT.top = 0; }
    else if (r.id === 'pad') { OPT.page = 'pad'; OPT.sel = 0; OPT.top = 0; }
    else if (r.id === 'kback') { const was = OPT.page; OPT.page = 'main'; const L = OPT.rows(); OPT.sel = L.findIndex(x => x.id === was); OPT.top = Math.max(0, OPT.sel - 8); }
    else if (r.id === 'rkeys') { S.binds = {}; rebuildMap(); save(); OPT.msg = 'KEYS RESET'; OPT.msgT = 1.6; }
    else if (r.id === 'rtips') { if (window.TIPS) TIPS.reset(); OPT.msg = 'TIPS WILL SHOW AGAIN'; OPT.msgT = 1.6; }
    else if (r.id === 'reset') { const b = S.binds; Object.assign(S, DEF, { binds: b }); G.sens = S.sens; FX.on = S.fx; save(); OPT.msg = 'SETTINGS RESET'; OPT.msgT = 1.6; }
  }
  const tick = () => { try { if (SFX.ctx) SFX.ev('ui_click', 0.5, ['clink']); } catch (e) { } };
  // capture a key for rebinding before the game sees it
  addEventListener('keydown', e => { if (e.code === 'KeyS' && G.state === 'title' && !OPT.open && !e.repeat) OPT.show('title'); });   // raw S, whatever it is bound to
  addEventListener('keydown', e => {
    if (!OPT.open || !OPT.cap) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code === 'Escape') { OPT.cap = null; return; }
    if (/^Meta|^F\d+$|^Enter$/.test(e.code) && e.code !== 'Enter') return;
    if (e.code === 'Enter') { OPT.msg = 'ENTER IS RESERVED FOR MENUS'; OPT.msgT = 1.6; OPT.cap = null; return; }
    assign(OPT.cap, e.code); OPT.cap = null; tick();
  }, true);
  // mouse position for hover / click (cursor is free while menus are open)
  screen.addEventListener('mousemove', e => { const r = screen.getBoundingClientRect(); OPT.mx = (e.clientX - r.left) / r.width * W; OPT.my = (e.clientY - r.top) / r.height * H; });
  addEventListener('wheel', e => { if (OPT.open && !OPT.cap) { const L = OPT.rows(); OPT.top = Math.max(0, Math.min(Math.max(0, L.length - VIS), OPT.top + Math.sign(e.deltaY))); } }, { passive: true });

  // ---------- layout ----------
  const PX = W / 2 - 160, PW = 320, PY = 16, PH = 238, RY = PY + 34, RH = 12, VIS = 15;
  const SLX = PX + 168, SLW = 100;
  OPT.layout = { PX, PW, PY, PH, RY, RH, VIS };
  function moveSel(L, d) { let i = OPT.sel; for (let n = 0; n < L.length; n++) { i = (i + d + L.length) % L.length; if (sel1(L[i])) break; } OPT.sel = i; }
  OPT.input = function (rdt) {
    this.anim = Math.min(1, this.anim + rdt * 6); if (this.msgT > 0) this.msgT -= rdt;
    if (this.cap) { if (KP.PadBack || KP.PadStart) this.cap = null; for (const k in KP) delete KP[k]; MBP[0] = false; return; }
    if (this.page === 'sets') { if (KP.Escape || KP.PadBack || KP.Backspace || KP.Enter || KP.Space || KP.PadOK || MBP[0]) { tick(); this.close(); } else if (KP.PadStart) { this.close(); G.paused = false; } for (const k in KP) delete KP[k]; MBP[0] = false; return; }
    const L = this.rows(); if (!sel1(L[this.sel] || {})) moveSel(L, 1);
    if (KP.ArrowUp || KP.KeyW) moveSel(L, -1);
    if (KP.ArrowDown || KP.KeyS) moveSel(L, 1);
    const r = L[this.sel];
    if (KP.ArrowLeft || KP.KeyA) act(r, -1);
    if (KP.ArrowRight || KP.KeyD) act(r, 1);
    if (KP.Enter || KP.Space || KP.PadOK) act(r, 0);
    if (KP.Escape || KP.PadBack || KP.Backspace || (KP.PadStart && this.from === 'title')) { tick(); if (this.page !== 'main') act({ t: 'btn', id: 'kback' }, 0); else this.close(); }
    else if (KP.PadStart && this.from === 'pause') { this.close(); G.paused = false; }
    // mouse: hover selects, click activates (left / right half of a value nudges it, sliders jump to the click)
    const mx = this.mx, my = this.my;
    if (mx >= PX && mx < PX + PW && my >= RY - 3 && my < RY - 3 + VIS * RH) {
      const i = this.top + Math.floor((my - RY + 3) / RH);
      if (L[i] && sel1(L[i]) && (this._mx !== mx || this._my !== my)) this.sel = i;
      if (MBP[0] && L[i] && sel1(L[i])) {
        this.sel = i; const rr = L[i];
        if (rr.t === 'slider' && mx >= SLX - 4 && mx <= SLX + SLW + 4) { S[rr.id] = Math.round(clamp01((mx - SLX) / SLW) * 10) / 10; save(); tick(); }
        else if (rr.t === 'slider' || rr.t === 'opt' || rr.t === 'pad') act(rr, mx < PX + PW - 70 ? 1 : (mx < PX + PW - 40 ? -1 : 1));
        else act(rr, 0);
      }
    }
    this._mx = mx; this._my = my;
    if (this.sel < this.top) this.top = this.sel; if (this.sel >= this.top + VIS) this.top = this.sel - VIS + 1;
    this.top = Math.max(0, Math.min(Math.max(0, L.length - VIS), this.top));
    for (const k in KP) delete KP[k]; MBP[0] = false;
  };
  // ---------- drawing (own canvas so the HUD is never drawn twice) ----------
  const oc = document.createElement('canvas'); oc.width = W; oc.height = H; const ox = oc.getContext('2d');
  OPT.draw = function (ctx) {
    const a = 0.35 + 0.65 * ease(this.anim);
    ctx.fillStyle = `rgba(10,0,20,${0.82 * a})`; ctx.fillRect(0, 0, W, H);
    const dy = Math.round((1 - ease(this.anim)) * 10);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(0, dy);
    if (this.page === 'sets') goldFrame(ctx, 24, PY + 6, W - 48, PH - 12, '#c060ff'); else goldFrame(ctx, PX, PY, PW, PH, '#c060ff');
    if (this.page === 'sets') {
      text(ctx, 'RELIC SETS', W / 2, PY + 14, '#ffe080', 'center', 2);
      if (window.SETS) SETS.drawPage(ctx, OPT.layout);
      if (G.inputMode === 'pad') promptRow(ctx, ['{circle}', ' back'], W / 2, PY + PH - 20, '#e8e0f0', 'center');
      else text(ctx, 'ESC back', W / 2, PY + PH - 20, '#e8e0f0', 'center');
      ctx.restore(); return;
    }
    const title = this.page === 'keys' ? 'KEY BINDINGS' : this.page === 'pad' ? 'CONTROLLER' : 'SETTINGS';
    text(ctx, title, W / 2, PY + 9, '#ffe080', 'center', 2);
    const L = this.rows();
    for (let j = 0; j < VIS; j++) {
      const i = this.top + j, r = L[i]; if (!r) break;
      const y = RY + j * RH, sel = i === this.sel;
      if (r.t === 'hdr') { text(ctx, r.l, PX + 10, y, '#9a7cc8'); ctx.fillStyle = 'rgba(154,124,200,0.35)'; ctx.fillRect(PX + 14 + r.l.length * 8, y + 4, PW - 28 - r.l.length * 8, 1); continue; }
      if (sel) { ctx.fillStyle = 'rgba(160,80,255,0.35)'; ctx.fillRect(PX + 6, y - 2, PW - 12, RH); ctx.fillStyle = '#f0c040'; ctx.fillRect(PX + 6, y - 2, 2, RH); }
      const lab = typeof r.l === 'function' ? r.l() : r.l;
      const col = sel ? '#ffffff' : '#c8b8e0';
      if (r.t === 'pad') { text(ctx, lab, PX + 18, y, col); if (sel) { text(ctx, '<', PX + PW - 22, y, '#f0c040'); } continue; }
      text(ctx, lab, PX + 18, y, col);
      if (r.t === 'slider') {
        const v = S[r.id];
        ctx.fillStyle = '#2a1238'; ctx.fillRect(SLX, y + 2, SLW, 5);
        ctx.fillStyle = sel ? '#f0c040' : '#a070d0'; ctx.fillRect(SLX, y + 2, Math.round(SLW * v), 5);
        ctx.fillStyle = '#fff0a0'; ctx.fillRect(SLX + Math.round(SLW * v) - 1, y, 3, 9);
        text(ctx, Math.round(v * 10) + '', PX + PW - 14, y, col, 'right');
      } else if (r.t === 'opt' || r.t === 'key') {
        const v = this.cap === r.id ? '[ PRESS A KEY ]' : r.v();
        const vc = this.cap === r.id ? (G.t % 0.6 < 0.3 ? '#ffe080' : '#ff80c0') : sel ? '#ffe080' : '#e0d0f0';
        text(ctx, v, PX + PW - (r.t === 'opt' ? 24 : 14), y, vc, 'right');
        if (sel && r.t === 'opt') { text(ctx, '<', PX + PW - 32 - v.length * 8, y, '#f0c040'); text(ctx, '>', PX + PW - 20, y, '#f0c040'); }
      }
    }
    // scroll bar
    if (L.length > VIS) { const th = Math.max(12, VIS / L.length * VIS * RH), ty = RY - 2 + (this.top / (L.length - VIS)) * (VIS * RH - th); ctx.fillStyle = '#2a1238'; ctx.fillRect(PX + PW - 5, RY - 2, 2, VIS * RH); ctx.fillStyle = '#c090f0'; ctx.fillRect(PX + PW - 5, ty, 2, th); }
    const fy = PY + PH - 20;
    if (this.msgT > 0) text(ctx, this.msg, W / 2, fy - 12, '#80ff90', 'center');
    if (this.cap) text(ctx, 'PRESS THE NEW KEY   ESC CANCELS', W / 2, fy, '#ffe080', 'center');
    else if (G.inputMode === 'pad') promptRow(ctx, ['{cross}', ' select  ', '{circle}', ' back  ', '{DPAD}', ' change'], W / 2, fy, '#e8e0f0', 'center');
    else text(ctx, 'ARROWS  ENTER select  ESC back', W / 2, fy, '#e8e0f0', 'center');
    ctx.restore();
  };
  // ---------- hook into the frame ----------
  let fpsAcc = 0, fpsN = 0, fpsT = 0, lastNow = performance.now(), dirty = false;
  const _render = render;
  render = function (rdt) {
    apply();
    const now = performance.now(), d = now - lastNow; lastNow = now; fpsAcc += d; fpsN++;
    if (fpsAcc > 500) { OPT.fps = Math.round(1000 * fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    _render(rdt);
    const showTitleHint = G.state === 'title' && !OPT.open;
    if (dirty) { ox.clearRect(0, 0, W, H); dirty = false; }
    let drew = false;
    if (window.M8DRAW) for (const f of M8DRAW) { try { if (f(ox, rdt)) drew = true; } catch (e) { } }
    const tipsOn = window.TIPS && TIPS.drawable && TIPS.drawable();
    if (!drew && !OPT.open && !S.fps && !showTitleHint && !tipsOn) return;   // nothing to composite this frame
    if (tipsOn) TIPS.draw(ox, rdt);
    if (showTitleHint) {
      if (G.inputMode === 'pad') promptRow(ox, ['{triangle}', ' SETTINGS'], 6, 5, '#c8b8e0', 'left');
      else text(ox, 'S  SETTINGS', 6, 5, '#c8b8e0', 'left');
    }
    if (S.fps) { const f = OPT.fps + ' FPS'; ox.fillStyle = 'rgba(10,0,20,0.6)'; ox.fillRect(W / 2 - f.length * 4 - 2, 1, f.length * 8 + 4, 11); text(ox, f, W / 2, 3, OPT.fps >= 55 ? '#80ff90' : OPT.fps >= 40 ? '#ffe080' : '#ff6060', 'center'); }
    if (OPT.open) OPT.draw(ox);
    sctx.setTransform(SCALE, 0, 0, SCALE, 0, 0); sctx.imageSmoothingEnabled = false; sctx.drawImage(oc, 0, 0); dirty = true;
  };
  // the mouse must stay free while the settings menu is open in pause
  screen.addEventListener('mousedown', e => { if (OPT.open && G.state === 'play') { MB[e.button] = true; MBP[e.button] = true; e.stopImmediatePropagation(); } }, true);
  window.M8DRAW = window.M8DRAW || [];
  rebuildMap();
  G.sens = S.sens; FX.on = S.fx;
})();

// ---------- M8: RELIC SETS (collect 2 of 3 for a bonus that changes how you play; small, conditional numbers) ----------
(function () {
  const SETDEF = [
    { id: 'bloodline', n: 'BLOODLINE', c: '#ff4060', ids: ['fang', 'thornmail', 'bloodletter'], sh: ['FANG', 'THORN MAIL', 'BLOODLETTER'], d: 'Whip a BLEEDING foe: the bleed CHAINS to the nearest foe.' },
    { id: 'silver', n: 'SILVER HUNT', c: '#d8d0ff', ids: ['silverbolts', 'repeater', 'quiver'], sh: ['SILVER BOLTS', 'REPEATER', 'QUIVER'], d: 'Ranged shots RICOCHET to one more foe for 50% damage.' },
    { id: 'vigil', n: 'IRON VIGIL', c: '#ffe080', ids: ['ironoath', 'dreadhorn', 'rosary'], sh: ['IRON OATH', 'DREAD HORN', 'ROSARY'], d: 'A PARRY readies a RIPOSTE: next sword hit x1.5 and staggers.' },
    { id: 'grave', n: 'GRAVEWARDEN', c: '#60ffb0', ids: ['gravedirt', 'phylactery', 'soulsiphon'], sh: ['GRAVE DIRT', 'PHYLACTERY', 'SIPHON'], d: 'Every 6th kill frees a hungry soul that hunts a foe.' },
    { id: 'reaver', n: 'PHANTOM STEP', c: '#80d0ff', ids: ['wraithcloak', 'quicksilver', 'berserk'], sh: ['WRAITH CLOAK', 'QUICKSILVER', 'BERSERK'], d: 'Perfect dodges burst out a phantom: 12 dmg and a stagger.' },
  ];
  const SETS = window.SETS = {
    DEF: SETDEF,
    have(s) { if (!RUN.on || !RUN.picks) return 0; let n = 0; for (const id of s.ids) if (RUN.picks.includes(id)) n++; return n; },
    on(id) { const s = SETDEF.find(x => x.id === id); return !!s && this.have(s) >= 2; },
    of(uid) { return SETDEF.find(s => s.ids.includes(uid)) || null; },
    announced: [],
  };
  // set activation toast (checked every frame, cheap)
  let lastN = -1;
  function checkAnnounce() {
    if (!RUN.on || !RUN.picks) { lastN = -1; return; }
    if (RUN.picks.length === lastN) return; lastN = RUN.picks.length;
    if (!RUN.setsOn) RUN.setsOn = [];
    for (const s of SETDEF) if (SETS.have(s) >= 2 && !RUN.setsOn.includes(s.id)) {
      RUN.setsOn.push(s.id);
      setTimeout(() => { toast('SET BONUS: ' + s.n, s.d, s.c, 4.5); SFX.play('secret', 0.5); }, 1300);
    }
  }
  // ---- effects ----
  let ricoT = -1, chainT = -1;
  const nearestFoe = (x, y, r, not) => { let b = null, bd = r; for (const q of G.enemies) { if (!q.alive || q.hidden || q === not || (not && not.has && not.has(q))) continue; const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; b = q; } } return b; };
  const _de = damageEnemy;
  damageEnemy = function (e, dmg, o) {
    if (!RUN.on || !e || !e.alive || !o) return _de(e, dmg, o);
    // IRON VIGIL riposte
    if (o.src === 'sword' && P.m8rip > G.time && SETS.on('vigil')) {
      P.m8rip = 0; dmg *= 1.5; dmgNum(e.x, e.y, e.z + e.h + 0.55, 'RIPOSTE!', '#ffe080'); SFX.play('clink', 0.7);
      const r = _de(e, dmg, o); if (e.alive && !e.d.boss) { e.stagger = Math.max(e.stagger || 0, 0.8); e.state = 'stagger'; e.st = 0; e.atk = null; } return r;
    }
    const wasBleeding = e.bleedT > 0;
    const r = _de(e, dmg, o);
    // BLOODLINE: whip on a bleeding foe -> bleed jumps to the nearest other foe (once per lash)
    if (o.src === 'whip' && wasBleeding && G.time !== chainT && SETS.on('bloodline') && typeof addBleed === 'function') {
      const t = nearestFoe(e.x, e.y, 4, e);
      if (t) { chainT = G.time; addBleed(t, 3); addBolt(e.x, e.y, e.z + e.h * 0.6, t.x, t.y, t.z + t.h * 0.6, '#ff2040', 0.6); spray(t.x, t.y, t.z + t.h * 0.6, 0, 0, 0.5, 8, 2, Math.PI, 'flesh', 0.8); }
    }
    // SILVER HUNT: one ricochet per shot to a foe the shot did not hit
    if (o.src === 'pistol' && !o.rico && G.time !== ricoT && SETS.on('silver')) {
      ricoT = G.time;
      setTimeout(() => {
        if (G.state !== 'play') return;
        const t = nearestFoe(e.x, e.y, 6, e); if (!t) return;
        addBolt(e.x, e.y, e.z + e.h * 0.55, t.x, t.y, t.z + t.h * 0.55, '#e8d8ff', 0.6);
        _de(t, dmg * 0.5, { dx: t.x - e.x, dy: t.y - e.y, dz: 0.1, kb: 1.5, src: 'pistol', rico: true, col: '#e8d0ff' });
        sparks(t.x, t.y, t.z + t.h * 0.55, 8, RGB(230, 220, 255)); SFX.play('clink', 0.5);
      }, 70);
    }
    return r;
  };
  const _ah = rogueAfterHurt;
  rogueAfterHurt = function (res, dmg, opt) {
    _ah(res, dmg, opt);
    if (res === 'parry' && SETS.on('vigil')) { P.m8rip = G.time + 2.5; dmgNum(P.x + Math.cos(P.ang), P.y + Math.sin(P.ang), P.z + 1.6, 'RIPOSTE READY', '#ffe080'); }
    if (res === 'dodged' && P.dodgeAge < 0.2 && !opt.nopd && SETS.on('reaver') && G.time > (P.m8ph || 0)) {
      P.m8ph = G.time + 1;
      for (const q of G.enemies) if (q.alive && !q.hidden && Math.hypot(q.x - P.x, q.y - P.y) < 2.5) { damageEnemy(q, 12, { dx: q.x - P.x, dy: q.y - P.y, kb: 2, src: 'bash', col: '#c0e8ff' }); if (q.alive && !q.d.boss) { q.stagger = Math.max(q.stagger || 0, 0.45); q.state = 'stagger'; q.st = 0; q.atk = null; } }
      for (let i = 0; i < 26; i++) { const a = i / 26 * TAU; addP({ k: 'ecto', x: P.x + Math.cos(a) * 0.5, y: P.y + Math.sin(a) * 0.5, z: P.z + rand(0.3, 1.5), vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, vz: 0.4, size: 0.06, col: RGB(150, 210, 255), life: 0.5 }); }
      SFX.play('ghost', 0.4);
    }
  };
  const _ok = rogueOnKill;
  rogueOnKill = function (e) {
    _ok(e);
    if (e.summoned || !SETS.on('grave') || typeof soulWisp !== 'function') return;
    RUN.m8kills = (RUN.m8kills || 0) + 1;
    if (RUN.m8kills % 6 === 0) setTimeout(() => { if (G.state === 'play') soulWisp(e.x, e.y, e.z + e.h * 0.6); }, 120);
  };
  // ---- HUD: set progress under the relic icons ----
  M8DRAW.push(function (ctx) {
    checkAnnounce();
    if (!RUN.on || G.state !== 'play' || G.paused || G.toasts.length || G.bigText) return;
    let y = 39;
    for (const s of SETDEF) {
      const n = SETS.have(s); if (!n) continue;
      const on = n >= 2;
      text(ctx, s.n, 6, y, on ? s.c : '#9080a8');
      let px = 8 + s.n.length * 8 + 2;
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i < n ? (on ? s.c : '#c0b0d8') : 'rgba(60,40,80,0.9)'; ctx.fillRect(px + i * 6, y + 2, 4, 4); }
      if (on && s.id === 'vigil' && P.m8rip > G.time) text(ctx, 'RIPOSTE', px + 22, y, '#ffe080');
      y += 10;
    }
    return y > 39;
  });
  // ---- pause-menu SETS page (drawn by the settings overlay) ----
  SETS.drawPage = function (ctx, L) {
    const X0 = 34, XW = W - 68; let y = L.PY + 38;
    for (const s of SETDEF) {
      const n = SETS.have(s), on = n >= 2;
      text(ctx, s.n, X0, y, on ? s.c : '#c8b8e0');
      text(ctx, on ? n + '/3  ACTIVE' : n + '/3', X0 + XW, y, on ? '#80ff90' : '#9080a8', 'right');
      for (let i = 0; i < 3; i++) { const own = RUN.on && RUN.picks && RUN.picks.includes(s.ids[i]); text(ctx, (own ? '+ ' : '- ') + s.sh[i], X0 + 8 + i * 136, y + 10, own ? '#ffffff' : '#6a5a80'); }
      fitBlock(ctx, (on ? '' : '2 OF 3: ') + s.d, X0 + 8, y + 20, XW - 8, 9, on ? '#ece0f4' : '#a898c0', 'left');
      y += 35;
    }
  };
})();

// ---------- M8: FIRST-TIME TIPS (contextual, one at a time, dismissable, each shown once ever) ----------
(function () {
  const KEY = 'tu_tips';
  let seen = {}; try { seen = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch (e) { } };
  const kb = id => OPT.keyName(OPT.bindOf(OPT.ACTS.find(a => a[0] === id)));
  const DEF = {
    enemy: { t: 'A FOE STIRS', kb: () => 'LMB/' + kb('sword') + ' sword combo. RMB/' + kb('off') + ' lash or raise the shield. Block just before a hit lands to PARRY.', pad: () => 'R2 sword combo. L2 lash or raise the shield. Block just before a hit lands to PARRY.' },
    secret: { t: 'A HOLLOW WALL', kb: () => 'Dust breathing out of a wall and a faint whisper mean a hidden room. Strike the wall to break through.', pad: null },
    altar: { t: 'THE RELIQUARY ALTAR', kb: () => 'Spend Reliquary Shards on new weapons, relics and blessings. Walk into the altar to open it.', pad: null },
    relic: { t: 'RELICS & SETS', kb: () => 'Relics last the whole run. Own 2 of a set for a SET BONUS - see Pause > RELIC SETS.', pad: null },
    boss: { t: 'BOSS', kb: () => 'Every attack is telegraphed. Parry what you can, roll through the rest - a parry opens them up.', pad: null },
  };
  const T = window.TIPS = { cur: null, t: 0, q: [], seen,
    reset() { for (const k in seen) delete seen[k]; save(); this.q = []; this.cur = null; },
    fire(id) { if (!OPT.S.tips || seen[id] || this.q.includes(id) || (this.cur && this.cur.id === id)) return; this.q.push(id); },
    drawable() { return !!this.cur && G.state === 'play' && !G.paused && !OPT.open; },
  };
  function scan() {
    if (G.state !== 'play' || G.paused || OPT.open) return;
    if (LEVEL.kind === 'hub') { if (Math.hypot(P.x - 10.5, P.y - 4.5) < 5.5) T.fire('altar'); if (seen.altar && !T.cur && G.t > 4) T.fire('boss'); } // M8c: boss tip is read in the Chapel, not mid-fight
    else {
      for (const e of G.enemies) if (e.alive && !e.hidden && !e.d.boss && e.awake && Math.hypot(e.x - P.x, e.y - P.y) < 9) { T.fire('enemy'); break; }
      for (const c of (LEVEL.cracks || [])) if (c && !c.open && Math.hypot(P.x - c.x - 0.5, P.y - c.y - 0.5) < 3.1) { T.fire('secret'); break; }
      const b = G.enemies.find(e => e.alive && e.d.boss && !e.hidden);
    }
    if (RUN.on && RUN.picks && RUN.picks.some(id => { const u = UPG.find(q => q.id === id); return u && u.kind !== 'WEAPON'; })) T.fire('relic');
  }
  M8DRAW.unshift(function (ctx, rdt) {
    scan();
    if (G.state !== 'play' || G.paused || OPT.open) return;
    const bossFight = !!(G.boss && G.boss.alive && G.boss.awake && LEVEL.kind !== 'hub'); // M8c: no new tip pops over a boss fight
    if (T.cur && bossFight && T.t < 0.25 && !T.cur.out) { T.q.unshift(T.cur.id); seen[T.cur.id] = 0; T.cur = null; }
    if (!T.cur && T.q.length && !bossFight && !(G.bigText && G.bigText.t < (G.bigText.dur || 3))) { const id = T.q.shift(); if (!seen[id]) { T.cur = { id }; T.t = 0; seen[id] = 1; save(); } }
    if (!T.cur) return;
    T.t += rdt;
    if (KP.KeyX || KP.PadTip || T.t > 10 || !OPT.S.tips) { T.cur.out = T.cur.out || 0.001; }
    if (T.cur.out) { T.cur.out += rdt * 4; if (T.cur.out >= 1) { T.cur = null; return; } }
  });
  T.draw = function (ctx) {
    const c = T.cur; if (!c) return; const d = DEF[c.id];
    const a = Math.min(1, T.t * 5) * (c.out ? 1 - c.out : 1); if (a <= 0) return;
    const pad = G.inputMode === 'pad', body = (pad && d.pad ? d.pad : d.kb)();
    const bw = 300, bh = 46, x = Math.round(W / 2 - bw / 2), y = Math.round(H - 94 + (1 - Math.min(1, T.t * 5)) * 8);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(14,2,24,0.86)'; ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = '#c060ff'; ctx.fillRect(x, y, bw, 1); ctx.fillRect(x, y + bh - 1, bw, 1); ctx.fillStyle = '#f0c040'; ctx.fillRect(x, y, 2, bh);
    text(ctx, 'TIP  ' + d.t, x + 7, y + 4, '#ffe080');
    if (pad) promptRow(ctx, ['{CREATE}', ' ok'], x + bw - 5, y + 3, '#a898c0', 'right'); else text(ctx, 'X ok', x + bw - 5, y + 4, '#a898c0', 'right');
    fitBlock(ctx, body, x + 7, y + 15, bw - 12, 29, '#ece0f4', 'left');
    // remaining-time bar
    ctx.fillStyle = 'rgba(192,96,255,0.5)'; ctx.fillRect(x + 2, y + bh - 2, Math.round((bw - 4) * Math.max(0, 1 - T.t / 10)), 1);
    ctx.restore();
  };
})();

// ---------- M8: finer Abyss rift shards (replace the 12x32 blade sprite that looked chunky up close) ----------
(function () {
  function shard(seed, pal) {
    const w = 30, h = 96, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const im = x.createImageData(w, h), d = im.data;
    let s = seed * 9301 + 49297; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const lean = (rnd() - 0.5) * 6, jag = []; for (let i = 0; i <= 12; i++) jag.push((rnd() - 0.5) * 2.2);
    const half = v => { const k = v / h; const base = 13 * Math.pow(1 - k, 0.85) * (0.75 + 0.25 * Math.sin(k * 3.1)); return Math.max(0, base + jag[Math.min(12, (k * 12) | 0)] * (1 - k)); };
    const inside = (px, py) => { const v = h - 1 - py, cx = w / 2 + lean * (v / h); return Math.abs(px + 0.5 - cx) <= half(v); };
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      if (!inside(px, py)) continue;
      const v = h - 1 - py, cx = w / 2 + lean * (v / h), hw = Math.max(0.5, half(v)), u = (px + 0.5 - cx) / hw;   // -1..1 across
      const edge = !inside(px - 1, py) || !inside(px + 1, py) || !inside(px, py - 1) || !inside(px, py + 1);
      let col;
      if (edge) col = pal.edge;
      else if (Math.abs(u - 0.15) < 0.16) col = pal.core;                                   // bright facet ridge
      else if (u < 0.15) col = (Math.abs(u + 0.5) < 0.12 && ((py >> 2) % 3 === 0)) ? pal.mid : pal.dark;   // shadow face with glints
      else col = pal.light;
      const fade = Math.min(1, v / 10);                                                       // dissolve into the floor
      const i = (py * w + px) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = Math.round(255 * (edge ? 0.95 : 1) * (0.55 + 0.45 * fade));
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  const PAL = {
    v: { edge: [70, 10, 120], dark: [120, 40, 210], mid: [190, 120, 255], light: [170, 90, 255], core: [240, 215, 255] },
    g: { edge: [120, 60, 10], dark: [200, 120, 40], mid: [255, 210, 120], light: [240, 170, 70], core: [255, 245, 210] },
  };
  for (const k of ['v', 'g']) for (let j = 0; j < 3; j++) {
    const c = shard(j * 7 + (k === 'g' ? 3 : 1), PAL[k]), n = 'm8_rift' + k + j;
    Engine.imgs[n] = c; const dd = c.getContext('2d').getImageData(0, 0, c.width, c.height); Engine.tex[n] = { w: c.width, h: c.height, d: new Uint32Array(dd.data.buffer) };
  }
})();
// finer spectral blade for the Undead Knight's falling swords (same shape/orientation as the old 12x32 p_blade)
(function () {
  const w = 21, h = 66, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  const R = (col, a, b, cw, ch) => { x.fillStyle = col; x.fillRect(a, b, cw, ch); };
  const cx = 10;
  // blade (tip up): outline, body, fuller, edge highlight
  for (let y = 0; y < 46; y++) { const hw = y < 7 ? Math.max(0, Math.round(y * 0.45)) : 3; R('#24083c', cx - hw - 1, y, hw * 2 + 3, 1); R('#7a4ad0', cx - hw, y, hw * 2 + 1, 1); if (y > 7) { R('#40208a', cx, y, 1, 1); R('#b890ff', cx - hw, y, 1, 1); R('#5a34b0', cx + hw, y, 1, 1); } }
  R('#3a1660', 1, 45, 19, 5); R('#e0b850', 2, 46, 17, 3); R('#fff0a0', 2, 46, 17, 1); R('#8a5a20', 2, 48, 17, 1);   // crossguard
  R('#3a1660', cx - 2, 50, 5, 11); R('#5a3020', cx - 1, 50, 3, 11); R('#a06030', cx - 1, 51, 1, 9);                     // grip
  R('#3a1660', cx - 3, 60, 7, 6); R('#e0b850', cx - 2, 61, 5, 4); R('#fff0a0', cx - 2, 61, 2, 1);                          // pommel
  Engine.imgs.m8_blade = c; const dd = x.getImageData(0, 0, w, h); Engine.tex.m8_blade = { w, h, d: new Uint32Array(dd.data.buffer) };
})();

// ---------- M8b: CALMER WALLS. Wall textures flattened toward a mostly solid colour in each stage's own palette:
// fine detail / ornaments / glowing squiggles cut to ~20%, mortar lines kept faint, gentle large-scale shading kept.
// Doors, gates, window/banner/statue decals and pickups are untouched; crack tells keep more of their detail.
(function () {
  const WALL = /^(t_stone2?|t_pillar|t_cpillar|t_crypt2?|t_skulls|t_cryptfalse|f_wood|[a-z]_(wall2?|loose|pillar|hedge|ivy|beam|wallfalse|false))$/;
  const CRACK = /^(t_cracked|t_cryptcrack|[a-z]_crack)$/;
  function blurWrap(src, w, h, r) {   // separable box blur with wrap-around (textures tile)
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length), n = 2 * r + 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -r; k <= r; k++) s += src[y * w + ((x + k + w) % w)]; tmp[y * w + x] = s / n; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -r; k <= r; k++) s += tmp[((y + k + h) % h) * w + x]; out[y * w + x] = s / n; }
    return out;
  }
  function calm(T, kd, km, ks) {
    // hue-free: every pixel becomes the texture's mean colour, shaded only by (damped) luminance structure
    const w = T.w, h = T.h, d = T.d, N = w * h;
    const L = new Float32Array(N); let mr = 0, mg = 0, mb = 0, ml = 0, na = 0;
    for (let i = 0; i < N; i++) { const q = d[i]; if (!(q >>> 24)) continue; const r = q & 255, g = (q >> 8) & 255, b = (q >> 16) & 255; L[i] = r * 0.3 + g * 0.55 + b * 0.15; mr += r; mg += g; mb += b; na++; }
    if (!na) return; mr /= na; mg /= na; mb /= na; ml = Math.max(1, mr * 0.3 + mg * 0.55 + mb * 0.15);
    const BL = blurWrap(blurWrap(L, w, h, 4), w, h, 4);
    for (let i = 0; i < N; i++) {
      const a = d[i] >>> 24; if (!a) continue;
      const bl = Math.max(1, BL[i]), rel = (L[i] - bl) / bl;
      const k = rel < -0.12 ? km : kd;                                     // mortar / crevices keep a bit more
      const m = Math.pow(bl / ml, ks) * (1 + Math.max(-0.5, Math.min(0.22, rel * k)));
      const r = Math.min(255, Math.round(mr * m)), g = Math.min(255, Math.round(mg * m)), b = Math.min(255, Math.round(mb * m));
      d[i] = (a << 24) | (b << 16) | (g << 8) | r;
    }
  }
  const M8B = window.M8B = { done: false, n: 0, names: [] };
  M8B.run = function () {
    if (M8B.done) return; M8B.done = true;
    for (const n in Engine.tex) {
      const T = Engine.tex[n]; if (!T || T.w < 16 || T.h < 16) continue;
      if (WALL.test(n)) { calm(T, 0.16, 0.5, 0.35); M8B.n++; M8B.names.push(n); }
      else if (CRACK.test(n)) { calm(T, 0.4, 1.0, 0.45); M8B.n++; M8B.names.push(n); }
      else if (n === 'f_soulglass') { calm(T, 0.55, 0.8, 0.7); M8B.n++; M8B.names.push(n); }   // the one floor as busy as the walls were
    }
    if (typeof SPANS !== 'undefined') for (const k in SPANS) delete SPANS[k];
  };
  // run right after the GFX load-time texture pass (which sharpens textures) so we flatten the final result
  const _r = render;
  render = function (rdt) { _r(rdt); if (!M8B.done && GFX.texDone) M8B.run(); };
})();
