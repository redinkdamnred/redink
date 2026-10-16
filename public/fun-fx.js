/* =====================================================================
   FUN FX — ฟีเจอร์เสริมธีม Minecraft (ไม่แก้โค้ดหลักของ index.html)
   - ป้าย "Advancement Made!" เด้งมุมจอ
   - เสียง Minecraft สังเคราะห์ด้วย WebAudio (ปิดไว้เป็นค่าเริ่มต้น)
   - แถบ XP + orb ลอยเข้าแถบ + level up ตอนมีคนเข้าเกม
   - หัวสกินหันตามเมาส์ + สกินเต็มตัวตอนชี้ชิปผู้เล่น
   - เคอร์เซอร์พิกเซล (ดาบ/พิคแอ็กซ์) + รอยแตกเมื่อคลิกพื้นหลัง
   - Hotbar 9 ช่องบนมือถือ
   - Easter egg: Herobrine, หมู / เอนเดอร์แมนวาป / ค้างคาว เดินข้ามจอ
   ทุกอย่างอ่านสถานะจาก DOM ที่มีอยู่ ไม่ยิง API เพิ่ม
   ===================================================================== */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, body = doc.body;
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = false, fine = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  try { fine = matchMedia('(pointer: fine)').matches; } catch (e) {}

  function $(id) { return doc.getElementById(id); }
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; }
    return null;
  }
  function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function canAnim(e) { return !!(e && e.animate); }

  /* ---------- พิกเซลอาร์ต: แปลงตาราง ตัวอักษร → SVG (ข้อมูลคงที่ในโค้ดเท่านั้น) ---------- */
  function pixSVG(grid, pal, cls) {
    var h = grid.length, w = grid[0].length, s = '';
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var c = grid[y].charAt(x);
      if (c !== '.' && pal[c]) s += '<rect x="' + x + '" y="' + y + '" width="1.02" height="1.02" fill="' + pal[c] + '"/>';
    }
    return '<svg xmlns="' + NS + '" class="' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges" aria-hidden="true">' + s + '</svg>';
  }
  var ART = {
    grass: { g: ['GGGGGGGG', 'GGgGGgGG', 'DDDDDDDD', 'DdDDDdDD', 'DDDDdDDD', 'DdDDDDdD', 'DDDDDDDD', 'DDdDDDDD'],
      p: { G: '#5ec43a', g: '#3f9a28', D: '#8a5a3a', d: '#6b4326' } },
    steve: { g: ['HHHHHHHH', 'HHHHHHHH', 'HSSHHSSH', 'SSSSSSSS', 'SWBSSBWS', 'SSSNNSSS', 'SSNNNNSS', 'SSNSSNSS'],
      p: { H: '#3b2a1a', S: '#b58a63', W: '#ffffff', B: '#3a4fb0', N: '#7a4a33' } },
    hero: { g: ['HHHHHHHH', 'HHHHHHHH', 'HSSHHSSH', 'SSSSSSSS', 'SWWSSWWS', 'SSSNNSSS', 'SSNNNNSS', 'SSNSSNSS'],
      p: { H: '#3b2a1a', S: '#b58a63', W: '#ffffff', N: '#7a4a33' } },
    book: { g: ['.CCCCCC.', 'CWWWWWWC', 'CWkkkkWC', 'CWWWWWWC', 'CWkkkWWC', 'CWWWWWWC', 'CWkkkkWC', '.CCCCCC.'],
      p: { C: '#8a5a3a', W: '#f2e6c8', k: '#6b6b6b' } },
    map: { g: ['.MMMMMM.', 'MwwbbwwM', 'MwbbwwwM', 'MwwwwxwM', 'MwwwwwwM', 'MbbwwwwM', 'MwbbwwwM', '.MMMMMM.'],
      p: { M: '#b89a5c', w: '#e9d9a8', x: '#d33a2c', b: '#4a8bd4' } },
    crown: { g: ['Y..YY..Y', 'YY.YY.YY', 'YYYYYYYY', 'YRYYYYRY', 'YYYYYYYY', 'yyyyyyyy'],
      p: { Y: '#ffd24a', y: '#c8921c', R: '#e8443a' } }
  };
  function art(name, cls) { var a = ART[name]; return pixSVG(a.g, a.p, cls); }
  window.mcPixArt = art; // ให้ไฟล์อื่นใช้ (ranking-client.js วาดมงกุฎ)

  /* =====================================================================
     เสียง (WebAudio สังเคราะห์เอง ไม่ต้องโหลดไฟล์) — ปิดเป็นค่าเริ่มต้น
     ===================================================================== */
  var AC = window.AudioContext || window.webkitAudioContext, ac = null, master = null, nbuf = null;
  var sfxOn = store('mcSfx') === '1';
  function audio() {
    if (!AC) return null;
    if (!ac) {
      try { ac = new AC(); master = ac.createGain(); master.gain.value = 0.35; master.connect(ac.destination); }
      catch (e) { ac = null; return null; }
    }
    if (ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
    return ac;
  }
  function tone(f, d, type, v, t0, f2) {
    var a = audio(); if (!a) return;
    var t = a.currentTime + (t0 || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v || 0.2, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.03);
  }
  function noise(d, v, ftype, freq, t0, freq2) {
    var a = audio(); if (!a) return;
    if (!nbuf) {
      nbuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
      var ch = nbuf.getChannelData(0);
      for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    var t = a.currentTime + (t0 || 0), s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = nbuf; s.loop = true;
    f.type = ftype || 'bandpass';
    f.frequency.setValueAtTime(freq || 1500, t);
    if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + d);
    g.gain.setValueAtTime(v || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + d + 0.03);
  }
  var SFX = {
    click: function () { noise(0.05, 0.22, 'bandpass', 1900); tone(170, 0.05, 'square', 0.1, 0, 90); },
    hit: function () { noise(0.09, 0.3, 'bandpass', 520); tone(110, 0.08, 'square', 0.12, 0, 60); },
    xp: function () { tone(880 + Math.random() * 520, 0.1, 'triangle', 0.17); },
    levelup: function () {
      [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.16, 'triangle', 0.2, i * 0.07); });
      tone(1568, 0.5, 'triangle', 0.14, 0.38);
    },
    adv: function () { [392, 523, 659, 784].forEach(function (f, i) { tone(f, 0.22, 'triangle', 0.17, i * 0.09); }); tone(1047, 0.45, 'sine', 0.1, 0.36); },
    fuse: function () { noise(1.45, 0.32, 'highpass', 3200, 0, 6500); },
    boom: function () { noise(0.95, 0.75, 'lowpass', 1100, 0, 90); tone(72, 0.7, 'sine', 0.65, 0, 28); },
    tele: function () { tone(1300, 0.2, 'sine', 0.18, 0, 260); tone(260, 0.18, 'sine', 0.16, 0.06, 1500); },
    oink: function () { tone(250, 0.13, 'sawtooth', 0.1, 0, 150); tone(210, 0.12, 'sawtooth', 0.09, 0.1, 120); },
    bat: function () { tone(2600, 0.05, 'square', 0.05, 0, 3300); tone(2300, 0.05, 'square', 0.05, 0.08, 3000); },
    hero: function () { tone(58, 1.3, 'sine', 0.5, 0, 42); noise(0.9, 0.16, 'lowpass', 520, 0, 140); }
  };
  window.mcSfx = function (name) {
    if (!sfxOn || !SFX[name]) return;
    try { SFX[name](); } catch (e) {}
  };
  var sfxBtns = [];
  function syncSfxUI() {
    sfxBtns.forEach(function (b) {
      b.setAttribute('aria-pressed', sfxOn ? 'true' : 'false');
      b.classList.toggle('on', sfxOn);
      b.title = sfxOn ? 'ปิดเสียง' : 'เปิดเสียง';
      b.setAttribute('aria-label', b.title);
    });
  }
  function toggleSfx() {
    sfxOn = !sfxOn; store('mcSfx', sfxOn ? '1' : '0');
    if (sfxOn) { audio(); SFX.levelup(); }
    syncSfxUI();
  }
  var SPK_ON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M2 6h3l4-3v10l-4-3H2z"/><path fill="currentColor" d="M11 5h1v1h-1zM12 6h1v4h-1zM11 10h1v1h-1zM13 3h1v2h-1zM14 5h1v6h-1zM13 11h1v2h-1z"/></svg>';
  var SPK_OFF = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M2 6h3l4-3v10l-4-3H2z"/><path fill="currentColor" d="M11 6h1v1h-1zM12 7h1v1h-1zM13 8h1v1h-1zM14 9h1v1h-1zM14 6h1v1h-1zM13 7h1v1h-1zM12 8h1v1h-1zM11 9h1v1h-1z"/></svg>';
  function sfxIcon(b) { b.innerHTML = '<span class="i-on">' + SPK_ON + '</span><span class="i-off">' + SPK_OFF + '</span>'; }

  // เสียงคลิกปุ่ม
  doc.addEventListener('pointerdown', function (e) {
    if (!sfxOn) return;
    var t = e.target; if (!t || !t.closest) return;
    if (t.closest('button,a,.nv,[role="button"],.mcx-hb-slot')) window.mcSfx('click');
  }, { passive: true });
  // ปลดล็อกเสียงเมื่อผู้ใช้แตะครั้งแรก (ข้อบังคับของเบราว์เซอร์)
  doc.addEventListener('pointerdown', function () { if (sfxOn) audio(); }, { passive: true, once: true });

  /* =====================================================================
     ป้าย Advancement Made!
     ===================================================================== */
  var advWrap = el('div', 'mcx-adv-wrap'); advWrap.setAttribute('aria-live', 'polite');
  body.appendChild(advWrap);
  var advQ = [], advShown = 0;
  function pump() {
    if (advShown >= 2 || !advQ.length) return;
    var o = advQ.shift(); advShown++;
    var card = el('div', 'mcx-adv' + (o.challenge ? ' ch' : ''));
    var ic = el('div', 'mcx-adv-ic');
    if (o.img) {
      var im = el('img'); im.alt = ''; im.width = 32; im.height = 32; im.referrerPolicy = 'no-referrer'; im.src = o.img;
      im.addEventListener('error', function () { ic.innerHTML = art('steve'); });
      ic.appendChild(im);
    } else ic.innerHTML = art(o.icon || 'grass');
    var tx = el('div', 'mcx-adv-tx');
    tx.appendChild(el('b', 'mcx-adv-t', o.challenge ? 'Challenge Complete!' : 'Advancement Made!'));
    tx.appendChild(el('span', 'mcx-adv-n', o.name));
    card.appendChild(ic); card.appendChild(tx);
    advWrap.appendChild(card);
    window.mcSfx('adv');
    requestAnimationFrame(function () { requestAnimationFrame(function () { card.classList.add('in'); }); });
    setTimeout(function () { card.classList.remove('in'); }, 4800);
    setTimeout(function () {
      if (card.parentNode) card.parentNode.removeChild(card);
      advShown--; pump();
    }, 5500);
  }
  window.mcAdv = function (o) { if (o && o.name) { advQ.push(o); if (advQ.length > 6) advQ.shift(); pump(); } };

  /* ---- ตัวจับเหตุการณ์ (อ่านจาก DOM ของหน้าเดิม) ---- */
  // 1) เซิร์ฟเปิด: สถานะเปลี่ยนจาก closed → open
  var hero = $('hero'), lastState = null;
  function heroState() {
    if (!hero) return null;
    var c = hero.className;
    return c.indexOf('closed') > -1 ? 'closed' : c.indexOf('open') > -1 ? 'open' : null;
  }
  if (hero) {
    lastState = heroState();
    new MutationObserver(function () {
      var s = heroState();
      if (s === 'open' && lastState === 'closed') {
        window.mcAdv({ icon: 'grass', name: 'เซิร์ฟเปิดแล้ว! เข้ามาเล่นกัน' });
        window.mcSfx('levelup');
      }
      if (s) lastState = s;
    }).observe(hero, { attributes: true, attributeFilter: ['class'] });
  }

  // 2) คัดลอกที่อยู่เซิร์ฟ
  var copyBtn = $('copy'), lastCopy = 0;
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var n = Date.now(); if (n - lastCopy < 12000) return; lastCopy = n;
    setTimeout(function () { window.mcAdv({ icon: 'book', name: 'Copy & Paste — คัดลอกที่อยู่เซิร์ฟแล้ว' }); }, 250);
  });

  // 3) เปิดครบทุกแท็บ
  var navBtns = [].slice.call(doc.querySelectorAll('.nav .nv'));
  var visited = {};
  try { visited = JSON.parse(store('mcVisited') || '{}') || {}; } catch (e) { visited = {}; }
  function checkAllTabs() {
    if (store('mcAllTabs') === '1') return;
    var need = navBtns.filter(function (b) { return !b.hidden; });
    if (need.length < 4) return;
    for (var i = 0; i < need.length; i++) if (!visited[need[i].getAttribute('data-h')]) return;
    store('mcAllTabs', '1');
    window.mcAdv({ icon: 'map', name: 'นักสำรวจ — เปิดครบทุกแท็บแล้ว', challenge: true });
  }
  navBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      visited[b.getAttribute('data-h')] = 1;
      store('mcVisited', JSON.stringify(visited));
      setTimeout(checkAllTabs, 120);
    });
  });
  var curNav = doc.querySelector('.nav .nv[aria-current]');
  if (curNav) visited[curNav.getAttribute('data-h')] = 1;

  /* =====================================================================
     แถบ XP + จำนวนผู้เล่น (level = คนออนไลน์)
     ===================================================================== */
  var stats = doc.querySelector('#p-overview .stats'), xpEl = null, xpFill = null, xpLv = null, xpCap = null;
  if (stats) {
    xpEl = el('div', 'mcx-xp block'); xpEl.id = 'mcxXp'; xpEl.setAttribute('role', 'img');
    xpLv = el('div', 'mcx-xp-lv', '0');
    var track = el('div', 'mcx-xp-track'); xpFill = el('i', 'mcx-xp-fill'); track.appendChild(xpFill);
    xpCap = el('div', 'mcx-xp-cap small muted', 'ระดับ XP = จำนวนผู้เล่นที่ออนไลน์');
    xpEl.appendChild(xpLv); xpEl.appendChild(track); xpEl.appendChild(xpCap);
    stats.parentNode.insertBefore(xpEl, stats.nextSibling);
  }
  var playersBox = $('players');
  var prevCount = null, prevNames = [], lastJoinAdv = 0;

  function setXP(n, max, animate) {
    if (!xpEl) return;
    var pct = n == null ? 0 : Math.min(100, max ? n / max * 100 : 0);
    if (n > 0 && pct < 4) pct = 4;
    if (!animate) { xpFill.style.width = pct + '%'; }
    xpLv.textContent = n == null ? '0' : String(n);
    xpEl.setAttribute('aria-label', n == null ? 'เซิร์ฟปิดอยู่ ระดับ 0' : 'ผู้เล่นออนไลน์ ' + n + ' จาก ' + max + ' คน');
    return pct;
  }
  function levelUp() {
    if (!xpEl) return;
    xpLv.classList.remove('up'); void xpLv.offsetWidth; xpLv.classList.add('up');
    xpEl.classList.add('flash');
    setTimeout(function () { xpEl.classList.remove('flash'); xpLv.classList.remove('up'); }, 1000);
    window.mcSfx('levelup');
  }
  function flyOrbs(count, n, max) {
    var pct = setXP(n, max, true);
    if (!xpEl || reduce || !canAnim(xpEl) || xpEl.offsetParent === null) {
      xpFill.style.width = pct + '%'; levelUp(); return;
    }
    var box = xpEl.getBoundingClientRect(), tr = xpFill.parentNode.getBoundingClientRect();
    var ex = tr.left - box.left + tr.width * pct / 100, ey = tr.top - box.top + tr.height / 2 - 5;
    var total = Math.min(count, 6), done = 0;
    for (var i = 0; i < total; i++) (function (i) {
      var orb = el('i', 'mcx-xp-orb'); xpEl.appendChild(orb);
      var sx = rnd(10, Math.max(40, box.width - 20)), sy = -rnd(40, 110);
      var a = orb.animate([
        { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(.5)', opacity: 0 },
        { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(1)', opacity: 1, offset: 0.2 },
        { transform: 'translate(' + ex + 'px,' + ey + 'px) scale(.8)', opacity: 1 }
      ], { duration: 650 + i * 130, delay: i * 90, easing: 'cubic-bezier(.45,0,.9,.55)', fill: 'forwards' });
      a.onfinish = function () {
        if (orb.parentNode) orb.parentNode.removeChild(orb);
        window.mcSfx('xp'); done++;
        if (done === total) { xpFill.style.width = pct + '%'; levelUp(); }
      };
    })(i);
  }
  // อ่านจำนวนผู้เล่นจากคำตอบของ /api/status จริง ๆ (ไม่อ่านจาก DOM เพราะเอฟเฟกต์ตัวเลขสุ่มของเดิมเขียนค่าชั่วคราวลงไป)
  function onStatus(j) {
    if (!j || j.online !== true || !j.players) { prevCount = null; prevNames = []; setXP(null, 0, false); return; }
    var n = +j.players.online || 0, max = +j.players.max || 0, names = j.players.names || [];
    if (prevCount === null) setXP(n, max, false);
    else if (n > prevCount) {
      var fresh = names.filter(function (x) { return prevNames.indexOf(x) < 0; });
      flyOrbs(n - prevCount, n, max);
      var now = Date.now();
      if (now - lastJoinAdv > 4000) {
        lastJoinAdv = now;
        var nm = fresh.length ? fresh[0] + (fresh.length > 1 ? ' และอีก ' + (fresh.length - 1) + ' คน' : '') + ' เข้าเกมแล้ว'
          : 'มีผู้เล่นเข้าเกม (' + n + '/' + max + ')';
        window.mcAdv(fresh.length === 1 ? { img: 'https://mc-heads.net/avatar/' + encodeURIComponent(fresh[0]) + '/32', name: nm } : { icon: 'steve', name: nm });
      }
    } else setXP(n, max, false);
    prevCount = n; prevNames = names;
  }
  var _fetch = window.fetch;
  if (_fetch) window.fetch = function (input) {
    var p = _fetch.apply(this, arguments);
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.indexOf('/api/status') > -1) p.then(function (r) { return r.clone().json(); }).then(onStatus).catch(function () {});
    } catch (e) {}
    return p;
  };

  /* =====================================================================
     หัวสกินหันตามเมาส์ + สกินเต็มตัวตอนชี้ชิปผู้เล่น
     ===================================================================== */
  var mx = -1, my = -1, tiltRAF = 0;
  var skin = el('div', 'mcx-skin'); skin.hidden = true;
  var skinIn = el('div', 'mcx-skin-in'), skinImg = el('img'), skinName = el('span', 'mcx-skin-n');
  skinImg.alt = ''; skinImg.referrerPolicy = 'no-referrer';
  skinIn.appendChild(skinImg); skinIn.appendChild(skinName); skin.appendChild(skinIn); body.appendChild(skin);
  var skinFor = null;
  function showSkin(chip) {
    var name = chip.lastElementChild ? chip.lastElementChild.textContent : '';
    if (!name) return;
    skinFor = chip; skinName.textContent = name;
    skinImg.src = 'https://mc-heads.net/body/' + encodeURIComponent(name) + '/150';
    skin.hidden = false;
    var r = chip.getBoundingClientRect(), w = 124, h = 214;
    var left = clamp(r.left + r.width / 2 - w / 2, 8, Math.max(8, innerWidth - w - 8));
    var top = r.top - h - 8; if (top < 8) top = r.bottom + 8;
    skin.style.left = left + 'px'; skin.style.top = top + 'px';
    requestAnimationFrame(function () { skin.classList.add('show'); });
    scheduleTilt();
  }
  function hideSkin() { skin.classList.remove('show'); skin.hidden = true; skinFor = null; }
  skinImg.addEventListener('error', function () { skinImg.style.visibility = 'hidden'; });
  skinImg.addEventListener('load', function () { skinImg.style.visibility = 'visible'; });
  if (playersBox) {
    var ptype = 'mouse';
    playersBox.addEventListener('pointerdown', function (e) { ptype = e.pointerType; }, { passive: true });
    playersBox.addEventListener('pointerover', function (e) {
      if (e.pointerType === 'touch') return;
      var c = e.target.closest && e.target.closest('.chip.has-head'); if (c && c !== skinFor) showSkin(c);
    });
    playersBox.addEventListener('pointerout', function (e) {
      if (e.pointerType === 'touch') return;
      var c = e.target.closest && e.target.closest('.chip.has-head');
      if (c && !c.contains(e.relatedTarget)) hideSkin();
    });
    playersBox.addEventListener('click', function (e) {
      if (ptype !== 'touch') return;
      var c = e.target.closest && e.target.closest('.chip.has-head'); if (!c) return;
      if (skinFor === c) hideSkin(); else showSkin(c);
    });
  }
  doc.addEventListener('click', function (e) { if (skinFor && !(e.target.closest && e.target.closest('.chip'))) hideSkin(); });
  addEventListener('scroll', function () { if (skinFor) hideSkin(); }, { passive: true });

  function tilt() {
    tiltRAF = 0;
    if (mx < 0) return;
    var imgs = doc.querySelectorAll('.chip.has-head img,.mcx-pd-head img,.mcx-tilt');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i], r = im.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      var dx = clamp((mx - (r.left + r.width / 2)) / 240, -1, 1), dy = clamp((my - (r.top + r.height / 2)) / 240, -1, 1);
      im.style.transform = 'perspective(140px) rotateY(' + (dx * 34).toFixed(1) + 'deg) rotateX(' + (-dy * 28).toFixed(1) + 'deg)';
    }
    if (skinFor && !skin.hidden) {
      var sr = skin.getBoundingClientRect();
      var sx = clamp((mx - (sr.left + sr.width / 2)) / 220, -1, 1), sy = clamp((my - (sr.top + sr.height / 2)) / 300, -1, 1);
      skinIn.style.transform = 'perspective(520px) rotateY(' + (sx * 24).toFixed(1) + 'deg) rotateX(' + (-sy * 14).toFixed(1) + 'deg)';
    }
  }
  function scheduleTilt() { if (!tiltRAF && !reduce) tiltRAF = requestAnimationFrame(tilt); }
  if (!reduce) {
    doc.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      mx = e.clientX; my = e.clientY; scheduleTilt();
    }, { passive: true });
  }

  /* =====================================================================
     เคอร์เซอร์พิกเซล + รอยแตกเมื่อคลิกพื้นหลัง
     ===================================================================== */
  function cell(map, x, y, c) { if (x >= 0 && y >= 0 && x < 16 && y < 16) map[y * 16 + x] = c; }
  function cursorURI(map) {
    var s = '';
    for (var k in map) {
      var i = +k; s += '<rect x="' + (i % 16) + '" y="' + Math.floor(i / 16) + '" width="1" height="1" fill="' + map[k] + '"/>';
    }
    var svg = '<svg xmlns="' + NS + '" width="32" height="32" viewBox="0 0 16 16" shape-rendering="crispEdges">' + s + '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  function swordMap() {
    var m = {}, k;
    for (k = 0; k <= 9; k++) { cell(m, k + 1, k, '#6c7f86'); cell(m, k, k + 1, '#6c7f86'); }
    for (k = 0; k <= 9; k++) cell(m, k, k, '#eef6f8');
    for (k = -3; k <= 3; k++) cell(m, 11 + k, 11 - k, '#c8921c');
    cell(m, 11, 11, '#e8b43a');
    for (k = 12; k <= 14; k++) cell(m, k, k, '#6b4326');
    cell(m, 15, 15, '#c8921c');
    return m;
  }
  function pickMap() {
    var m = {}, k;
    for (k = 5; k <= 14; k++) { cell(m, k, k, '#8a5a2a'); cell(m, k + 1, k, '#5e3b18'); }
    for (k = -4; k <= 4; k++) { cell(m, 4 + k, 4 - k, '#d6e2e6'); cell(m, 5 + k, 4 - k, '#8fa3aa'); cell(m, 4 + k, 5 - k, '#8fa3aa'); }
    cell(m, 4, 4, '#ffffff');
    return m;
  }
  var curBtn = null, curOn = fine && store('mcCur') !== '0';
  function applyCursor() { root.classList.toggle('mcx-cur', curOn && fine); if (curBtn) { curBtn.setAttribute('aria-pressed', curOn ? 'true' : 'false'); curBtn.classList.toggle('on', curOn); } }
  if (fine) {
    var cs = el('style');
    var sw = cursorURI(swordMap()), pk = cursorURI(pickMap());
    cs.textContent = 'html.mcx-cur,html.mcx-cur body{cursor:url("' + sw + '") 1 1,auto}' +
      'html.mcx-cur a,html.mcx-cur button,html.mcx-cur .nv,html.mcx-cur .has-tip,html.mcx-cur .chip,html.mcx-cur .mcx-pd,html.mcx-cur .mcx-mob,html.mcx-cur label,html.mcx-cur select,html.mcx-cur [role="button"]{cursor:url("' + pk + '") 9 9,pointer}' +
      'html.mcx-cur input,html.mcx-cur textarea{cursor:text}';
    doc.head.appendChild(cs);
  }
  var CRACK_COL = ['#5ec43a', '#8a5a3a', '#7d7d7d', '#b5b5b5'];
  var lastCrack = 0;
  function crack(x, y) {
    var S = 52, box = el('div', 'mcx-crack');
    box.style.left = (x - S / 2) + 'px'; box.style.top = (y - S / 2) + 'px';
    var svg = doc.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + S + ' ' + S); svg.setAttribute('width', S); svg.setAttribute('height', S);
    svg.setAttribute('shape-rendering', 'crispEdges');
    var n = 5 + Math.floor(Math.random() * 3), c = S / 2, d = '';
    for (var i = 0; i < n; i++) {
      var a = i * Math.PI * 2 / n + rnd(-0.3, 0.3), len = rnd(12, 24), px = c, py = c;
      d += 'M' + c + ' ' + c;
      for (var q = 1; q <= 3; q++) {
        var aa = a + rnd(-0.5, 0.5), step = len / 3;
        px += Math.cos(aa) * step; py += Math.sin(aa) * step;
        d += 'L' + Math.round(px) + ' ' + Math.round(py);
      }
    }
    // วาดสองชั้น (เส้นเข้ม + เส้นสว่าง) บนเส้นทางเดียวกัน ให้เห็นทั้งธีมมืดและสว่าง
    [[3, 'rgba(0,0,0,.6)'], [1, 'rgba(255,255,255,.75)']].forEach(function (l) {
      var g = doc.createElementNS(NS, 'path');
      g.setAttribute('d', d); g.setAttribute('fill', 'none'); g.setAttribute('stroke', l[1]);
      g.setAttribute('stroke-width', l[0]); g.setAttribute('stroke-linecap', 'square');
      svg.appendChild(g);
    });
    box.appendChild(svg);
    body.appendChild(box);
    if (canAnim(box)) {
      for (var j = 0; j < 5; j++) {
        var p = el('i', 'mcx-deb'); p.style.background = pick(CRACK_COL); p.style.left = (S / 2) + 'px'; p.style.top = (S / 2) + 'px';
        box.appendChild(p);
        p.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: 'translate(' + rnd(-26, 26) + 'px,' + rnd(14, 44) + 'px)', opacity: 0 }],
          { duration: rnd(380, 640), easing: 'cubic-bezier(.2,.5,.6,1)', fill: 'forwards' });
      }
    }
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 750);
  }
  function isBackground(t) {
    if (!t || t.nodeType !== 1) return false;
    return t === root || t === body || t.classList.contains('app') || t.classList.contains('main') || t.id === 'main' || t.id === 'side';
  }
  if (!reduce) doc.addEventListener('pointerdown', function (e) {
    if (e.button > 0 || !isBackground(e.target)) return;
    var n = Date.now(); if (n - lastCrack < 90) return; lastCrack = n;
    crack(e.clientX, e.clientY); window.mcSfx('hit');
  }, { passive: true });

  /* =====================================================================
     ปุ่มลอย (คอมพิวเตอร์): เสียง + เคอร์เซอร์
     ===================================================================== */
  var dock = el('div', 'mcx-dock'); dock.setAttribute('role', 'group'); dock.setAttribute('aria-label', 'ตั้งค่าเอฟเฟกต์');
  var dSfx = el('button', 'mcx-dk'); dSfx.type = 'button'; sfxIcon(dSfx); dSfx.addEventListener('click', toggleSfx);
  sfxBtns.push(dSfx); dock.appendChild(dSfx);
  if (fine) {
    curBtn = el('button', 'mcx-dk'); curBtn.type = 'button'; curBtn.title = 'เคอร์เซอร์พิกเซล'; curBtn.setAttribute('aria-label', 'เคอร์เซอร์พิกเซล');
    curBtn.innerHTML = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M1 1h2v2H1zM3 3h2v2H3zM5 5h2v2H5zM7 7h2v2H7zM9 9h2v2H9zM7 9h2v2H7zM11 11h2v2h-2zM13 13h2v2h-2zM9 7h2v2H9z"/></svg>';
    curBtn.addEventListener('click', function () { curOn = !curOn; store('mcCur', curOn ? '1' : '0'); applyCursor(); });
    dock.appendChild(curBtn);
  }
  body.appendChild(dock); applyCursor(); syncSfxUI();

  /* =====================================================================
     Hotbar (มือถือ): 9 ช่องแบบในเกม
     ===================================================================== */
  var hb = el('nav', 'mcx-hb'); hb.setAttribute('aria-label', 'เมนูด่วน');
  var hbName = el('div', 'mcx-hb-name'); hbName.setAttribute('aria-hidden', 'true');
  body.appendChild(hb); body.appendChild(hbName);
  root.classList.add('mcx-hb-on');
  var hbT = 0;
  function showHbName(t) {
    hbName.textContent = t; hbName.classList.add('show');
    clearTimeout(hbT); hbT = setTimeout(function () { hbName.classList.remove('show'); }, 1400);
  }
  var hbRAF = 0;
  function buildHotbar() {
    hbRAF = 0; hb.textContent = '';
    sfxBtns = sfxBtns.filter(function (b) { return !b.classList.contains('mcx-hb-slot'); });
    var vis = navBtns.filter(function (b) { return !b.hidden; }).slice(0, 7);
    vis.forEach(function (b) {
      var lab = b.querySelector('span') ? b.querySelector('span').textContent : '';
      var s = el('button', 'mcx-hb-slot' + (b.getAttribute('aria-current') === 'page' ? ' sel' : ''));
      s.type = 'button'; s.setAttribute('aria-label', lab);
      var ico = b.querySelector('svg'); if (ico) s.appendChild(ico.cloneNode(true));
      var bd = b.querySelector('.badge'); if (bd && bd.textContent) s.appendChild(el('i', 'mcx-hb-n', bd.textContent));
      s.addEventListener('click', function () { b.click(); showHbName(lab); });
      hb.appendChild(s);
    });
    for (var i = vis.length; i < 7; i++) { var e = el('span', 'mcx-hb-slot empty'); e.setAttribute('aria-hidden', 'true'); hb.appendChild(e); }
    var sb = el('button', 'mcx-hb-slot'); sb.type = 'button'; sfxIcon(sb);
    sb.addEventListener('click', function () { toggleSfx(); showHbName(sfxOn ? 'เปิดเสียง' : 'ปิดเสียง'); });
    sfxBtns.push(sb); hb.appendChild(sb);
    var tb = el('button', 'mcx-hb-slot'); tb.type = 'button'; tb.setAttribute('aria-label', 'สลับธีม');
    tb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>';
    tb.addEventListener('click', function () { var t = $('theme'); if (t) t.click(); showHbName('สลับธีม'); });
    hb.appendChild(tb);
    syncSfxUI();
  }
  function scheduleHotbar() { if (!hbRAF) hbRAF = requestAnimationFrame(buildHotbar); }
  var navEl = doc.querySelector('.nav');
  if (navEl) new MutationObserver(scheduleHotbar).observe(navEl, { subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-current'], childList: true, characterData: true });
  buildHotbar();

  /* =====================================================================
     Easter egg: Herobrine + มอนเดินข้ามจอ
     ===================================================================== */
  var herobusy = false;
  function herobrine() {
    if (herobusy) return; herobusy = true;
    var dim = el('div', 'mcx-dim'), face = el('div', 'mcx-hero'); face.innerHTML = art('hero');
    var left = Math.random() < 0.5; face.style[left ? 'left' : 'right'] = '-26px'; face.style.top = rnd(12, 62) + 'vh';
    if (!left) face.style.transform = 'scaleX(-1)';
    body.appendChild(dim); body.appendChild(face);
    window.mcSfx('hero');
    requestAnimationFrame(function () { dim.classList.add('on'); face.classList.add('on'); });
    setTimeout(function () { dim.classList.remove('on'); face.classList.remove('on'); }, 420);
    setTimeout(function () {
      if (dim.parentNode) dim.parentNode.removeChild(dim);
      if (face.parentNode) face.parentNode.removeChild(face);
      herobusy = false;
      window.mcAdv({ icon: 'hero', name: 'Herobrine กำลังมองคุณอยู่…', challenge: true });
    }, 900);
  }
  window.mcHerobrine = herobrine;

  var KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'], kp = 0, typed = '';
  doc.addEventListener('keydown', function (e) {
    var tg = e.target, tag = tg && tg.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (tg && tg.isContentEditable)) return;
    var k = (e.key || '').toLowerCase();
    kp = k === KONAMI[kp] ? kp + 1 : (k === KONAMI[0] ? 1 : 0);
    if (kp === KONAMI.length) { kp = 0; herobrine(); }
    if (k.length === 1) { typed = (typed + k).slice(-9); if (typed === 'herobrine') { typed = ''; herobrine(); } }
  });
  // กดโลโก้: ทุกครั้งเรียกมอน, กด 7 ครั้งใน 5 วินาที = Herobrine
  var logo = doc.querySelector('.brand .logo'), logoClicks = [];
  if (logo) {
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', function () {
      var n = Date.now(); logoClicks = logoClicks.filter(function (t) { return n - t < 5000; }); logoClicks.push(n);
      if (logoClicks.length >= 7) { logoClicks = []; herobrine(); return; }
      spawnMob();
    });
  }

  /* ---- สไปรต์มอน ---- */
  var SPR = {
    pig: { g: ['..PPPPPPPP..', '.PPPPPPPPPP.', '.PPPPPPPPEPS', '.PPPPPPPPPSS', '.PPPPPPPPPPS', '.PPPPPPPPPP.', '..DD....DD..', '..DD....DD..'],
      p: { P: '#f0a8a8', D: '#d77f87', S: '#e8838b', E: '#222222' }, px: 4 },
    ender: { g: ['KKKKKK', 'KKKKKK', 'VVKKVV', 'KKKKKK', '.KKKK.', 'K.KK.K', 'K.KK.K', 'K.KK.K', 'K.KK.K', 'K.KK.K', 'K.KK.K', '.KKKK.', '.K..K.', '.K..K.', '.K..K.', '.K..K.', '.K..K.', '.K..K.'],
      p: { K: '#161616', V: '#e040ff' }, px: 4 },
    batA: { g: ['BB.......BB', 'BBB.B.B.BBB', '.BBBBBBBBB.', '..BBBBBBB..', '...BEBEB...', '....B.B....'], p: { B: '#3a2c45', E: '#ff4a4a' }, px: 4 },
    batB: { g: ['...........', '.....B.B...', 'BB.BBBBB.BB', 'BBBBBBBBBBB', '.BBBEBEBBB.', '..B..B.B...'], p: { B: '#3a2c45', E: '#ff4a4a' }, px: 4 }
  };
  var mobBusy = false, mobTimer = 0;
  function finishMob(m) {
    if (m.parentNode) m.parentNode.removeChild(m);
    mobBusy = false; scheduleMob(rnd(40000, 90000));
  }
  function portal(m) {
    var r = m.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (var i = 0; i < 12; i++) {
      var p = el('i', 'mcx-pt'); p.style.left = cx + 'px'; p.style.top = cy + 'px'; p.style.background = pick(['#b44cff', '#e040ff', '#7a1fd6', '#f0b4ff']);
      body.appendChild(p);
      if (canAnim(p)) {
        var a = p.animate([{ transform: 'translate(' + rnd(-12, 12) + 'px,' + rnd(-24, 24) + 'px)', opacity: 1 }, { transform: 'translate(' + rnd(-30, 30) + 'px,' + rnd(-60, 10) + 'px)', opacity: 0 }], { duration: rnd(420, 700), easing: 'ease-out', fill: 'forwards' });
        a.onfinish = (function (q) { return function () { if (q.parentNode) q.parentNode.removeChild(q); }; })(p);
      } else if (p.parentNode) p.parentNode.removeChild(p);
    }
  }
  function makeMob(kind) {
    var s = SPR[kind], m = el('div', 'mcx-mob ' + kind), inner = el('div', 'mcx-mob-in');
    inner.innerHTML = pixSVG(s.g, s.p, '');
    var svg = inner.firstChild; svg.style.width = (s.g[0].length * s.px) + 'px'; svg.style.height = (s.g.length * s.px) + 'px';
    m.appendChild(inner); body.appendChild(m); return { m: m, inner: inner };
  }
  function walkMob(kind) {
    var o = makeMob(kind), m = o.m, dir = Math.random() < 0.5 ? 1 : -1, vw = innerWidth;
    if (dir < 0) o.inner.style.transform = 'scaleX(-1)';
    var x = dir > 0 ? -70 : vw + 70, end = dir > 0 ? vw + 70 : -70, anim = null, dead = false;
    m.style.left = x + 'px';
    function segment() {
      if (dead) return;
      var remain = Math.abs(end - x), len = kind === 'ender' ? Math.min(remain, rnd(140, 380)) : remain, speed = kind === 'pig' ? 55 : 62;
      var dx = dir * len;
      if (!canAnim(m)) { finishMob(m); return; }
      anim = m.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + dx + 'px)' }], { duration: len / speed * 1000, easing: 'linear', fill: 'forwards' });
      anim.onfinish = function () {
        if (dead) return;
        x += dx; anim.cancel(); m.style.left = x + 'px';
        if (Math.abs(end - x) < 3) { dead = true; finishMob(m); return; }
        // เอนเดอร์แมนวาป
        portal(m); window.mcSfx('tele');
        x += dir * Math.min(Math.abs(end - x), rnd(70, 190)); m.style.left = x + 'px';
        m.classList.add('blink'); setTimeout(function () { m.classList.remove('blink'); }, 260);
        portal(m); segment();
      };
    }
    m.addEventListener('click', function () {
      if (kind === 'pig') {
        window.mcSfx('oink');
        if (canAnim(o.inner)) o.inner.animate([{ translate: '0 0' }, { translate: '0 -22px' }, { translate: '0 0' }], { duration: 320, easing: 'ease-out' });
      } else if (anim && anim.playState === 'running') anim.finish();
    });
    if (kind === 'pig') window.mcSfx('oink');
    segment();
  }
  function flyBat() {
    var a = makeMob('batA'), m = a.m, dir = Math.random() < 0.5 ? 1 : -1, vw = innerWidth, vh = innerHeight;
    m.classList.remove('batA'); m.classList.add('bat'); m.style.top = '0px'; m.style.bottom = 'auto'; m.style.left = '0px';
    var b = el('div', 'mcx-mob-in b'); b.innerHTML = pixSVG(SPR.batB.g, SPR.batB.p, '');
    var sv = b.firstChild; sv.style.width = (SPR.batB.g[0].length * 4) + 'px'; sv.style.height = (SPR.batB.g.length * 4) + 'px';
    m.appendChild(b);
    var base = rnd(vh * 0.12, vh * 0.5), amp = rnd(24, 60), x0 = dir > 0 ? -60 : vw + 60, x1 = dir > 0 ? vw + 60 : -60, kf = [], N = 36, ph = rnd(0, 6);
    for (var i = 0; i <= N; i++) {
      var t = i / N;
      kf.push({ transform: 'translate(' + (x0 + (x1 - x0) * t).toFixed(1) + 'px,' + (base + Math.sin(t * Math.PI * 5 + ph) * amp).toFixed(1) + 'px)' });
    }
    if (!canAnim(m)) { finishMob(m); return; }
    var an = m.animate(kf, { duration: rnd(7000, 10000), easing: 'linear', fill: 'forwards' });
    an.onfinish = function () { clearInterval(fl); finishMob(m); };
    var fl = setInterval(function () { m.classList.toggle('flap'); }, 140);
    m.addEventListener('click', function () { window.mcSfx('bat'); });
    window.mcSfx('bat');
  }
  function spawnMob(kind) {
    if (mobBusy || doc.hidden || reduce) return;
    mobBusy = true;
    kind = kind || pick(['pig', 'ender', 'bat']);
    try { if (kind === 'bat') flyBat(); else walkMob(kind); } catch (e) { mobBusy = false; }
  }
  window.mcSpawnMob = spawnMob;
  function scheduleMob(ms) { clearTimeout(mobTimer); if (!reduce) mobTimer = setTimeout(function () { spawnMob(); if (!mobBusy) scheduleMob(rnd(20000, 40000)); }, ms); }
  scheduleMob(rnd(25000, 45000));
})();
