(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.mechanics=window.MMKit.mechanics||{};
MMKit.mechanics.NeonPlay = function (config, game) {
  var W = R.W, H = R.H;

  // =========================================================
  //  PERSISTENT / SHARED GAME META (avatar, name, loadout)
  // =========================================================
  game.dj = game.dj || {};
  if (!game.dj.avatar) {
    // defaults if selection screen wasn't visited
    game.dj.avatar = { key: 'dj_pulse', name: 'Pulse', track: 'neon_drive', tint: '#0ff' };
  }
  if (!game.dj.name) game.dj.name = 'DJ ' + game.dj.avatar.name;

  // weakest loadout always (no progression persisted, as per rules)
  game.loadout = game.loadout || {
    deck: 'Battered Dual Turntable',
    mixer: '2-Channel (1 working fader)',
    needle: 'Bronze',
    needleWindowMul: 1.0,   // narrow
    needleMult: 1.0,        // low multiplier
    speaker: '60-Watt Stack',
    speakerScale: 0.7       // small hype gain
  };

  game.score = 0;
  game.resultsState = game.resultsState || 'RESULTS';

  // =========================================================
  //  STATE
  // =========================================================
  var ld = game.loadout;
  var tint = game.dj.avatar.tint || '#0ff';

  var state = {
    timer: 120,
    cart: { x: W * 0.5, y: H * 0.85, vx: 0, vy: 0 },
    home: { x: W * 0.5, y: H * 0.9 },
    booths: [],
    dropped: 0,
    mode: 'roam',            // roam | rhythm | returning | done
    activeBooth: null,
    hype: 0,
    deadAir: 0,
    combo: 0,
    multiplier: 1,
    bestStreak: 0,
    streak: 0,
    bonusesTriggered: 0,
    crowd: 0,
    particles: [],
    floaties: [],
    bonuses: { panel: 0, laser: 0, disco: 0, balloon: 0 },
    distBonus: 0,
    cueHint: 0
  };
  game.set = state;

  // beat clock for music-synced flashing (avatar track tempo feel)
  var beatClock = 0;

  // =========================================================
  //  PROCEDURAL BOOTH LAYOUT (distance-ranked difficulty)
  // =========================================================
  (function genBooths() {
    var rng = (config && config.seed ? config.seed : 0) || ((Date.now() & 0xffff) + 12345);
    function rand() { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; }

    var raw = [];
    var tries = 0;
    while (raw.length < 5 && tries < 400) {
      tries++;
      var bx = 70 + rand() * (W - 140);
      var by = 70 + rand() * (H * 0.6);
      var ok = true;
      for (var j = 0; j < raw.length; j++) {
        if (Math.hypot(bx - raw[j].x, by - raw[j].y) < 90) { ok = false; break; }
      }
      if (Math.hypot(bx - state.home.x, by - state.home.y) < 70) ok = false;
      if (ok) raw.push({ x: bx, y: by });
    }
    while (raw.length < 5) {
      raw.push({ x: 70 + (raw.length * (W - 140) / 5), y: 90 + raw.length * 40 });
    }

    // sort by distance from home -> nearest = easiest
    raw.sort(function (a, b) {
      return Math.hypot(a.x - state.home.x, a.y - state.home.y) -
             Math.hypot(b.x - state.home.x, b.y - state.home.y);
    });

    for (var i = 0; i < 5; i++) {
      var dist = Math.hypot(raw[i].x - state.home.x, raw[i].y - state.home.y);
      state.booths.push({
        x: raw[i].x, y: raw[i].y,
        r: 28,
        rank: i,
        dropped: false,
        bpm: 80 + i * 22,                       // 80..168
        density: 0.8 + i * 0.35,
        noteCount: 12 + i * 3,
        noteSpeed: 3.6 + i * 0.7,
        payout: Math.round(180 + dist * 0.6 + i * 130),
        dist: dist,
        pulse: Math.random() * Math.PI * 2
      });
    }
  })();

  // =========================================================
  //  RHYTHM SUB-STATE
  // =========================================================
  var rhythm = null;
  var DROP_LINE = H - 90;

  function laneX(lane) {
    var cx = W * 0.5;
    return lane === 0 ? cx - 80 : cx + 80;
  }

  function startRhythm(booth) {
    state.mode = 'rhythm';
    state.activeBooth = booth;
    rhythm = {
      booth: booth,
      notes: [],
      spawnTimer: 0,
      interval: 60 / booth.bpm,
      lane: 0,
      markerX: laneX(0),
      misses: 0,
      cleared: 0,
      total: booth.noteCount,
      spawned: 0,
      noteSpeed: booth.noteSpeed,
      whiffed: false,
      done: false,
      endHold: 0,
      result: '',
      resultTimer: 0,
      resultCol: '#fff'
    };
    state.cart.vx *= 0.2; state.cart.vy *= 0.2;
  }

  function endRhythm() {
    rhythm = null;
    state.activeBooth = null;
    state.mode = 'roam';
    if (state.dropped >= 5) beginReturn();
  }

  // =========================================================
  //  PARTICLES & FLOATERS (juice)
  // =========================================================
  function burst(x, y, color, n, spd) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = spd * (0.4 + Math.random() * 0.8);
      state.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.4,
        color: color, size: 2 + Math.random() * 3
      });
    }
  }
  function floaty(x, y, text, color) {
    state.floaties.push({ x: x, y: y, text: text, color: color, life: 1.0 });
  }

  // =========================================================
  //  SCORING
  // =========================================================
  function activeBonusMul() {
    var m = 1;
    var k = ['panel', 'laser', 'disco', 'balloon'];
    for (var i = 0; i < k.length; i++) if (state.bonuses[k[i]] > 0) m += 0.1;
    return m;
  }

  function recomputeScore() {
    var deadFactor = Math.max(0.2, 1 - state.deadAir * 0.02);
    var sc = state.hype * state.multiplier * activeBonusMul() * deadFactor;
    sc += state.distBonus;
    state.score = Math.round(sc);
    game.score = state.score;
    game.biggestStreak = state.bestStreak;
    game.bonusesTriggered = state.bonusesTriggered;
    state.crowd = Math.min(5000, Math.round(state.hype * 3 + state.dropped * 140));
    game.crowdSize = state.crowd;
    game.hype = Math.round(state.hype);
    game.deadAir = state.deadAir;
  }

  function dropBooth(booth) {
    if (booth.dropped) return;
    booth.dropped = true;
    state.dropped++;
    state.crowd += 80 + booth.rank * 40;
    state.distBonus += booth.payout;
    burst(booth.x, booth.y, tint, 36, 5);
    floaty(booth.x, booth.y - 30, '+' + booth.payout, '#ff0');
  }

  function beginReturn() {
    if (state.mode === 'done') return;
    state.mode = 'returning';
  }

  function endSet() {
    if (state.mode === 'done') return;
    state.mode = 'done';
    recomputeScore();
    R.go(game.resultsState);
  }

  // =========================================================
  //  BONUS TRIGGERS (streak-gated, stackable)
  // =========================================================
  function triggerBonuses() {
    if (state.streak >= 3 && R.pressed('a') && state.bonuses.panel <= 0) {
      state.bonuses.panel = 6; state.bonusesTriggered++;
      burst(W / 2, H / 2, '#f0f', 30, 4); floaty(W / 2, H * 0.4, 'FLOOR PANELS!', '#f0f');
    }
    if (state.streak >= 5 && R.pressed('s') && state.bonuses.laser <= 0) {
      state.bonuses.laser = 6; state.bonusesTriggered++;
      burst(W / 2, H / 2, '#0ff', 32, 5); floaty(W / 2, H * 0.4, 'LASERS!', '#0ff');
    }
    if (state.streak >= 7 && R.pressed('d') && state.bonuses.disco <= 0) {
      state.bonuses.disco = 6; state.bonusesTriggered++;
      burst(W / 2, H / 2, '#ff0', 34, 5); floaty(W / 2, H * 0.4, 'DISCO BALL!', '#ff0');
    }
    if (state.streak >= 9 && R.pressed('f') && state.bonuses.balloon <= 0) {
      state.bonuses.balloon = 6; state.bonusesTriggered++;
      burst(W / 2, H / 2, '#f44', 44, 6); floaty(W / 2, H * 0.4, 'BALLOON DROP!', '#f44');
    }
  }

  // =========================================================
  //  UPDATE
  // =========================================================
  function update(dt) {
    if (R.current() !== 'GAMEPLAY') return;
    if (dt > 0.1) dt = 0.1;
    var fr = dt * 60;

    beatClock += dt;

    // particles
    for (var i = state.particles.length - 1; i >= 0; i--) {
      var p = state.particles[i];
      p.x += p.vx * fr; p.y += p.vy * fr;
      p.vx *= 0.94; p.vy *= 0.94; p.vy += 0.1 * fr;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (var f = state.floaties.length - 1; f >= 0; f--) {
      var fl = state.floaties[f];
      fl.y -= 0.7 * fr; fl.life -= dt * 1.1;
      if (fl.life <= 0) state.floaties.splice(f, 1);
    }
    for (var b = 0; b < state.booths.length; b++) state.booths[b].pulse += dt * 4;

    // bonus timers
    var bk = ['panel', 'laser', 'disco', 'balloon'];
    for (var k = 0; k < bk.length; k++) {
      if (state.bonuses[bk[k]] > 0) {
        state.bonuses[bk[k]] -= dt;
        if (state.bonuses[bk[k]] < 0) state.bonuses[bk[k]] = 0;
      }
    }

    // timer (stops once returning/done)
    if (state.mode !== 'returning' && state.mode !== 'done') {
      state.timer -= dt;
      if (state.timer <= 0) { state.timer = 0; beginReturn(); }
    }
    if (state.cueHint > 0) state.cueHint -= dt;

    if (state.mode === 'roam') updateRoam(fr, dt);
    else if (state.mode === 'rhythm') updateRhythm(dt, fr);
    else if (state.mode === 'returning') updateReturn(fr);

    recomputeScore();
  }

  // ---- ROAM: momentum cart physics ----
  function updateRoam(fr, dt) {
    var c = state.cart;
    var ACCEL = 0.55;
    if (R.keys['ArrowLeft']) c.vx -= ACCEL * fr;
    if (R.keys['ArrowRight']) c.vx += ACCEL * fr;
    if (R.keys['ArrowUp']) c.vy -= ACCEL * fr;
    if (R.keys['ArrowDown']) c.vy += ACCEL * fr;

    // forward (vy) damps faster; lateral skid (vx) damps slower
    c.vy *= Math.pow(0.93, fr);
    c.vx *= Math.pow(0.965, fr);

    var maxv = 7.5;
    var sp = Math.hypot(c.vx, c.vy);
    if (sp > maxv) { c.vx *= maxv / sp; c.vy *= maxv / sp; }

    c.x += c.vx * fr;
    c.y += c.vy * fr;

    if (c.x < 20) { c.x = 20; c.vx = Math.abs(c.vx) * 0.4; }
    if (c.x > W - 20) { c.x = W - 20; c.vx = -Math.abs(c.vx) * 0.4; }
    if (c.y < 24) { c.y = 24; c.vy = Math.abs(c.vy) * 0.4; }
    if (c.y > H - 24) { c.y = H - 24; c.vy = -Math.abs(c.vy) * 0.4; }

    // drift trail juice
    if (sp > 2.4 && Math.random() < 0.4) burst(c.x, c.y + 8, tint, 1, 1);

    // cue record at near booth
    var near = null;
    for (var i = 0; i < state.booths.length; i++) {
      var bt = state.booths[i];
      if (bt.dropped) continue;
      if (Math.hypot(c.x - bt.x, c.y - bt.y) < bt.r + 22) { near = bt; break; }
    }
    if (near) {
      state.cueHint = 0.2;
      if (R.pressed(' ') || R.pressed('Enter')) startRhythm(near);
    }
  }

  // ---- RETURNING home ----
  function updateReturn(fr) {
    var c = state.cart;
    var dx = state.home.x - c.x, dy = state.home.y - c.y;
    var d = Math.hypot(dx, dy);
    if (d < 10) { endSet(); return; }
    c.vx += (dx / d) * 0.55 * fr;
    c.vy += (dy / d) * 0.55 * fr;
    c.vx *= 0.9; c.vy *= 0.9;
    c.x += c.vx * fr; c.y += c.vy * fr;
  }

  // ---- RHYTHM mini-game ----
  function updateRhythm(dt, fr) {
    if (!rhythm) { state.mode = 'roam'; return; }
    triggerBonuses();

    // groove marker slide
    if (R.pressed('ArrowLeft')) rhythm.lane = 0;
    if (R.pressed('ArrowRight')) rhythm.lane = 1;
    var tx = laneX(rhythm.lane);
    rhythm.markerX += (tx - rhythm.markerX) * Math.min(1, 0.35 * fr);

    if (rhythm.resultTimer > 0) rhythm.resultTimer -= dt;

    // whiff/cleared hold
    if (rhythm.whiffed) {
      rhythm.endHold -= dt;
      if (rhythm.endHold <= 0) endRhythm();
      return;
    }
    if (rhythm.done) {
      rhythm.endHold -= dt;
      if (rhythm.endHold <= 0) endRhythm();
      return;
    }

    // spawn notes on the beat
    if (rhythm.spawned < rhythm.total) {
      rhythm.spawnTimer -= dt;
      if (rhythm.spawnTimer <= 0) {
        rhythm.spawnTimer = rhythm.interval;
        rhythm.notes.push({ lane: Math.random() < 0.5 ? 0 : 1, y: -20, hit: false });
        rhythm.spawned++;
      }
    }

    var spd = rhythm.noteSpeed * fr;
    var struck = R.pressed(' ') || R.pressed('Enter') || R.pressed('ArrowUp');

    // move notes & detect overrun misses
    for (var i = rhythm.notes.length - 1; i >= 0; i--) {
      var n = rhythm.notes[i];
      if (!n.hit) {
        n.y += spd;
        if (n.y > DROP_LINE + 48) {
          n.hit = true;
          registerMiss();
        }
      }
    }

    // strike: nearest unhit note in marker lane within window
    if (struck) {
      var best = null, bestD = 99999;
      for (var j = 0; j < rhythm.notes.length; j++) {
        var nt = rhythm.notes[j];
        if (nt.hit || nt.lane !== rhythm.lane) continue;
        var d = Math.abs(nt.y - DROP_LINE);
        if (d < bestD) { bestD = d; best = nt; }
      }
      var perfWin = 14 * ld.needleWindowMul;
      var goodWin = 34 * ld.needleWindowMul;

      if (!best || bestD > goodWin + 24) {
        // off-beat press -> dead air
        state.deadAir += 1;
        state.combo = 0; state.streak = 0; state.multiplier = 1;
        rhythm.result = 'OFF-BEAT'; rhythm.resultCol = '#888'; rhythm.resultTimer = 0.5;
      } else if (bestD > goodWin) {
        best.hit = true;
        registerMiss();
      } else {
        best.hit = true;
        var col, label, base;
        if (bestD <= perfWin) { label = 'PERFECT'; col = tint; base = 100; }
        else { label = 'GOOD'; col = '#0f0'; base = 55; }

        state.combo++; state.streak++;
        if (state.streak > state.bestStreak) state.bestStreak = state.streak;
        state.multiplier = Math.min(8, 1 + Math.floor(state.combo / 5) * 0.5);

        var deadPenalty = Math.max(0.4, 1 - state.deadAir * 0.03);
        var gain = base * ld.speakerScale * ld.needleMult * state.multiplier * deadPenalty;
        state.hype += gain;
        rhythm.cleared++;

        burst(laneX(best.lane), DROP_LINE, col, 14, 4);
        floaty(laneX(best.lane), DROP_LINE - 24, label, col);
        rhythm.result = label; rhythm.resultCol = col; rhythm.resultTimer = 0.4;
      }
    }

    // remove fully-resolved off-screen notes
    rhythm.notes = rhythm.notes.filter(function (nn) {
      return !(nn.hit && nn.y > DROP_LINE + 60);
    });

    // booth cleared when all notes spawned & resolved
    if (rhythm.spawned >= rhythm.total && rhythm.notes.length === 0 && !rhythm.done) {
      rhythm.done = true;
      rhythm.endHold = 1.1;
      rhythm.result = 'CROWD GOES WILD!';
      rhythm.resultCol = '#ff0';
      rhythm.resultTimer = 1.1;
      dropBooth(rhythm.booth);
    }
  }

  function registerMiss() {
    if (!rhythm) return;
    rhythm.misses++;
    state.combo = 0; state.streak = 0; state.multiplier = 1;
    state.deadAir += 1;
    rhythm.result = 'MISS'; rhythm.resultCol = '#f44'; rhythm.resultTimer = 0.5;
    if (rhythm.misses >= 2 && !rhythm.done) {
      rhythm.whiffed = true;
      rhythm.endHold = 1.2;
      rhythm.result = 'WHIFF! SCRATCHED';
      rhythm.resultCol = '#f44';
      rhythm.resultTimer = 1.2;
    }
  }

  // =========================================================
  //  RENDER
  // =========================================================
  function fmtTime(t) {
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  function draw() {
    if (R.current() !== 'GAMEPLAY') return;
    var ctx = R.ctx;
    var beat = (Math.sin(beatClock * 6) * 0.5 + 0.5);

    // floor
    ctx.fillStyle = '#0a0612';
    ctx.fillRect(0, 0, W, H);

    // neon grid floor
    ctx.strokeStyle = 'rgba(' + (state.bonuses.laser > 0 ? '0,255,255' : '80,40,120') + ',0.25)';
    ctx.lineWidth = 1;
    for (var gx = 0; gx <= W; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (var gy = 0; gy <= H; gy += 40) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

    // dance-floor disco flashes
    if (state.bonuses.disco > 0 || state.bonuses.panel > 0) {
      ctx.globalAlpha = 0.08 + beat * 0.06;
      ctx.fillStyle = state.bonuses.disco > 0 ? '#ff0' : '#f0f';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    if (state.mode === 'roam' || state.mode === 'returning') {
      drawFloorScene(ctx, beat);
    } else if (state.mode === 'rhythm') {
      drawRhythm(ctx, beat);
    }

    drawParticles(ctx);
    drawFloaties(ctx);
    drawHUD(ctx);
  }

  function drawFloorScene(ctx, beat) {
    // home booth
    ctx.fillStyle = '#221033';
    R.roundRect(state.home.x - 26, state.home.y - 18, 52, 32, 6);
    ctx.fill();
    R.text('HOME', state.home.x, state.home.y - 26, '10px monospace', '#aaa', 'center');

    // booths
    for (var i = 0; i < state.booths.length; i++) {
      var b = state.booths[i];
      var pulse = Math.sin(b.pulse) * 0.5 + 0.5;
      if (b.dropped) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        R.text('\u2713', b.x, b.y + 5, 'bold 18px monospace', '#0f0', 'center');
      } else {
        ctx.shadowBlur = 12 + pulse * 10;
        ctx.shadowColor = tint;
        ctx.fillStyle = 'rgba(0,255,255,' + (0.25 + pulse * 0.3) + ')';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = tint; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
        R.text((b.rank + 1) + '', b.x, b.y + 5, 'bold 15px monospace', '#fff', 'center');
        R.text(b.bpm + 'BPM', b.x, b.y + b.r + 12, '9px monospace', '#0aa', 'center');
      }
    }

    // cart (deck-cart)
    var c = state.cart;
    var sp = Math.hypot(c.vx, c.vy);
    ctx.save();
    ctx.translate(c.x, c.y);
    if (sp > 0.1) ctx.rotate(Math.atan2(c.vy, c.vx) * 0.15);
    ctx.shadowBlur = 8; ctx.shadowColor = tint;
    ctx.fillStyle = '#15101f';
    R.roundRect(-18, -12, 36, 24, 5); ctx.fill();
    ctx.shadowBlur = 0;
    // turntables
    ctx.fillStyle = tint;
    ctx.beginPath(); ctx.arc(-8, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-8, 0, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, 0, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (state.cueHint > 0 && state.mode === 'roam') {
      R.text('[SPACE] CUE RECORD', c.x, c.y - 24, 'bold 11px monospace', '#ff0', 'center');
    }
    if (state.mode === 'returning') {
      R.text('SET OVER - ROLLING HOME...', W / 2, 40, 'bold 14px monospace', '#ff0', 'center');
    }
  }

  function drawRhythm(ctx, beat) {
    var bt = state.activeBooth;
    var laneW = 90;
    var cx = W * 0.5;

    // lane backdrop
    ctx.fillStyle = 'rgba(20,10,35,0.85)';
    ctx.fillRect(cx - laneW - 30, 60, (laneW + 30) * 2, H - 120);

    for (var l = 0; l < 2; l++) {
      var lx = laneX(l);
      ctx.fillStyle = (rhythm.lane === l) ? 'rgba(0,255,255,0.10)' : 'rgba(255,255,255,0.03)';
      ctx.fillRect(lx - 36, 60, 72, H - 120);
      ctx.strokeStyle = 'rgba(120,120,160,0.3)'; ctx.lineWidth = 1;
      ctx.strokeRect(lx - 36, 60, 72, H - 120);
    }

    // tightening on-beat target zone (pulses with beat)
    var zone = 20 + beat * 18;
    ctx.strokeStyle = 'rgba(255,255,0,' + (0.4 + beat * 0.4) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - laneW - 30, DROP_LINE - zone); ctx.lineTo(cx + laneW + 30, DROP_LINE - zone);
    ctx.moveTo(cx - laneW - 30, DROP_LINE + zone); ctx.lineTo(cx + laneW + 30, DROP_LINE + zone);
    ctx.stroke();

    // glowing drop-line
    ctx.shadowBlur = 14; ctx.shadowColor = tint;
    ctx.strokeStyle = tint; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - laneW - 30, DROP_LINE); ctx.lineTo(cx + laneW + 30, DROP_LINE);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // notes
    for (var i = 0; i < rhythm.notes.length; i++) {
      var n = rhythm.notes[i];
      if (n.hit) continue;
      var nx = laneX(n.lane);
      ctx.shadowBlur = 8; ctx.shadowColor = '#f0f';
      ctx.fillStyle = n.lane === rhythm.lane ? '#f0f' : '#a4a';
      R.roundRect(nx - 24, n.y - 8, 48, 16, 4); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // groove marker
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(rhythm.markerX, DROP_LINE - 16);
    ctx.lineTo(rhythm.markerX - 10, DROP_LINE - 30);
    ctx.lineTo(rhythm.markerX + 10, DROP_LINE - 30);
    ctx.closePath(); ctx.fill();

    // booth / track info
    R.text('BOOTH ' + (bt.rank + 1) + '  -  ' + bt.bpm + ' BPM', W / 2, 44, 'bold 13px monospace', tint, 'center');
    R.text('\u266A ' + game.dj.avatar.track, W / 2, 76, '10px monospace', '#0aa', 'center');
    R.text('NOTES ' + rhythm.cleared + '/' + rhythm.total + '   MISSES ' + rhythm.misses + '/2',
      W / 2, H - 36, '11px monospace', '#ccc', 'center');

    // result flash
    if (rhythm.resultTimer > 0) {
      R.text(rhythm.result, W / 2, H * 0.5, 'bold 22px monospace', rhythm.resultCol, 'center');
    }

    R.text('\u2190\u2192 LANE   [SPACE] STRIKE   A/S/D/F BONUS', W / 2, H - 16, '9px monospace', '#777', 'center');
  }

  function drawParticles(ctx) {
    for (var i = 0; i < state.particles.length; i++) {
      var p = state.particles[i];
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaties(ctx) {
    for (var i = 0; i < state.floaties.length; i++) {
      var fl = state.floaties[i];
      ctx.globalAlpha = Math.max(0, fl.life);
      R.text(fl.text, fl.x, fl.y, 'bold 13px monospace', fl.color, 'center');
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD(ctx) {
    // top bar
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, 26);

    R.text(game.dj.name, 8, 17, 'bold 12px monospace', tint, 'left');
    var tcol = state.timer < 20 ? '#f44' : '#fff';
    R.text('\u23F1 ' + fmtTime(state.timer), W / 2, 17, 'bold 14px monospace', tcol, 'center');
    R.text('SCORE ' + state.score, W - 8, 17, 'bold 12px monospace', '#ff0', 'right');

    // hype / dead-air / combo bar (second row)
    R.text('HYPE ' + Math.round(state.hype), 8, H - 8, '11px monospace', '#0f0', 'left');
    R.text('DEAD AIR ' + state.deadAir, W / 2, H - 8, '11px monospace', '#f44', 'center');
    if (state.mode !== 'rhythm') {
      R.text('BOOTHS ' + state.dropped + '/5   x' + state.multiplier.toFixed(1),
        W - 8, H - 8, '11px monospace', '#0ff', 'right');
    }

    // streak badge
    if (state.streak > 1) {
      R.text(state.streak + ' STREAK  x' + state.multiplier.toFixed(1),
        W / 2, 50, 'bold 12px monospace', '#ff0', 'center');
    }

    // active bonuses
    var labels = { panel: 'PANELS', laser: 'LASERS', disco: 'DISCO', balloon: 'BALLOONS' };
    var bx = 8, k = ['panel', 'laser', 'disco', 'balloon'];
    for (var i = 0; i < k.length; i++) {
      if (state.bonuses[k[i]] > 0) {
        R.text('+' + labels[k[i]], bx, 40, '9px monospace', '#f0f', 'left');
        bx += 70;
      }
    }
  }

  // =========================================================
  //  REGISTER
  // =========================================================
  this.update = update;
  this.draw = draw;
  return this;
};
})();