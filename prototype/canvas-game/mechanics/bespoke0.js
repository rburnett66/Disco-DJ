(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.mechanics=window.MMKit.mechanics||{};
MMKit.mechanics.RhythmPlay = function (config, game) {
  config = config || {};
  game = game || {};

  // ---------- Constants ----------
  var SET_DURATION = 120;            // 2-minute set
  var LANE_COUNT = 2;
  var WHIFF_MISS_LIMIT = 2;
  var BONUS_MIN_DUR = 10;
  var BONUS_MAX_DUR = 20;

  // Starter loadout (battered deck, 2-channel mixer w/ one working fader,
  // Bronze Needle, 60-watt stack). Upgrades may override via game.loadout.
  var L = game.loadout || {};
  var NEEDLE_MULT   = (typeof L.needleMult   === 'number') ? L.needleMult   : 1.0;  // Bronze low mult
  var NEEDLE_WINDOW = (typeof L.needleWindow === 'number') ? L.needleWindow : 55;   // narrow Good window (px)
  var SPEAKER_GAIN  = (typeof L.speakerGain  === 'number') ? L.speakerGain  : 1.0;  // 60-watt small hype gain

  var BONUS_KEYS  = ['a', 's', 'd', 'f'];
  var BONUS_NAMES = ['Floor Panels', 'Laser Beams', 'Disco Ball', 'Balloon Drop'];
  var BONUS_COLOR = ['#ff4488', '#44ffff', '#ffff44', '#88ff44'];
  var BONUS_STREAK = [3, 5, 7, 9];   // live combo-streak gating

  // ---------- Geometry ----------
  var W = R.W, H = R.H;
  var laneW = 120;
  var laneGap = 70;
  var centerX = W / 2;
  var lanes = [centerX - laneGap, centerX + laneGap];
  var dropLineY = H - 130;

  // ---------- State ----------
  game.score = 0;
  game.resultsState = game.resultsState || 'RESULTS';
  game.crowdHype = 0;
  game.deadAir = 0;
  game.combo = 0;
  game.maxCombo = 0;
  game.misses = 0;          // misses within current whiff window
  game.totalMisses = 0;
  game.dancers = 0;
  game.hitCount = 0;
  game.cityThreshold = (typeof game.cityThreshold === 'number') ? game.cityThreshold : 3000;

  var markerLane = 0;       // 0 = left, 1 = right
  var markerX = lanes[0];
  var notes = [];
  var particles = [];
  var spawnTimer = 0;
  var setTime = 0;
  var ended = false;

  // bonus state per index; "earned" gates re-unlock once per streak rank in a set
  var bonuses = [];
  for (var i = 0; i < 4; i++) {
    bonuses.push({ unlocked: false, active: false, timeLeft: 0, earnedThisSet: false });
  }

  var feedback = '';
  var feedbackTimer = 0;
  var shake = 0;
  var flash = 0;
  var flashColor = '#ffffff';
  var booTimer = 0;          // crowd-boo visual on whiff

  // ---------- Helpers ----------
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function activeBonusStacks() {
    var n = 0;
    for (var i = 0; i < 4; i++) if (bonuses[i].active && bonuses[i].timeLeft > 0) n++;
    return n;
  }

  // Multiplier per spec: needle base * (1 + 0.10 per active stacked bonus)
  function scoreMultiplier() {
    return NEEDLE_MULT * (1 + activeBonusStacks() * 0.10);
  }

  function addParticles(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 60 + Math.random() * 200;
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 50,
        life: 0.5 + Math.random() * 0.4,
        color: color,
        size: 3 + Math.random() * 4
      });
    }
  }

  function setFeedback(txt, dur) { feedback = txt; feedbackTimer = dur; }

  // Live combo-streak unlock; each rank unlocks once per set (earnedThisSet gate)
  function checkUnlocks() {
    for (var i = 0; i < 4; i++) {
      if (!bonuses[i].earnedThisSet && game.combo >= BONUS_STREAK[i]) {
        bonuses[i].unlocked = true;
        bonuses[i].earnedThisSet = true;
        flash = 0.3; flashColor = BONUS_COLOR[i];
        setFeedback(BONUS_NAMES[i] + ' READY!', 0.9);
      }
    }
  }

  function triggerBonus(idx) {
    var b = bonuses[idx];
    if (!b || !b.unlocked) return;
    b.active = true;
    b.unlocked = false;
    b.timeLeft = BONUS_MIN_DUR + Math.random() * (BONUS_MAX_DUR - BONUS_MIN_DUR); // 10-20s
    flash = 0.3; flashColor = BONUS_COLOR[idx];
    addParticles(centerX, H / 2, BONUS_COLOR[idx], 26);
    setFeedback(BONUS_NAMES[idx] + '!', 1.0);
  }

  function spawnNote() {
    var lane = Math.random() < 0.5 ? 0 : 1;
    notes.push({ lane: lane, y: -30, judged: false, dead: false });
  }

  function registerHit(perfect, lane) {
    game.hitCount++;
    game.combo++;
    if (game.combo > game.maxCombo) game.maxCombo = game.combo;
    game.misses = 0;
    game.dancers = clamp(game.dancers + (perfect ? 2 : 1), 0, 99999);

    var base = perfect ? 100 : 60;
    var gained = base * scoreMultiplier() * SPEAKER_GAIN;
    if (!isFinite(gained) || gained < 0) gained = 0;
    game.score += gained;

    game.crowdHype = clamp(game.crowdHype + (perfect ? 6 : 4) * SPEAKER_GAIN, 0, 100);
    game.deadAir = clamp(game.deadAir - 2, 0, 100);

    if (perfect) {
      addParticles(lanes[lane], dropLineY, '#ffdd33', 16);
      flash = 0.22; flashColor = '#ffffaa'; shake = Math.max(shake, 7);
      setFeedback('PERFECT!', 0.5);
    } else {
      addParticles(lanes[lane], dropLineY, '#44ff88', 10);
      flash = 0.14; flashColor = '#88ffaa'; shake = Math.max(shake, 4);
      setFeedback('GOOD!', 0.5);
    }
    checkUnlocks();
  }

  function registerMiss(lane) {
    game.misses++;
    game.totalMisses++;
    game.combo = 0;
    game.deadAir = clamp(game.deadAir + 10 * (2 - SPEAKER_GAIN * 0.5), 0, 100);
    game.crowdHype = clamp(game.crowdHype - 3, 0, 100);
    addParticles(lanes[lane], dropLineY, '#ff3333', 10);
    flash = 0.18; flashColor = '#ff4444'; shake = Math.max(shake, 6);
    setFeedback('MISS', 0.5);

    if (game.misses >= WHIFF_MISS_LIMIT) handleWhiff();
  }

  function handleWhiff() {
    // track scratches out, dead air spikes, crowd boos, combo resets -> playable
    game.deadAir = clamp(game.deadAir + 25, 0, 100);
    game.combo = 0;
    game.misses = 0;
    // lose pending (un-triggered) unlocks; keep active bonuses
    for (var i = 0; i < 4; i++) {
      if (!bonuses[i].active) bonuses[i].unlocked = false;
    }
    shake = 16; flash = 0.4; flashColor = '#aa0000';
    booTimer = 1.4;
    addParticles(centerX, dropLineY, '#ff0000', 30);
    setFeedback('SCRATCH! Crowd boos!', 1.1);
  }

  function endSet() {
    if (ended) return;
    ended = true;
    game.finalScore = Math.floor(game.score);
    game.maxComboFinal = game.maxCombo;

    var threshold = game.cityThreshold;
    game.passedCity = (game.finalScore >= threshold);

    var s = game.finalScore;
    var rank;
    if (s >= threshold * 2)        rank = 'Platinum';
    else if (s >= threshold * 1.5) rank = 'Gold';
    else if (s >= threshold)       rank = 'Silver';
    else if (s >= threshold * 0.5) rank = 'Bronze';
    else                           rank = 'Rookie';
    game.rankBadge = rank;

    var currency = Math.floor(game.maxCombo * 10 + game.dancers * 2 + s * 0.05);
    if (!isFinite(currency) || currency < 0) currency = 0;
    game.currency = (game.currency || 0) + currency;
    game.earnedCurrency = currency;

    if (game.passedCity) {
      game.cityThreshold = threshold + 1000;
      game.cityIndex = (game.cityIndex || 0) + 1;
    }
    try { R.go(game.resultsState); } catch (e) { /* never crash */ }
  }

  // ---------- Update ----------
  function update(dt) {
    if (R.current() !== 'GAMEPLAY') return;
    if (ended) return;
    if (!isFinite(dt) || dt <= 0) dt = 1 / 60;
    if (dt > 0.1) dt = 0.1;
    var f = dt * 60;

    setTime += dt;
    if (setTime >= SET_DURATION) { endSet(); return; }

    var prog = clamp(setTime / SET_DURATION, 0, 1);

    // Marker slide
    if (R.pressed('ArrowLeft'))  markerLane = 0;
    if (R.pressed('ArrowRight')) markerLane = LANE_COUNT - 1;
    var targetX = lanes[markerLane];
    markerX += (targetX - markerX) * Math.min(1, dt * 18);

    // Bonus triggers
    for (var bi = 0; bi < 4; bi++) {
      if (R.pressed(BONUS_KEYS[bi])) triggerBonus(bi);
    }

    // Bonus timers
    for (var b = 0; b < 4; b++) {
      if (bonuses[b].active) {
        bonuses[b].timeLeft -= dt;
        if (bonuses[b].timeLeft <= 0) { bonuses[b].timeLeft = 0; bonuses[b].active = false; }
      }
    }

    // Spawn notes; difficulty ramps
    var spawnInterval = 0.85 - prog * 0.40;
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnTimer = spawnInterval; spawnNote(); }

    // Tightening target zone
    var tighten = 1 - prog * 0.40;
    var goodW = NEEDLE_WINDOW * tighten;
    var perfectW = goodW * 0.45;
    var fallSpeed = 260 + prog * 200;

    // Move & judge notes
    for (var n = notes.length - 1; n >= 0; n--) {
      var note = notes[n];
      if (!note) { notes.splice(n, 1); continue; }

      if (!note.judged) {
        note.y += fallSpeed * dt;
        var dist = note.y - dropLineY;

        // Auto-judge when crossing drop-line within active zone & marker on lane
        if (Math.abs(dist) <= goodW && note.lane === markerLane) {
          note.judged = true;
          registerHit(Math.abs(dist) <= perfectW, note.lane);
          notes.splice(n, 1);
          continue;
        }
        // Passed below zone without hit -> miss (off-beat / missed)
        if (note.y > dropLineY + goodW + 8) {
          note.judged = true;
          registerMiss(note.lane);
          notes.splice(n, 1);
          continue;
        }
      } else {
        note.y += fallSpeed * dt;
        if (note.y > H + 40) { notes.splice(n, 1); continue; }
      }
    }

    // Particles
    for (var p = particles.length - 1; p >= 0; p--) {
      var pt = particles[p];
      pt.life -= dt;
      if (pt.life <= 0) { particles.splice(p, 1); continue; }
      pt.vy += 400 * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }

    // Meter dynamics
    game.deadAir = clamp(game.deadAir - dt * 2, 0, 100); // slow decay
    game.crowdHype = clamp(game.crowdHype, 0, 100);
    if (!isFinite(game.score) || game.score < 0) game.score = 0;

    // Timers
    if (feedbackTimer > 0) feedbackTimer -= dt;
    if (shake > 0) { shake -= f * 0.8; if (shake < 0) shake = 0; }
    if (flash > 0) { flash -= dt; if (flash < 0) flash = 0; }
    if (booTimer > 0) booTimer -= dt;

    // End on max dead air
    if (game.deadAir >= 100) { endSet(); return; }
  }

  // ---------- Draw helpers ----------
  function drawBonusEffects(ctx) {
    var t = setTime;
    // 0: colored floor panels (behind everything, lower floor)
    if (bonuses[0].active) {
      for (var px = 0; px < W; px += 60) {
        for (var py = dropLineY; py < H; py += 40) {
          var hue = (px + py + t * 200) % 360;
          ctx.fillStyle = 'hsla(' + hue + ',80%,50%,0.28)';
          ctx.fillRect(px, py, 58, 38);
        }
      }
    }
    // 2: disco ball (rays + ball)
    if (bonuses[2].active) {
      var dbx = centerX, dby = 50;
      for (var ray = 0; ray < 8; ray++) {
        var ang = ray / 8 * Math.PI * 2 + t * 0.9;
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(dbx, dby);
        ctx.lineTo(dbx + Math.cos(ang) * 500, dby + Math.sin(ang) * 500);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      var dbr = 16 + Math.sin(t * 6) * 4;
      ctx.beginPath(); ctx.arc(dbx, dby, dbr, 0, Math.PI * 2); ctx.fill();
    }
    // 1: laser beams
    if (bonuses[1].active) {
      ctx.lineWidth = 3;
      for (var lz = 0; lz < 6; lz++) {
        ctx.strokeStyle = lz % 2 ? 'rgba(255,0,80,0.32)' : 'rgba(80,255,255,0.32)';
        var ang2 = (t * 2 + lz) % (Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(centerX, 70);
        ctx.lineTo(centerX + Math.cos(ang2) * W, 70 + Math.sin(ang2) * H);
        ctx.stroke();
      }
    }
    // 3: balloon drop
    if (bonuses[3].active) {
      for (var bl = 0; bl < 12; bl++) {
        var bx = (bl * 137) % W;
        var by = (t * 70 + bl * 70) % (dropLineY + 60);
        ctx.fillStyle = ['#ffcf3a', '#a04fff', '#ff4f4f', '#cccccc'][bl % 4];
        ctx.beginPath(); ctx.arc(bx, by, 10, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawMeter(ctx, x, y, w, h, frac, color, label) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    R.roundRect(x, y, w, h, 5); ctx.fill();
    ctx.fillStyle = color;
    R.roundRect(x, y, w * clamp(frac, 0, 1), h, 5); ctx.fill();
    R.text(label, x, y - 4, 'bold 11px sans-serif', '#ffffff', 'left');
  }

  // ---------- Draw ----------
  function draw() {
    var ctx = R.ctx;
    if (!ctx) return;

    ctx.save();
    var sx = 0, sy = 0;
    if (shake > 0) { sx = (Math.random() - 0.5) * shake; sy = (Math.random() - 0.5) * shake; }
    ctx.translate(sx, sy);

    // Bonus background effects
    drawBonusEffects(ctx);

    // Lanes
    for (var l = 0; l < LANE_COUNT; l++) {
      ctx.fillStyle = (l === markerLane) ? 'rgba(120,90,200,0.22)' : 'rgba(255,255,255,0.06)';
      R.roundRect(lanes[l] - laneW / 2, 60, laneW, dropLineY - 60 + 40, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      R.roundRect(lanes[l] - laneW / 2, 60, laneW, dropLineY - 60 + 40, 14);
      ctx.stroke();
    }

    // Active target zone + drop-line
    var prog = clamp(setTime / SET_DURATION, 0, 1);
    var goodW = NEEDLE_WINDOW * (1 - prog * 0.40);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(lanes[0] - laneW / 2, dropLineY - goodW, laneW * 2 + laneGap * 0, 0);
    for (var lz2 = 0; lz2 < LANE_COUNT; lz2++) {
      ctx.fillRect(lanes[lz2] - laneW / 2, dropLineY - goodW, laneW, goodW * 2);
    }
    var glow = 0.5 + 0.5 * Math.sin(setTime * 8);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,220,80,' + (0.5 + glow * 0.4) + ')';
    ctx.shadowColor = '#ffee55';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(lanes[0] - laneW / 2, dropLineY);
    ctx.lineTo(lanes[1] + laneW / 2, dropLineY);
    ctx.stroke();
    ctx.restore();

    // Notes
    for (var i = 0; i < notes.length; i++) {
      var note = notes[i];
      var nx = lanes[note.lane];
      ctx.fillStyle = note.lane === 0 ? '#ff4fa3' : '#4fd2ff';
      R.roundRect(nx - laneW / 2 + 14, note.y - 14, laneW - 28, 28, 8);
      ctx.fill();
    }

    // Groove marker
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(markerX, dropLineY - 24);
    ctx.lineTo(markerX - 16, dropLineY + 12);
    ctx.lineTo(markerX + 16, dropLineY + 12);
    ctx.closePath();
    ctx.fill();

    // Particles
    for (var p = 0; p < particles.length; p++) {
      var pt = particles[p];
      ctx.globalAlpha = clamp(pt.life, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore(); // end shake

    // ---------- HUD (un-shaken) ----------
    R.text('Score: ' + Math.floor(game.score), 16, 30, 'bold 22px sans-serif', '#ffffff', 'left');
    R.text('Combo: ' + game.combo + ' (Best ' + game.maxCombo + ')', 16, 54, 'bold 14px sans-serif', '#ffec70', 'left');

    var timeLeft = Math.max(0, SET_DURATION - setTime);
    var mm = Math.floor(timeLeft / 60), ss = Math.floor(timeLeft % 60);
    R.text((mm) + ':' + (ss < 10 ? '0' : '') + ss, W - 16, 30, 'bold 22px sans-serif', '#ffffff', 'right');
    R.text('Target: ' + game.cityThreshold, W - 16, 54, 'bold 13px sans-serif',
      (game.score >= game.cityThreshold) ? '#7fff7f' : '#ffaaaa', 'right');

    // Meters
    drawMeter(ctx, 16, 80, 180, 12, game.crowdHype / 100, '#4fd2ff', 'CROWD HYPE');
    drawMeter(ctx, 16, 110, 180, 12, game.deadAir / 100, '#ff4f6a', 'DEAD AIR');

    // Score multiplier display
    R.text('x' + scoreMultiplier().toFixed(2) + ' (' + activeBonusStacks() + ' stacked)',
      W - 16, 80, 'bold 14px sans-serif', '#a0ffd0', 'right');

    // Bonus buttons
    var bx = W / 2 - (4 * 70) / 2;
    for (var bb = 0; bb < 4; bb++) {
      var x = bx + bb * 70;
      var y = H - 46;
      var b = bonuses[bb];
      var col = b.active ? BONUS_COLOR[bb]
              : b.unlocked ? 'rgba(255,255,255,0.85)'
              : 'rgba(255,255,255,0.18)';
      ctx.fillStyle = b.active ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.35)';
      R.roundRect(x, y, 60, 36, 8); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = b.unlocked || b.active ? 3 : 1;
      R.roundRect(x, y, 60, 36, 8); ctx.stroke();
      R.text(BONUS_KEYS[bb].toUpperCase(), x + 30, y + 16, 'bold 16px sans-serif', col, 'center');
      if (b.active) {
        R.text(Math.ceil(b.timeLeft) + 's', x + 30, y + 30, 'bold 10px sans-serif', BONUS_COLOR[bb], 'center');
      } else {
        R.text(BONUS_NAMES[bb].split(' ')[0], x + 30, y + 30, '9px sans-serif', col, 'center');
      }
    }

    // Feedback text
    if (feedbackTimer > 0) {
      var alpha = clamp(feedbackTimer / 0.5, 0, 1);
      ctx.globalAlpha = alpha;
      R.text(feedback, W / 2, dropLineY - 70, 'bold 32px sans-serif',
        booTimer > 0 ? '#ff5555' : '#ffffff', 'center');
      ctx.globalAlpha = 1;
    }

    // Crowd-boo overlay
    if (booTimer > 0) {
      ctx.globalAlpha = clamp(booTimer / 1.4, 0, 1) * 0.5;
      R.text('BOOO!', W / 2, dropLineY - 110, 'bold 40px sans-serif', '#ff2222', 'center');
      ctx.globalAlpha = 1;
    }

    // Flash overlay
    if (flash > 0) {
      ctx.globalAlpha = clamp(flash, 0, 0.4);
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  return { update: update, draw: draw };
};
})();