(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.mechanics=window.MMKit.mechanics||{};
MMKit.mechanics.NeonPlay = function (config, game) {
  var W = R.W, H = R.H;

  // ---------- helpers ----------
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // ---------- avatars / tracks ----------
  var AVATARS = [
    { name: 'NOVA',  color: '#22ffff', bpm: 96,  desc: 'Synthwave' },
    { name: 'BLAZE', color: '#ff5588', bpm: 120, desc: 'Electro House' },
    { name: 'VOLT',  color: '#ffdd33', bpm: 140, desc: 'Drum & Bass' },
    { name: 'ECHO',  color: '#aa66ff', bpm: 108, desc: 'Deep Tech' }
  ];

  // ---------- synth audio (real track to score to) ----------
  var AC = null;
  try { AC = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null; } catch (e) { AC = null; }
  var masterGain = null;
  if (AC) { masterGain = AC.createGain(); masterGain.gain.value = 0.18; masterGain.connect(AC.destination); }

  function beep(freq, dur, type) {
    if (!AC) return;
    try {
      if (AC.state === 'suspended') AC.resume();
      var o = AC.createOscillator(), g = AC.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, AC.currentTime);
      g.gain.exponentialRampToValueAtTime(0.5, AC.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
      o.connect(g); g.connect(masterGain);
      o.start(); o.stop(AC.currentTime + dur + 0.02);
    } catch (e) {}
  }

  // background music loop driven by booth bpm + avatar
  var music = { t: 0, beat: 0, bpm: 96, base: 110, on: false };
  function startMusic(bpm, base) { music.bpm = bpm; music.base = base; music.t = 0; music.beat = 0; music.on = true; }
  function stopMusic() { music.on = false; }
  function tickMusic(dt) {
    if (!music.on) return;
    music.t += dt;
    var beatLen = 60 / music.bpm;
    if (music.t >= beatLen) {
      music.t -= beatLen;
      music.beat++;
      var b = music.beat % 4;
      if (b === 0) beep(music.base, 0.12, 'sine');       // kick
      else beep(music.base * (1 + (b % 2)), 0.07, 'triangle');
      if (b === 2) beep(music.base * 4, 0.04, 'square');
    }
  }

  // ---------- core set state ----------
  game.score = 0;
  game.timer = 120;
  game.hype = 0;            // running Crowd Hype (live)
  game.bankedHype = 0;      // banked at booths (locked-in)
  game.deadAir = 0;
  game.combo = 0;
  game.comboMult = 1;
  game.biggestStreak = 0;
  game.bonusesTriggered = 0;
  game.crowdSize = 0;
  game.boothsDropped = 0;
  game.resultsState = game.resultsState || 'RESULTS';

  // ---------- loadout (weakest start) ----------
  var loadout = {
    needleWindow: 38,    // px good window (bronze narrow)
    perfectWindow: 14,   // px perfect
    needleMult: 1.0,
    speakerGain: 1.0,
    faderChannels: 2,
    workingFaders: 1
  };

  // ---------- procedural floor + booths ----------
  var home = { x: W * 0.5, y: H * 0.86 };
  var seed = (Date.now() & 0xffff) ^ 0x5a3c;
  function rng() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

  var booths = [];
  (function genBooths() {
    var placed = [];
    for (var i = 0; i < 5; i++) {
      var bx, by, tries = 0, ok;
      do {
        bx = 70 + rng() * (W - 140);
        by = 60 + rng() * (H * 0.6);
        ok = true;
        for (var p = 0; p < placed.length; p++) {
          if (Math.hypot(bx - placed[p].x, by - placed[p].y) < 110) { ok = false; break; }
        }
        if (Math.hypot(bx - home.x, by - home.y) < 120) ok = false;
        tries++;
      } while (!ok && tries < 40);
      placed.push({ x: bx, y: by });
    }
    // sort by distance: near = easy, far = hard
    placed.sort(function (a, b) {
      return Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y);
    });
    for (var j = 0; j < placed.length; j++) {
      var dist = Math.hypot(placed[j].x - home.x, placed[j].y - home.y);
      booths.push({
        x: placed[j].x, y: placed[j].y,
        idx: j,
        dist: dist,
        dropped: false,
        bpm: 80 + j * 22,
        density: 0.85 + j * 0.32,
        payout: Math.round(150 + dist * 0.7 + j * 60)
      });
    }
  })();
  game.booths = booths;

  // ---------- deck cart momentum ----------
  var cart = {
    x: home.x, y: home.y, vx: 0, vy: 0,
    accel: 460, dragFwd: 2.7, dragLat: 1.05, maxV: 360,
    facing: -Math.PI / 2, r: 18
  };

  // ---------- mode / phase ----------
  // phases: AVATAR, NAME, ROAM, RHYTHM, RETURN
  var phase = 'AVATAR';
  var selAvatar = 0;
  var djName = '';
  var avatar = AVATARS[0];
  var setEnded = false;

  // ---------- mini-game ----------
  var mg = null;
  var dropLineY = H - 110;
  var laneX = [W / 2 - 100, W / 2 + 100];

  // ---------- mixer / fader ----------
  var fader = { v: 0.5, target: 0.5 }; // 0..1; affects hype gain band

  // ---------- bonuses (stackable dance-floor) ----------
  var bonuses = [
    { key: 'a', streak: 3, t: 0, dur: 5, name: 'FLOOR', color: '#22ff88' },
    { key: 's', streak: 5, t: 0, dur: 5, name: 'LASER', color: '#ff44dd' },
    { key: 'd', streak: 7, t: 0, dur: 5, name: 'DISCO', color: '#ffdd33' },
    { key: 'f', streak: 9, t: 0, dur: 5, name: 'BALLOON', color: '#66ddff' }
  ];
  function activeBonusMult() {
    var m = 1;
    for (var b = 0; b < bonuses.length; b++) if (bonuses[b].t > 0) m += 0.12;
    return m;
  }

  // ---------- juice ----------
  var particles = [];
  function burst(x, y, color, n, spd) {
    for (var k = 0; k < n; k++) {
      var a = Math.random() * Math.PI * 2, s = spd * (0.3 + Math.random());
      particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6 + Math.random() * 0.4, color: color, r: 2 + Math.random() * 3 });
    }
  }
  var shake = 0;
  function addShake(v) { shake = Math.min(shake + v, 16); }
  var feedText = null, feedTimer = 0, feedColor = '#fff';
  function showFeed(t, c) { feedText = t; feedTimer = 0.7; feedColor = c; }

  // ============================================================
  //  SCORE
  // ============================================================
  function recomputeScore() {
    var distBonus = 0;
    for (var i = 0; i < booths.length; i++) if (booths[i].dropped) distBonus += booths[i].payout;
    var live = (game.bankedHype + game.hype) * game.comboMult * activeBonusMult() + distBonus;
    live -= game.deadAir * 4;
    game.score = Math.max(0, Math.floor(live));
  }

  function endSet() {
    if (setEnded) return;
    setEnded = true;
    stopMusic();
    phase = 'RETURN';
  }

  function finalize() {
    game.crowdSize = Math.floor((game.bankedHype + game.hype) * 2 + game.biggestStreak * 25 + game.boothsDropped * 80);
    recomputeScore();
    game.finalScore = game.score;
    game.djName = djName || 'DJ';
    game.avatarName = avatar.name;
    var s = game.score;
    game.rank = s > 5000 ? 'S' : s > 3200 ? 'A' : s > 1800 ? 'B' : s > 700 ? 'C' : 'D';
    R.go(game.resultsState);
  }

  // ============================================================
  //  MINI-GAME
  // ============================================================
  function startMini(booth) {
    mg = {
      booth: booth, lane: 0, notes: [],
      spawnT: 0, beatInterval: 60 / booth.bpm,
      noteSpeed: 230 + booth.idx * 42,
      misses: 0, hits: 0, spawned: 0,
      target: 8 + booth.idx * 3,
      elapsed: 0, targetZone: 1.0
    };
    phase = 'RHYTHM';
    startMusic(booth.bpm, avatar.bpm + booth.idx * 6);
    addShake(6);
    burst(cart.x, cart.y, avatar.color, 22, 3);
  }

  function endMini(cleared) {
    stopMusic();
    if (cleared) {
      mg.booth.dropped = true;
      game.boothsDropped++;
      // BANK hype on clear
      game.bankedHype += game.hype * 0.5;
      var pay = mg.booth.payout * activeBonusMult();
      game.bankedHype += pay;
      game.hype = 0;
      game.crowdSize += 50 + mg.booth.idx * 30;
      showFeed('CROWD ERUPTS! +' + Math.round(pay), '#ffff44');
      addShake(12);
      burst(cart.x, cart.y, '#ffff44', 60, 6);
    } else {
      game.deadAir += 12;
      game.combo = 0; game.comboMult = 1;
      showFeed('SCRATCHED OUT!', '#ff4444');
      addShake(10);
    }
    mg = null;
    phase = 'RETURN';
    cart.vx = 0; cart.vy = 0;
    recomputeScore();
    checkAllDropped();
  }

  function checkAllDropped() {
    var all = true;
    for (var i = 0; i < booths.length; i++) if (!booths[i].dropped) all = false;
    if (all) endSet();
  }

  function registerHit(quality) {
    var base = quality === 'perfect' ? 30 : 15;
    base *= loadout.speakerGain * loadout.needleMult;
    // fader band: closer fader matches "groove zone" -> bonus
    var faderBoost = 1 + (1 - Math.abs(fader.v - 0.65)) * 0.4;
    base *= faderBoost;
    base *= clamp(1 - game.deadAir * 0.03, 0.3, 1);
    base *= activeBonusMult();
    game.hype += base;
    game.combo++;
    if (game.combo > game.biggestStreak) game.biggestStreak = game.combo;
    game.comboMult = 1 + Math.floor(game.combo / 4) * 0.5;
    game.crowdSize += quality === 'perfect' ? 3 : 2;
    mg.hits++;
    beep(avatar.bpm * 4 + (quality === 'perfect' ? 200 : 0), 0.06, 'sawtooth');
  }

  function registerMiss(offbeat) {
    game.deadAir += offbeat ? 2 : 4;
    game.combo = 0; game.comboMult = 1;
    if (!offbeat) mg.misses++;
    beep(70, 0.1, 'sawtooth');
  }

  function updateRhythm(dt, f) {
    mg.elapsed += dt;
    // tightening on-beat target zone (shrinks toward beat windows)
    mg.targetZone = Math.max(0.35, 1.0 - mg.elapsed * 0.025);

    // marker lane slide
    if (R.pressed('ArrowLeft')) mg.lane = 0;
    if (R.pressed('ArrowRight')) mg.lane = 1;

    // fader control (one working fader): Up/Down nudges, drifts back
    if (R.keys['ArrowUp']) fader.target = clamp(fader.target + dt * 1.5, 0, 1);
    if (R.keys['ArrowDown']) fader.target = clamp(fader.target - dt * 1.5, 0, 1);
    fader.target += (0.5 - fader.target) * dt * 0.3;
    fader.v += (fader.target - fader.v) * Math.min(1, dt * 8);

    // spawn notes to beat & density
    var interval = mg.beatInterval / mg.booth.density;
    mg.spawnT += dt;
    if (mg.spawnT >= interval && mg.spawned < mg.target) {
      mg.spawnT -= interval;
      mg.spawned++;
      mg.notes.push({ lane: Math.random() < 0.5 ? 0 : 1, y: 40, judged: false });
    }

    // current tightened windows (px)
    var goodW = loadout.needleWindow * mg.targetZone;
    var perfW = loadout.perfectWindow * mg.targetZone;

    // move notes / detect miss
    for (var n = mg.notes.length - 1; n >= 0; n--) {
      var note = mg.notes[n];
      note.y += mg.noteSpeed * dt;
      if (!note.judged && note.y > dropLineY + goodW) {
        note.judged = true;
        registerMiss(false);
        if (mg.misses >= 2) { endMini(false); return; }
      }
      if (note.y > H + 30) mg.notes.splice(n, 1);
    }

    // strike
    if (R.pressed(' ')) {
      var best = null, bestD = 1e9;
      for (var m = 0; m < mg.notes.length; m++) {
        var nt = mg.notes[m];
        if (nt.judged || nt.lane !== mg.lane) continue;
        var d = Math.abs(nt.y - dropLineY);
        if (d < bestD) { bestD = d; best = nt; }
      }
      if (best && bestD <= goodW) {
        best.judged = true;
        var q = bestD <= perfW ? 'perfect' : 'good';
        registerHit(q);
        burst(laneX[mg.lane], dropLineY, q === 'perfect' ? '#44ffff' : '#88ff44', 18, 4);
        showFeed(q === 'perfect' ? 'PERFECT' : 'GOOD', q === 'perfect' ? '#44ffff' : '#88ff44');
      } else {
        registerMiss(true);
        showFeed('OFF BEAT', '#ff8844');
      }
    }

    // clear condition
    if (mg.spawned >= mg.target && mg.notes.length === 0) { endMini(true); return; }
  }

  // ============================================================
  //  ROAM (momentum physics)
  // ============================================================
  function updateRoam(dt) {
    var ax = 0, ay = 0;
    if (R.keys['ArrowLeft']) ax -= 1;
    if (R.keys['ArrowRight']) ax += 1;
    if (R.keys['ArrowUp']) ay -= 1;
    if (R.keys['ArrowDown']) ay += 1;
    var mag = Math.hypot(ax, ay);
    if (mag > 0) {
      ax /= mag; ay /= mag;
      cart.vx += ax * cart.accel * dt;
      cart.vy += ay * cart.accel * dt;
      cart.facing = Math.atan2(ay, ax);
    }
    // forward vs lateral damping (skid)
    var sp = Math.hypot(cart.vx, cart.vy);
    if (sp > 0.001) {
      var fx = Math.cos(cart.facing), fy = Math.sin(cart.facing);
      var fwd = cart.vx * fx + cart.vy * fy;
      var latx = cart.vx - fwd * fx, laty = cart.vy - fwd * fy;
      fwd *= (1 - cart.dragFwd * dt);
      latx *= (1 - cart.dragLat * dt);
      laty *= (1 - cart.dragLat * dt);
      cart.vx = fwd * fx + latx;
      cart.vy = fwd * fy + laty;
    }
    sp = Math.hypot(cart.vx, cart.vy);
    if (sp > cart.maxV) { cart.vx *= cart.maxV / sp; cart.vy *= cart.maxV / sp; }

    cart.x += cart.vx * dt;
    cart.y += cart.vy * dt;

    if (cart.x < cart.r) { cart.x = cart.r; cart.vx *= -0.4; }
    if (cart.x > W - cart.r) { cart.x = W - cart.r; cart.vx *= -0.4; }
    if (cart.y < cart.r + 50) { cart.y = cart.r + 50; cart.vy *= -0.4; }
    if (cart.y > H - cart.r) { cart.y = H - cart.r; cart.vy *= -0.4; }

    // trail
    if (sp > 120 && Math.random() < 0.5)
      particles.push({ x: cart.x, y: cart.y, vx: 0, vy: 0, life: 0.3, color: avatar.color, r: 4 });

    // cue at booth
    for (var i = 0; i < booths.length; i++) {
      var b = booths[i];
      if (b.dropped) continue;
      if (Math.hypot(b.x - cart.x, b.y - cart.y) < 52 && R.pressed(' ')) {
        cart.vx = 0; cart.vy = 0;
        startMini(b);
        return;
      }
    }
  }

  function updateReturn(dt) {
    var dx = home.x - cart.x, dy = home.y - cart.y;
    var d = Math.hypot(dx, dy);
    if (d < 18) {
      cart.x = home.x; cart.y = home.y; cart.vx = 0; cart.vy = 0;
      if (setEnded) { finalize(); return; }
      phase = 'ROAM';
      return;
    }
    cart.facing = Math.atan2(dy, dx);
    cart.vx += (dx / d) * cart.accel * dt;
    cart.vy += (dy / d) * cart.accel * dt;
    cart.vx *= (1 - cart.dragFwd * dt);
    cart.vy *= (1 - cart.dragFwd * dt);
    cart.x += cart.vx * dt;
    cart.y += cart.vy * dt;
  }

  // ============================================================
  //  UPDATE
  // ============================================================
  function update(dt) {
    if (R.current() !== 'GAMEPLAY') return;
    dt = num(dt, 1 / 60);
    if (dt > 0.1) dt = 0.1;
    var f = dt * 60;

    // shake decay
    if (shake > 0) { shake -= f * 0.7; if (shake < 0) shake = 0; }
    if (feedTimer > 0) feedTimer -= dt;

    // particles
    for (var p = particles.length - 1; p >= 0; p--) {
      var pt = particles[p];
      pt.x += pt.vx * f; pt.y += pt.vy * f; pt.vy += 0.15 * f; pt.vx *= 0.96;
      pt.life -= dt;
      if (pt.life <= 0) particles.splice(p, 1);
    }

    // -------- pre-game flow --------
    if (phase === 'AVATAR') {
      if (R.pressed('ArrowLeft')) selAvatar = (selAvatar + AVATARS.length - 1) % AVATARS.length;
      if (R.pressed('ArrowRight')) selAvatar = (selAvatar + 1) % AVATARS.length;
      if (R.pressed(' ') || R.pressed('Enter')) { avatar = AVATARS[selAvatar]; phase = 'NAME'; }
      return;
    }
    if (phase === 'NAME') {
      var keys = 'abcdefghijklmnopqrstuvwxyz';
      for (var ci = 0; ci < keys.length; ci++) {
        if (R.pressed(keys[ci]) && djName.length < 8) djName += keys[ci].toUpperCase();
      }
      if (R.pressed('Backspace') && djName.length) djName = djName.slice(0, -1);
      if ((R.pressed('Enter') || R.pressed(' ')) && djName.length) phase = 'ROAM';
      return;
    }

    // -------- timer / end conditions --------
    if (!setEnded) {
      game.timer -= dt;
      if (game.timer <= 0) { game.timer = 0; endSet(); }
    }

    // bonus timers
    for (var b = 0; b < bonuses.length; b++) if (bonuses[b].t > 0) bonuses[b].t -= dt;

    // bonus triggers (stackable, from combo context)
    for (var bn = 0; bn < bonuses.length; bn++) {
      var bo = bonuses[bn];
      if (R.pressed(bo.key) && game.combo >= bo.streak && bo.t <= 0) {
        bo.t = bo.dur;
        game.bonusesTriggered++;
        addShake(8);
        burst(W / 2, H / 2, bo.color, 40, 5);
        showFeed(bo.name + ' BONUS!', bo.color);
      }
    }

    tickMusic(dt);

    if (phase === 'ROAM') updateRoam(dt);
    else if (phase === 'RHYTHM') updateRhythm(dt, f);
    else if (phase === 'RETURN') updateReturn(dt);

    recomputeScore();
  }

  // ============================================================
  //  DRAW
  // ============================================================
  function neonRect(x, y, w, h, r, fill, stroke) {
    var ctx = R.ctx;
    ctx.save();
    ctx.fillStyle = fill;
    R.roundRect(x, y, w, h, r); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = stroke;
    R.roundRect(x, y, w, h, r); ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    var ctx = R.ctx;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.save();
      ctx.globalAlpha = clamp(p.life * 1.5, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function drawAvatarSelect() {
    var ctx = R.ctx;
    ctx.fillStyle = '#0a0014'; ctx.fillRect(0, 0, W, H);
    R.text('PICK YOUR DJ', W / 2, 60, 'bold 30px monospace', '#ff44dd', 'center');
    R.text('< LEFT / RIGHT >   SPACE to confirm', W / 2, 95, '13px monospace', '#aaa', 'center');
    var n = AVATARS.length, cardW = 120, gap = 24;
    var total = n * cardW + (n - 1) * gap;
    var startX = (W - total) / 2;
    for (var i = 0; i < n; i++) {
      var a = AVATARS[i];
      var x = startX + i * (cardW + gap), y = H / 2 - 70;
      var sel = i === selAvatar;
      neonRect(x, y, cardW, 150, 10, sel ? '#22113a' : '#120824', sel ? a.color : '#443366');
      ctx.save();
      ctx.fillStyle = a.color;
      ctx.beginPath(); ctx.arc(x + cardW / 2, y + 50, 26, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      R.text(a.name, x + cardW / 2, y + 95, 'bold 16px monospace', sel ? a.color : '#ccc', 'center');
      R.text(a.desc, x + cardW / 2, y + 115, '10px monospace', '#999', 'center');
      R.text(a.bpm + ' BPM', x + cardW / 2, y + 133, '10px monospace', '#888', 'center');
    }
  }

  function drawNameEntry() {
    var ctx = R.ctx;
    ctx.fillStyle = '#0a0014'; ctx.fillRect(0, 0, W, H);
    R.text('NAME YOUR DJ', W / 2, H / 2 - 80, 'bold 28px monospace', avatar.color, 'center');
    R.text('TYPE A-Z   BACKSPACE   ENTER', W / 2, H / 2 - 48, '12px monospace', '#aaa', 'center');
    neonRect(W / 2 - 130, H / 2 - 20, 260, 50, 8, '#120824', avatar.color);
    var caret = (Math.floor(Date.now() / 400) % 2) ? '_' : ' ';
    R.text((djName || '') + caret, W / 2, H / 2 + 12, 'bold 24px monospace', '#fff', 'center');
  }

  function drawFloor() {
    var ctx = R.ctx;
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    ctx.fillStyle = '#0a0018'; ctx.fillRect(0, 0, W, H);
    // grid floor
    ctx.strokeStyle = 'rgba(80,40,120,0.3)'; ctx.lineWidth = 1;
    for (var gx = 0; gx < W; gx += 50) { ctx.beginPath(); ctx.moveTo(gx, 50); ctx.lineTo(gx, H); ctx.stroke(); }
    for (var gy = 50; gy < H; gy += 50) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    // home booth
    neonRect(home.x - 26, home.y - 20, 52, 40, 8, '#223', '#66f');
    R.text('HOME', home.x, home.y + 4, '10px monospace', '#9af', 'center');

    // booths
    for (var i = 0; i < booths.length; i++) {
      var b = booths[i];
      var pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300 + i);
      var col = b.dropped ? '#2a6' : avatar.color;
      ctx.save();
      ctx.globalAlpha = b.dropped ? 0.6 : (0.7 + pulse * 0.3);
      neonRect(b.x - 24, b.y - 24, 48, 48, 8, b.dropped ? '#143' : '#301a40', col);
      ctx.restore();
      R.text((i + 1) + (b.dropped ? ' OK' : ''), b.x, b.y - 4, 'bold 13px monospace', '#fff', 'center');
      R.text(b.bpm + 'bpm', b.x, b.y + 14, '9px monospace', '#fdd', 'center');
    }

    // cart
    ctx.save();
    ctx.translate(cart.x, cart.y);
    ctx.rotate(cart.facing + Math.PI / 2);
    ctx.fillStyle = avatar.color;
    R.roundRect(-16, -12, 32, 24, 5); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-7, 0, 4, 0, Math.PI * 2); ctx.arc(7, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    drawParticles();
    ctx.restore();
  }

  function drawMini() {
    var ctx = R.ctx;
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    ctx.fillStyle = '#08001a'; ctx.fillRect(0, 0, W, H);
    var beatPulse = music.on ? (1 - music.t / (60 / music.bpm)) : 0;

    // lanes
    for (var l = 0; l < 2; l++) {
      ctx.save();
      ctx.globalAlpha = 0.18 + (mg.lane === l ? 0.18 : 0);
      ctx.fillStyle = avatar.color;
      ctx.fillRect(laneX[l] - 45, 40, 90, H - 40);
      ctx.restore();
    }

    // tightening target zone around drop line
    var zoneH = loadout.needleWindow * mg.targetZone * 2;
    ctx.save();
    ctx.globalAlpha = 0.25 + beatPulse * 0.3;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(laneX[mg.lane] - 48, dropLineY - zoneH / 2, 96, zoneH);
    ctx.restore();

    // drop line
    ctx.strokeStyle = '#ff44dd'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(laneX[0] - 48, dropLineY); ctx.lineTo(laneX[1] + 48, dropLineY); ctx.stroke();

    // notes
    for (var n = 0; n < mg.notes.length; n++) {
      var note = mg.notes[n];
      if (note.judged) continue;
      ctx.save();
      ctx.fillStyle = note.lane === mg.lane ? '#44ffff' : '#88ff44';
      R.roundRect(laneX[note.lane] - 30, note.y - 12, 60, 24, 6); ctx.fill();
      ctx.restore();
    }

    // groove marker
    ctx.save();
    ctx.fillStyle = '#ffffff';
    R.roundRect(laneX[mg.lane] - 36, dropLineY - 6, 72, 12, 4); ctx.fill();
    ctx.restore();

    // mixer / fader (one working channel)
    var fx = 30, fy = H / 2 - 60, fh = 120;
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
    ctx.strokeRect(fx, fy, 16, fh);
    ctx.fillStyle = (Math.abs(fader.v - 0.65) < 0.2) ? '#22ff88' : '#ff8844';
    ctx.fillRect(fx, fy + (1 - fader.v) * fh - 4, 16, 8);
    R.text('FADER', fx + 8, fy - 8, '9px monospace', '#aaa', 'center');
    R.text('UP/DN', fx + 8, fy + fh + 14, '8px monospace', '#888', 'center');

    drawParticles();

    R.text(avatar.name + ' MIX  ' + mg.booth.bpm + ' BPM', W / 2, 28, 'bold 16px monospace', avatar.color, 'center');
    R.text('LEFT/RIGHT slide  SPACE strike  |  misses ' + mg.misses + '/2', W / 2, H - 26, '12px monospace', '#ccc', 'center');
    R.text('hits ' + mg.hits + '/' + mg.target, W / 2, H - 48, '11px monospace', '#9f9', 'center');

    ctx.restore();
  }

  function drawHUD() {
    var ctx = R.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, 48);
    var t = Math.max(0, game.timer);
    var mm = Math.floor(t / 60), ss = Math.floor(t % 60);
    R.text((mm) + ':' + (ss < 10 ? '0' : '') + ss, 14, 30, 'bold 20px monospace', t < 20 ? '#f44' : '#fff', 'left');
    R.text('SCORE ' + game.score, W / 2, 22, 'bold 16px monospace', '#fff', 'center');
    R.text('HYPE ' + Math.round(game.bankedHype + game.hype) + '  x' + game.comboMult.toFixed(1), W / 2, 40, '11px monospace', '#ff8', 'center');
    R.text('COMBO ' + game.combo, W - 14, 18, 'bold 14px monospace', '#4ff', 'right');
    R.text('BOOTHS ' + game.boothsDropped + '/5', W - 14, 36, '11px monospace', '#9f9', 'right');

    // active bonuses
    var bx = 14, by = 58;
    for (var i = 0; i < bonuses.length; i++) {
      var bo = bonuses[i];
      var active = bo.t > 0;
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.35;
      ctx.fillStyle = active ? bo.color : '#333';
      R.roundRect(bx, by, 64, 18, 4); ctx.fill();
      ctx.restore();
      R.text(bo.name + ' [' + bo.key.toUpperCase() + ']', bx + 32, by + 13, '8px monospace', active ? '#000' : '#888', 'center');
      bx += 70;
    }

    if (feedTimer > 0 && feedText) {
      ctx.save();
      ctx.globalAlpha = clamp(feedTimer * 2, 0, 1);
      R.text(feedText, W / 2, H / 2 - 60, 'bold 28px monospace', feedColor, 'center');
      ctx.restore();
    }
    ctx.restore();
  }

  function draw() {
    if (phase === 'AVATAR') { drawAvatarSelect(); return; }
    if (phase === 'NAME') { drawNameEntry(); return; }
    if (phase === 'RHYTHM') drawMini();
    else drawFloor();
    drawHUD();
  }

  return { update: update, draw: draw };
};
})();