(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.mechanics=window.MMKit.mechanics||{};
MMKit.mechanics.NeonPlay = function (config, game) {
  config = config || {};
  game = game || {};

  var W = R.W, H = R.H;

  // ---------- helpers ----------
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function dist2(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }

  // ---------- avatars (each with its own music track) ----------
  var AVATARS = [
    { name: 'PULSE',  col: '#0ff', track: 'synthwave', bpmBase: 80, glow: '#0ff' },
    { name: 'VOLT',   col: '#f0f', track: 'electro',   bpmBase: 90, glow: '#f0f' },
    { name: 'NOVA',   col: '#ff0', track: 'house',     bpmBase: 100, glow: '#ff0' },
    { name: 'BASSLINE', col: '#0f8', track: 'dnb',     bpmBase: 110, glow: '#0f8' }
  ];

  // ---------- persistent state ----------
  game.score = 0;
  game.crowdHype = 0;
  game.biggestStreak = 0;
  game.bonusesTriggered = 0;
  game.crowdSize = 0;
  game.boothsDropped = 0;
  game.rank = 'D';
  game.resultsState = game.resultsState || 'RESULTS';

  var TIMER_START = 120;
  game.setTimer = TIMER_START;

  // ---------- loadout (weakest, with model for progression) ----------
  var loadout = game.loadout || {
    needle:   { name: 'Bronze Needle', perfectWindow: 0.055, goodWindow: 0.12, mult: 1.0 },
    mixer:    { name: '2-Channel Mixer', faders: 2, working: 1 },
    speaker:  { name: '60-Watt Stack', hypeScale: 1.0 }
  };
  game.loadout = loadout;

  // ---------- phases ----------
  // 'avatar' -> 'name' -> game modes
  var phase = 'avatar';
  var selectedAvatar = 0;
  var djName = '';
  var nameCursor = 0;
  var NAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';

  // ---------- music track (procedural beat clock per avatar) ----------
  var music = {
    avatar: AVATARS[0],
    time: 0,
    beatPhase: 0,
    bpm: 80,
    beatPulse: 0
  };
  function setTrack(av, bpm) {
    music.avatar = av;
    music.bpm = bpm;
    music.time = 0;
    music.beatPhase = 0;
    music.beatPulse = 0;
  }
  function tickMusic(dt) {
    music.time += dt;
    var beatLen = 60 / music.bpm;
    var prev = music.beatPhase;
    music.beatPhase += dt / beatLen;
    if (Math.floor(music.beatPhase) > Math.floor(prev)) music.beatPulse = 1;
    music.beatPulse = Math.max(0, music.beatPulse - dt * 4);
  }

  // ---------- booths ----------
  var HOME = { x: W * 0.5, y: H * 0.86 };
  var booths = [];
  (function buildBooths() {
    var seed = 1234567;
    function srand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    var slots = [
      { x: W * 0.24, y: H * 0.64 },
      { x: W * 0.76, y: H * 0.58 },
      { x: W * 0.30, y: H * 0.30 },
      { x: W * 0.70, y: H * 0.24 },
      { x: W * 0.50, y: H * 0.12 }
    ];
    for (var i = 0; i < 5; i++) {
      var s = slots[i];
      var jx = (srand() - 0.5) * 30, jy = (srand() - 0.5) * 30;
      var bx = clamp(s.x + jx, 60, W - 60);
      var by = clamp(s.y + jy, 60, H - 160);
      var dx = bx - HOME.x, dy = by - HOME.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      booths.push({
        x: bx, y: by, dist: d, index: i,
        bpm: 0,           // set when avatar chosen
        bpmBoost: i * 22, // farther = faster
        density: 0.45 + i * 0.12,
        payout: 200 + i * 170,
        dropped: false,
        pulse: 0
      });
    }
  })();

  // ---------- cart (momentum physics) ----------
  var cart = { x: HOME.x, y: HOME.y, vx: 0, vy: 0, r: 15, angle: 0 };
  var ACCEL = 0.5;
  var MAXV = 6.2;

  // ---------- modes ----------
  var mode = 'roam'; // 'roam' | 'rhythm' | 'returning'
  var setEnded = false;

  // ---------- particles & juice ----------
  var parts = [];
  function spawnP(x, y, n, col, spd) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = (0.4 + Math.random()) * (spd || 200);
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.5, max: 1, col: col, r: 2 + Math.random() * 3 });
    }
  }
  function updParts(dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) parts.splice(i, 1);
    }
  }
  var shake = 0;
  function addShake(v) { shake = Math.min(shake + v, 20); }

  var feedTxt = '', feedT = 0, feedCol = '#fff';
  function feedback(t, col) { feedTxt = t; feedT = 0.8; feedCol = col; }

  // ---------- mini-game ----------
  var mg = null;
  function startMiniGame(booth) {
    mode = 'rhythm';
    setTrack(AVATARS[selectedAvatar], booth.bpm);
    var beatGap = 60 / booth.bpm;
    var notes = [];
    var count = Math.round(10 + booth.density * 16);
    var t = 1.4;
    for (var i = 0; i < count; i++) {
      notes.push({ lane: Math.random() < 0.5 ? 0 : 1, time: t, hit: false, judged: false, fade: 0 });
      // notes land on musical beats; density picks half-beats sometimes
      t += beatGap * (Math.random() < booth.density ? 0.5 : 1);
    }
    mg = {
      booth: booth,
      notes: notes,
      time: 0,
      marker: 0,
      fallTime: 1.4,
      misses: 0,
      whiffed: false,
      bonuses: { panel: 0, laser: 0, disco: 0, balloon: 0 },
      combo: 0,
      multiplier: 1,
      flash: 0,
      flashCol: '#fff',
      lastJudge: '',
      judgeTimer: 0,
      dropLineY: H * 0.74
    };
  }

  function activeBonusMult() {
    if (!mg) return 1;
    var b = mg.bonuses, m = 1;
    if (b.panel > 0) m += 0.1;
    if (b.laser > 0) m += 0.1;
    if (b.disco > 0) m += 0.1;
    if (b.balloon > 0) m += 0.1;
    return m;
  }

  function registerHit(quality, base) {
    var bonusMult = activeBonusMult();
    mg.combo++;
    if (quality === 'PERFECT') mg.multiplier = 1 + Math.floor(mg.combo / 4) * 0.5;
    var gainBase = quality === 'PERFECT' ? 45 : 24;
    var deadDampen = 1; // dead air handled via combo reset
    var gain = gainBase * base * loadout.needle.mult * loadout.speaker.hypeScale * mg.multiplier * bonusMult;
    game.crowdHype += gain;
    game.crowdSize += quality === 'PERFECT' ? 8 : 4;
    if (mg.combo > game.biggestStreak) game.biggestStreak = mg.combo;
    mg.flash = 0.22; mg.flashCol = quality === 'PERFECT' ? '#0ff' : '#5f5';
    mg.lastJudge = quality; mg.judgeTimer = 0.7;
    var px = (mg.marker === 0 ? W * 0.5 - 80 : W * 0.5 + 80);
    spawnP(px, mg.dropLineY, quality === 'PERFECT' ? 26 : 14, mg.flashCol, 320);
    addShake(quality === 'PERFECT' ? 8 : 4);
    feedback(quality, mg.flashCol);
  }

  function registerMiss() {
    mg.combo = 0; mg.multiplier = 1;
    mg.misses++;
    mg.flash = 0.25; mg.flashCol = '#f33';
    addShake(7);
    feedback('MISS', '#f55');
    if (mg.misses >= 2) {
      mg.whiffed = true;
      feedback('WHIFF! SCRATCHED', '#f00');
      addShake(16);
    }
  }

  function registerDeadAir() {
    mg.combo = 0; mg.multiplier = 1;
    mg.flash = 0.15; mg.flashCol = '#f80';
    feedback('OFF-BEAT', '#fa0');
    addShake(3);
  }

  function tryBonus(key, streakReq, name, col) {
    if (mg.combo < streakReq) return;
    var b = mg.bonuses;
    if (b[key] > 0) { b[key] = 4; return; }
    b[key] = 4;
    game.bonusesTriggered++;
    spawnP(cart.x, mg.dropLineY, 30, col, 360);
    addShake(8);
    feedback(name + '!', col);
  }

  function endMiniGame(cleared) {
    if (!mg) return;
    var booth = mg.booth;
    if (cleared && !booth.dropped) {
      booth.dropped = true;
      game.boothsDropped++;
      var bonus = Math.round(booth.payout * (1 + booth.dist / Math.max(1, H)));
      game.crowdHype += bonus;
      game.crowdSize += 25 + booth.index * 14;
      spawnP(booth.x, booth.y, 50, '#0ff', 420);
      addShake(14);
      feedback('CROWD ERUPTS!', '#0ff');
    }
    mg = null;
    mode = 'roam';
    setTrack(AVATARS[selectedAvatar], AVATARS[selectedAvatar].bpmBase);
    if (game.boothsDropped >= 5) triggerSetEnd();
  }

  function triggerSetEnd() {
    if (setEnded) return;
    setEnded = true;
    mode = 'returning';
    mg = null;
  }

  function finalizeResults() {
    game.score = Math.max(0, Math.round(game.crowdHype));
    var s = game.score;
    if (s >= 4500) game.rank = 'S';
    else if (s >= 3000) game.rank = 'A';
    else if (s >= 1900) game.rank = 'B';
    else if (s >= 950) game.rank = 'C';
    else game.rank = 'D';
    game.djName = djName || 'DJ';
    game.avatar = AVATARS[selectedAvatar].name;
    R.go(game.resultsState);
  }

  // ===================== UPDATE =====================
  function update(dt) {
    if (R.current() !== 'GAMEPLAY') return;
    if (dt <= 0 || dt > 0.2) dt = 1 / 60;
    var k = dt * 60;

    shake *= Math.pow(0.85, k);
    updParts(dt);
    if (feedT > 0) feedT -= dt;
    tickMusic(dt);
    for (var bi = 0; bi < booths.length; bi++) {
      if (booths[bi].pulse > 0) booths[bi].pulse -= dt * 2;
    }

    if (phase === 'avatar') { updateAvatarSelect(); return; }
    if (phase === 'name') { updateNameEntry(); return; }

    if (!setEnded && mode !== 'returning') {
      game.setTimer -= dt;
      if (game.setTimer <= 0) { game.setTimer = 0; triggerSetEnd(); }
    }

    if (mode === 'roam') updateRoam(dt, k);
    else if (mode === 'rhythm') updateRhythm(dt);
    else if (mode === 'returning') updateReturning(dt, k);
  }

  // ---------- avatar select ----------
  function updateAvatarSelect() {
    if (R.pressed('ArrowLeft')) selectedAvatar = (selectedAvatar + AVATARS.length - 1) % AVATARS.length;
    if (R.pressed('ArrowRight')) selectedAvatar = (selectedAvatar + 1) % AVATARS.length;
    // mouse select
    if (R.mouse.clicked) {
      var n = AVATARS.length;
      var slotW = W / n;
      var idx = Math.floor(R.mouse.x / slotW);
      if (idx >= 0 && idx < n) selectedAvatar = idx;
    }
    setTrack(AVATARS[selectedAvatar], AVATARS[selectedAvatar].bpmBase);
    if (R.pressed(' ') || R.pressed('Enter')) {
      phase = 'name';
    }
  }

  // ---------- name entry ----------
  function updateNameEntry() {
    if (R.pressed('ArrowLeft')) nameCursor = (nameCursor + NAME_CHARS.length - 1) % NAME_CHARS.length;
    if (R.pressed('ArrowRight')) nameCursor = (nameCursor + 1) % NAME_CHARS.length;
    if (R.pressed('ArrowUp')) {
      if (djName.length < 8) djName += NAME_CHARS.charAt(nameCursor);
    }
    if (R.pressed('ArrowDown')) {
      if (djName.length > 0) djName = djName.slice(0, -1);
    }
    if (R.pressed(' ') && djName.length < 8) djName += NAME_CHARS.charAt(nameCursor);
    if (R.pressed('Enter')) {
      if (djName.length === 0) djName = 'DJ';
      // assign per-avatar BPM to booths
      var av = AVATARS[selectedAvatar];
      for (var i = 0; i < booths.length; i++) {
        booths[i].bpm = av.bpmBase + booths[i].bpmBoost;
      }
      setTrack(av, av.bpmBase);
      phase = 'play';
    }
  }

  // ---------- roam (momentum) ----------
  function updateRoam(dt, k) {
    var ax = 0, ay = 0;
    if (R.keys['ArrowLeft']) ax -= ACCEL;
    if (R.keys['ArrowRight']) ax += ACCEL;
    if (R.keys['ArrowUp']) ay -= ACCEL;
    if (R.keys['ArrowDown']) ay += ACCEL;

    cart.vx += ax * k;
    cart.vy += ay * k;

    // forward drift damps faster; lateral skid damps slower
    var fwdDamp = 0.96, latDamp = 0.986;
    cart.vx *= Math.pow(latDamp, k);
    cart.vy *= Math.pow(fwdDamp, k);

    var sp = Math.sqrt(cart.vx * cart.vx + cart.vy * cart.vy);
    if (sp > MAXV) { cart.vx = cart.vx / sp * MAXV; cart.vy = cart.vy / sp * MAXV; }
    if (sp > 0.2) cart.angle = Math.atan2(cart.vy, cart.vx);

    cart.x += cart.vx * k;
    cart.y += cart.vy * k;

    if (cart.x < cart.r) { cart.x = cart.r; cart.vx = -cart.vx * 0.4; }
    if (cart.x > W - cart.r) { cart.x = W - cart.r; cart.vx = -cart.vx * 0.4; }
    if (cart.y < cart.r) { cart.y = cart.r; cart.vy = -cart.vy * 0.4; }
    if (cart.y > H - cart.r) { cart.y = H - cart.r; cart.vy = -cart.vy * 0.4; }

    for (var i = 0; i < booths.length; i++) {
      var b = booths[i];
      if (b.dropped) continue;
      if (dist2(cart, b) < 44 * 44) {
        if (R.pressed(' ') || R.pressed('Enter')) {
          cart.vx = 0; cart.vy = 0;
          b.pulse = 1;
          startMiniGame(b);
          return;
        }
      }
    }
  }

  // ---------- returning home ----------
  function updateReturning(dt, k) {
    var dx = HOME.x - cart.x, dy = HOME.y - cart.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < 8) {
      cart.x = HOME.x; cart.y = HOME.y;
      finalizeResults();
      return;
    }
    // momentum roll toward home
    cart.vx += (dx / d) * ACCEL * 1.6 * k;
    cart.vy += (dy / d) * ACCEL * 1.6 * k;
    var sp = Math.sqrt(cart.vx * cart.vx + cart.vy * cart.vy);
    if (sp > MAXV * 1.3) { cart.vx = cart.vx / sp * MAXV * 1.3; cart.vy = cart.vy / sp * MAXV * 1.3; }
    cart.vx *= Math.pow(0.95, k);
    cart.vy *= Math.pow(0.95, k);
    cart.x += cart.vx * k;
    cart.y += cart.vy * k;
    cart.angle = Math.atan2(dy, dx);
  }

  // ---------- rhythm ----------
  function updateRhythm(dt) {
    if (!mg) { mode = 'roam'; return; }
    mg.time += dt;
    if (mg.judgeTimer > 0) mg.judgeTimer -= dt;
    mg.flash = Math.max(0, mg.flash - dt);

    var bn = mg.bonuses;
    bn.panel = Math.max(0, bn.panel - dt);
    bn.laser = Math.max(0, bn.laser - dt);
    bn.disco = Math.max(0, bn.disco - dt);
    bn.balloon = Math.max(0, bn.balloon - dt);

    // mixer fader: only one working channel — represented by lane the fader can boost.
    // The fader is the groove marker lane control.
    if (R.pressed('ArrowLeft')) mg.marker = 0;
    if (R.pressed('ArrowRight')) mg.marker = 1;

    // streak-unlocked dance-floor bonuses
    if (R.pressed('a')) tryBonus('panel', 3, 'FLOOR PANEL', '#f0f');
    if (R.pressed('s')) tryBonus('laser', 5, 'LASER', '#0ff');
    if (R.pressed('d')) tryBonus('disco', 7, 'DISCO BALL', '#ff0');
    if (R.pressed('f')) tryBonus('balloon', 9, 'BALLOON DROP', '#0f8');

    var pW = loadout.needle.perfectWindow;
    var gW = loadout.needle.goodWindow;
    // tighten window as notes deplete (tightening target zone)
    var judged = 0;
    for (var c = 0; c < mg.notes.length; c++) if (mg.notes[c].judged) judged++;
    var tighten = clamp(1 - (judged / mg.notes.length) * 0.4, 0.6, 1);
    var perfectWindow = pW * tighten;
    var goodWindow = gW * tighten;

    // strike
    if (R.pressed(' ') || R.pressed('Enter') || R.pressed('ArrowUp')) {
      var best = null, bestErr = 1e9;
      for (var i = 0; i < mg.notes.length; i++) {
        var n = mg.notes[i];
        if (n.judged) continue;
        var err = Math.abs(mg.time - n.time);
        if (err < goodWindow && err < bestErr) { bestErr = err; best = n; }
      }
      if (best) {
        if (best.lane !== mg.marker) {
          best.judged = true; best.fade = 0.3;
          registerMiss();
        } else if (bestErr <= perfectWindow) {
          best.judged = true; best.hit = true; best.fade = 0.3;
          registerHit('PERFECT', 1.0);
        } else {
          best.judged = true; best.hit = true; best.fade = 0.3;
          registerHit('GOOD', 0.55);
        }
      } else {
        registerDeadAir();
      }
    }

    // missed (passed line)
    for (var j = 0; j < mg.notes.length; j++) {
      var nn = mg.notes[j];
      if (nn.judged) continue;
      if (mg.time > nn.time + goodWindow) {
        nn.judged = true; nn.fade = 0.3;
        registerMiss();
        if (mg.whiffed) break;
      }
    }

    if (mg.whiffed) { endMiniGame(false); return; }

    var allJudged = true;
    for (var q = 0; q < mg.notes.length; q++) {
      if (!mg.notes[q].judged) { allJudged = false; break; }
    }
    if (allJudged) { endMiniGame(true); return; }

    // recompute live score
    game.score = Math.round(game.crowdHype);
  }

  // ===================== DRAW =====================
  function drawBackground() {
    var ctx = R.ctx;
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(0, 0, W, H);
    // floor grid pulsing to beat
    var pulse = music.beatPulse;
    ctx.save();
    ctx.globalAlpha = 0.25 + pulse * 0.3;
    ctx.strokeStyle = music.avatar.glow;
    ctx.lineWidth = 1;
    var gs = 48;
    for (var x = 0; x <= W; x += gs) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (var y = 0; y <= H; y += gs) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawCart() {
    var ctx = R.ctx;
    ctx.save();
    ctx.translate(cart.x, cart.y);
    ctx.rotate(cart.angle);
    ctx.shadowBlur = 16;
    ctx.shadowColor = music.avatar.glow;
    // deck-cart body
    ctx.fillStyle = '#1a1a2e';
    R.roundRect(-16, -11, 32, 22, 5);
    ctx.fill();
    ctx.strokeStyle = music.avatar.glow;
    ctx.lineWidth = 2;
    R.roundRect(-16, -11, 32, 22, 5);
    ctx.stroke();
    // turntable platters
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#0ff';
    ctx.beginPath(); ctx.arc(-7, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0f';
    ctx.beginPath(); ctx.arc(7, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawBooths() {
    var ctx = R.ctx;
    for (var i = 0; i < booths.length; i++) {
      var b = booths[i];
      ctx.save();
      ctx.translate(b.x, b.y);
      var lit = !b.dropped;
      var glow = b.dropped ? '#444' : (i < 2 ? '#0f8' : i < 4 ? '#ff0' : '#f33');
      var p = 0.5 + 0.5 * Math.sin(music.time * 4 + i) + b.pulse;
      ctx.shadowBlur = b.dropped ? 4 : 14 + p * 8;
      ctx.shadowColor = glow;
      ctx.fillStyle = b.dropped ? '#222' : '#16162a';
      R.roundRect(-26, -20, 52, 40, 7);
      ctx.fill();
      ctx.strokeStyle = glow;
      ctx.lineWidth = 2;
      R.roundRect(-26, -20, 52, 40, 7);
      ctx.stroke();
      // platter
      ctx.shadowBlur = 0;
      ctx.fillStyle = b.dropped ? '#333' : glow;
      ctx.beginPath(); ctx.arc(0, 0, 9 + (lit ? p * 2 : 0), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      R.text(b.dropped ? 'DROPPED' : (b.bpm | 0) + 'BPM', b.x, b.y + 32, '9px monospace', b.dropped ? '#555' : glow, 'center');
    }
  }

  function drawParts() {
    var ctx = R.ctx;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      ctx.save();
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = p.col;
      ctx.shadowBlur = 8; ctx.shadowColor = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function drawHUD() {
    var ctx = R.ctx;
    // top bar
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, 30);
    ctx.restore();
    var mins = Math.floor(game.setTimer / 60);
    var secs = Math.floor(game.setTimer % 60);
    var tcol = game.setTimer < 20 ? '#f55' : '#fff';
    R.text((mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs, W * 0.5, 20, 'bold 16px monospace', tcol, 'center');
    R.text('HYPE ' + Math.round(game.crowdHype), 10, 20, '13px monospace', '#0ff', 'left');
    R.text('BOOTHS ' + game.boothsDropped + '/5', W - 10, 20, '13px monospace', '#f0f', 'right');
    R.text(djName || 'DJ', 10, H - 8, '11px monospace', music.avatar.glow, 'left');
    R.text('CROWD ' + game.crowdSize, W - 10, H - 8, '11px monospace', '#ff0', 'right');
  }

  function drawRhythm() {
    if (!mg) return;
    var ctx = R.ctx;
    // panel backdrop
    ctx.save();
    if (mg.flash > 0) {
      ctx.fillStyle = mg.flashCol;
      ctx.globalAlpha = mg.flash * 0.5;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(5,5,18,0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    var laneW = 90;
    var cx = W * 0.5;
    var laneX = [cx - laneW * 0.55, cx + laneW * 0.55];
    var topY = 60;
    var dropY = mg.dropLineY;

    // lanes
    for (var l = 0; l < 2; l++) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = l === mg.marker ? music.avatar.glow : '#444';
      ctx.fillRect(laneX[l] - laneW * 0.45, topY, laneW * 0.9, dropY - topY + 40);
      ctx.restore();
    }

    // drop line with tightening target zone
    var judged = 0;
    for (var c = 0; c < mg.notes.length; c++) if (mg.notes[c].judged) judged++;
    var tighten = clamp(1 - (judged / mg.notes.length) * 0.4, 0.6, 1);
    var beatNear = music.beatPulse;
    ctx.save();
    ctx.shadowBlur = 14 + beatNear * 10;
    ctx.shadowColor = '#0ff';
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - laneW, dropY); ctx.lineTo(cx + laneW, dropY);
    ctx.stroke();
    // target zone box on marker lane
    var zoneH = 26 * tighten;
    ctx.globalAlpha = 0.4 + beatNear * 0.3;
    ctx.fillStyle = music.avatar.glow;
    ctx.fillRect(laneX[mg.marker] - laneW * 0.42, dropY - zoneH, laneW * 0.84, zoneH * 2);
    ctx.restore();

    // notes (fall mapped from time)
    var look = mg.fallTime;
    for (var i = 0; i < mg.notes.length; i++) {
      var n = mg.notes[i];
      var rel = n.time - mg.time; // seconds until it should hit
      if (n.judged && n.fade <= 0) continue;
      if (!n.judged && (rel > look || rel < -0.3)) continue;
      var ny = dropY - (rel / look) * (dropY - topY);
      var nx = laneX[n.lane];
      ctx.save();
      if (n.judged) {
        n.fade -= 1 / 60;
        ctx.globalAlpha = clamp(n.fade / 0.3, 0, 1);
      }
      ctx.shadowBlur = 12; ctx.shadowColor = n.hit ? '#0ff' : (n.lane === 0 ? '#0ff' : '#f0f');
      ctx.fillStyle = n.hit ? '#0ff' : (n.lane === 0 ? '#0ff' : '#f0f');
      R.roundRect(nx - 22, ny - 9, 44, 18, 6);
      ctx.fill();
      ctx.restore();
    }

    // groove marker (the mixer fader)
    ctx.save();
    ctx.shadowBlur = 18; ctx.shadowColor = music.avatar.glow;
    ctx.fillStyle = music.avatar.glow;
    var mx = laneX[mg.marker];
    ctx.beginPath();
    ctx.moveTo(mx, dropY + 22);
    ctx.lineTo(mx - 12, dropY + 40);
    ctx.lineTo(mx + 12, dropY + 40);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // judge text
    if (mg.judgeTimer > 0) {
      R.text(mg.lastJudge, cx, dropY - 60, 'bold 26px monospace',
        mg.lastJudge === 'PERFECT' ? '#0ff' : mg.lastJudge === 'GOOD' ? '#5f5' : '#f55', 'center');
    }

    // mini HUD
    R.text('COMBO ' + mg.combo + '  x' + mg.multiplier.toFixed(1), cx, 38, 'bold 14px monospace', '#fff', 'center');
    R.text('MISS ' + mg.misses + '/2', cx, topY - 22, '12px monospace', mg.misses >= 1 ? '#f55' : '#888', 'center');

    // bonus availability
    var by = H - 60;
    var labels = [
      { k: 'A', n: 'PANEL', req: 3, on: mg.bonuses.panel > 0, col: '#f0f' },
      { k: 'S', n: 'LASER', req: 5, on: mg.bonuses.laser > 0, col: '#0ff' },
      { k: 'D', n: 'DISCO', req: 7, on: mg.bonuses.disco > 0, col: '#ff0' },
      { k: 'F', n: 'BALLOON', req: 9, on: mg.bonuses.balloon > 0, col: '#0f8' }
    ];
    for (var bI = 0; bI < labels.length; bI++) {
      var lb = labels[bI];
      var avail = mg.combo >= lb.req;
      var bx = 40 + bI * (W - 80) / 4;
      R.text('[' + lb.k + '] ' + lb.n, bx, by,
        '11px monospace', lb.on ? lb.col : (avail ? '#fff' : '#555'), 'left');
    }

    if (feedT > 0) R.text(feedTxt, cx, H * 0.4, 'bold 22px monospace', feedCol, 'center');
  }

  function drawAvatarSelect() {
    var ctx = R.ctx;
    ctx.fillStyle = '#08081a';
    ctx.fillRect(0, 0, W, H);
    R.text('PICK YOUR DJ', W * 0.5, 60, 'bold 28px monospace', '#0ff', 'center');
    R.text('< LEFT / RIGHT >   SPACE to confirm', W * 0.5, 92, '13px monospace', '#aaa', 'center');
    var n = AVATARS.length;
    var slotW = W / n;
    for (var i = 0; i < n; i++) {
      var av = AVATARS[i];
      var x = slotW * i + slotW * 0.5;
      var y = H * 0.45;
      var sel = i === selectedAvatar;
      ctx.save();
      ctx.translate(x, y);
      ctx.shadowBlur = sel ? 22 : 8;
      ctx.shadowColor = av.glow;
      ctx.fillStyle = sel ? '#1c1c34' : '#12121f';
      R.roundRect(-slotW * 0.36, -55, slotW * 0.72, 110, 10);
      ctx.fill();
      ctx.strokeStyle = av.glow;
      ctx.lineWidth = sel ? 3 : 1;
      R.roundRect(-slotW * 0.36, -55, slotW * 0.72, 110, 10);
      ctx.stroke();
      // headphone avatar
      ctx.shadowBlur = sel ? 16 : 6;
      ctx.fillStyle = av.col;
      ctx.beginPath(); ctx.arc(0, -10, 20, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -10, 26, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.restore();
      R.text(av.name, x, y + 45, 'bold 14px monospace', sel ? av.col : '#888', 'center');
      R.text(av.track, x, y + 64, '10px monospace', sel ? '#fff' : '#555', 'center');
    }
  }

  function drawNameEntry() {
    var ctx = R.ctx;
    ctx.fillStyle = '#08081a';
    ctx.fillRect(0, 0, W, H);
    var av = AVATARS[selectedAvatar];
    R.text('NAME YOUR DJ', W * 0.5, 70, 'bold 26px monospace', av.glow, 'center');
    // current name
    ctx.save();
    ctx.shadowBlur = 12; ctx.shadowColor = av.glow;
    R.text((djName || '_') + (djName.length < 8 ? '|' : ''), W * 0.5, H * 0.42, 'bold 36px monospace', '#fff', 'center');
    ctx.restore();
    // char picker
    R.text('< char >  UP add  DOWN del  ENTER start', W * 0.5, H * 0.42 + 50, '12px monospace', '#aaa', 'center');
    ctx.save();
    ctx.shadowBlur = 14; ctx.shadowColor = av.glow;
    R.text(NAME_CHARS.charAt(nameCursor), W * 0.5, H * 0.42 + 95, 'bold 30px monospace', av.glow, 'center');
    ctx.restore();
    R.text('LOADOUT: ' + loadout.needle.name + ' / ' + loadout.mixer.name + ' / ' + loadout.speaker.name,
      W * 0.5, H - 40, '10px monospace', '#666', 'center');
  }

  function draw() {
    var ctx = R.ctx;
    ctx.save();
    if (shake > 0.5) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    if (phase === 'avatar') { drawAvatarSelect(); ctx.restore(); return; }
    if (phase === 'name') { drawNameEntry(); ctx.restore(); return; }

    drawBackground();
    drawBooths();
    if (mode !== 'rhythm') {
      // home booth marker
      ctx.save();
      ctx.shadowBlur = 12; ctx.shadowColor = '#fff';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      R.roundRect(HOME.x - 22, HOME.y - 16, 44, 32, 6); ctx.stroke();
      ctx.restore();
      R.text('HOME', HOME.x, HOME.y + 28, '9px monospace', '#fff', 'center');
      drawCart();
      // cue hint
      for (var i = 0; i < booths.length; i++) {
        var b = booths[i];
        if (!b.dropped && dist2(cart, b) < 44 * 44) {
          R.text('SPACE: CUE RECORD', cart.x, cart.y - 26, '11px monospace', '#0ff', 'center');
        }
      }
      if (mode === 'returning') R.text('ROLLING HOME...', W * 0.5, H * 0.5, 'bold 18px monospace', '#0ff', 'center');
    }
    drawParts();
    drawHUD();
    if (mode === 'rhythm') drawRhythm();

    ctx.restore();
  }

  return { update: update, draw: draw };
};
})();