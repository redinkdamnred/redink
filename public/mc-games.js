/* =====================================================================
   MINI GAMES — Creeper Dash + Whack-a-Mole + ท้าทายรายวัน + กระดานคะแนนกลุ่ม
   - แท็บ "มินิเกม" (#gamesBox) ซ่อนอยู่จนกว่าเซิร์ฟเวอร์จะตอบ /api/games/config ว่าเปิดใช้
   - ด่านรายวัน: ทุกคนได้ลำดับอุปสรรค/มอนเดียวกัน (seed จากเซิร์ฟเวอร์ตามวันที่ไทย)
   - สถิติส่วนตัวเก็บในเบราว์เซอร์ คะแนนกลุ่มเก็บที่เซิร์ฟเวอร์ (games.js)
   ===================================================================== */
(function () {
  'use strict';
  var doc = document, box = doc.getElementById('gamesBox'), root = doc.getElementById('mcgRoot');
  if (!box || !root) return;

  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; }
    return null;
  }
  function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function sfx(n) { try { if (window.mcSfx) window.mcSfx(n); } catch (e) {} }
  function adv(o) { try { if (window.mcAdv) window.mcAdv(o); } catch (e) {} }
  var nf = new Intl.NumberFormat('th-TH');
  function isDark() {
    var t = doc.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true; if (t === 'light') return false;
    try { return matchMedia('(prefers-color-scheme:dark)').matches; } catch (e) { return false; }
  }
  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pixSVG(grid, pal) {
    var h = grid.length, w = grid[0].length, s = '';
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var c = grid[y].charAt(x);
      if (c !== '.' && pal[c]) s += '<rect x="' + x + '" y="' + y + '" width="1.02" height="1.02" fill="' + pal[c] + '"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges" aria-hidden="true">' + s + '</svg>';
  }

  /* ---------- สไปรต์ ---------- */
  var CREEPER = [
    '..gggggggg..', '..gGgggGgg..', '..gKKggKKg..', '..gKKggKKg..', '..gggKKggg..', '..ggKKKKgg..', '..ggKggKgg..', '..gggggggg..',
    '..gGgggggg..', '..gggggGgg..', '..gggggggg..', '..gggggggg..', '..gg.gg.gg..'];
  var CR_FEET = ['..ggg..ggg..', '..ggg..ggg..'];
  var CPAL = { g: '#5ec43a', G: '#3f9a28', K: '#0b2a0b' };
  var MOBS = {
    zombie: { g: ['GGGGGGGG', 'GGGGGGGG', 'GWBGGBWG', 'GGGGGGGG', 'GGGSSGGG', 'GGSSSSGG', 'GGSGGSGG', 'GGGGGGGG'], p: { G: '#4f9a3a', W: '#fff', B: '#2d3f8f', S: '#2c5a22' } },
    gold: { g: ['YYYYYYYY', 'YYYYYYYY', 'YWBYYBWY', 'YYYYYYYY', 'YYYSSYYY', 'YYSSSSYY', 'YYSYYSYY', 'YYYYYYYY'], p: { Y: '#f2c94c', W: '#fff', B: '#7a4a00', S: '#b5851a' } },
    pig: { g: ['PPPPPPPP', 'PPPPPPPP', 'PEPPPPEP', 'PPPPPPPP', 'PPSSSSPP', 'PPSDSDPP', 'PPSSSSPP', 'PPPPPPPP'], p: { P: '#f0a8a8', E: '#222', S: '#e8838b', D: '#7a2f36' } },
    creeper: { g: ['gggggggg', 'gGgggGgg', 'gKKggKKg', 'gKKggKKg', 'gggKKggg', 'ggKKKKgg', 'ggKggKgg', 'gggggggg'], p: CPAL }
  };

  /* ---------- สถานะ/ตัวช่วยกลาง ---------- */
  var cfg = null, scores = null, game = 'dash', mode = 'best', cur = null; // cur = เกมที่กำลังเล่น {stop}
  var NAMES = { dash: 'Creeper Dash', mole: 'Whack-a-Mole' };
  function bestKey(g, m) { return 'mcBest.' + g + '.' + (m === 'daily' && cfg ? cfg.day : 'all'); }
  function getBest(g, m) { return parseInt(store(bestKey(g, m)) || '0', 10) || 0; }
  function setBest(g, m, v) { store(bestKey(g, m), String(v)); }
  function api(path, opt) { return fetch(path, opt).then(function (r) { return r.json().then(function (j) { j.status = r.status; return j; }); }); }

  /* ---------- UI ---------- */
  var tabs = el('div', 'tabs'); tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'เลือกเกม');
  var bDash = el('button', null, 'Creeper Dash'), bMole = el('button', null, 'Whack-a-Mole');
  bDash.type = bMole.type = 'button'; bDash.setAttribute('data-g', 'dash'); bMole.setAttribute('data-g', 'mole');
  tabs.appendChild(bDash); tabs.appendChild(bMole);
  var modes = el('div', 'tabs mcg-modes'); modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', 'โหมด');
  var mBest = el('button', null, 'เล่นเอง'), mDaily = el('button', null, 'ท้าทายรายวัน');
  mBest.type = mDaily.type = 'button'; mBest.setAttribute('data-m', 'best'); mDaily.setAttribute('data-m', 'daily');
  modes.appendChild(mBest); modes.appendChild(mDaily);
  var nameRow = el('div', 'mcg-name');
  var nameIn = el('input', 'field'); nameIn.id = 'mcgName'; nameIn.maxLength = 20; nameIn.placeholder = 'ชื่อของคุณ (ใช้ขึ้นกระดานคะแนน)'; nameIn.setAttribute('aria-label', 'ชื่อบนกระดานคะแนน');
  nameIn.value = store('mcGameName') || '';
  nameIn.addEventListener('input', function () { store('mcGameName', nameIn.value.trim().slice(0, 20)); });
  nameRow.appendChild(nameIn);
  var info = el('div', 'mcg-info small muted');
  var stage = el('div', 'mcg-stage');
  var hud = el('div', 'mcg-hud'); var hudScore = el('b', null, '0'), hudMid = el('span', null, ''), hudBest = el('span', null, '');
  hud.appendChild(hudScore); hud.appendChild(hudMid); hud.appendChild(hudBest);
  var view = el('div', 'mcg-view'); stage.appendChild(hud); stage.appendChild(view);
  var overlay = el('div', 'mcg-ov');
  var ovTitle = el('div', 'mcg-ov-t'), ovText = el('div', 'mcg-ov-x small'), ovBtn = el('button', 'primary', 'เริ่มเล่น'); ovBtn.type = 'button';
  var ovSubmit = el('button', null, 'ส่งคะแนน'); ovSubmit.type = 'button'; ovSubmit.hidden = true;
  var ovMsg = el('div', 'mcg-ov-m small');
  overlay.appendChild(ovTitle); overlay.appendChild(ovText); overlay.appendChild(ovBtn); overlay.appendChild(ovSubmit); overlay.appendChild(ovMsg);
  stage.appendChild(overlay);
  var lbHead = el('div', 'chat-head'); lbHead.style.marginTop = '14px';
  lbHead.appendChild(el('h3', 'mcg-h3', 'กระดานคะแนนกลุ่ม'));
  var lbTabs = el('div', 'tabs mcg-lbtabs'); lbTabs.setAttribute('role', 'group');
  var lbDay = el('button', null, 'วันนี้'), lbAll = el('button', null, 'ตลอดกาล'); lbDay.type = lbAll.type = 'button';
  lbTabs.appendChild(lbDay); lbTabs.appendChild(lbAll); lbHead.appendChild(lbTabs);
  var lbList = el('ol', 'rank mcg-lb');
  root.appendChild(tabs); root.appendChild(modes); root.appendChild(nameRow); root.appendChild(info); root.appendChild(stage); root.appendChild(lbHead); root.appendChild(lbList);
  var lbMode = 'best';

  function sync() {
    [bDash, bMole].forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-g') === game ? 'true' : 'false'); });
    [mBest, mDaily].forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-m') === mode ? 'true' : 'false'); });
    [lbDay, lbAll].forEach(function (b) { b.setAttribute('aria-pressed', (b === lbDay) === (lbMode === 'daily') ? 'true' : 'false'); });
    var dayTxt = cfg ? 'ด่านวันที่ ' + cfg.day : '';
    info.textContent = mode === 'daily' ? ('ท้าทายรายวัน: ทุกคนได้ด่านเดียวกัน ' + dayTxt + ' เล่นกี่ครั้งก็ได้ นับคะแนนสูงสุด') : 'เล่นเอง: ด่านสุ่มทุกครั้ง นับเป็นสถิติรวมของกลุ่ม';
    hudBest.textContent = 'สถิติคุณ ' + nf.format(getBest(game, mode));
    var d = doc.getElementById('mcgDay'); if (d) d.textContent = cfg ? cfg.day : '';
    renderLB();
  }
  function renderLB() {
    lbList.textContent = '';
    var l = scores ? (lbMode === 'daily' ? scores.daily[game] : scores.best[game]) : null;
    if (!l || !l.length) { var e = el('li', 'empty', scores ? 'ยังไม่มีใครขึ้นกระดาน เป็นคนแรกเลย!' : 'กำลังโหลด…'); lbList.appendChild(e); return; }
    var me = nameIn.value.trim().toLowerCase();
    l.slice(0, 10).forEach(function (r, i) {
      var li = el('li');
      var rk = el('span', 'rk' + (i === 0 ? ' first' : ''), String(i + 1));
      var nm = el('span', 'rn', r.name), vl = el('span', 'rv', nf.format(r.score));
      if (me && r.name.toLowerCase() === me) li.className = 'mcg-me';
      li.appendChild(rk); li.appendChild(nm); li.appendChild(vl); lbList.appendChild(li);
    });
  }
  function loadScores() {
    api('/api/games/scores', { cache: 'no-store' }).then(function (j) { if (j && j.best) { scores = j; renderLB(); } }).catch(function () {});
  }
  bDash.addEventListener('click', function () { setGame('dash'); });
  bMole.addEventListener('click', function () { setGame('mole'); });
  mBest.addEventListener('click', function () { setMode('best'); });
  mDaily.addEventListener('click', function () { setMode('daily'); });
  lbDay.addEventListener('click', function () { lbMode = 'daily'; sync(); });
  lbAll.addEventListener('click', function () { lbMode = 'best'; sync(); });
  function setGame(g) { if (g === game) return; stopCur(); game = g; lbMode = mode === 'daily' ? 'daily' : 'best'; idle(); sync(); }
  function setMode(m) { if (m === mode) return; stopCur(); mode = m; lbMode = m === 'daily' ? 'daily' : 'best'; idle(); sync(); }
  function stopCur() { if (cur) { try { cur.stop(); } catch (e) {} cur = null; } view.textContent = ''; hudScore.textContent = '0'; hudMid.textContent = ''; }

  /* ---------- หน้าจอเริ่ม/จบ ---------- */
  var last = null;
  function idle() {
    overlay.hidden = false; ovSubmit.hidden = true; ovMsg.textContent = ''; last = null;
    ovTitle.textContent = NAMES[game];
    ovText.textContent = game === 'dash' ? 'แตะหน้าจอ / กด Space / ↑ เพื่อให้ครีปเปอร์กระโดด หลบกระบองเพชรและลาวา ยิ่งไกลยิ่งเร็ว'
      : 'ตีซอมบี้ (+10) และซอมบี้ทอง (+25) ภายใน 45 วินาที อย่าตีหมู (−10) และอย่าแตะครีปเปอร์ (−20)';
    ovBtn.textContent = 'เริ่มเล่น'; ovBtn.hidden = false;
    hudScore.textContent = '0'; hudMid.textContent = '';
  }
  function over(res) {
    cur = null; last = { game: game, mode: mode, score: res.score, dur: res.dur, day: cfg && cfg.day, seed: cfg && cfg.seed, sent: false };
    var prev = getBest(game, mode), rec = res.score > prev;
    if (rec) { setBest(game, mode, res.score); adv({ icon: 'crown', name: 'สถิติใหม่ของคุณใน ' + NAMES[game] + ': ' + nf.format(res.score), challenge: true }); sfx('levelup'); }
    hudBest.textContent = 'สถิติคุณ ' + nf.format(getBest(game, mode));
    overlay.hidden = false; ovTitle.textContent = (res.title || 'จบเกม') + ' · ' + nf.format(res.score) + ' แต้ม';
    ovText.textContent = rec ? 'สถิติใหม่ของคุณ!' : 'สถิติคุณ ' + nf.format(prev);
    ovBtn.textContent = 'เล่นอีกครั้ง'; ovBtn.hidden = false; ovMsg.textContent = '';
    ovSubmit.hidden = true;
    if (res.score > 0) { if (nameIn.value.trim()) submit(); else { ovSubmit.hidden = false; ovMsg.textContent = 'ใส่ชื่อด้านบนแล้วกด "ส่งคะแนน" เพื่อขึ้นกระดานกลุ่ม'; } }
  }
  function submit() {
    if (!last || last.sent || cfg == null) return;
    var name = nameIn.value.trim();
    if (!name) { ovMsg.textContent = 'ใส่ชื่อก่อนส่งคะแนน'; nameIn.focus(); return; }
    last.sent = true; ovSubmit.hidden = true; ovMsg.textContent = 'กำลังส่งคะแนน…';
    var L = last;
    api('/api/games/score', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: L.game, mode: L.mode, name: name, score: L.score, dur: L.dur, day: L.day, seed: L.seed }) })
      .then(function (j) {
        if (j && j.ok) {
          ovMsg.textContent = j.rank ? 'ส่งแล้ว! อันดับ ' + j.rank + ' ของ' + (L.mode === 'daily' ? 'วันนี้' : 'กลุ่ม') + (j.record ? ' · ทำลายสถิติกลุ่ม!' : '') : 'ส่งแล้ว (ยังไม่ติด 20 อันดับ)';
          if (j.record) { adv({ icon: 'crown', name: name + ' ทำลายสถิติกลุ่มใน ' + NAMES[L.game], challenge: true }); sfx('levelup'); }
          loadScores();
        } else { L.sent = false; ovMsg.textContent = (j && j.message) || 'ส่งคะแนนไม่สำเร็จ'; if (j && j.status !== 409 && j.status !== 400) ovSubmit.hidden = false; }
      }).catch(function () { L.sent = false; ovSubmit.hidden = false; ovMsg.textContent = 'ส่งไม่สำเร็จ ลองกดส่งอีกครั้ง'; });
  }
  ovSubmit.addEventListener('click', submit);
  ovBtn.addEventListener('click', function () { start(); });
  function start() {
    stopCur();
    var seed = mode === 'daily' && cfg ? cfg.seed : (Math.random() * 4294967296) >>> 0;
    if (mode === 'daily' && !cfg) { ovMsg.textContent = 'ยังโหลดด่านรายวันไม่ได้ ลองใหม่อีกครั้ง'; return; }
    overlay.hidden = true; ovMsg.textContent = '';
    cur = (game === 'dash' ? dash : mole)(seed);
  }

  /* =====================================================================
     Creeper Dash
     ===================================================================== */
  function dash(seed) {
    var W = 600, H = 220, GY = 176, PX = 3, STEP = 1 / 60;
    var cv = el('canvas', 'mcg-cv'); cv.width = W; cv.height = H; cv.setAttribute('aria-label', 'เกม Creeper Dash'); view.textContent = ''; view.appendChild(cv);
    var g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    var rnd = mulberry(seed);
    var dist = 0, py = 0, vy = 0, onGround = true, alive = true, acc = 0, lastT = 0, raf = 0, t0 = performance.now(), frames = 0, jumpBuf = 0;
    var obs = [], nextX = 720, stars = [], clouds = [], rg = mulberry(seed ^ 0x9e3779b9);
    for (var i = 0; i < 40; i++) stars.push([rg() * W, rg() * 110, rg() < 0.2 ? 2 : 1]);
    for (i = 0; i < 5; i++) clouds.push([rg() * W, 14 + rg() * 60, 30 + rg() * 30]);
    var speedAt = function (d) { return Math.min(400, 220 + d / 12); };
    function gen() {
      while (nextX < dist + W + 200) {
        var r = rnd(), sp = speedAt(nextX), air = 0.65 * sp;
        if (r < 0.28) { var w = 70 + Math.floor(rnd() * 36); obs.push({ t: 'gap', x: nextX, w: w }); nextX += w; }
        else { var n = rnd() < 0.3 ? 2 : 1, h = [24, 36, 48][Math.floor(rnd() * 3)]; obs.push({ t: 'cac', x: nextX, w: 16 * n + (n - 1) * 4, h: h }); nextX += 16 * n; }
        nextX += air * 1.15 + 70 + rnd() * 200;
      }
    }
    function jump() { if (!alive) return; if (onGround) { vy = -780; onGround = false; sfx('jump'); } else jumpBuf = 0.12; }
    function key(e) {
      if (!box.classList.contains('active')) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'ArrowUp' || e.key === ' ') {
        var tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'BUTTON') return;
        e.preventDefault(); if (!e.repeat) jump();
      }
    }
    function down(e) { e.preventDefault(); jump(); }
    doc.addEventListener('keydown', key); cv.addEventListener('pointerdown', down);
    function sprite() { return CREEPER.concat(CR_FEET); }
    var SP = sprite();
    function step() {
      var sp = speedAt(dist); dist += sp * STEP;
      vy += 2400 * STEP; py += vy * STEP;
      if (py >= 0) { py = 0; vy = 0; if (!onGround) { onGround = true; if (jumpBuf > 0) { vy = -780; onGround = false; jumpBuf = 0; sfx('jump'); } } }
      if (jumpBuf > 0) jumpBuf -= STEP;
      gen();
      var px0 = 80 + 2 * PX + 2, px1 = 80 + 10 * PX - 2, bot = GY + py;
      for (var k = 0; k < obs.length; k++) {
        var o = obs[k], sx = o.x - dist + 80;
        if (sx + o.w < -20) { obs.splice(k, 1); k--; continue; }
        if (o.t === 'cac') { if (px1 > sx + 2 && px0 < sx + o.w - 2 && bot > GY - o.h + 2) { die(); return; } }
        else if (bot >= GY - 0.5 && px0 > sx + 6 && px1 < sx + o.w - 6) { die(); return; }
      }
      if (py > 160) die();
    }
    var shake = 0;
    function die() {
      alive = false; sfx('boom'); shake = 0.4;
      draw(); cancelAnimationFrame(raf); cleanup();
      var score = Math.floor(dist / 10);
      setTimeout(function () { over({ score: score, dur: Math.round(performance.now() - t0), title: 'ครีปเปอร์พังแล้ว!' }); }, 650);
    }
    function cleanup() { doc.removeEventListener('keydown', key); cv.removeEventListener('pointerdown', down); }
    function draw() {
      var dark = isDark();
      var sky = g.createLinearGradient(0, 0, 0, H);
      if (dark) { sky.addColorStop(0, '#04101a'); sky.addColorStop(1, '#0d2a3a'); } else { sky.addColorStop(0, '#8ed0ff'); sky.addColorStop(1, '#d9f1ff'); }
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      var ox = shake > 0 ? (Math.random() - 0.5) * 8 : 0; if (shake > 0) shake -= 0.016;
      g.save(); g.translate(ox, 0);
      if (dark) { g.fillStyle = '#cfe9ff'; stars.forEach(function (s) { g.fillRect(((s[0] - dist * 0.02) % W + W) % W, s[1], s[2], s[2]); }); }
      else { g.fillStyle = 'rgba(255,255,255,.9)'; clouds.forEach(function (c) { var x = ((c[0] - dist * 0.1) % (W + 80) + W + 80) % (W + 80) - 40; g.fillRect(x, c[1], c[2], 10); g.fillRect(x + 8, c[1] - 8, c[2] - 16, 8); }); }
      // พื้น
      var off = dist % 24;
      g.fillStyle = '#6b4326'; g.fillRect(0, GY, W, H - GY);
      g.fillStyle = '#5ec43a'; g.fillRect(0, GY, W, 8);
      g.fillStyle = '#3f9a28'; for (var x = -off; x < W; x += 24) g.fillRect(x, GY + 8, 12, 4);
      g.fillStyle = '#4e321b'; for (x = -off * 0.7; x < W; x += 40) g.fillRect(x, GY + 24, 8, 6);
      obs.forEach(function (o) {
        var sx = o.x - dist + 80; if (sx > W + 30 || sx + o.w < -30) return;
        if (o.t === 'gap') {
          g.fillStyle = dark ? '#04101a' : '#8ed0ff'; g.fillRect(sx, GY, o.w, H - GY);
          g.fillStyle = '#ff7a1a'; g.fillRect(sx, GY + 22, o.w, H - GY - 22);
          g.fillStyle = '#ffd24a'; for (var q = 0; q < o.w; q += 10) g.fillRect(sx + q, GY + 22 + ((q / 10 + Math.floor(dist / 12)) % 2) * 4, 6, 4);
        } else {
          g.fillStyle = '#2f7d1f'; g.fillRect(sx, GY - o.h, o.w, o.h);
          g.fillStyle = '#4ea83a'; g.fillRect(sx + 3, GY - o.h + 3, 4, o.h - 6);
          g.fillStyle = '#1b4d12'; for (var yy = GY - o.h + 6; yy < GY; yy += 12) g.fillRect(sx + o.w - 5, yy, 5, 3);
        }
      });
      // ครีปเปอร์
      var pxl = 80, flash = !alive && Math.floor(performance.now() / 80) % 2;
      for (var r = 0; r < SP.length; r++) for (var c = 0; c < 12; c++) {
        var ch = SP[r].charAt(c); if (ch === '.') continue;
        g.fillStyle = flash ? '#fff' : CPAL[ch]; g.fillRect(pxl + c * PX, GY - SP.length * PX + py + r * PX, PX, PX);
      }
      g.restore();
      hudScore.textContent = nf.format(Math.floor(dist / 10));
      hudMid.textContent = 'ความเร็ว ' + Math.round(speedAt(dist) / 4) + '%';
    }
    lastT = performance.now(); gen();
    function loop(t) {
      raf = requestAnimationFrame(loop);
      if (!alive) return;
      var dt = Math.min(0.1, (t - lastT) / 1000); lastT = t; acc += dt;
      while (acc >= STEP && alive) { step(); acc -= STEP; }
      if (alive) draw();
    }
    raf = requestAnimationFrame(loop);
    return { stop: function () { alive = false; cancelAnimationFrame(raf); cleanup(); } };
  }

  /* =====================================================================
     Whack-a-Mole
     ===================================================================== */
  function mole(seed) {
    var DUR = 45000, rnd = mulberry(seed), t0 = performance.now(), score = 0, over_ = false, timers = [], tick = 0;
    var grid = el('div', 'mcg-grid'); view.textContent = ''; view.appendChild(grid);
    var cells = [];
    for (var i = 0; i < 9; i++) (function (i) {
      var c = el('button', 'mcg-hole'); c.type = 'button'; c.setAttribute('aria-label', 'หลุมที่ ' + (i + 1));
      var m = el('div', 'mcg-mob'); c.appendChild(m);
      c.addEventListener('pointerdown', function (e) { e.preventDefault(); whack(i); });
      c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); whack(i); } });
      grid.appendChild(c); cells.push({ btn: c, mob: m, up: null });
    })(i);
    function pickType() {
      var r = rnd();
      return r < 0.55 ? 'zombie' : r < 0.67 ? 'gold' : r < 0.85 ? 'pig' : 'creeper';
    }
    function pop(c, type, life) {
      var u = c.up = { type: type, hit: false }; c.mob.innerHTML = pixSVG(MOBS[type].g, MOBS[type].p);
      c.btn.className = 'mcg-hole up ' + type;
      var id = setTimeout(function () { if (c.up === u) hide(c); }, life); timers.push(id);
    }
    function hide(c) { c.up = null; c.btn.className = 'mcg-hole'; }
    function float(c, txt, bad) {
      var f = el('span', 'mcg-pop' + (bad ? ' bad' : ''), txt); c.btn.appendChild(f);
      setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 700);
    }
    function whack(i) {
      if (over_) return; var c = cells[i]; if (!c.up || c.up.hit) return;
      c.up.hit = true; var t = c.up.type, d = t === 'zombie' ? 10 : t === 'gold' ? 25 : t === 'pig' ? -10 : -20;
      score = Math.max(0, score + d); hudScore.textContent = nf.format(score);
      c.btn.className = 'mcg-hole up hit ' + t; float(c, (d > 0 ? '+' : '') + d, d < 0);
      sfx(t === 'pig' ? 'oink' : t === 'creeper' ? 'boom' : 'hit'); if (d > 0) sfx('xp');
      if (t === 'creeper') { grid.classList.add('shake'); setTimeout(function () { grid.classList.remove('shake'); }, 350); }
      var u = c.up, id = setTimeout(function () { if (c.up === u) hide(c); }, 220); timers.push(id);
    }
    function spawn() {
      if (over_) return;
      var el_ = performance.now() - t0; if (el_ >= DUR) return finish();
      var p = el_ / DUR, life = 950 - 480 * p, gap = 820 - 400 * p;
      var free = []; cells.forEach(function (c, k) { if (!c.up) free.push(k); });
      if (free.length) { var k = free[Math.floor(rnd() * free.length)]; pop(cells[k], pickType(), life * (0.85 + rnd() * 0.3)); } else rnd();
      var id = setTimeout(spawn, gap * (0.8 + rnd() * 0.4)); timers.push(id);
    }
    function clock() {
      var left = Math.max(0, DUR - (performance.now() - t0)); hudMid.textContent = 'เหลือ ' + Math.ceil(left / 1000) + ' วิ';
      if (left <= 0) finish();
    }
    function finish() {
      if (over_) return; over_ = true; stopTimers(); cells.forEach(hide);
      var dur = Math.round(performance.now() - t0);
      over({ score: score, dur: dur, title: 'หมดเวลา!' });
    }
    function stopTimers() { timers.forEach(clearTimeout); clearInterval(tick); }
    tick = setInterval(clock, 200); spawn(); clock();
    return { stop: function () { over_ = true; stopTimers(); } };
  }

  /* ---------- เปิด/ปิดแท็บ: หยุดเกมเมื่อออกจากแท็บ ---------- */
  new MutationObserver(function () { if (!box.classList.contains('active') && cur) { stopCur(); idle(); } })
    .observe(box, { attributes: true, attributeFilter: ['class'] });
  doc.addEventListener('visibilitychange', function () { if (doc.hidden && cur) { stopCur(); idle(); } });
  new MutationObserver(function () { if (box.classList.contains('active')) loadScores(); }).observe(box, { attributes: true, attributeFilter: ['class'] });

  /* ---------- เริ่มต้น: ถามเซิร์ฟเวอร์ว่าเปิดใช้ไหม ---------- */
  api('/api/games/config', { cache: 'no-store' }).then(function (j) {
    if (!j || !j.enabled) return;
    cfg = j; box.hidden = false; idle(); sync(); loadScores();
  }).catch(function () {});
  setInterval(function () { if (!cfg) return; api('/api/games/config', { cache: 'no-store' }).then(function (j) { if (j && j.enabled && j.day !== cfg.day) { cfg = j; sync(); loadScores(); } }).catch(function () {}); }, 5 * 60 * 1000);
  window.mcGames = { start: function (g, m) { if (g) game = g; if (m) mode = m; sync(); start(); } };
})();
