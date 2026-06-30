(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.mechanics=window.MMKit.mechanics||{};
MMKit.mechanics.NeonPlay = function (config, game) {
  var W = R.W, H = R.H;

  // ---------- helpers ----------
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // ---------- persistent save / loadout ----------
  // Weakest starting loadout (battered deck, 2-channel mixer one fader,
  // Bronze Needle = narrow windows + low mult, 60-watt speaker = small hype gain).
  game.save = game.save || {
    loadout: {
      needle: { name: 'Bronze Needle', perfWin: 0.05, goodWin: 0.11, mult: 1.0 },
      speaker: { name: '60-Watt Stack', hypeGain: 1.0 },
      mixer: { name: '2-Channel Mixer', faders: 1 }
    }
  };
  var loadout = game.save.loadout;

  // ---------- avatars + per-avatar music tracks ----------
  var AVATARS = [
    { key: 'spr_dj_neon',  name: 'NOVA',  track: { name: 'Pulse Drive',  baseBPM: 92,  scale: [0, 3, 5, 7, 10], col: '#0ff' } },
    { key: 'spr_dj_vapor', name: 'VAPR',  track: { name: 'Velvet Synth', baseBPM: 104, scale: [0, 2, 4, 7, 9],  col: '#f0f' } },
    { key: 'spr_dj_bass',  name: 'QUAKE', track: { name: 'Sub Bass War', baseBPM: 120, scale: [0, 2, 3, 7, 8],  col: '#0f8' } }
  ];

  // ---------- run state ----------
  game.score = 0;
  game.resultsState = game.resultsState || 'RESULTS';
  var hype = 0;
  var deadAir = 0;
  var biggestStreak = 0;
  var bonusesTriggered = 0;
  var crowdSize = 0;
  var dropped = 0;
  var streak = 0;
  var comboMult = 1;

  var timeLeft = 120;
  var setEnded = false;

  // phases: 'select' -> 'name' -> 'roam' -> 'mini' -> 'returning' -> 'done'
  var phase = 'select';
  var selIdx = 0;
  var avatar = null;
  var djName = '';
  var nameMax = 10;
  var nameLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
  var letIdx = 0;

  // ---------- procedural floor / booths ----------
  var home = { x: W * 0.5, y: H * 0.9 };
  var booths = [];
  (function () {
    var seed = 1337;
    function rng() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    for (var i = 0; i < 5; i++) {
      var bx = 70 + rng() * (W - 140);
      var by = 70 + rng() * (H * 0.6);
      var dist = (i + 1) / 5; // normalized difficulty: nearer easier
      booths.push({
        x: bx, y: by, idx: i, dist: dist,
        bpm: 80 + dist * 90,
        density: 0.6 + dist * 0.8,
        payout: Math.round(200 + dist * 800),
        dropped: false
      });
    }
  })();

  // ---------- deck-cart (momentum) ----------
  var cart = { x: home.x, y: home.y, vx: 0, vy: 0, accel: 480 };
  var FWD_DAMP = 0.985;  // forward glides (damps slow)
  var SKID_DAMP = 0.992; // lateral skid damps EVEN SLOWER than forward (per rules)
  var MAXV = 360;

  // ---------- particles ----------
  var particles = [];
  function burst(x, y, n, col, spd) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = spd * (0.3 + Math.random());
      particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.5, max: 1, col: col, r: 2 + Math.random() * 3 });
    }
  }

  // ---------- stackable dance-floor bonuses ----------
  // Earned automatically as performance streak crosses thresholds (not manual keys).
  var bonuses = [
    { name: 'Floor Panels', streak: 4,  dur: 7, t: 0, given: false, col: '#08f' },
    { name: 'Laser Beams',  streak: 8,  dur: 7, t: 0, given: false, col: '#0ff' },
    { name: 'Disco Ball',   streak: 12, dur: 7, t: 0, given: false, col: '#ff0' },
    { name: 'Balloon Drop', streak: 16, dur: 7, t: 0, given: false, col: '#f0f' }
  ];
  function checkBonusUnlocks() {
    for (var i = 0; i < bonuses.length; i++) {
      var b = bonuses[i];
      if (!b.given && streak >= b.streak) {
        b.given = true; b.t = b.dur; bonusesTriggered++;
        burst(W * 0.5, H * 0.4, 30, b.col, 240);
      }
    }
  }
  function bonusMult() {
    var m = 1;
    for (var i = 0; i < bonuses.length; i++) if (bonuses[i].t > 0) m += 0.1;
    return m;
  }

  // ---------- mini-game ----------
  var mini = null;
  function laneX(lane) { return W * 0.5 + (lane === 0 ? -90 : 90); }

  function startMini(booth) {
    phase = 'mini';
    var beat = 60 / booth.bpm;
    var count = Math.round(10 + booth.density * 8);
    var notes = [];
    var scale = avatar.track.scale;
    // notes spawned ON the music track's beat grid (rhythm sync to selected track)
    for (var i = 0; i < count; i++) {
      var step = scale[i % scale.length];
      notes.push({
        lane: (step % 2 === 0) ? 0 : 1, // melodic lane mapping from track scale
        t: 1.4 + i * beat,
        judged: false, hit: false
      });
    }
    mini = {
      booth: booth, notes: notes, time: 0,
      fallDur: 1.4, lineY: H * 0.78, marker: 0,
      misses: 0, perfWin: loadout.needle.perfWin, goodWin: loadout.needle.goodWin,
      flash: 0, shake: 0, judge: '', judgeT: 0, done: false,
      targetZone: 1.0, beat: beat
    };
  }

  function endMini(cleared) {
    var b = mini.booth;
    if (cleared) {
      b.dropped = true; dropped++;
      hype += b.payout * 0.3;
      crowdSize += Math.round(30 + b.dist * 80);
      burst(b.x, b.y, 40, '#ff0', 300);
    }
    mini = null;
    if (dropped >= 5 && !setEnded) { beginReturn(); }
    else { phase = setEnded ? 'returning' : 'roam'; if (setEnded) beginReturn(); }
  }

  function registerHit(m, kind) {
    streak++;
    if (streak > biggestStreak) biggestStreak = streak;
    comboMult = 1 + Math.floor(streak / 4) * 0.25;
    checkBonusUnlocks();
    var base = (kind === 'perfect' ? 14 : 8);
    var deadFactor = clamp(1 - deadAir * 0.01, 0.3, 1);
    hype += base * loadout.needle.mult * loadout.speaker.hypeGain *
            comboMult * bonusMult() * deadFactor;
    crowdSize += (kind === 'perfect' ? 3 : 1);
    m.flash = 0.25; m.judge = kind.toUpperCase(); m.judgeT = 0.5;
    burst(laneX(m.marker), m.lineY, kind === 'perfect' ? 18 : 10,
          kind === 'perfect' ? avatar.track.col : '#0f8', 220);
  }

  function registerMiss(m) {
    streak = 0; comboMult = 1;
    deadAir += 2; m.misses++;
    m.shake = 0.3; m.judge = 'MISS'; m.judgeT = 0.5;
    burst(W * 0.5, m.lineY, 8, '#f44', 160);
    if (m.misses >= 2) { m.judge = 'SCRATCHED!'; endMini(false); }
  }

  function registerOffbeat(m) {
    streak = 0; comboMult = 1;
    deadAir += 1; m.shake = 0.2; m.judge = 'OFF-BEAT'; m.judgeT = 0.4;
  }

  // ---------- phase transitions ----------
  function beginReturn() { phase = 'returning'; setEnded = true; }

  function recomputeScore() {
    var distBonus = 0;
    for (var i = 0; i < booths.length; i++)
      if (booths[i].dropped) distBonus += booths[i].payout;
    game.score = Math.max(0, Math.round(hype * comboMult * bonusMult() + distBonus));
  }

  function tallyAndFinish() {
    phase = 'done';
    recomputeScore();
    crowdSize += Math.round(hype * 0.5);
    game.result = {
      djName: djName || 'DJ ???',
      avatar: avatar ? avatar.name : '?',
      track: avatar ? avatar.track.name : '?',
      score: game.score,
      biggestStreak: biggestStreak,
      bonuses: bonusesTriggered,
      crowd: crowdSize,
      rank: rankBadge(game.score)
    };
    R.go(game.resultsState);
  }

  function rankBadge(s) {
    if (s >= 6000) return 'S';
    if (s >= 4000) return 'A';
    if (s >= 2500) return 'B';
    if (s >= 1200) return 'C';
    return 'D';
  }

  // ============================================================
  // UPDATE
  // ============================================================
  function update(dt) {
    if (R.current() !== 'GAMEPLAY') return;
    if (!isFinite(dt) || dt <= 0) dt = 1 / 60;
    dt = Math.min(dt, 0.1);
    var f = dt * 60;

    // particles
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.94, f); p.vy *= Math.pow(0.94, f); p.vy += 60 * dt;
      p.life -= dt; if (p.life <= 0) particles.splice(i, 1);
    }
    // bonus timers
    for (i = 0; i < bonuses.length; i++) if (bonuses[i].t > 0) bonuses[i].t = Math.max(0, bonuses[i].t - dt);

    if (phase === 'select') { updateSelect(); return; }
    if (phase === 'name') { updateName(); return; }
    if (phase === 'done') return;

    // live set timer
    if ((phase === 'roam' || phase === 'mini') && !setEnded) {
      timeLeft -= dt;
      if (timeLeft <= 0) { timeLeft = 0; beginReturn(); }
    }

    if (phase === 'returning') { updateReturn(dt); return; }
    if (phase === 'roam') { updateRoam(dt, f); recomputeScore(); return; }
    if (phase === 'mini') { updateMini(dt); recomputeScore(); return; }
  }

  function updateSelect() {
    if (R.pressed('ArrowLeft')) selIdx = (selIdx + AVATARS.length - 1) % AVATARS.length;
    if (R.pressed('ArrowRight')) selIdx = (selIdx + 1) % AVATARS.length;
    if (R.pressed(' ') || R.pressed('Enter')) {
      avatar = AVATARS[selIdx];
      phase = 'name';
    }
  }

  function updateName() {
    if (R.pressed('ArrowUp')) letIdx = (letIdx + nameLetters.length - 1) % nameLetters.length;
    if (R.pressed('ArrowDown')) letIdx = (letIdx + 1) % nameLetters.length;
    if (R.pressed('ArrowRight') || R.pressed(' ')) {
      if (djName.length < nameMax) djName += nameLetters[letIdx];
    }
    if (R.pressed('ArrowLeft')) djName = djName.slice(0, -1);
    if (R.pressed('Enter')) {
      if (!djName) djName = 'DJ ' + avatar.name;
      phase = 'roam';
    }
  }

  function updateRoam(dt, f) {
    var ax = 0, ay = 0;
    if (R.keys['ArrowLeft']) ax -= 1;
    if (R.keys['ArrowRight']) ax += 1;
    if (R.keys['ArrowUp']) ay -= 1;
    if (R.keys['ArrowDown']) ay += 1;
    if (ax || ay) {
      var mag = Math.hypot(ax, ay) || 1;
      cart.vx += (ax / mag) * cart.accel * dt;
      cart.vy += (ay / mag) * cart.accel * dt;
    }
    // forward (dominant axis) glides; lateral skid damps slower
    var absx = Math.abs(cart.vx), absy = Math.abs(cart.vy);
    if (absx >= absy) {
      cart.vx *= Math.pow(FWD_DAMP, f);
      cart.vy *= Math.pow(SKID_DAMP, f);
    } else {
      cart.vy *= Math.pow(FWD_DAMP, f);
      cart.vx *= Math.pow(SKID_DAMP, f);
    }
    var sp = Math.hypot(cart.vx, cart.vy);
    if (sp > MAXV) { cart.vx *= MAXV / sp; cart.vy *= MAXV / sp; }

    cart.x += cart.vx * dt;
    cart.y += cart.vy * dt;
    if (cart.x < 18) { cart.x = 18; cart.vx *= -0.4; }
    if (cart.x > W - 18) { cart.x = W - 18; cart.vx *= -0.4; }
    if (cart.y < 18) { cart.y = 18; cart.vy *= -0.4; }
    if (cart.y > H - 18) { cart.y = H - 18; cart.vy *= -0.4; }

    // cue a booth
    var best = null, bd = 1e9;
    for (var i = 0; i < booths.length; i++) {
      var b = booths[i]; if (b.dropped) continue;
      var d = Math.hypot(b.x - cart.x, b.y - cart.y);
      if (d < bd) { bd = d; best = b; }
    }
    if (best && bd < 48 && (R.pressed(' ') || R.pressed('Enter'))) {
      cart.vx = 0; cart.vy = 0;
      startMini(best);
    }
  }

  function updateReturn(dt) {
    var dx = home.x - cart.x, dy = home.y - cart.y;
    var d = Math.hypot(dx, dy);
    if (d < 8) { cart.x = home.x; cart.y = home.y; tallyAndFinish(); return; }
    cart.x += (dx / d) * 340 * dt;
    cart.y += (dy / d) * 340 * dt;
  }

  function updateMini(dt) {
    var m = mini; if (!m) return;
    m.time += dt;
    if (m.flash > 0) m.flash -= dt;
    if (m.shake > 0) m.shake -= dt;
    if (m.judgeT > 0) m.judgeT -= dt;

    // tighten on-beat target zone over time
    m.targetZone = clamp(1.0 - (m.time / (m.notes.length * m.beat + 2)) * 0.6, 0.4, 1.0);

    if (R.pressed('ArrowLeft')) m.marker = 0;
    if (R.pressed('ArrowRight')) m.marker = 1;

    // strike
    if (R.pressed(' ') || R.pressed('Enter')) {
      var best = null, bd = 1e9;
      for (var i = 0; i < m.notes.length; i++) {
        var n = m.notes[i]; if (n.judged) continue;
        var d = Math.abs(n.t - m.time);
        if (d < bd) { bd = d; best = n; }
      }
      // windows scale with needle quality AND tightening zone
      var pw = m.perfWin * m.targetZone;
      var gw = m.goodWin * (0.6 + 0.4 * m.targetZone);
      if (best && bd <= gw + 0.05) {
        if (best.lane !== m.marker) { registerMiss(m); best.judged = true; }
        else if (bd <= pw) { best.judged = true; best.hit = true; registerHit(m, 'perfect'); }
        else if (bd <= gw) { best.judged = true; best.hit = true; registerHit(m, 'good'); }
        else { best.judged = true; registerMiss(m); }
      } else {
        registerOffbeat(m);
      }
      if (!mini) return; // ended by whiff
    }

    // auto-miss notes that fully pass the line
    for (var j = 0; j < m.notes.length; j++) {
      var nt = m.notes[j];
      if (!nt.judged && m.time - nt.t > m.goodWin + 0.1) {
        nt.judged = true; registerMiss(m);
        if (!mini) return;
      }
    }

    // clear check
    var allDone = true;
    for (var z = 0; z < m.notes.length; z++) if (!m.notes[z].judged) { allDone = false; break; }
    if (allDone) endMini(true);
  }

  // ============================================================
  // DRAW
  // ============================================================
  function draw() {
    var ctx = R.ctx;
    ctx.fillStyle = '#0a0014';
    ctx.fillRect(0, 0, W, H);

    if (phase === 'select') { drawSelect(); return; }
    if (phase === 'name') { drawName(); return; }

    drawFloor();
    drawBooths();
    drawBonuses();
    drawParticles();

    if (phase === 'mini') drawMini();
    else drawCart();

    drawHUD();
  }

  function drawParticles() {
    var ctx = R.ctx;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSelect() {
    R.text('NEON DJ', W / 2, 60, 'bold 40px sans-serif', '#0ff', 'center');
    R.text('PICK YOUR DJ', W / 2, 110, '18px sans-serif', '#f0f', 'center');
    for (var i = 0; i < AVATARS.length; i++) {
      var a = AVATARS[i];
      var x = W / 2 + (i - 1) * 150;
      var y = H / 2 - 20;
      var sel = i === selIdx;
      R.ctx.strokeStyle = sel ? a.track.col : '#333';
      R.ctx.lineWidth = sel ? 3 : 1;
      R.roundRect(x - 55, y - 60, 110, 130, 10);
      R.ctx.stroke();
      R.drawSpr(a.key, x - 32, y - 50, 64, 64);
      R.text(a.name, x, y + 36, 'bold 18px sans-serif', sel ? a.track.col : '#aaa', 'center');
      R.text(a.track.name, x, y + 56, '12px sans-serif', '#888', 'center');
    }
    R.text('< / >  choose    SPACE select', W / 2, H - 40, '14px sans-serif', '#0ff', 'center');
  }

  function drawName() {
    R.text('NAME YOUR DJ', W / 2, 90, 'bold 28px sans-serif', avatar.track.col, 'center');
    R.ctx.strokeStyle = '#0ff';
    R.roundRect(W / 2 - 150, H / 2 - 30, 300, 60, 8);
    R.ctx.stroke();
    R.text(djName + '_', W / 2, H / 2 + 8, 'bold 26px monospace', '#fff', 'center');
    R.text('letter: [ ' + nameLetters[letIdx] + ' ]', W / 2, H / 2 + 60, '18px monospace', '#f0f', 'center');
    R.text('UP/DOWN pick letter   > add   < del   ENTER start',
           W / 2, H - 40, '13px sans-serif', '#0ff', 'center');
  }

  function drawFloor() {
    var ctx = R.ctx;
    ctx.strokeStyle = 'rgba(0,180,255,0.08)';
    ctx.lineWidth = 1;
    for (var gx = 0; gx < W; gx += 48) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (var gy = 0; gy < H; gy += 48) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
    // home booth
    ctx.fillStyle = '#114';
    ctx.strokeStyle = '#0ff';
    R.roundRect(home.x - 30, home.y - 18, 60, 36, 6); ctx.fill(); ctx.stroke();
    R.text('HOME', home.x, home.y + 5, '11px sans-serif', '#0ff', 'center');
  }

  function drawBooths() {
    var ctx = R.ctx;
    for (var i = 0; i < booths.length; i++) {
      var b = booths[i];
      var col = b.dropped ? '#0f8' : (i < 2 ? '#0cf' : i < 4 ? '#fa0' : '#f0f');
      var pulse = 0.5 + 0.5 * Math.sin(Date.now() / 250 + i);
      ctx.globalAlpha = 0.3 + pulse * 0.4;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(b.x, b.y, 26, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, 20, 0, Math.PI * 2); ctx.stroke();
      R.text(b.dropped ? '\u2713' : (i + 1), b.x, b.y + 5, 'bold 16px sans-serif', '#fff', 'center');
      R.text(Math.round(b.bpm) + ' BPM', b.x, b.y + 38, '10px sans-serif', col, 'center');
    }
  }

  function drawBonuses() {
    var any = false;
    for (var i = 0; i < bonuses.length; i++) if (bonuses[i].t > 0) any = true;
    if (any) {
      var ctx = R.ctx;
      ctx.globalAlpha = 0.06 + 0.04 * Math.sin(Date.now() / 100);
      ctx.fillStyle = avatar ? avatar.track.col : '#0ff';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  function drawCart() {
    var ctx = R.ctx;
    ctx.save();
    ctx.translate(cart.x, cart.y);
    ctx.fillStyle = '#222';
    ctx.strokeStyle = avatar ? avatar.track.col : '#0ff';
    ctx.lineWidth = 2;
    R.roundRect(-22, -14, 44, 28, 6); ctx.fill(); ctx.stroke();
    if (avatar) R.drawSpr(avatar.key, -16, -34, 32, 32);
    ctx.fillStyle = avatar ? avatar.track.col : '#0ff';
    ctx.beginPath(); ctx.arc(-10, 16, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, 16, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawMini() {
    var m = mini; var ctx = R.ctx;
    var sx = m.shake > 0 ? (Math.random() - 0.5) * 12 : 0;
    var sy = m.shake > 0 ? (Math.random() - 0.5) * 12 : 0;
    ctx.save();
    ctx.translate(sx, sy);

    // backdrop panel
    ctx.fillStyle = 'rgba(0,0,20,0.85)';
    ctx.fillRect(W * 0.5 - 150, 30, 300, H - 110);
    ctx.strokeStyle = avatar.track.col; ctx.lineWidth = 2;
    R.roundRect(W * 0.5 - 150, 30, 300, H - 110, 10); ctx.stroke();

    // lanes
    for (var l = 0; l < 2; l++) {
      var lx = laneX(l);
      ctx.strokeStyle = 'rgba(0,200,255,0.25)';
      ctx.beginPath(); ctx.moveTo(lx, 40); ctx.lineTo(lx, m.lineY + 30); ctx.stroke();
    }

    // drop line + tightening target zone
    ctx.strokeStyle = m.flash > 0 ? '#fff' : avatar.track.col;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(W * 0.5 - 130, m.lineY); ctx.lineTo(W * 0.5 + 130, m.lineY); ctx.stroke();
    var zoneH = 30 * m.targetZone;
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = avatar.track.col;
    ctx.fillRect(W * 0.5 - 130, m.lineY - zoneH, 260, zoneH * 2);
    ctx.globalAlpha = 1;

    // falling notes
    for (var i = 0; i < m.notes.length; i++) {
      var n = m.notes[i];
      if (n.judged) continue;
      var prog = (m.time - (n.t - m.fallDur)) / m.fallDur;
      if (prog < 0) continue;
      var ny = 40 + prog * (m.lineY - 40);
      ctx.fillStyle = avatar.track.col;
      ctx.beginPath(); ctx.arc(laneX(n.lane), ny, 12, 0, Math.PI * 2); ctx.fill();
    }

    // groove marker
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = avatar.track.col; ctx.lineWidth = 3;
    R.roundRect(laneX(m.marker) - 18, m.lineY - 10, 36, 20, 5);
    ctx.fill(); ctx.stroke();

    if (m.judgeT > 0) {
      var jc = m.judge === 'PERFECT' ? '#0ff' : m.judge === 'GOOD' ? '#0f8' : '#f44';
      R.text(m.judge, W * 0.5, m.lineY - 50, 'bold 24px sans-serif', jc, 'center');
    }

    R.text(m.booth.bpm.toFixed(0) + ' BPM \u00B7 ' + avatar.track.name,
           W * 0.5, 55, '13px sans-serif', avatar.track.col, 'center');
    R.text('MISSES ' + m.misses + '/2', W * 0.5, H - 95, '12px sans-serif',
           m.misses >= 1 ? '#f44' : '#888', 'center');
    R.text('LEFT/RIGHT slide  \u00B7  SPACE strike on beat',
           W * 0.5, H - 75, '12px sans-serif', '#0ff', 'center');
    ctx.restore();
  }

  function drawHUD() {
    var ctx = R.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, W, 28);
    R.text('TIME ' + Math.ceil(timeLeft), 10, 19, 'bold 14px monospace',
           timeLeft < 20 ? '#f44' : '#0ff', 'left');
    R.text('HYPE ' + Math.round(hype), 120, 19, 'bold 14px monospace', '#0f8', 'left');
    R.text('x' + comboMult.toFixed(2), 260, 19, 'bold 14px monospace', '#ff0', 'left');
    R.text('STREAK ' + streak, 330, 19, 'bold 14px monospace', '#f0f', 'left');
    R.text('SCORE ' + game.score, W - 10, 19, 'bold 14px monospace', '#0ff', 'right');
    R.text('BOOTHS ' + dropped + '/5', W - 10, H - 8, '12px sans-serif', '#0cf', 'right');
    R.text('DEAD AIR ' + deadAir, 10, H - 8, '12px sans-serif', '#a44', 'left');
    if (djName) R.text(djName, W * 0.5, H - 8, '12px sans-serif', avatar.track.col, 'center');

    // active bonus chips
    var bx = 10;
    for (var i = 0; i < bonuses.length; i++) {
      if (bonuses[i].t > 0) {
        R.text(bonuses[i].name + ' +10%', bx, 46, '11px sans-serif', bonuses[i].col, 'left');
        bx += 0; // stacked vertically below
      }
    }
    var by = 46;
    for (i = 0; i < bonuses.length; i++) {
      if (bonuses[i].t > 0) {
        R.ctx.fillStyle = bonuses[i].col;
        R.text(bonuses[i].name + ' +10%', 10, by, '11px sans-serif', bonuses[i].col, 'left');
        by += 16;
      }
    }
  }

  return { update: update, draw: draw };
};
})();