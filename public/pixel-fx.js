/* =====================================================================
   PIXEL FX — เอฟเฟกต์สไตล์เกมพิกเซล (ไม่แตะโค้ดเดิมของหน้า)
   - ฉากหลัง canvas ความละเอียดต่ำ: เมฆ/ใบไม้ (Creeper) หรือดาว/สปอร์ (Warden)
   - ครีปเปอร์เดินข้ามจอ แตะแล้วชนวนระเบิดได้ + จอสั่น
   - พิมพ์ดีดข้อความสถานะ, ตัวเลขสุ่มก่อนนิ่ง, กราฟโตทีละขั้น, ดอกไม้ไฟตอนเซิร์ฟเปิด
   - เอฟเฟกต์เปิดตลอดเวลา ไม่มีปุ่มปิด
   ===================================================================== */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var $ = function (id) { return doc.getElementById(id); };
  var PX = 4; // 1 พิกเซลของ canvas = 4 px บนจอ
  var on = true; // เอฟเฟกต์เปิดตลอด ไม่มีปุ่มปิด

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  var darkNow = true;
  function calcDark() {
    var t = root.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return !(window.matchMedia && matchMedia('(prefers-color-scheme:light)').matches);
  }
  function isDark() { return darkNow; }
  darkNow = calcDark();
  var fadeT = 0;
  function themeWave(toDark) {
    var lampBox = doc.querySelector('.lamp-wrap'), r = lampBox ? lampBox.getBoundingClientRect() : null;
    var cx = r && r.width ? r.left + r.width / 2 : innerWidth / 2, cy = r && r.width ? r.top + r.height / 2 : innerHeight / 3;
    waveEl.style.left = cx + 'px'; waveEl.style.top = cy + 'px';
    waveEl.className = toDark ? 'dark' : 'light';
    void waveEl.offsetWidth; waveEl.classList.add('go');
    root.classList.add('theme-fade'); clearTimeout(fadeT);
    fadeT = setTimeout(function () { root.classList.remove('theme-fade'); waveEl.className = ''; }, 1200);
  }
  var themeSeen = root.getAttribute('data-theme');
  if (window.MutationObserver) new MutationObserver(function () {
    var was = darkNow; darkNow = calcDark();
    var t = root.getAttribute('data-theme');
    if (themeSeen && t !== themeSeen && was !== darkNow) { quakeSoft(); themeWave(darkNow); }
    themeSeen = t;
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  try { matchMedia('(prefers-color-scheme:light)').addEventListener('change', function () { darkNow = calcDark(); }); } catch (e) {}

  /* ---------- สร้างเลเยอร์ ---------- */
  function mk(tag, id) { var e = doc.createElement(tag); e.id = id; e.setAttribute('aria-hidden', 'true'); doc.body.appendChild(e); return e; }
  var bgC = mk('canvas', 'fxBg'), fgC = mk('canvas', 'fxFg');
  var scan = mk('div', 'fxScan'), flashEl = mk('div', 'fxFlash');
  var waveEl = mk('div', 'fxWave');
  var bg = bgC.getContext('2d'), fg = fgC.getContext('2d');
  var W = 0, H = 0;

  /* ---------- ฉากหลัง ---------- */
  var clouds = [], leaves = [], spores = [], stars = [];
  function seed() {
    clouds = []; leaves = []; spores = []; stars = [];
    var i, n;
    n = Math.max(4, Math.round(W / 38));
    for (i = 0; i < n; i++) clouds.push({ x: rnd(-30, W), y: rnd(2, H * 0.55), w: Math.round(rnd(16, 34)), v: rnd(1.2, 3.4) });
    n = Math.round(W * H / 5200);
    for (i = 0; i < n; i++) leaves.push({ x: rnd(0, W), y: rnd(0, H), v: rnd(5, 13), s: Math.random() < .25 ? 2 : 1, ph: rnd(0, 6.28), c: pick(['#5ec43a', '#8bd96a', '#2b8a19', '#b6f08f']) });
    n = Math.round(W * H / 3400);
    for (i = 0; i < n; i++) spores.push({ x: rnd(0, W), y: rnd(0, H), v: rnd(3, 9), s: Math.random() < .2 ? 2 : 1, ph: rnd(0, 6.28), sp: rnd(1, 3), c: pick(['47,227,212', '134,245,234', '60,160,200', '91,229,138']) });
    n = Math.round(W * H / 2600);
    for (i = 0; i < n; i++) stars.push({ x: Math.floor(rnd(0, W)), y: Math.floor(rnd(0, H * .7)), ph: rnd(0, 6.28), sp: rnd(.6, 2) });
  }
  function resize() {
    W = Math.ceil(innerWidth / PX); H = Math.ceil(innerHeight / PX);
    bgC.width = fgC.width = W; bgC.height = fgC.height = H;
    bg.imageSmoothingEnabled = fg.imageSmoothingEnabled = false;
    seed();
  }
  function drawCloud(c, col) {
    var x = Math.floor(c.x), y = Math.floor(c.y), w = c.w;
    bg.fillStyle = col;
    bg.fillRect(x, y + 3, w, 3);
    bg.fillRect(x + 2, y + 1, w - 4, 3);
    bg.fillRect(x + Math.floor(w * .28), y, Math.floor(w * .32), 2);
  }
  function drawBg(t, dt) {
    bg.clearRect(0, 0, W, H);
    var i, o, dark = isDark();
    if (dark) {
      for (i = 0; i < stars.length; i++) {
        o = stars[i];
        var tw = Math.sin(t * o.sp + o.ph);
        if (tw > .15) { bg.fillStyle = 'rgba(180,255,250,' + (tw > .7 ? .9 : .45) + ')'; bg.fillRect(o.x, o.y, 1, 1); }
      }
      for (i = 0; i < clouds.length; i++) {
        o = clouds[i]; o.x += o.v * dt * .5; if (o.x > W + 4) { o.x = -o.w - 2; o.y = rnd(2, H * .55); }
        drawCloud(o, 'rgba(60,170,190,.07)');
      }
      for (i = 0; i < spores.length; i++) {
        o = spores[i]; o.y -= o.v * dt; if (o.y < -2) { o.y = H + 2; o.x = rnd(0, W); }
        var a = .25 + .75 * Math.abs(Math.sin(t * o.sp + o.ph));
        bg.fillStyle = 'rgba(' + o.c + ',' + a.toFixed(2) + ')';
        bg.fillRect(Math.floor(o.x + Math.sin(t * .7 + o.ph) * 3), Math.floor(o.y), o.s, o.s);
      }
    } else {
      for (i = 0; i < clouds.length; i++) {
        o = clouds[i]; o.x += o.v * dt; if (o.x > W + 4) { o.x = -o.w - 2; o.y = rnd(2, H * .55); }
        drawCloud(o, 'rgba(255,255,255,.62)');
      }
      for (i = 0; i < leaves.length; i++) {
        o = leaves[i]; o.y += o.v * dt; if (o.y > H + 2) { o.y = -2; o.x = rnd(0, W); }
        bg.fillStyle = o.c;
        bg.fillRect(Math.floor(o.x + Math.sin(t * 1.1 + o.ph) * 5), Math.floor(o.y), o.s + 1, o.s);
      }
    }
  }

  /* ---------- อนุภาค (ระเบิด / ดอกไม้ไฟ / ป๊อป) ---------- */
  var parts = [];
  function burst(cx, cy, n, cols, o) {
    o = o || {};
    if (!on) return;
    var x = cx / PX, y = cy / PX, i, a, s;
    for (i = 0; i < n; i++) {
      a = Math.random() * 6.283; s = rnd(o.vmin || 10, o.vmax || 40);
      parts.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + (o.lift || 0),
        g: o.g == null ? 60 : o.g, life: 0, max: rnd(o.lmin || .5, o.lmax || 1.1),
        c: pick(cols), s: Math.random() < (o.big || .25) ? 2 : 1
      });
    }
    if (parts.length > 400) parts.splice(0, parts.length - 400);
  }
  function drawParts(dt) {
    var i, p;
    for (i = parts.length - 1; i >= 0; i--) {
      p = parts[i]; p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= (1 - Math.min(1, .6 * dt));
      fg.globalAlpha = p.life > p.max * .7 ? Math.max(0, (p.max - p.life) / (p.max * .3)) : 1;
      fg.fillStyle = p.c;
      fg.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    fg.globalAlpha = 1;
  }
  var C_BOOM = ['#ffffff', '#ffd24a', '#ff7a1a', '#8a8a8a', '#5ec43a', '#3f9a28', '#333'];
  var C_SONIC = ['#ffffff', '#7dfff2', '#2fe3d4', '#17a8b0', '#0e3d42'];
  var C_FIRE = ['#5be58a', '#b6f08f', '#ffd24a', '#2fe3d4', '#ffffff', '#ff5a4a'];
  var C_XP = ['#b6f08f', '#e3ff55', '#8bd96a', '#fff7a8'];
  function rectCenter(el) { var r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
  function quake() {
    root.classList.remove('fx-quake'); void root.offsetWidth; root.classList.add('fx-quake');
    setTimeout(function () { root.classList.remove('fx-quake'); }, 560);
    flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go');
  }
  function quakeSoft() {
    root.classList.remove('fx-quake'); void root.offsetWidth; root.classList.add('fx-quake');
    setTimeout(function () { root.classList.remove('fx-quake'); }, 560);
  }
  function fireworks() {
    if (!on) return;
    for (var k = 0; k < 6; k++) (function (k) {
      setTimeout(function () {
        burst(rnd(innerWidth * .15, innerWidth * .85), rnd(innerHeight * .12, innerHeight * .45), 46, C_FIRE,
          { vmin: 14, vmax: 46, g: 38, lmin: .8, lmax: 1.5, big: .3 });
      }, k * 260);
    })(k);
  }

  /* ---------- ครีปเปอร์ ---------- */
  var HEAD = ['.ggdggggd.', '.gggggdgg.', '.gkkggkkg.', '.gkkggkkg.', '.gggkkggg.', '.ggkkkkgg.', '.ggkkkkgg.', '.gdgkkgdg.'];
  var BODY = ['..gdggdg..', '..ggdggg..', '..gdggdg..', '..ggggdg..'];
  var FEET_A = ['.ggg..ggg.', '.gdg..gdg.', '.ggg..ggg.', '.ggg......'];
  var FEET_B = ['.ggg..ggg.', '.gdg..gdg.', '.ggg..ggg.', '......ggg.'];
  var PAL = { g: '#5ec43a', d: '#3f9a28', k: '#0b1a08' };
  // Warden ตามสกิน: หนวดฟ้าบนหัว ไหล่เหลืองอ่อน แกนกลางอกสีฟ้า รองเท้าเขียว (n=ลำตัว e=เขียวอมฟ้า a=ฟ้าเรือง y=เหลือง k=แกน g=เขียว w=เหลืองปลายเท้า)
  var W_HEAD = ['a..e..e..a', '.aeeddeea.', '..nnnnnn..', '.nnnnnnnn.', '.ndnnnndn.', '.nnnddnnn.', '.nnnnnnnn.', '.nnnnnnnn.'];
  var W_BODY = ['yynnkknnyy', '.ynnkknny.', '..nnkknn..', '..nnnnnn..'];
  var W_FEET_A = ['.nnn..nnn.', '.ndn..ndn.', '.ggg..ggg.', '.www......'];
  var W_FEET_B = ['.nnn..nnn.', '.ndn..ndn.', '.ggg..ggg.', '......www.'];
  var W_PAL = { n: '#171a2b', d: '#0d1020', e: '#17635f', a: '#5ee6d2', y: '#b3b36a', k: '#2b8fb6', g: '#1a6b50', w: '#d0d07a' };
  var SPR_W = 10, SPR_H = 16;
  var cr = null, nextCr = performance.now() + rnd(3000, 6000);

  function drawCreeper(c, t) {
    var wd = isDark(), pal = wd ? W_PAL : PAL;
    var step = (Math.floor(t * 5) % 2);
    var rows = (wd ? W_HEAD : HEAD).concat(wd ? W_BODY : BODY, wd ? (step ? W_FEET_A : W_FEET_B) : (step ? FEET_A : FEET_B));
    var f = c.scale, bob = (c.state === 'walk' && Math.floor(t * 5) % 2) ? -1 : 0;
    var px = Math.ceil(f), flashOn = c.state === 'fuse' && Math.floor(c.fuseT * 8) % 2 === 0;
    var ox = c.x + SPR_W / 2, oy = c.y + SPR_H + bob; // จุดยึด = กลางเท้า
    for (var r = 0; r < rows.length; r++) {
      for (var q = 0; q < SPR_W; q++) {
        var ch = rows[r].charAt(q);
        if (ch === '.') continue;
        fg.fillStyle = flashOn && ch !== 'k' && ch !== 'a' ? (wd ? '#c8fff9' : '#ffffff') : pal[ch];
        fg.fillRect(Math.round(ox + (q - SPR_W / 2) * f), Math.round(oy - (SPR_H - r) * f), px, px);
      }
    }
  }
  function spawnCreeper() {
    var dir = Math.random() < .5 ? 1 : -1;
    cr = { x: dir > 0 ? -SPR_W - 2 : W + 2, y: H - SPR_H - 1, dir: dir, state: 'walk', scale: 1, fuseT: 0,
      igniteAt: Math.random() < .4 ? rnd(.3, .7) : 2 }; // 40% จะชนวนเอง
  }
  function igniteCreeper() { if (cr && cr.state === 'walk') { cr.state = 'fuse'; cr.fuseT = 0; } }
  function updateCreeper(dt, t) {
    if (!cr) return;
    if (cr.state === 'walk') {
      cr.x += cr.dir * 15 * dt;
      var prog = cr.dir > 0 ? (cr.x + SPR_W / 2) / W : 1 - (cr.x + SPR_W / 2) / W;
      if (prog >= cr.igniteAt && prog < 1.1) cr.state = 'fuse';
      if (cr.x > W + 4 || cr.x < -SPR_W - 4) { cr = null; nextCr = performance.now() + rnd(15000, 30000); return; }
    }
    if (cr.state === 'fuse') {
      cr.fuseT += dt;
      cr.scale = 1 + Math.min(.55, cr.fuseT * .4) + (Math.floor(cr.fuseT * 8) % 2 ? .12 : 0);
      if (cr.fuseT >= 1.5) {
        var cx = (cr.x + SPR_W / 2) * PX, cy = (cr.y + SPR_H / 2) * PX;
        if (isDark()) burst(cx, cy, 130, C_SONIC, { vmin: 20, vmax: 80, g: 10, lmin: .8, lmax: 1.8, big: .4 });
        else burst(cx, cy, 110, C_BOOM, { vmin: 12, vmax: 70, g: 80, lmin: .7, lmax: 1.7, big: .4, lift: -20 });
        quake();
        cr = null; nextCr = performance.now() + rnd(15000, 30000);
      }
    }
  }
  doc.addEventListener('pointerdown', function (e) {
    if (!on || !cr || cr.state !== 'walk') return;
    var x = cr.x * PX, y = cr.y * PX, w = SPR_W * PX, h = SPR_H * PX, m = 14;
    if (e.clientX >= x - m && e.clientX <= x + w + m && e.clientY >= y - m && e.clientY <= y + h + m) igniteCreeper();
  }, { passive: true });

  /* Z z z ตอนเซิร์ฟปิด ทำด้วย HTML/CSS (.zzz ใน index.html) อยู่ในกล่องของหัวครีปเปอร์ จึงไม่ไปทับข้อความอื่น */

  /* ---------- ลูป ---------- */
  var last = performance.now(), acc = 0, raf = 0, T = 0, bgAcc = 0, fgDirty = false;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = (now - last) / 1000; last = now;
    if (dt > .1) dt = .1;
    T += dt;
    bgAcc += dt;                  // พื้นหลังวาด ~30 เฟรม/วิ (ฉากพิกเซลไม่ต้อง 60) ลดภาระ CPU/GPU ลงครึ่งหนึ่ง
    if (bgAcc >= 0.033) { drawBg(T, bgAcc); bgAcc = 0; }
    if (!cr && now >= nextCr && !doc.hidden) spawnCreeper();
    var busy = !!cr || parts.length > 0;
    if (busy || fgDirty) fg.clearRect(0, 0, W, H);   // ไม่มีครีปเปอร์/อนุภาค = ไม่ต้องล้างทุกเฟรม
    fgDirty = busy;
    if (cr) { updateCreeper(dt, T); if (cr) drawCreeper(cr, T); }
    if (parts.length) drawParts(dt);
  }
  function start() {
    if (raf || !on) return;
    last = performance.now();
    resize();
    raf = requestAnimationFrame(frame);
  }
  var rt;
  addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 150); });
  doc.addEventListener('visibilitychange', function () {
    if (doc.hidden) { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    else start();
  });

  /* ---------- พิมพ์ดีดข้อความสถานะ ---------- */
  function graphemes(s) {
    try { if (window.Intl && Intl.Segmenter) return Array.from(new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(s), function (x) { return x.segment; }); } catch (e) {}
    return Array.from(s);
  }
  var word = $('word'), lastWord = word ? word.textContent : '', typeT = 0;
  var wordObs = null;
  function typeText(full) {
    clearInterval(typeT);
    var seg = graphemes(full), i = 0;
    word.classList.add('fx-typing');
    word.textContent = ''; wordObs.takeRecords();
    typeT = setInterval(function () {
      i++;
      word.textContent = seg.slice(0, i).join(''); wordObs.takeRecords();
      if (i >= seg.length) { clearInterval(typeT); word.classList.remove('fx-typing'); }
    }, 55);
  }
  if (word && window.MutationObserver) {
    wordObs = new MutationObserver(function () {
      var t = word.textContent;
      if (t === lastWord) return;
      lastWord = t;
      if (on && t) typeText(t);
    });
    wordObs.observe(word, { childList: true, characterData: true, subtree: true });
  }

  /* ---------- ตัวเลขสุ่มก่อนนิ่ง ---------- */
  function scramble(el, full, obs) {
    clearInterval(el._sc);
    var n = 0, steps = 9;
    el._sc = setInterval(function () {
      n++;
      var out = '';
      for (var i = 0; i < full.length; i++) {
        var ch = full.charAt(i);
        // ตัวเลขนิ่งจากซ้ายไปขวา ส่วนที่ยังไม่ถึงคิวจะสุ่มต่อ
        out += (/[0-9]/.test(ch) && i >= Math.floor(n * full.length / steps)) ? String(Math.floor(Math.random() * 10)) : ch;
      }
      el.textContent = n >= steps ? full : out; obs.takeRecords();
      if (n >= steps) clearInterval(el._sc);
    }, 45);
  }
  ['stPlayers', 'stVer', 'stPing', 'stUp'].forEach(function (id) {
    var el = $(id); if (!el || !window.MutationObserver) return;
    var prev = el.textContent;
    var obs = new MutationObserver(function () {
      var t = el.textContent;
      if (t === prev) return;
      prev = t;
      if (on && t && t !== '–' && /[0-9]/.test(t)) scramble(el, t, obs);
    });
    obs.observe(el, { childList: true, characterData: true, subtree: true });
  });

  /* ---------- กะพริบตา (ไฟสถานะรูปครีปเปอร์) ---------- */
  var lampEl = $('lamp');
  (function blinkLoop() {
    setTimeout(function () {
      if (on && lampEl) { lampEl.classList.add('blink'); setTimeout(function () { lampEl.classList.remove('blink'); }, 170); }
      blinkLoop();
    }, rnd(2400, 5600));
  })();

  /* ---------- ดอกไม้ไฟตอนเซิร์ฟเปลี่ยนจากปิด → เปิด ---------- */
  var hero = $('hero');
  function heroState() { return hero.classList.contains('open') ? 'open' : hero.classList.contains('closed') ? 'closed' : ''; }
  if (hero && window.MutationObserver) {
    var hs = heroState();
    new MutationObserver(function () {
      var n = heroState();
      if (hs === 'closed' && n === 'open') fireworks();
      if (n) hs = n;
    }).observe(hero, { attributes: true, attributeFilter: ['class'] });
  }

  /* ---------- กราฟ/ผู้เล่น: เล่นอนิเมชั่นเข้าฉากทีละครั้งต่อการเปิดแท็บ ---------- */
  var PLAY = {
    bars: { id: 'bars', cls: 'fx-grow', step: 14, total: 900 },
    strip: { id: 'strip', cls: 'fx-sweep', step: 12, total: 700 },
    players: { id: 'players', cls: 'fx-pop', step: 70, total: 600 }
  };
  function tagChips() {
    var n = $('players'); if (!n) return;
    for (var i = 0; i < n.children.length; i++) n.children[i].style.setProperty('--i', i);
  }
  function tagStrip() {
    var n = $('strip'); if (!n) return;
    for (var i = 0; i < n.children.length; i++) n.children[i].style.setProperty('--d', i * 12);
  }
  function play(key) {
    var c = PLAY[key], n = $(c.id);
    if (!on || !n) return;
    var p = n.closest('.panel');
    if (!p || !p.classList.contains('active') || !n.children.length) return;
    c.played = true;
    for (var i = 0; i < n.children.length; i++) n.children[i].style.setProperty('--d', i * c.step);
    n.classList.remove(c.cls); void n.offsetWidth; n.classList.add(c.cls);
    clearTimeout(c.t);
    c.t = setTimeout(function () { n.classList.remove(c.cls); }, c.total + n.children.length * c.step);
  }
  if (window.MutationObserver) {
    Object.keys(PLAY).forEach(function (key) {
      var n = $(PLAY[key].id); if (!n) return;
      new MutationObserver(function () {
        if (key === 'players') tagChips();
        if (key === 'strip') tagStrip();
        if (!PLAY[key].played) play(key);
      }).observe(n, { childList: true });
    });
    [].forEach.call(doc.querySelectorAll('.panel'), function (p) {
      new MutationObserver(function () {
        if (!p.classList.contains('active')) return;
        Object.keys(PLAY).forEach(function (key) {
          var n = $(PLAY[key].id);
          if (n && p.contains(n)) { PLAY[key].played = false; setTimeout(function () { play(key); }, 40); }
        });
      }).observe(p, { attributes: true, attributeFilter: ['class'] });
    });
  }

  /* ---------- คลิกปุ่ม: ป๊อปพิกเซล ---------- */
  doc.addEventListener('click', function (e) {
    if (!on || !e.target.closest) return;
    var b = e.target.closest('button,.btn');
    if (!b) return;
    var c = rectCenter(b);
    if (b.id === 'copy') burst(c[0], c[1], 26, C_XP, { vmin: 8, vmax: 26, g: -30, lift: -22, lmin: .7, lmax: 1.5, big: .35 });
    else if (b.id === 'theme') burst(c[0], c[1], 44, isDark() ? ['#5ec43a', '#8bd96a', '#b6f08f', '#fff'] : ['#2fe3d4', '#86f5ea', '#0b7f8c', '#fff'], { vmin: 14, vmax: 50, g: 30, big: .3 });
    else burst(c[0], c[1], 9, [getComputedStyle(root).getPropertyValue('--accent').trim() || '#2fe3d4', '#ffffff'], { vmin: 8, vmax: 24, g: 40, lmin: .3, lmax: .6 });
  }, false);

  /* ---------- เริ่ม ---------- */
  tagChips(); tagStrip();
  start();
})();
