/* อันดับผู้เล่น (หน้าแรก) — ใช้ textContent เท่านั้น */
(function () {
  'use strict';
  var box = document.getElementById('rankBox');
  if (!box) return;
  var list = document.getElementById('rankList'), stat = document.getElementById('rankStat');
  var tabs = [].slice.call(box.querySelectorAll('[data-k]'));
  var data = null, kind = 'blocks';

  var KEY = { ores: 'o', blocks: 'b', mobs: 'm', hours: 'h', deaths: 'd', dist: 'k' };
  var LABEL = { ores: 'บล็อกแร่ที่ขุด', blocks: 'บล็อกทั้งหมดที่ขุด', mobs: 'มอนสเตอร์ที่ฆ่า', hours: 'ชั่วโมงที่เล่น', deaths: 'จำนวนครั้งที่ตาย', dist: 'ระยะทางที่เดินทาง' };
  var nf = new Intl.NumberFormat('th-TH');

  function fmt(k, v) {
    var big = v >= 100 ? nf.format(Math.round(v)) : nf.format(v);
    if (k === 'hours') return big + ' ชม.';
    if (k === 'dist') return big + ' กม.';
    if (k === 'deaths') return nf.format(v) + ' ครั้ง';
    return nf.format(v);
  }
  function ago(t) {
    if (!t) return '';
    var m = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (m < 1) return 'อัปเดตเมื่อสักครู่';
    if (m < 60) return 'อัปเดตเมื่อ ' + m + ' นาทีที่แล้ว';
    var h = Math.round(m / 60);
    return h < 48 ? 'อัปเดตเมื่อ ' + h + ' ชม.ที่แล้ว' : 'อัปเดตเมื่อ ' + Math.round(h / 24) + ' วันที่แล้ว';
  }

  /* ---------- กล่องแสดงรายการบล็อกที่ขุด (ชี้เมาส์ / โฟกัส / แตะ) ---------- */
  var TH = {
    stone: 'หิน', cobblestone: 'หินกรวด', deepslate: 'ดีปสเลต', cobbled_deepslate: 'ดีปสเลตกรวด',
    dirt: 'ดิน', grass_block: 'บล็อกหญ้า', coarse_dirt: 'ดินหยาบ', sand: 'ทราย', red_sand: 'ทรายแดง', gravel: 'กรวด',
    clay: 'ดินเหนียว', netherrack: 'เนเธอร์แร็ก', end_stone: 'หินเอนด์', obsidian: 'ออบซิเดียน',
    andesite: 'แอนดีไซต์', diorite: 'ไดออไรต์', granite: 'แกรนิต', tuff: 'ทัฟฟ์', calcite: 'แคลไซต์', basalt: 'บะซอลต์',
    coal_ore: 'แร่ถ่านหิน', iron_ore: 'แร่เหล็ก', copper_ore: 'แร่ทองแดง', gold_ore: 'แร่ทอง', redstone_ore: 'แร่เรดสโตน',
    lapis_ore: 'แร่ลาพิส', diamond_ore: 'แร่เพชร', emerald_ore: 'แร่มรกต', nether_gold_ore: 'แร่ทองเนเธอร์',
    nether_quartz_ore: 'แร่ควอตซ์', ancient_debris: 'เศษโบราณ',
    oak_log: 'ท่อนไม้โอ๊ก', spruce_log: 'ท่อนไม้สปรูซ', birch_log: 'ท่อนไม้เบิร์ช', jungle_log: 'ท่อนไม้จังเกิล',
    acacia_log: 'ท่อนไม้อะคาเซีย', dark_oak_log: 'ท่อนไม้ดาร์กโอ๊ก', mangrove_log: 'ท่อนไม้แมนโกรฟ', cherry_log: 'ท่อนไม้เชอร์รี',
    oak_leaves: 'ใบโอ๊ก', snow: 'หิมะ', snow_block: 'บล็อกหิมะ', ice: 'น้ำแข็ง', soul_sand: 'ทรายวิญญาณ', glowstone: 'โกลว์สโตน'
  };
  function bname(id) {
    if (TH[id]) return TH[id];
    var m = /^deepslate_(.+_ore)$/.exec(id);
    if (m && TH[m[1]]) return TH[m[1]] + ' (ดีปสเลต)';
    return id.replace(/_/g, ' ');
  }
  var tip = document.createElement('div');
  tip.className = 'rank-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  document.body.appendChild(tip);
  var tipFor = null;

  function hideTip() { tip.hidden = true; tipFor = null; }
  function showTip(li, p) {
    tip.textContent = '';
    var h = document.createElement('div'); h.className = 'tt-h';
    var hn = document.createElement('b'); hn.textContent = p.n;
    var hs = document.createElement('span'); hs.textContent = 'ขุดรวม ' + nf.format(p.b || 0) + ' บล็อก';
    h.appendChild(hn); h.appendChild(hs); tip.appendChild(h);
    var t = p.t || [];
    if (!t.length) {
      var e = document.createElement('div'); e.className = 'tt-e'; e.textContent = 'ยังไม่มีข้อมูลการขุด';
      tip.appendChild(e);
    } else {
      var max = t[0][1] || 1;
      t.forEach(function (r) {
        var row = document.createElement('div'); row.className = 'tt-r';
        var bar = document.createElement('i'); bar.style.width = Math.max(4, Math.round((r[1] / max) * 100)) + '%';
        var nm = document.createElement('span'); nm.className = 'tt-n'; nm.textContent = bname(String(r[0]));
        var ct = document.createElement('span'); ct.className = 'tt-c'; ct.textContent = nf.format(r[1]);
        row.appendChild(bar); row.appendChild(nm); row.appendChild(ct); tip.appendChild(row);
      });
      if (p.x > 0) {
        var more = document.createElement('div'); more.className = 'tt-e'; more.textContent = 'และอีก ' + nf.format(p.x) + ' ชนิด';
        tip.appendChild(more);
      }
    }
    tip.hidden = false; tipFor = li;
    // จัดตำแหน่งให้อยู่ในจอ: ใต้แถว ถ้าที่ไม่พอก็ขึ้นไปอยู่เหนือแถว
    var r = li.getBoundingClientRect(), w = tip.offsetWidth, hh = tip.offsetHeight;
    var left = Math.min(Math.max(8, r.left + 40), Math.max(8, window.innerWidth - w - 8));
    var top = r.bottom + 6;
    if (top + hh > window.innerHeight - 8) top = Math.max(8, r.top - hh - 6);
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  }
  document.addEventListener('click', function (e) { if (tipFor && !tipFor.contains(e.target)) hideTip(); });
  window.addEventListener('scroll', hideTip, { passive: true });
  window.addEventListener('resize', hideTip);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideTip(); });

  function render() {
    hideTip();
    list.textContent = '';
    stat.textContent = data && data.updatedAt ? ago(data.updatedAt) : '';
    var k = KEY[kind];
    var rows = (data ? data.players : []).filter(function (p) { return p[k] > 0; })
      .sort(function (a, b) { return b[k] - a[k] || a.n.localeCompare(b.n); }).slice(0, 10);

    if (!rows.length) {
      var li = document.createElement('li');
      li.className = 'empty';
      li.textContent = data && data.updatedAt ? 'ยังไม่มีข้อมูลในหมวดนี้' : 'กำลังรอข้อมูลจากเซิร์ฟ…';
      list.appendChild(li);
      return;
    }
    rows.forEach(function (p, i) {
      var li = document.createElement('li');
      var rk = document.createElement('span'); rk.className = 'rk' + (i === 0 ? ' first' : ''); rk.textContent = i + 1;
      li.appendChild(rk);
      if (p.known) {
        var img = document.createElement('img');
        img.src = 'https://mc-heads.net/avatar/' + encodeURIComponent(p.n) + '/24';
        img.width = 24; img.height = 24; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
        li.appendChild(img);
      }
      var nm = document.createElement('span'); nm.className = 'rn'; nm.textContent = p.n;
      var vl = document.createElement('span'); vl.className = 'rv'; vl.textContent = fmt(kind, p[k]);
      vl.title = LABEL[kind];
      li.appendChild(nm); li.appendChild(vl);
      li.className = 'has-tip'; li.tabIndex = 0;
      li.setAttribute('aria-label', p.n + ' — ดูรายการบล็อกที่ขุด');
      li.addEventListener('mouseenter', function () { showTip(li, p); });
      li.addEventListener('mouseleave', hideTip);
      li.addEventListener('focus', function () { showTip(li, p); });
      li.addEventListener('blur', hideTip);
      li.addEventListener('click', function () { if (tipFor === li) hideTip(); else showTip(li, p); });
      list.appendChild(li);
    });
  }

  tabs.forEach(function (b) {
    b.addEventListener('click', function () {
      kind = b.getAttribute('data-k');
      tabs.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      render();
    });
  });

  function load() {
    fetch('/api/ranking', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.enabled) { box.hidden = true; return; }
        data = j; box.hidden = false; render();
      })
      .catch(function () { /* เชื่อมต่อไม่ได้ก็ปล่อยข้อมูลเดิมไว้ */ });
  }
  load();
  setInterval(function () { if (!document.hidden) load(); }, 5 * 60 * 1000);
})();
