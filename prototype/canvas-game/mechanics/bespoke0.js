(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.mechanics=window.MMKit.mechanics||{};
MMKit.mechanics.NeonPlay = function (config, game) {
  config = config || {};
  var W = R.W, H = R.H;

  // ============================================================
  // PERSISTENT / SAVE STATE
  // ============================================================
  game.resultsState = game.resultsState || 'RESULTS';

  // ---- Avatars (each with its own "track" descriptor) ----
  var AVATARS = [
    { key: 'spr_dj_nova',  name: 'NOVA',  baseBpm: 90,  col: '#0ff', track: 'Pulse Drift' },
    { key: 'spr_dj_blaze', name: 'BLAZE', baseBpm: 110, col: '#f0a', track: 'Heat Wave' },
    { key: 'spr_dj_echo',  name: 'ECHO',  baseBpm: 100, col: '#8f0', track: 'Reverb City' },
    { key: 'spr_dj_lux',   name: 'LUX',   baseBpm: 120, col: '#ff0', track: 'Goldline' }
  ];

  // ============================================================
  // CORE STAGE STATE
  // ============================================================
  var SET_TIME = 120;
  game.timer = SET_TIME;
  game.score = 0;
  game.hype = 0;
  game.deadAir = 0;
  game.combo = 0;
  game.multiplier = 1;
  game.maxStreak = 0;
  game.boothsDropped = 0;
  game.bonusesTriggered = 0;
  game.crowdSize = 50;

  // ---- Weakest loadout (Bronze Needle / 2-ch one-fader mixer / 60W stack) ----
  var loadout = {
    needleWindowPerfect: 0.05,   // narrow (bronze)
    needleWindowGood: 0.11,
    needleMult: 1.0,
    speakerGain: 1.0,            // 60-watt small hype
    faders: 1                    // one working fader
  };

  // ============================================================
  // PHASES:  SELECT -> NAME -> ROAM -> RHYTHM -> RETURN -> end
  // ============================================================
  var phase = 'SELECT';
  var ended = false;

  // avatar select cursor
  var selIndex = 0;
  // name entry
  var djName = '';
  var NAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var avatar = AVATARS[0];

  // ============================================================
  // HOME BOOTH + CART (momentum physics)
  // ============================================================
  var home = { x: W * 0.5, y: H * 0.86 };
  var cart = {
    x: home.x, y: home.y,
    vx: 0, vy: 0,
    accel: 0.5,
    radius: 16,
    angle: 0
  };

  // ============================================================
  // PROCEDURAL BOOTHS (5) — nearer easier, distance-weighted payout
  // ============================================================
  var booths = [];
  (function genBooths() {
    var pts = [];
    for (var i = 0; i < 5; i++) {
      pts.push({ x: 70 + Math.random() * (W - 140), y: 60 + Math.random() * (H * 0.62) });
    }
    pts.sort(function (a, b) {
      var da = (a.x - home.x) * (a.x - home.x) + (a.y - home.y) * (a.y - home.y);
      var db = (b.x - home.x) * (b.x - home.x) + (b.y - home.y) * (b.y - home.y);
      return da - db;
    });
    var maxD = 1;
    for (var k = 0; k < pts.length; k++) {
      var dd = Math.hypot(pts[k].x - home.x, pts[k].y - home.y);
      if (dd > maxD) maxD = dd;
    }
    for (var j = 0; j < 5; j++) {
      var dist = Math.hypot(pts[j].x - home.x, pts[j].y - home.y);
      var t = dist / maxD; // 0..1 true distance weight
      booths.push({
        x: pts[j].x, y: pts[j].y,
        radius: 26,
        dropped: false,
        idx: j,
        dist: dist,
        bpm: 70 + t * 80 + j * 6,            // farther = faster
        density: 0.8 + t * 0.9,              // farther = denser
        payout: Math.round(100 + t * 500 + j * 40)  // distance-weighted payout
      });
    }
  })();

  // ============================================================
  // DANCE-FLOOR BONUSES (stackable, +10% each while active)
  // ============================================================
  var bonuses = [
    { key: 'a', name: 'Floor Panels', streak: 3, t: 0, dur: 6, col: '#ff0' },
    { key: 's', name: 'Lasers',       streak: 5, t: 0, dur: 6, col: '#f0f' },
    { key: 'd', name: 'Disco Ball',   streak: 7, t: 0, dur: 6, col: '#0ff' },
    { key: 'f', name: 'Balloon Drop', streak: 9, t: 0, dur: 6, col: '#0f0' }
  ];
  function activeBonusMult() {
    var m = 1;
    for (var i = 0; i < bonuses.length; i++) if (bonuses[i].t > 0) m += 0.1;
    return m;
  }

  // ============================================================
  // JUICE: particles, popups, shake, flash
  // ============================================================
  var particles = [], pops = [];
  var shake = 0, flash = 0, flashCol = '#fff';

  function spawnParticles(x, y, n, col, spd) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = spd * (0.3 + Math.random());
      particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.5, col: col, r: 2 + Math.random() * 3 });
    }
  }
  function popup(x, y, txt, col) { pops.push({ x: x, y: y, txt: txt, col: col, life: 0.9 }); }
  function updateFx(dt) {
    var f = dt * 60;
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * f; p.y += p.vy * f; p.vx *= 0.94; p.vy *= 0.94;
      p.life -= dt; if (p.life <= 0) particles.splice(i, 1);
    }
    for (var j = pops.length - 1; j >= 0; j--) {
      pops[j].y -= f; pops[j].life -= dt; if (pops[j].life <= 0) pops.splice(j, 1);
    }
    shake *= 0.85;
    if (flash > 0) flash -= dt * 1.6;
  }

  // ============================================================
  // RHYTHM MINI-GAME (2 lanes, falling notes, track-synced beat)
  // ============================================================
  var rg = null;
  var beatPulse = 0;

  function startRhythm(booth) {
    var bpm = booth.bpm + (avatar.baseBpm - 90) * 0.2; // avatar track tints tempo
    var beatInt = 60 / bpm;
    rg = {
      booth: booth,
      lane: 0,
      notes: [],
      spawnTimer: 0,
      beatInt: beatInt,
      beatClock: 0,
      noteSpeed: 200 + bpm * 1.3,
      dropY: H * 0.80,
      misses: 0,
      needed: Math.round(10 + booth.density * 6),
      spawned: 0,
      targetZone: 1.0,        // tightening on-beat zone (1 -> shrinks)
      flash: '', flashT: 0
    };
    phase = 'RHYTHM';
    flash = 0.4; flashCol = avatar.col;
  }

  function spawnNote() {
    rg.notes.push({ lane: Math.random() < 0.5 ? 0 : 1, y: 30, hit: false });
    rg.spawned++;
  }

  function registerHit(kind) {
    if (kind === 'perfect' || kind === 'good') {
      var base = kind === 'perfect' ? 50 : 25;
      game.combo++;
      if (game.combo > game.maxStreak) game.maxStreak = game.combo;
      game.multiplier = loadout.needleMult * (1 + Math.floor(game.combo / 4) * 0.5);
      var gain = base * loadout.speakerGain;
      if (game.deadAir > 0) gain *= Math.max(0.3, 1 - game.deadAir * 0.02);
      game.hype += gain;
      game.crowdSize += kind === 'perfect' ? 6 : 3;
      rg.flash = kind.toUpperCase(); rg.flashT = 0.35;
      flash = 0.3; flashCol = kind === 'perfect' ? '#0ff' : '#8f8';
    } else {
      game.combo = 0;
      game.multiplier = loadout.needleMult;
      game.deadAir += 3;
      rg.misses++;
      rg.flash = 'MISS'; rg.flashT = 0.4;
      shake = 8; flash = 0.4; flashCol = '#f44';
    }
  }

  function judgeStrike() {
    var best = null, bd = 9999;
    for (var i = 0; i < rg.notes.length; i++) {
      var n = rg.notes[i];
      if (n.hit || n.lane !== rg.lane) continue;
      var d = Math.abs(n.y - rg.dropY);
      if (d < bd) { bd = d; best = n; }
    }
    if (!best) { registerHit('miss'); return; }
    var terr = bd / rg.noteSpeed;
    var pWin = loadout.needleWindowPerfect / Math.max(0.55, rg.targetZone);
    var gWin = loadout.needleWindowGood / Math.max(0.55, rg.targetZone);
    if (terr <= pWin) { best.hit = true; registerHit('perfect'); }
    else if (terr <= gWin) { best.hit = true; registerHit('good'); }
    else { registerHit('miss'); }
  }

  function endRhythmSuccess() {
    var b = rg.booth;
    b.dropped = true;
    game.boothsDropped++;
    var bonus = b.payout * 0.3 * loadout.speakerGain;
    game.hype += bonus;
    game.crowdSize += 60 + Math.round(b.dist);
    spawnParticles(b.x, b.y, 60, avatar.col, 6);
    spawnParticles(b.x, b.y, 40, '#f0f', 5);
    popup(b.x, b.y - 34, 'BOOTH DROPPED! +' + Math.round(b.payout), avatar.col);
    shake = 14; flash = 0.6; flashCol = '#0f8';
    rg = null;
    phase = 'ROAM';
    checkSetEnd();
  }

  function endRhythmWhiff() {
    spawnParticles(rg.booth.x, rg.booth.y, 30, '#f44', 5);
    popup(rg.booth.x, rg.booth.y - 30, 'SCRATCHED!', '#f44');
    shake = 10; flash = 0.5; flashCol = '#f00';
    game.combo = 0; game.multiplier = loadout.needleMult; game.deadAir += 8;
    rg = null;
    phase = 'ROAM';
  }

  function tryTriggerBonuses() {
    for (var i = 0; i < bonuses.length; i++) {
      var b = bonuses[i];
      if (R.pressed(b.key) && game.maxStreak >= b.streak && b.t <= 0) {
        b.t = b.dur;
        game.bonusesTriggered++;
        spawnParticles(cart.x, cart.y, 26, b.col, 6);
        popup(cart.x, cart.y - 30, b.name + '!', b.col);
        flash = 0.4; flashCol = b.col;
      }
    }
  }

  // ============================================================
  // SCORE
  // ============================================================
  function recomputeScore() {
    var distBonus = 0;
    for (var i = 0; i < booths.length; i++) if (booths[i].dropped) distBonus += booths[i].payout;
    var effHype = game.hype - game.deadAir * 0.5;
    if (effHype < 0) effHype = 0;
    var s = effHype * game.multiplier * activeBonusMult() + distBonus;
    game.score = Math.max(0, Math.floor(s));
  }

  function checkSetEnd() {
    if (ended) return;
    if (game.timer <= 0 || game.boothsDropped >= 5) {
      ended = true;
      phase = 'RETURN';
    }
  }

  function finishSet() {
    recomputeScore();
    game.finalScore = game.score;
    game.djName = djName || 'DJ';
    game.avatarName = avatar.name;
    // rank badge
    var s = game.score;
    var rank = 'C';
    if (s >= 4000) rank = 'S'; else if (s >= 2500) rank = 'A';
    else if (s >= 1500) rank = 'B'; else if (s >= 700) rank = 'C'; else rank = 'D';
    game.rank = rank;
    R.go(game.resultsState);
  }

  // ============================================================
  // UPDATE SUB-PHASES
  // ============================================================
  function updateSelect() {
    if (R.pressed('ArrowLeft')) { selIndex = (selIndex + AVATARS.length - 1) % AVATARS.length; }
    if (R.pressed('ArrowRight')) { selIndex = (selIndex + 1) % AVATARS.length; }
    if (R.pressed(' ')) {
      avatar = AVATARS[selIndex];
      phase = 'NAME';
    }
  }

  function updateName() {
    // type with held alpha keys (pressed once) — use letter keys
    for (var i = 0; i < NAME_CHARS.length; i++) {
      var c = NAME_CHARS.charAt(i);
      if (R.pressed(c.toLowerCase()) && djName.length < 8) djName += c;
    }
    if (R.pressed('Backspace') && djName.length > 0) djName = djName.slice(0, -1);
    if (R.pressed('Enter') || (R.pressed(' ') && djName.length > 0)) {
      phase = 'ROAM';
    }
  }

  function updateRoam(dt) {
    var f = dt * 60;
    var ax = 0, ay = 0;
    if (R.keys['ArrowLeft']) ax -= cart.accel;
    if (R.keys['ArrowRight']) ax += cart.accel;
    if (R.keys['ArrowUp']) ay -= cart.accel;
    if (R.keys['ArrowDown']) ay += cart.accel;

    cart.vx += ax * f;
    cart.vy += ay * f;

    // momentum: forward (heading) damps faster, lateral skid damps slower
    var spd = Math.hypot(cart.vx, cart.vy);
    if (spd > 0.01) cart.angle = Math.atan2(cart.vy, cart.vx);
    var hx = Math.cos(cart.angle), hy = Math.sin(cart.angle);
    var fwd = cart.vx * hx + cart.vy * hy;       // forward component
    var latx = cart.vx - fwd * hx, laty = cart.vy - fwd * hy; // lateral skid
    var fwdDamp = Math.pow(0.93, f);
    var latDamp = Math.pow(0.975, f);
    fwd *= fwdDamp;
    latx *= latDamp; laty *= latDamp;
    cart.vx = fwd * hx + latx;
    cart.vy = fwd * hy + laty;

    cart.x += cart.vx * f;
    cart.y += cart.vy * f;

    if (cart.x < cart.radius) { cart.x = cart.radius; cart.vx *= -0.4; }
    if (cart.x > W - cart.radius) { cart.x = W - cart.radius; cart.vx *= -0.4; }
    if (cart.y < 40 + cart.radius) { cart.y = 40 + cart.radius; cart.vy *= -0.4; }
    if (cart.y > H - cart.radius) { cart.y = H - cart.radius; cart.vy *= -0.4; }

    if (spd > 2 && Math.random() < 0.5) {
      particles.push({ x: cart.x, y: cart.y + 8, vx: -cart.vx * 0.2, vy: -cart.vy * 0.2,
        life: 0.3, col: '#08f', r: 2 + Math.random() * 2 });
    }

    for (var i = 0; i < booths.length; i++) {
      var b = booths[i];
      if (b.dropped) continue;
      var dx = cart.x - b.x, dy = cart.y - b.y;
      if (dx * dx + dy * dy < (b.radius + cart.radius) * (b.radius + cart.radius)) {
        if (R.pressed(' ')) { cart.vx = 0; cart.vy = 0; startRhythm(b); return; }
      }
    }
  }

  function updateRhythm(dt) {
    if (rg.flashT > 0) rg.flashT -= dt;
    if (R.pressed('ArrowLeft')) rg.lane = 0;
    if (R.pressed('ArrowRight')) rg.lane = 1;
    if (R.pressed(' ')) { judgeStrike(); if (phase !== 'RHYTHM') return; }
    tryTriggerBonuses();

    rg.targetZone -= dt * 0.04;
    if (rg.targetZone < 0.55) rg.targetZone = 0.55;

    rg.beatClock += dt;
    if (rg.beatClock >= rg.beatInt) { rg.beatClock -= rg.beatInt; beatPulse = 1; }

    // spawn synced to beat subdivisions
    rg.spawnTimer -= dt;
    if (rg.spawnTimer <= 0 && rg.spawned < rg.needed) {
      rg.spawnTimer = rg.beatInt / rg.booth.density;
      spawnNote();
    }

    for (var i = 0; i < rg.notes.length; i++) {
      var n = rg.notes[i];
      if (n.hit) continue;
      n.y += rg.noteSpeed * dt;
      if (n.y > rg.dropY + 44) { n.hit = true; registerHit('miss'); if (phase !== 'RHYTHM') return; }
    }

    if (rg.misses >= 2) { endRhythmWhiff(); return; }

    if (rg.spawned >= rg.needed) {
      var pending = false;
      for (var j = 0; j < rg.notes.length; j++) if (!rg.notes[j].hit) pending = true;
      if (!pending) { endRhythmSuccess(); return; }
    }
  }

  function updateReturn(dt) {
    var f = dt * 60;
    var dx = home.x - cart.x, dy = home.y - cart.y;
    var d = Math.hypot(dx, dy);
    if (d < 6) { finishSet(); return; }
    var pull = 6 * f;
    cart.vx = (dx / d) * Math.min(d, pull) ;
    cart.vy = (dy / d) * Math.min(d, pull);
    cart.x += cart.vx;
    cart.y += cart.vy;
    cart.angle = Math.atan2(dy, dx);
  }

  // ============================================================
  // MAIN UPDATE
  // ============================================================
  game.update = function (dt) {
    if (R.current && R.current() !== 'GAMEPLAY') return;
    if (dt > 0.05) dt = 0.05;

    updateFx(dt);
    beatPulse *= 0.85;

    for (var bi = 0; bi < bonuses.length; bi++) if (bonuses[bi].t > 0) bonuses[bi].t -= dt;

    if (phase === 'SELECT') { updateSelect(); return; }
    if (phase === 'NAME') { updateName(); return; }

    // timer only runs once playing
    if (phase === 'ROAM' || phase === 'RHYTHM') {
      game.timer -= dt;
      if (game.timer < 0) game.timer = 0;
      checkSetEnd();
    }

    if (phase === 'ROAM') updateRoam(dt);
    else if (phase === 'RHYTHM') updateRhythm(dt);
    else if (phase === 'RETURN') updateReturn(dt);

    recomputeScore();
  };

  // ============================================================
  // DRAW HELPERS
  // ============================================================
  function drawNeonCircle(ctx, x, y, r, col, glow) {
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = glow || 16;
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawBackground(ctx) {
    ctx.fillStyle = '#080010';
    ctx.fillRect(0, 0, W, H);
    // grid floor
    ctx.save();
    ctx.strokeStyle = 'rgba(80,20,120,0.35)';
    ctx.lineWidth = 1;
    for (var gx = 0; gx <= W; gx += 48) {
      ctx.beginPath(); ctx.moveTo(gx, 40); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (var gy = 40; gy <= H; gy += 48) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles(ctx) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.col; ctx.shadowColor = p.col; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    for (var j = 0; j < pops.length; j++) {
      var po = pops[j];
      R.text(po.txt, po.x, po.y, 'bold 14px monospace', po.col, 'center');
    }
  }

  function drawCart(ctx) {
    ctx.save();
    ctx.translate(cart.x, cart.y);
    ctx.rotate(cart.angle + Math.PI / 2);
    ctx.shadowColor = avatar.col; ctx.shadowBlur = 14;
    if (R.drawSpr) {
      R.drawSpr('spr_cart', -18, -18, 36, 36);
    }
    // fallback deck-cart body
    ctx.fillStyle = '#222'; ctx.strokeStyle = avatar.col; ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-14, -10, 28, 20, 4); else ctx.rect(-14, -10, 28, 20);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = avatar.col;
    ctx.beginPath(); ctx.arc(-6, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawHUD(ctx) {
    var t = Math.max(0, game.timer);
    var mm = Math.floor(t / 60), ss = Math.floor(t % 60);
    var tstr = mm + ':' + (ss < 10 ? '0' : '') + ss;
    R.text('TIME ' + tstr, 10, 22, 'bold 16px monospace', t < 20 ? '#f44' : '#0ff', 'left');
    R.text('HYPE ' + Math.floor(game.hype), W * 0.5, 22, 'bold 16px monospace', '#f0f', 'center');
    R.text('SCORE ' + game.score, W - 10, 22, 'bold 16px monospace', '#ff0', 'right');
    R.text('x' + game.multiplier.toFixed(1) + '  STREAK ' + game.combo, 10, H - 12, '12px monospace', '#8f8', 'left');
    R.text('BOOTHS ' + game.boothsDropped + '/5', W - 10, H - 12, '12px monospace', '#0ff', 'right');

    // bonus availability bar
    var bx = W * 0.5 - 140;
    for (var i = 0; i < bonuses.length; i++) {
      var b = bonuses[i];
      var avail = game.maxStreak >= b.streak;
      var col = b.t > 0 ? b.col : (avail ? '#888' : '#333');
      R.text('[' + b.key.toUpperCase() + ']' + b.name, bx + i * 0, H - 30, '10px monospace', col, 'left');
      // stack vertically-ish: lay out horizontally
    }
  }

  function drawBonusBar(ctx) {
    var labelY = H - 30;
    var startX = 10;
    for (var i = 0; i < bonuses.length; i++) {
      var b = bonuses[i];
      var avail = game.maxStreak >= b.streak;
      var col = b.t > 0 ? b.col : (avail ? '#aaa' : '#444');
      var tag = b.key.toUpperCase();
      R.text(tag, startX + i * 26, labelY, 'bold 12px monospace', col, 'left');
    }
  }

  // ============================================================
  // DRAW MAIN
  // ============================================================
  game.draw = function () {
    var ctx = R.ctx;
    ctx.save();
    if (shake > 0.3) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    if (phase === 'SELECT') {
      drawBackground(ctx);
      R.text('PICK YOUR DJ', W * 0.5, 70, 'bold 26px monospace', '#0ff', 'center');
      for (var i = 0; i < AVATARS.length; i++) {
        var a = AVATARS[i];
        var ax = W * (0.2 + i * 0.2);
        var ay = H * 0.45;
        var sel = i === selIndex;
        drawNeonCircle(ctx, ax, ay, sel ? 40 : 30, a.col, sel ? 26 : 12);
        if (R.drawSpr) R.drawSpr(a.key, ax - 24, ay - 24, 48, 48);
        R.text(a.name, ax, ay + 56, 'bold 14px monospace', a.col, 'center');
        R.text('♪ ' + a.track, ax, ay + 74, '10px monospace', '#ccc', 'center');
      }
      R.text('< LEFT / RIGHT >   SPACE = SELECT', W * 0.5, H * 0.8, '14px monospace', '#fff', 'center');
      ctx.restore();
      return;
    }

    if (phase === 'NAME') {
      drawBackground(ctx);
      R.text('NAME YOUR DJ', W * 0.5, 80, 'bold 24px monospace', avatar.col, 'center');
      if (R.drawSpr) R.drawSpr(avatar.key, W * 0.5 - 28, H * 0.32, 56, 56);
      var show = (djName || '_');
      R.text(show + (Math.floor(Date.now() / 400) % 2 ? '|' : ''), W * 0.5, H * 0.55, 'bold 30px monospace', '#fff', 'center');
      R.text('TYPE A-Z / 0-9 · BACKSPACE · ENTER', W * 0.5, H * 0.72, '12px monospace', '#aaa', 'center');
      ctx.restore();
      return;
    }

    // ---- PLAYFIELD ----
    drawBackground(ctx);

    // booths
    for (var b = 0; b < booths.length; b++) {
      var bo = booths[b];
      if (bo.dropped) {
        drawNeonCircle(ctx, bo.x, bo.y, bo.radius, '#0f8', 8);
        R.text('✓', bo.x, bo.y + 5, 'bold 16px monospace', '#0f8', 'center');
      } else {
        var pulse = bo.radius + Math.sin(Date.now() / 200 + b) * 4;
        drawNeonCircle(ctx, bo.x, bo.y, pulse, avatar.col, 18);
        R.text((b + 1), bo.x, bo.y + 5, 'bold 16px monospace', '#fff', 'center');
        R.text(Math.round(bo.bpm) + 'bpm', bo.x, bo.y + bo.radius + 14, '9px monospace', '#888', 'center');
      }
    }

    // home booth
    drawNeonCircle(ctx, home.x, home.y, 22, '#ff0', 10);
    R.text('HOME', home.x, home.y + 36, '10px monospace', '#ff0', 'center');

    drawParticles(ctx);
    drawCart(ctx);

    // ---- RHYTHM OVERLAY ----
    if (phase === 'RHYTHM' && rg) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#000';
      ctx.fillRect(W * 0.5 - 110, 50, 220, H - 100);
      ctx.restore();

      var laneW = 80;
      var L0 = W * 0.5 - laneW, L1 = W * 0.5;
      var lanesX = [L0 + laneW / 2, L1 + laneW / 2];

      // lane backgrounds
      ctx.save();
      for (var ln = 0; ln < 2; ln++) {
        ctx.strokeStyle = ln === rg.lane ? avatar.col : '#444';
        ctx.lineWidth = ln === rg.lane ? 3 : 1;
        ctx.strokeRect(L0 + ln * laneW, 60, laneW, H - 120);
      }
      ctx.restore();

      // drop line + tightening target zone
      var zoneH = 30 * rg.targetZone + 6;
      ctx.save();
      ctx.fillStyle = 'rgba(255,0,255,0.18)';
      ctx.fillRect(L0, rg.dropY - zoneH, laneW * 2, zoneH * 2);
      ctx.strokeStyle = '#f0f'; ctx.lineWidth = 3; ctx.shadowColor = '#f0f'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(L0, rg.dropY); ctx.lineTo(L0 + laneW * 2, rg.dropY); ctx.stroke();
      ctx.restore();

      // notes
      for (var ni = 0; ni < rg.notes.length; ni++) {
        var nn = rg.notes[ni];
        if (nn.hit) continue;
        var nx = lanesX[nn.lane];
        drawNeonCircle(ctx, nx, nn.y, 12, avatar.col, 12);
        ctx.save(); ctx.fillStyle = avatar.col; ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.arc(nx, nn.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }

      // groove marker
      var mx = lanesX[rg.lane];
      ctx.save();
      ctx.strokeStyle = '#0ff'; ctx.lineWidth = 4 + beatPulse * 3; ctx.shadowColor = '#0ff'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(mx, rg.dropY, 16, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      if (rg.flashT > 0) {
        R.text(rg.flash, W * 0.5, rg.dropY - 60, 'bold 22px monospace',
          rg.flash === 'MISS' ? '#f44' : '#0ff', 'center');
      }
      R.text('♪ ' + avatar.track, W * 0.5, 46, '11px monospace', avatar.col, 'center');
      R.text('MISSES ' + rg.misses + '/2', W * 0.5, H - 70, '12px monospace', '#f88', 'center');
      R.text('< > MOVE   SPACE STRIKE', W * 0.5, H - 54, '11px monospace', '#aaa', 'center');
    }

    // flash overlay
    if (flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.5, flash);
      ctx.fillStyle = flashCol;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (phase === 'RETURN') {
      R.text('ROLLING HOME...', W * 0.5, H * 0.5, 'bold 22px monospace', '#0ff', 'center');
    }

    drawHUD(ctx);
    drawBonusBar(ctx);

    ctx.restore();
  };
};
})();