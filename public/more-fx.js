/* =====================================================================
   MORE FX — อนิเมชั่นชุดเพิ่มเติม (ไม่แตะโค้ดเดิมของหน้า)
   - ดวงอาทิตย์ / พระจันทร์พิกเซล เคลื่อนตามเวลาจริง (เวลาไทย) สลับตามธีม
   - แถบไฮไลต์เมนูซ้ายเลื่อนตามแท็บ
   - ออโรร่าในการ์ดสถานะ
   - อันดับ: แถบสัดส่วน + ตัวเลขนับขึ้น
   - ผู้เล่นที่เพิ่งเข้าเกม: วงแสง + เครื่องหมาย +
   ใช้ textContent / DOM API เท่านั้น ไม่ใช้ innerHTML
   ===================================================================== */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var mq = window.matchMedia;
  if (mq && mq('(prefers-reduced-motion:reduce)').matches) return;

  var NS = 'http://www.w3.org/2000/svg';
  function $(id) { return doc.getElementById(id); }
  function svgEl(tag, attrs) {
    var e = doc.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  /* ---------- ดวงอาทิตย์ / พระจันทร์ ---------- */
  var sky = doc.createElement('div');
  sky.id = 'mxSky';
  sky.setAttribute('aria-hidden', 'true');
  var sun = doc.createElement('div'); sun.className = 'mx-orb mx-sun';
  var moon = doc.createElement('div'); moon.className = 'mx-orb mx-moon';

  (function buildSun() {
    var s = svgEl('svg', { viewBox: '0 0 15 15' });
    function px(x, y, w, h, fill) { s.appendChild(svgEl('rect', { x: x, y: y, width: w, height: h, fill: fill })); }
    var cx = 7, cy = 7, x, y;
    for (y = 0; y < 15; y++) for (x = 0; x < 15; x++) {
      var d = Math.hypot(x - cx, y - cy);
      if (d <= 3.6) px(x, y, 1.02, 1.02, d <= 2.2 ? '#fff3a0' : '#ffd24a');
    }
    // แสงรัศมี 8 ทิศ
    px(7, 0, 1, 2, '#ffd24a'); px(7, 13, 1, 2, '#ffd24a');
    px(0, 7, 2, 1, '#ffd24a'); px(13, 7, 2, 1, '#ffd24a');
    px(2, 2, 1.5, 1.5, '#ffb52e'); px(11.5, 2, 1.5, 1.5, '#ffb52e');
    px(2, 11.5, 1.5, 1.5, '#ffb52e'); px(11.5, 11.5, 1.5, 1.5, '#ffb52e');
    sun.appendChild(s);
  })();
  (function buildMoon() {
    var s = svgEl('svg', { viewBox: '0 0 14 14' });
    for (var y = 0; y < 14; y++) for (var x = 0; x < 14; x++) {
      var inMoon = Math.hypot(x - 6.5, y - 6.5) <= 6;
      var cut = Math.hypot(x - 9.5, y - 5) <= 5;
      if (inMoon && !cut) {
        var crater = (x === 3 && y === 7) || (x === 4 && y === 10) || (x === 2 && y === 5);
        s.appendChild(svgEl('rect', { x: x, y: y, width: 1.02, height: 1.02, fill: crater ? '#9fd8d2' : '#d6fffb' }));
      }
    }
    moon.appendChild(s);
  })();
  sky.appendChild(sun); sky.appendChild(moon);

  /* บล็อกพิกเซลลอยขึ้น: สีสว่าง (Creeper) / สีฟ้าเรือง (Warden) สลับด้วย CSS ตามธีม */
  (function cubes() {
    var LIGHT = ['#5ec43a', '#8bd96a', '#8a5a2b', '#ffffff', '#b6f08f', '#3f9a28'];
    var DARK = ['#2fe3d4', '#86f5ea', '#17a8b0', '#5b8cff', '#a98bff', '#0e3d42'];
    var n = innerWidth < 700 ? 9 : 16;
    for (var i = 0; i < n; i++) {
      var c = doc.createElement('i');
      c.className = 'mx-cube';
      var s = Math.round(14 + Math.random() * 22);
      c.style.setProperty('--x', (Math.random() * 96).toFixed(1) + 'vw');
      c.style.setProperty('--s', s + 'px');
      c.style.setProperty('--t', (16 + Math.random() * 18).toFixed(1) + 's');
      c.style.setProperty('--d', (-Math.random() * 30).toFixed(1) + 's');
      c.style.setProperty('--dx', Math.round(-90 + Math.random() * 180) + 'px');
      c.style.setProperty('--r', Math.round(-540 + Math.random() * 1080) + 'deg');
      c.style.setProperty('--cl', LIGHT[i % LIGHT.length]);
      c.style.setProperty('--cd', DARK[i % DARK.length]);
      sky.appendChild(c);
    }
  })();
  doc.body.appendChild(sky);

  /* แสงวิ่งรอบขอบการ์ด (hero / block / stat) */
  [].forEach.call(doc.querySelectorAll('.hero,.block,.stat'), function (card, i) {
    var r = doc.createElement('span');
    r.className = 'mx-ring';
    r.setAttribute('aria-hidden', 'true');
    r.style.setProperty('--mx-rd', (-(i * 1.1) % 5).toFixed(1) + 's');
    card.appendChild(r);
  });

  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return !(mq && mq('(prefers-color-scheme:light)').matches);
  }
  function bangkokHours() {
    var d = new Date(Date.now() + 7 * 3600000);
    return d.getUTCHours() + d.getUTCMinutes() / 60;
  }
  function placeSky() {
    var dark = isDark();
    root.classList.toggle('mx-night', dark);
    root.classList.toggle('mx-day', !dark);
    // เดินครบ 1 โค้งทุก 12 ชม. (ตี 6 → 18:00 และ 18:00 → 06:00)
    var p = ((bangkokHours() - 6 + 24) % 12) / 12;
    // วงโคจรอยู่ช่วงล่างของจอ (ขอบฟ้า ~86%) เพราะส่วนบนมักถูกการ์ดบังหมด
    var w = innerWidth, h = innerHeight, size = w < 700 ? 64 : 104;
    var x = 0.06 * w + p * (w * 0.88) - size / 2;
    var y = h * 0.86 - Math.sin(Math.PI * p) * h * 0.34 - size / 2;
    var t = (x).toFixed(0) + 'px ' + y.toFixed(0) + 'px';
    var o = dark ? moon : sun;
    sun.style.width = sun.style.height = moon.style.width = moon.style.height = size + 'px';
    o.style.translate = t;
    (dark ? sun : moon).style.translate = t;
  }
  placeSky();
  setInterval(placeSky, 60 * 1000);
  addEventListener('resize', placeSky);
  if (window.MutationObserver) {
    new MutationObserver(placeSky).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* ---------- เมนูซ้าย: แถบไฮไลต์เลื่อนตามแท็บ ---------- */
  var nav = doc.querySelector('.nav');
  if (nav) {
    var bar = doc.createElement('span');
    bar.className = 'mx-nav-bar';
    bar.setAttribute('aria-hidden', 'true');
    nav.appendChild(bar);
    nav.classList.add('mx-ind');
    var barFirst = true;
    var moveBar = function () {
      var a = nav.querySelector('.nv[aria-current="page"]');
      if (!a || a.hidden || a.offsetHeight === 0) { bar.classList.remove('on'); return; }
      var inset = 9;
      if (barFirst) {                       // ครั้งแรกวางเลย ไม่ต้องไหล
        bar.style.transition = 'none';
        bar.style.translate = '0 ' + (a.offsetTop + inset) + 'px';
        bar.style.height = Math.max(8, a.offsetHeight - inset * 2) + 'px';
        void bar.offsetWidth;
        bar.style.transition = '';
        barFirst = false;
      } else {
        bar.style.translate = '0 ' + (a.offsetTop + inset) + 'px';
        bar.style.height = Math.max(8, a.offsetHeight - inset * 2) + 'px';
      }
      bar.classList.add('on');
    };
    if (window.MutationObserver) {
      new MutationObserver(function () { requestAnimationFrame(moveBar); })
        .observe(nav, { attributes: true, subtree: true, attributeFilter: ['aria-current', 'hidden'] });
    }
    addEventListener('resize', function () { requestAnimationFrame(moveBar); });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(moveBar);
    setTimeout(moveBar, 120);
    moveBar();
  }

  /* ---------- การ์ดสถานะ: ออโรร่า ---------- */
  var hero = $('hero');
  if (hero && !hero.querySelector('.mx-aurora')) {
    var au = doc.createElement('div');
    au.className = 'mx-aurora';
    au.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 3; i++) au.appendChild(doc.createElement('i'));
    hero.insertBefore(au, hero.firstChild);
  }

  /* ---------- อันดับ: แถบสัดส่วน + ตัวเลขนับขึ้น ---------- */
  var rankList = $('rankList');
  var nf = (function () { try { return new Intl.NumberFormat('th-TH'); } catch (e) { return null; } })();
  function countUp(el, to, dec, suffix, delay) {
    var start = null, dur = 800, tok = el._mxTok = (el._mxTok || 0) + 1;   // tok: กันลูปเก่าแย่งกันเขียนเมื่อเล่นซ้ำ
    function fmt(v) {
      var s = dec ? v.toFixed(dec) : String(Math.round(v));
      var n = Number(s);
      return (nf ? nf.format(n) : s) + suffix;
    }
    el.classList.add('mx-count');
    el.textContent = fmt(0);
    function step(ts) {
      if (el._mxTok !== tok) return;
      if (start === null) start = ts;
      var t = Math.min(1, Math.max(0, (ts - start - delay) / dur));
      var e = 1 - Math.pow(1 - t, 3);
      el.textContent = t >= 1 ? fmt(to) : fmt(to * e);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function decorateRank() {
    var rows = [].slice.call(rankList.children).filter(function (li) { return !li.classList.contains('empty'); });
    if (!rows.length) return;
    var vals = rows.map(function (li) {
      var rv = li.querySelector('.rv');
      var m = rv && rv.textContent.match(/^([\d,]+(?:\.\d+)?)(.*)$/);
      return m ? { rv: rv, n: parseFloat(m[1].replace(/,/g, '')), dec: (m[1].split('.')[1] || '').length, suf: m[2] } : null;
    });
    var max = 0;
    vals.forEach(function (v) { if (v && v.n > max) max = v.n; });
    rows.forEach(function (li, idx) {
      var v = vals[idx];
      if (!v || !max) return;
      var b = doc.createElement('i');
      b.className = 'mx-bar';
      b.setAttribute('aria-hidden', 'true');
      b.style.setProperty('--w', Math.max(4, Math.round(v.n / max * 100)) + '%');
      b.style.setProperty('--n', idx);
      li.insertBefore(b, li.firstChild);
      v.rv.setAttribute('data-mx-to', v.n);
      v.rv.setAttribute('data-mx-dec', v.dec);
      v.rv.setAttribute('data-mx-suf', v.suf);
    });
    playCounts();
  }
  // นับตัวเลขขึ้นเฉพาะตอนที่แท็บอันดับมองเห็นอยู่ (ถ้าซ่อนอยู่จะนับจบไปก่อนที่ใครจะเห็น)
  function rankVisible() { var p = rankList.closest('.panel'); return !!p && p.classList.contains('active') && !p.hidden; }
  function playCounts() {
    if (!rankVisible()) return;
    [].forEach.call(rankList.querySelectorAll('.rv[data-mx-to]'), function (rv, idx) {
      countUp(rv, parseFloat(rv.getAttribute('data-mx-to')), parseInt(rv.getAttribute('data-mx-dec'), 10) || 0,
        rv.getAttribute('data-mx-suf') || '', 120 + idx * 70);
    });
  }
  if (rankList && window.MutationObserver) {
    // สังเกตเฉพาะลูกตรง (li) ของรายการ จึงไม่วนซ้ำเมื่อเราแก้ข้างในแต่ละแถว
    new MutationObserver(function () { decorateRank(); }).observe(rankList, { childList: true });
    var rankPanel = rankList.closest('.panel');
    if (rankPanel) new MutationObserver(function () { playCounts(); }).observe(rankPanel, { attributes: true, attributeFilter: ['class'] });
    if (rankList.children.length) decorateRank();
  }

  /* ---------- ผู้เล่นที่เพิ่งเข้าเกม ---------- */
  var pl = $('players');
  if (pl && window.MutationObserver) {
    var prev = null, recent = {}, JOIN_MS = 2400;
    // เว็บสร้างชิปใหม่ทั้งชุดทุกครั้งที่ render จึงจำเวลาที่แต่ละคนเข้าเกมไว้ แล้วใส่ไฮไลต์ซ้ำให้ชิปใหม่
    // พร้อมเลื่อนจังหวะอนิเมชันตามเวลาที่ผ่านไปแล้ว (animation-delay ติดลบ) ให้เล่นต่อเนื่องไม่สะดุด
    new MutationObserver(function () {
      var now = Date.now();
      var chips = [].slice.call(pl.querySelectorAll('.chip'));
      var names = chips.map(function (c) { return c.lastElementChild ? c.lastElementChild.textContent : ''; });
      if (prev !== null) {                               // รอบแรก = ฐานเทียบ ไม่ไฮไลต์
        names.forEach(function (n) { if (n && prev.indexOf(n) === -1) recent[n] = now; });
      }
      prev = names;
      chips.forEach(function (c, i) {
        var t0 = recent[names[i]];
        if (t0 === undefined) return;
        var age = now - t0;
        if (age >= JOIN_MS) { delete recent[names[i]]; return; }
        c.style.setProperty('--mx-d', (-age) + 'ms');
        c.setAttribute('data-mx-join', '');
        setTimeout(function () { c.removeAttribute('data-mx-join'); }, JOIN_MS - age + 100);
      });
    }).observe(pl, { childList: true });
  }
})();
