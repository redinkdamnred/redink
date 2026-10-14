/* อันดับผู้เล่น (หน้าแรก) — ใช้ textContent เท่านั้น */
(function () {
  'use strict';
  var box = document.getElementById('rankBox');
  if (!box) return;
  var list = document.getElementById('rankList'), stat = document.getElementById('rankStat');
  var tabs = [].slice.call(box.querySelectorAll('[data-k]'));
  var data = null, kind = 'ores';

  var KEY = { ores: 'o', mobs: 'm', hours: 'h', deaths: 'd', dist: 'k' };
  var LABEL = { ores: 'บล็อกแร่ที่ขุด', mobs: 'มอนสเตอร์ที่ฆ่า', hours: 'ชั่วโมงที่เล่น', deaths: 'จำนวนครั้งที่ตาย', dist: 'ระยะทางที่เดินทาง' };
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

  function render() {
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
