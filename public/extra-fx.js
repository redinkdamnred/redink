/* =====================================================================
   EXTRA FX — อนิเมชั่นเพิ่มเติม (ไม่แตะโค้ดเดิมของหน้า)
   - การ์ดเอียง 3 มิติ + สปอตไลต์ตามเมาส์ (เฉพาะอุปกรณ์ที่มีเมาส์)
   - ร่องรอยพิกเซลตามเมาส์ + พื้นหลังขยับตามเมาส์
   - ริปเปิลตอนกดปุ่ม, ตัวเลขเด้งตอนค่าเปลี่ยน
   - XP Orb ลอยจาก Creeper (เซิร์ฟเปิด) / วิญญาณ Sculk ลอยจาก Warden (เซิร์ฟปิด)
   - กดโลโก้ = หมุน + Orb กระจาย, กด 5 ครั้งติด = ฝนบล็อก
   ===================================================================== */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var mq = window.matchMedia;
  if (mq && mq('(prefers-reduced-motion:reduce)').matches) return;
  var fine = !!(mq && mq('(hover:hover) and (pointer:fine)').matches);

  function $(id) { return doc.getElementById(id); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function accent() { return getComputedStyle(root).getPropertyValue('--accent').trim() || '#2fe3d4'; }
  function later(el, ms) { setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, ms); }

  /* ---------- เมาส์: เอียงการ์ด / สปอตไลต์ / ร่องรอย / พื้นหลัง ---------- */
  if (fine) {
    var px = 0, py = 0, raf = 0, tgt = null, lastTrail = { x: -99, y: -99 };
    doc.addEventListener('pointermove', function (e) {
      px = e.clientX; py = e.clientY; tgt = e.target;
      if (!raf) raf = requestAnimationFrame(onMove);
    }, { passive: true });
    doc.addEventListener('pointerleave', function () { resetTilt(); });

    var tilted = null;
    function resetTilt() {
      if (tilted) { tilted.style.rotate = ''; tilted = null; }
    }
    function onMove() {
      raf = 0;
      var card = tgt && tgt.closest ? tgt.closest('.stat,.block') : null;
      if (card) {
        var r = card.getBoundingClientRect();
        var fx = (px - r.left) / r.width, fy = (py - r.top) / r.height;
        card.style.setProperty('--mx', (fx * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (fy * 100).toFixed(1) + '%');
        if (card.classList.contains('stat')) {
          if (tilted && tilted !== card) resetTilt();
          var rx = (0.5 - fy) * 10, ry = (fx - 0.5) * 10;
          card.style.rotate = rx.toFixed(2) + ' ' + ry.toFixed(2) + ' 0 ' + Math.hypot(rx, ry).toFixed(2) + 'deg';
          tilted = card;
        } else resetTilt();
      } else resetTilt();

      // พื้นหลังขยับตามเมาส์
      var bg = $('fxBg');
      if (bg) bg.style.translate = (-(px / innerWidth - 0.5) * 16).toFixed(1) + 'px ' + (-(py / innerHeight - 0.5) * 10).toFixed(1) + 'px';

      // ร่องรอยพิกเซล
      if (Math.hypot(px - lastTrail.x, py - lastTrail.y) > 16) {
        lastTrail.x = px; lastTrail.y = py;
        var s = Math.random() < 0.3 ? 8 : 4;
        var t = doc.createElement('div');
        t.className = 'xtrail';
        t.setAttribute('aria-hidden', 'true');
        t.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (px - s / 2) + 'px;top:' + (py - s / 2) + 'px;background:' + (Math.random() < 0.7 ? accent() : '#fff');
        doc.body.appendChild(t);
        later(t, 650);
      }
    }
  }

  /* ---------- ริปเปิลตอนกดปุ่ม ---------- */
  doc.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('button.primary,.btn,button[type="submit"],.hero .actions button,.tabs button');
    if (!b) return;
    var r = b.getBoundingClientRect();
    var s = doc.createElement('span');
    s.className = 'xr';
    s.style.setProperty('--rx', (e.clientX - r.left) + 'px');
    s.style.setProperty('--ry', (e.clientY - r.top) + 'px');
    b.appendChild(s);
    later(s, 600);
  }, { passive: true });

  /* ---------- ตัวเลขเด้งเมื่อค่าเปลี่ยน ---------- */
  if (window.MutationObserver) {
    ['stPlayers', 'stVer', 'stPing', 'stUp', 'navPl'].forEach(function (id) {
      var el = $(id); if (!el) return;
      var last = 0;
      new MutationObserver(function () {
        var now = Date.now();
        if (now - last < 1500) return; // กันเด้งรัวระหว่างเอฟเฟกต์ตัวเลขสุ่มของเดิม
        last = now;
        el.classList.remove('xtick'); void el.offsetWidth; el.classList.add('xtick');
        setTimeout(function () { el.classList.remove('xtick'); }, 520);
      }).observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  /* ---------- XP Orb / วิญญาณ Sculk ลอยจากหน้าสถานะ ---------- */
  var hero = $('hero'), box = doc.querySelector('.lamp-wrap'), orbs = 0;
  function spawnOrb() {
    if (doc.hidden || !hero || !box || box.offsetParent === null) return;
    var closed = hero.classList.contains('closed'), open = hero.classList.contains('open');
    if (!closed && !open) return;
    if (orbs >= 6) return;
    var o = doc.createElement('i');
    o.className = 'xorb' + (closed ? ' sculk' : '');
    o.setAttribute('aria-hidden', 'true');
    o.style.setProperty('--x', rnd(10, 85).toFixed(0) + '%');
    o.style.setProperty('--dx', rnd(-34, 34).toFixed(0) + 'px');
    box.appendChild(o);
    orbs++;
    o.addEventListener('animationend', function () { orbs--; if (o.parentNode) o.parentNode.removeChild(o); });
  }
  (function loop() { spawnOrb(); setTimeout(loop, rnd(700, 1500)); })();

  /* ---------- กดโลโก้: หมุน + Orb กระจาย / 5 ครั้งติด = ฝนบล็อก ---------- */
  var logo = doc.querySelector('.logo'), clicks = 0, clickT = 0;
  function rain() {
    var cols = ['#e5483a', '#ffffff', '#2fe3d4', '#b5ff2e', '#ffd23f'];
    for (var i = 0; i < 36; i++) {
      var s = Math.round(rnd(8, 14)), d = doc.createElement('i');
      d.className = 'xrain';
      d.setAttribute('aria-hidden', 'true');
      d.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + rnd(0, 100).toFixed(1) + 'vw;background:' + pick(cols);
      d.style.setProperty('--t', rnd(1.2, 2.4).toFixed(2) + 's');
      d.style.setProperty('--dl', rnd(0, 0.8).toFixed(2) + 's');
      d.style.setProperty('--sw', rnd(-60, 60).toFixed(0) + 'px');
      d.style.setProperty('--r', rnd(-540, 540).toFixed(0) + 'deg');
      doc.body.appendChild(d);
      later(d, 3500);
    }
  }
  if (logo) logo.addEventListener('click', function () {
    logo.classList.remove('xspin'); void logo.getBoundingClientRect(); logo.classList.add('xspin');
    setTimeout(function () { logo.classList.remove('xspin'); }, 650);
    var r = logo.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2 + rnd(-0.2, 0.2), dist = rnd(40, 90), o = doc.createElement('i');
      o.className = 'xorb fly';
      o.setAttribute('aria-hidden', 'true');
      o.style.setProperty('--fx', cx + 'px'); o.style.setProperty('--fy', cy + 'px');
      o.style.setProperty('--dx', (Math.cos(a) * dist).toFixed(0) + 'px');
      o.style.setProperty('--dy', (Math.sin(a) * dist).toFixed(0) + 'px');
      doc.body.appendChild(o);
      later(o, 1000);
    }
    clearTimeout(clickT);
    clicks++;
    if (clicks >= 5) { clicks = 0; rain(); }
    else clickT = setTimeout(function () { clicks = 0; }, 2500);
  });
})();
