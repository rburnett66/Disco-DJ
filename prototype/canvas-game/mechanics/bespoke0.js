(function(){'use strict';var R=window.MMKit.runtime;window.MMKit=window.MMKit||{};window.MMKit.mechanics=window.MMKit.mechanics||{};
MMKit.mechanics.RhythmPlay = function (config, game) {
  config = config || {};
  var W = R.W, H = R.H;

  // ---------- persistent / results ----------
  game.score = game.score || 0;
  game.resultsState = game.resultsState || 'RESULTS';

  // ---------- Loadout (Bronze Needle / 60-watt starter) ----------
  var loadout = {
    perfectWindow: 0.040,   // ±40ms
    goodWindow: 0.090,      // ±90ms
    multiplier: 1.0,        // Bronze Needle ×1.0
    hypeGood: 1.0,          // +1.0 per good
    hypePerfect: 2.0,       // +2.0 per perfect
    deadAirMiss: 3.0        // +3.0 per miss
  };

  // ---------- avatar art ----------
  var avatars = ['gold', 'purple', 'red'];
  var avatarSprites = {
    gold: 'spr_balloongoldneutralbackgr',
    purple: 'spr_balloonpurpleneutralback',
    red: 'spr_balloonredneutralbackgro'
  };
  var avatarNames = { gold: 'Gold', purple: 'Violet', red: 'Crimson' };

  // ---------- geometry ----------
  var LANE_COUNT = 2;
  var laneW = Math.max(80, Math.min(140, W * 0.18));
  var laneGap = Math.max(40, W * 0.06);
  var totalLaneW = laneW * LANE_COUNT + laneGap;
  var laneStartX = (W - totalLaneW) / 2;
  var dropLineY = H * 0.78;
  var noteH = 26;
  var SET_TIME = 120; // 2:00

  function laneX(i) { return laneStartX + i * (laneW + laneGap); }
  function laneCx(i) { return laneX(i) + laneW / 2; }

  function clamp(v, lo, hi) {
    if (typeof v !== 'number' || isNaN(v)) return lo;
    return v < lo ? lo : (v > hi ? hi : v);
  }

  // ---------- state ----------
  var st = {
    phase: 'select',        // select -> name -> ready -> play -> done
    avatar: 0,
    name: '',
    markerLane: 0,
    markerVis: 0,
    timeLeft: SET_TIME,
    elapsed: 0,
    notes: [],
    particles: [],
    floaters: [],
    balloons: [],
    spawnTimer: 0,
    spawnInterval: 1.05,
    noteSpeed: 220,
    hype: 0,
    deadAir: 0,
    combo: 0,
    streak: 0,
    bestStreak: 0,
    whiffsInRun: 0,
    bonusCharges: 0,
    floorPanels: false,
    floorTimer: 0,
    crowdFlash: 0,
    booFlash: 0,
    dropFlash: 0,
    shake: 0,
    scratch: 0,
    cued: 0,
    ended: false,
    feedback: '',
    feedbackTimer: 0
  };
  game.rhythm = st;

  // ---------- juice helpers ----------
  function addParticles(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 80 + Math.random() * 220;
      st.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.5 + Math.random() * 0.4, max: 0.9,
        color: color, size: 2 + Math.random() * 4
      });
    }
  }
  function floater(text, x, y, color) {
    st.floaters.push({ text: text, x: x, y: y, life: 0.9, color: color });
  }

  // ---------- spawning ----------
  function spawnNote() {
    var lane = Math.floor(Math.random() * LANE_COUNT);
    st.notes.push({
      lane: lane,
      y: -noteH,
      resolved: false,
      color: lane === 0 ? '#3df' : '#f5c'
    });
  }

  // ---------- scoring ----------
  function activeBonusMultiplier() {
    var m = 1.0;
    if (st.floorPanels) m *= 1.15;
    return m;
  }

  function registerHit(perfect, note) {
    var gain = (perfect ? loadout.hypePerfect : loadout.hypeGood) * loadout.multiplier;
    if (st.floorPanels) gain *= 1.15;
    st.hype += gain;
    st.combo += 1;
    st.streak += 1;
    if (st.streak > st.bestStreak) st.bestStreak = st.streak;
    if (st.streak > 0 && st.streak % 8 === 0) {
      st.bonusCharges = clamp(st.bonusCharges + 1, 0, 4);
    }
    st.crowdFlash = 0.4;
    st.dropFlash = perfect ? 0.7 : 0.5;
    st.shake = perfect ? 9 : 5;
    var col = perfect ? '#ffe14d' : '#4dff9b';
    var cx = laneCx(note.lane);
    addParticles(cx, dropLineY, col, perfect ? 28 : 16);
    floater(perfect ? 'PERFECT!' : 'GOOD', cx, dropLineY - 30, col);
    st.feedback = perfect ? 'PERFECT!' : 'GOOD!';
    st.feedbackTimer = 0.55;
  }

  function registerWhiff(note, offBeat) {
    // A whiff spikes Dead Air, scratches track, crowd boos.
    // Streak only resets after 2 whiffs in the current run.
    st.deadAir += loadout.deadAirMiss;
    st.whiffsInRun += 1;
    st.booFlash = 0.45;
    st.scratch = 0.5;
    st.shake = 7;
    var cx = laneCx(note.lane);
    addParticles(cx, dropLineY, '#ff5d5d', 10);
    floater(offBeat ? 'OFF-BEAT!' : 'BOO!', cx, dropLineY - 30, '#ff5d5d');
    st.feedback = 'BOO!';
    st.feedbackTimer = 0.55;
    if (st.whiffsInRun >= 2) {
      st.combo = 0;
      st.streak = 0;
      st.whiffsInRun = 0;
    }
  }

  function liveScore() {
    var comboMult = 1 + clamp(st.bestStreak, 0, 9999) * 0.02;
    var raw = st.hype * comboMult * activeBonusMultiplier();
    raw = Math.max(0, Math.round(raw * 100));
    return isFinite(raw) ? raw : 0;
  }

  function rankBadge(s) {
    if (s >= 8000) return 'Legendary Drop';
    if (s >= 5000) return 'Headliner';
    if (s >= 2500) return 'Club Resident';
    if (s >= 1000) return 'Local Spinner';
    return 'Newbie';
  }

  function endSet() {
    if (st.ended) return;
    st.ended = true;
    st.phase = 'done';
    var s = liveScore();
    game.score = s;
    game.djName = st.name;
    game.avatar = avatars[st.avatar];
    game.rank = rankBadge(s);
    game.cash = (game.cash || 0) + s;
    R.go(game.resultsState);
  }

  // ---------- input phases ----------
  function handleSelect() {
    if (R.pressed('ArrowLeft')) st.avatar = (st.avatar + avatars.length - 1) % avatars.length;
    if (R.pressed('ArrowRight')) st.avatar = (st.avatar + 1) % avatars.length;
    // mouse click selection
    var spacing = 160;
    var startX = W / 2 - spacing;
    for (var i = 0; i < avatars.length; i++) {
      var x = startX + i * spacing;
      var y = H / 2 - 50;
      if (R.mouse.clicked && R.mouse.x >= x - 50 && R.mouse.x <= x + 50 &&
          R.mouse.y >= y - 10 && R.mouse.y <= y + 110) {
        st.avatar = i;
      }
    }
    if (R.pressed('Enter') || R.pressed(' ')) {
      st.phase = 'name';
    }
  }

  function handleName() {
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (var i = 0; i < letters.length; i++) {
      var c = letters[i];
      if (R.pressed(c) || R.pressed(c.toLowerCase())) {
        if (st.name.length < 14) st.name += c;
      }
    }
    if (R.pressed('Backspace')) st.name = st.name.slice(0, -1);
    if ((R.pressed('Enter') || R.pressed(' ')) && st.name.trim().length > 0) {
      st.phase = 'ready';
    }
  }

  // ---------- main update ----------
  function update(dt) {
    if (R.current() !== 'GAMEPLAY') return;
    if (typeof dt !== 'number' || isNaN(dt) || dt <= 0) dt = 1 / 60;
    if (dt > 0.1) dt = 0.1;
    var k = dt * 60;

    if (st.feedbackTimer > 0) st.feedbackTimer = Math.max(0, st.feedbackTimer - dt);
    if (st.crowdFlash > 0) st.crowdFlash = Math.max(0, st.crowdFlash - dt * 2);
    if (st.booFlash > 0) st.booFlash = Math.max(0, st.booFlash - dt * 2);
    if (st.dropFlash > 0) st.dropFlash = Math.max(0, st.dropFlash - dt * 2);
    if (st.scratch > 0) st.scratch = Math.max(0, st.scratch - dt * 2);
    if (st.cued > 0) st.cued = Math.max(0, st.cued - dt);
    if (st.shake > 0) { st.shake -= k * 0.8; if (st.shake < 0) st.shake = 0; }

    if (st.phase === 'select') { handleSelect(); return; }
    if (st.phase === 'name') { handleName(); return; }

    if (st.phase === 'ready') {
      // SPACE cues the record and starts the set
      if (R.pressed(' ')) {
        st.phase = 'play';
        st.timeLeft = SET_TIME;
        st.elapsed = 0;
        st.notes = [];
        st.particles = [];
        st.floaters = [];
        st.balloons = [];
        st.spawnTimer = 0;
        st.hype = 0; st.deadAir = 0; st.combo = 0; st.streak = 0;
        st.bestStreak = 0; st.whiffsInRun = 0; st.bonusCharges = 0;
        st.floorPanels = false; st.floorTimer = 0;
        st.cued = 1.2;
        st.dropFlash = 1; st.shake = 10;
      }
      return;
    }

    if (st.phase === 'done') return;

    // ---------- PLAY ----------
    st.timeLeft -= dt;
    st.elapsed += dt;
    if (st.timeLeft <= 0) { st.timeLeft = 0; endSet(); return; }

    // marker movement
    if (R.pressed('ArrowLeft')) st.markerLane = 0;
    if (R.pressed('ArrowRight')) st.markerLane = 1;
    st.markerVis += (st.markerLane - st.markerVis) * Math.min(1, dt * 16);

    // floor panels bonus (A) — spec control
    if ((R.pressed('a') || R.pressed('A')) && st.bonusCharges > 0 && !st.floorPanels) {
      st.floorPanels = true;
      st.floorTimer = 12;
      st.bonusCharges -= 1;
      st.crowdFlash = 0.6;
      st.shake = 10;
      addParticles(W / 2, H / 2, '#ffd34d', 40);
      for (var b = 0; b < 14; b++) {
        st.balloons.push({
          x: Math.random() * W, y: H + Math.random() * 200,
          vy: -(40 + Math.random() * 50), c: Math.floor(Math.random() * 3)
        });
      }
    }
    if (st.floorPanels) {
      st.floorTimer -= dt;
      if (st.floorTimer <= 0) { st.floorPanels = false; st.floorTimer = 0; }
    }

    // difficulty ramp (very-easy to easy, stays gentle)
    var prog = clamp(st.elapsed / SET_TIME, 0, 1);
    st.spawnInterval = 1.05 - 0.30 * prog;     // 1.05 -> 0.75s
    st.noteSpeed = 220 + 60 * prog;            // 220 -> 280 px/s

    // target zone tightens but stays easy: half-height in px
    var zonePx = 38 - 12 * prog;               // 38 -> 26 px

    // spawning
    st.spawnTimer -= dt;
    if (st.spawnTimer <= 0) {
      spawnNote();
      st.spawnTimer = st.spawnInterval;
    }

    // move + judge notes (true timing: judge at line crossing on dedicated key)
    var i, n;
    for (i = 0; i < st.notes.length; i++) {
      n = st.notes[i];
      if (n.resolved) continue;
      n.y += st.noteSpeed * dt;
      var pxDist = n.y - dropLineY;
      // convert px distance to ms via current speed for true timing windows
      var ms = Math.abs(pxDist) / st.noteSpeed; // seconds

      // Auto-judge ONLY when the note reaches the drop line target zone.
      // Hit if marker is in the correct lane at the moment of crossing.
      if (!n.resolved && Math.abs(pxDist) <= zonePx) {
        if (n.lane === st.markerLane) {
          var perfect = ms <= loadout.perfectWindow;
          var good = ms <= loadout.goodWindow;
          if (perfect) {
            registerHit(true, n);
            n.resolved = true;
          } else if (good) {
            registerHit(false, n);
            n.resolved = true;
          }
          // if inside zone-pixels but somehow outside ms window, wait for closer
        }
      }
      // passed line unresolved -> miss / off-beat whiff
      if (!n.resolved && pxDist > zonePx + 8) {
        registerWhiff(n, n.lane !== st.markerLane);
        n.resolved = true;
      }
    }

    // cull
    var live = [];
    for (i = 0; i < st.notes.length; i++) {
      n = st.notes[i];
      if (!n.resolved && n.y < H + 60) live.push(n);
      else if (n.resolved && n.y < dropLineY + 50) live.push(n);
    }
    st.notes = live;

    // particles
    for (i = st.particles.length - 1; i >= 0; i--) {
      var pt = st.particles[i];
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vy += 400 * dt;
      pt.life -= dt;
      if (pt.life <= 0) st.particles.splice(i, 1);
    }
    // floaters
    for (i = st.floaters.length - 1; i >= 0; i--) {
      var fl = st.floaters[i];
      fl.y -= 40 * dt; fl.life -= dt;
      if (fl.life <= 0) st.floaters.splice(i, 1);
    }
    // balloons
    for (i = st.balloons.length - 1; i >= 0; i--) {
      var bal = st.balloons[i];
      bal.y += bal.vy * dt;
      if (bal.y < -60) st.balloons.splice(i, 1);
    }

    game.score = liveScore();
  }

  // ---------- draw ----------
  function fmtTime(t) {
    var m = Math.floor(t / 60);
    var s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function draw() {
    var ctx = R.ctx;
    if (!ctx) return;

    // ===== SELECT =====
    if (st.phase === 'select') {
      ctx.fillStyle = '#0d0d1a';
      ctx.fillRect(0, 0, W, H);
      R.text('SELECT YOUR DJ AVATAR', W / 2, 80, '24px sans-serif', '#fff', 'center');
      var spacing = 160;
      var startX = W / 2 - spacing;
      for (var i = 0; i < avatars.length; i++) {
        var x = startX + i * spacing;
        var y = H / 2 - 50;
        if (i === st.avatar) {
          ctx.strokeStyle = '#ffcf3f';
          ctx.lineWidth = 4;
          R.roundRect(x - 50, y - 10, 100, 120, 8);
          ctx.stroke();
        }
        R.drawSpr(avatarSprites[avatars[i]], x - 40, y, 80, 100);
        R.text(avatarNames[avatars[i]], x, y + 116, '14px sans-serif', '#ccc', 'center');
      }
      R.text('LEFT/RIGHT or CLICK to choose  -  SPACE/ENTER to confirm',
        W / 2, H - 70, '15px sans-serif', '#aaa', 'center');
      return;
    }

    // ===== NAME =====
    if (st.phase === 'name') {
      ctx.fillStyle = '#0d0d1a';
      ctx.fillRect(0, 0, W, H);
      R.text('ENTER STAGE NAME', W / 2, 100, '24px sans-serif', '#fff', 'center');
      R.drawSpr(avatarSprites[avatars[st.avatar]], W / 2 - 40, 140, 80, 100);
      ctx.strokeStyle = '#ffcf3f';
      ctx.lineWidth = 2;
      R.roundRect(W / 2 - 160, H / 2 + 10, 320, 50, 8);
      ctx.stroke();
      var caret = (Math.floor(Date.now() / 400) % 2) ? '_' : '';
      R.text((st.name || '') + caret, W / 2, H / 2 + 44,
        '26px monospace', '#fff', 'center');
      R.text('Type letters/numbers  -  ENTER to continue',
        W / 2, H - 70, '15px sans-serif', '#aaa', 'center');
      return;
    }

    // ===== READY =====
    if (st.phase === 'ready') {
      ctx.fillStyle = '#0d0d1a';
      ctx.fillRect(0, 0, W, H);
      // marquee
      ctx.fillStyle = '#1a0033';
      R.roundRect(W / 2 - 220, 70, 440, 70, 12);
      ctx.fill();
      ctx.strokeStyle = '#ff3df0';
      ctx.lineWidth = 3;
      R.roundRect(W / 2 - 220, 70, 440, 70, 12);
      ctx.stroke();
      R.text('TONIGHT: DJ ' + st.name, W / 2, 114, '26px sans-serif', '#ffd34d', 'center');
      R.drawSpr(avatarSprites[avatars[st.avatar]], W / 2 - 45, H / 2 - 70, 90, 110);
      R.text('Bronze Needle  -  2ch Mixer  -  60W Stack',
        W / 2, H / 2 + 70, '15px sans-serif', '#9af', 'center');
      var pulse = 0.6 + 0.4 * Math.sin(Date.now() / 250);
      R.text('PRESS SPACE TO CUE THE RECORD',
        W / 2, H - 90, '20px sans-serif',
        'rgba(255,255,255,' + pulse.toFixed(2) + ')', 'center');
      return;
    }

    // ===== PLAY / DONE =====
    var sx = 0, sy = 0;
    if (st.shake > 0) {
      sx = (Math.random() - 0.5) * st.shake;
      sy = (Math.random() - 0.5) * st.shake;
    }
    ctx.save();
    ctx.translate(sx, sy);

    ctx.fillStyle = '#0a0a16';
    ctx.fillRect(-20, -20, W + 40, H + 40);

    // floor panels bonus tint
    if (st.floorPanels) {
      for (var fp = 0; fp < 6; fp++) {
        var cols = ['rgba(255,80,80,0.10)', 'rgba(80,255,120,0.10)', 'rgba(80,160,255,0.10)'];
        ctx.fillStyle = cols[(fp + Math.floor(Date.now() / 300)) % 3];
        ctx.fillRect((fp % 3) * (W / 3), Math.floor(fp / 3) * (H / 2), W / 3, H / 2);
      }
    }

    // lanes
    for (var L = 0; L < LANE_COUNT; L++) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(laneX(L), 0, laneW, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.strokeRect(laneX(L), 0, laneW, H);
    }

    // scratch overlay
    if (st.scratch > 0) {
      ctx.fillStyle = 'rgba(255,40,40,' + (st.scratch * 0.18).toFixed(2) + ')';
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }

    // drop line
    var glow = 0.4 + st.dropFlash * 0.6;
    for (var dl = 0; dl < LANE_COUNT; dl++) {
      ctx.fillStyle = 'rgba(255,220,80,' + glow.toFixed(2) + ')';
      ctx.fillRect(laneX(dl), dropLineY - 4, laneW, 8);
    }

    // target zone hint
    var prog2 = clamp(st.elapsed / SET_TIME, 0, 1);
    var zonePx2 = 38 - 12 * prog2;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (var tz = 0; tz < LANE_COUNT; tz++) {
      ctx.fillRect(laneX(tz), dropLineY - zonePx2, laneW, zonePx2 * 2);
    }

    // notes
    for (var i2 = 0; i2 < st.notes.length; i2++) {
      var n = st.notes[i2];
      if (n.resolved) continue;
      var nx = laneX(n.lane) + 6;
      ctx.fillStyle = n.color;
      R.roundRect(nx, n.y, laneW - 12, noteH, 6);
      ctx.fill();
    }

    // groove marker
    var mx = laneX(0) + st.markerVis * (laneW + laneGap);
    var mGlow = 0.5 + st.crowdFlash * 0.5;
    ctx.fillStyle = 'rgba(120,255,200,' + mGlow.toFixed(2) + ')';
    R.roundRect(mx + 4, dropLineY - zonePx2 - 6, laneW - 8, zonePx2 * 2 + 12, 8);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    R.roundRect(mx + 4, dropLineY - zonePx2 - 6, laneW - 8, zonePx2 * 2 + 12, 8);
    ctx.stroke();

    // particles
    for (var p = 0; p < st.particles.length; p++) {
      var pt = st.particles[p];
      var al = clamp(pt.life / pt.max, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = al;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
      ctx.globalAlpha = 1;
    }

    // balloons
    for (var bb = 0; bb < st.balloons.length; bb++) {
      var bal = st.balloons[bb];
      R.drawSpr(avatarSprites[avatars[bal.c]], bal.x, bal.y, 30, 38);
    }

    // floaters
    for (var f = 0; f < st.floaters.length; f++) {
      var fl = st.floaters[f];
      ctx.globalAlpha = clamp(fl.life / 0.9, 0, 1);
      R.text(fl.text, fl.x, fl.y, '20px sans-serif', fl.color, 'center');
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // ---------- HUD (no shake) ----------
    // marquee with chosen DJ + avatar
    ctx.fillStyle = 'rgba(26,0,51,0.85)';
    R.roundRect(W / 2 - 200, 8, 400, 44, 10);
    ctx.fill();
    ctx.strokeStyle = '#ff3df0';
    ctx.lineWidth = 2;
    R.roundRect(W / 2 - 200, 8, 400, 44, 10);
    ctx.stroke();
    R.drawSpr(avatarSprites[avatars[st.avatar]], W / 2 - 192, 12, 30, 36);
    R.text('DJ ' + st.name, W / 2 + 12, 38, '20px sans-serif', '#ffd34d', 'center');

    // timer
    R.text(fmtTime(st.timeLeft), W / 2, 80, '22px monospace', '#fff', 'center');

    // crowd hype meter (left)
    R.text('HYPE', 60, 70, '14px sans-serif', '#7fffd4', 'left');
    R.text(Math.floor(st.hype).toString(), 60, 92, '20px sans-serif', '#7fffd4', 'left');
    var hb = clamp(st.hype / 120, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(20, 104, 160, 12);
    ctx.fillStyle = '#3dffb0';
    ctx.fillRect(20, 104, 160 * hb, 12);

    // dead air meter (right)
    R.text('DEAD AIR', W - 60, 70, '14px sans-serif', '#ff6b6b', 'right');
    R.text(Math.floor(st.deadAir).toString(), W - 60, 92, '20px sans-serif', '#ff6b6b', 'right');
    var db = clamp(st.deadAir / 120, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(W - 180, 104, 160, 12);
    ctx.fillStyle = '#ff5d5d';
    ctx.fillRect(W - 180, 104, 160 * db, 12);

    // streak / combo / bonus charges
    R.text('STREAK ' + st.streak + '  (best ' + st.bestStreak + ')',
      W / 2, H - 50, '15px sans-serif', '#ffd34d', 'center');
    R.text('SCORE ' + game.score, W / 2, H - 28, '16px sans-serif', '#fff', 'center');

    // bonus charge indicator
    R.text('A: FLOOR PANELS', 20, H - 50, '13px sans-serif',
      st.bonusCharges > 0 ? '#ffd34d' : '#666', 'left');
    for (var bc = 0; bc < 4; bc++) {
      ctx.fillStyle = bc < st.bonusCharges ? '#ffd34d' : 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(28 + bc * 18, H - 28, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // feedback text
    if (st.feedbackTimer > 0) {
      ctx.globalAlpha = clamp(st.feedbackTimer / 0.55, 0, 1);
      var fc = st.feedback === 'BOO!' ? '#ff5d5d'
             : st.feedback === 'PERFECT!' ? '#ffe14d' : '#4dff9b';
      R.text(st.feedback, W / 2, dropLineY - 70, '30px sans-serif', fc, 'center');
      ctx.globalAlpha = 1;
    }

    // cue flash
    if (st.cued > 0) {
      ctx.globalAlpha = clamp(st.cued / 1.2, 0, 1);
      R.text('DROP IT!', W / 2, H / 2, '48px sans-serif', '#ff3df0', 'center');
      ctx.globalAlpha = 1;
    }
  }

  return { update: update, draw: draw };
};
})();