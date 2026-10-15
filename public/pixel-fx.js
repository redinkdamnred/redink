/* PIXEL FX 2 — ตัวช่วยอนิเมชั่นเพิ่มเติม (ทำงานแยกจาก pixel-fx.js) */
(function () {
  'use strict';
  var doc = document, $ = function (id) { return doc.getElementById(id); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  /* ---------- XP bar: เต็มตอนโหลด แล้วเป็นตัวบอกการเลื่อนหน้า ---------- */
  var xp = doc.createElement('div'); xp.id = 'xpBar'; xp.setAttribute('aria-hidden', 'true'); doc.body.appendChild(xp);
  var xpT, full = false;
  function xpShow(p) {
    xp.style.width = Math.max(0, Math.min(100, p)) + '%';
    xp.classList.add('show');
    clearTimeout(xpT); xpT = setTimeout(function () { xp.classList.remove('show'); }, 1200);
  }
  function spark(x, y) {
    for (var i = 0; i < 10; i++) {
      var s = doc.createElement('i'); s.className = 'fx2-trail';
      s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.background = i % 2 ? '#f5c842' : '#7dff6a';
      s.style.setProperty('--tx', ((Math.random() - .5) * 90) + 'px'); s.style.setProperty('--ty', (Math.random() * 50) + 'px');
      doc.body.appendChild(s); setTimeout(function (e) { e.remove(); }.bind(null, s), 600);
    }
  }
  function onScroll(e) {
    var t = e.target === doc ? doc.documentElement : e.target;
    if (!t || t.scrollHeight === undefined) return;
    var max = t.scrollHeight - t.clientHeight;
    if (max < 40) return;
    var p = t.scrollTop / max * 100;
    xpShow(p);
    if (p > 98 && !full) { full = true; spark(innerWidth - 10, 6); } else if (p < 90) full = false;
  }
  doc.addEventListener('scroll', onScroll, { passive: true, capture: true });
  requestAnimationFrame(function () { xpShow(0); setTimeout(function () { xpShow(100); }, 30); });

  /* ---------- รอยเมาส์ (เฉพาะเมาส์จริง) ---------- */
  var lastT = 0, alive = 0;
  doc.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var n = performance.now(); if (n - lastT < 45 || alive > 24) return; lastT = n;
    var s = doc.createElement('i'); s.className = 'fx2-trail'; alive++;
    s.style.left = (e.clientX + 6) + 'px'; s.style.top = (e.clientY + 6) + 'px';
    s.style.setProperty('--tx', ((Math.random() - .5) * 16) + 'px');
    doc.body.appendChild(s);
    setTimeout(function () { s.remove(); alive--; }, 580);
  }, { passive: true });

  /* ---------- ดูค่าที่เปลี่ยน (รอให้ตัวเลขสุ่มของ pixel-fx.js นิ่งก่อน) ---------- */
  function num(s) { var m = String(s || '').match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : NaN; }
  function floatText(el, txt, cls) {
    var r = el.getBoundingClientRect();
    var f = doc.createElement('div'); f.className = 'fx2-float ' + cls; f.textContent = txt;
    f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top + r.height / 2) + 'px';
    doc.body.appendChild(f); setTimeout(function () { f.remove(); }, 1150);
  }
  function watch(id, fn) {
    var el = $(id); if (!el || !window.MutationObserver) return;
    var last = num(el.textContent), t;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(function () { var v = num(el.textContent); fn(el, v, last); if (!isNaN(v)) last = v; }, 1000);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }
  watch('stPlayers', function (el, v, p) {
    if (isNaN(v) || isNaN(p) || v === p) return;
    var d = v - p; floatText(el, (d > 0 ? '+' : '') + d, d > 0 ? 'up' : 'down');
    var st = el.closest('.stat'); if (st) { st.classList.remove('fx2-bump'); void st.offsetWidth; st.classList.add('fx2-bump'); }
  });
  watch('stPing', function (el, v) {
    if (isNaN(v)) { el.removeAttribute('data-q'); return; }
    el.setAttribute('data-q', v < 80 ? 'good' : v < 200 ? 'mid' : 'bad');
  });
  var navPl = $('navPl');
  if (navPl && window.MutationObserver) new MutationObserver(function () {
    navPl.classList.remove('fx2-bump'); void navPl.offsetWidth; navPl.classList.add('fx2-bump');
  }).observe(navPl, { childList: true, characterData: true, subtree: true });

  /* ---------- กดคัดลอกที่อยู่: กรอบกะพริบ + +1 ลอย ---------- */
  doc.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#copy'); if (!b) return;
    var code = doc.querySelector('.addr code');
    if (code) { code.classList.remove('copied'); void code.offsetWidth; code.classList.add('copied'); }
    floatText(b, 'COPY!', 'up');
  });
})();
