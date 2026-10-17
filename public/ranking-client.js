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

  /* ---------- กล่องรายละเอียดของผู้เล่น (ชี้เมาส์ / โฟกัส / แตะ) ----------
   * แสดงตามแท็บที่เลือกอยู่ แยกกันชัดเจน: แท็บขุด = หมวดบล็อก, แท็บฆ่า = รายมอนสเตอร์ ฯลฯ */
  var CAT = {
    wood: 'ไม้', stone: 'หิน', dirt: 'ดิน / หญ้า', sand: 'ทราย / กรวด', ore: 'แร่', leaves: 'ใบไม้', plant: 'พืช / ดอกไม้',
    snow: 'หิมะ / น้ำแข็ง', glass: 'กระจก', wool: 'ขนแกะ / พรม', concrete: 'คอนกรีต / เทอราคอตตา',
    furniture: 'ของใช้ / เครื่องตกแต่ง', redstone: 'เรดสโตน / กลไก', other: 'อื่น ๆ'
  };
  var ORE = {
    coal_ore: 'แร่ถ่านหิน', iron_ore: 'แร่เหล็ก', copper_ore: 'แร่ทองแดง', gold_ore: 'แร่ทอง', redstone_ore: 'แร่เรดสโตน',
    lapis_ore: 'แร่ลาพิส', diamond_ore: 'แร่เพชร', emerald_ore: 'แร่มรกต', nether_gold_ore: 'แร่ทองเนเธอร์',
    nether_quartz_ore: 'แร่ควอตซ์', ancient_debris: 'เศษโบราณ (Ancient Debris)'
  };
  var MOB = {
    zombie: 'ซอมบี้', skeleton: 'โครงกระดูก', creeper: 'ครีปเปอร์', spider: 'แมงมุม', cave_spider: 'แมงมุมถ้ำ',
    enderman: 'เอนเดอร์แมน', witch: 'แม่มด', slime: 'สไลม์', magma_cube: 'แมกมาคิวบ์', blaze: 'เบลซ', ghast: 'แกสต์',
    zombified_piglin: 'ซอมบี้พิกลิน', piglin: 'พิกลิน', piglin_brute: 'พิกลินบรูท', hoglin: 'ฮอกลิน', zoglin: 'โซกลิน',
    wither_skeleton: 'วิเทอร์สเกเลตัน', drowned: 'ซอมบี้จมน้ำ', husk: 'ฮัสก์', stray: 'สเตรย์', phantom: 'แฟนทอม',
    pillager: 'พิลเลเจอร์', vindicator: 'วินดิเคเตอร์', evoker: 'อีโวเกอร์', ravager: 'ราเวเจอร์', vex: 'เวกซ์',
    guardian: 'การ์เดียน', elder_guardian: 'เอลเดอร์การ์เดียน', shulker: 'ชูลเกอร์', silverfish: 'ซิลเวอร์ฟิช',
    endermite: 'เอนเดอร์ไมต์', bogged: 'บ็อกเก็ด', breeze: 'บรีซ', warden: 'วอร์เดน', wither: 'วิเทอร์',
    ender_dragon: 'เอนเดอร์ดราก้อน', creaking: 'ครีคิง', zombie_villager: 'ซอมบี้ชาวบ้าน', player: 'ผู้เล่น',
    cow: 'วัว', pig: 'หมู', sheep: 'แกะ', chicken: 'ไก่', rabbit: 'กระต่าย', horse: 'ม้า', squid: 'หมึก',
    glow_squid: 'หมึกเรืองแสง', bat: 'ค้างคาว', villager: 'ชาวบ้าน', iron_golem: 'ไอรอนโกเลม', wolf: 'หมาป่า',
    cod: 'ปลาคอด', salmon: 'ปลาแซลมอน', tropical_fish: 'ปลาเขตร้อน', turtle: 'เต่า', goat: 'แพะ', fox: 'จิ้งจอก'
  };
  var TIME = { play: 'เวลาที่เล่น', sneak: 'เวลาที่ย่อตัว', since_death: 'นับจากตายครั้งล่าสุด', since_rest: 'นับจากนอนครั้งล่าสุด', world: 'เวลาที่อยู่ในโลก' };
  var DIST = {
    walk: 'เดิน', sprint: 'วิ่ง', crouch: 'ย่อตัวเดิน', swim: 'ว่ายน้ำ', walk_on_water: 'เดินบนน้ำ', walk_under_water: 'เดินใต้น้ำ',
    fly: 'บิน (ครีเอทีฟ)', aviate: 'บินด้วยปีก (Elytra)', boat: 'เรือ', horse: 'ม้า', pig: 'หมู', strider: 'สไตรเดอร์', minecart: 'รถราง'
  };
  var pretty = function (id) { return String(id).replace(/_/g, ' '); };
  function oreName(id) { return ORE[id] || pretty(id); }
  function mobName(id) { return MOB[id] || pretty(id); }
  function deathName(id) { return id === '_other' ? 'สาเหตุอื่น (ตกที่สูง ไฟ ลาวา จมน้ำ ฯลฯ)' : mobName(id); }

  // รายละเอียดของแต่ละแท็บ: คีย์ข้อมูล, หัวข้อ, ตัวแปลชื่อ, ตัวจัดรูปแบบค่า, ข้อความเมื่อไม่มีข้อมูล
  var DETAIL = {
    blocks: { f: 'b', head: function (p) { return 'ขุดรวม ' + nf.format(p.b || 0) + ' บล็อก'; }, name: function (id) { return CAT[id] || CAT.other; }, val: function (n) { return nf.format(n); }, empty: 'ยังไม่มีข้อมูลการขุด', bars: true },
    ores: { f: 'o', head: function (p) { return 'ขุดแร่รวม ' + nf.format(p.o || 0) + ' บล็อก'; }, name: oreName, val: function (n) { return nf.format(n); }, empty: 'ยังไม่เคยขุดแร่', bars: true },
    mobs: { f: 'm', more: 'mx', head: function (p) { return 'ฆ่ามอนสเตอร์รวม ' + nf.format(p.m || 0) + ' ตัว'; }, name: mobName, val: function (n) { return nf.format(n); }, empty: 'ยังไม่เคยฆ่ามอนสเตอร์', bars: true },
    deaths: { f: 'd', more: 'dx', head: function (p) { return 'ตายรวม ' + nf.format(p.d || 0) + ' ครั้ง'; }, name: deathName, val: function (n) { return nf.format(n) + ' ครั้ง'; }, empty: 'ยังไม่เคยตาย', bars: true },
    hours: { f: 'h', head: function (p) { return 'เล่นรวม ' + nf.format(p.h || 0) + ' ชม.'; }, name: function (id) { return TIME[id] || pretty(id); }, val: function (n) { return nf.format(n) + ' ชม.'; }, empty: 'ยังไม่มีข้อมูลเวลา', bars: false },
    dist: { f: 'k', head: function (p) { return 'เดินทางรวม ' + nf.format(p.k || 0) + ' กม.'; }, name: function (id) { return DIST[id] || pretty(id); }, val: function (n) { return nf.format(n) + ' กม.'; }, empty: 'ยังไม่มีข้อมูลการเดินทาง', bars: true }
  };

  var tip = document.createElement('div');
  tip.className = 'rank-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  document.body.appendChild(tip);
  var tipFor = null;

  function hideTip() { tip.hidden = true; tipFor = null; }
  function showTip(li, p) {
    var dt = DETAIL[kind];
    tip.textContent = '';
    var h = document.createElement('div'); h.className = 'tt-h';
    var hn = document.createElement('b'); hn.textContent = p.n;
    var hs = document.createElement('span'); hs.textContent = dt.head(p);
    h.appendChild(hn); h.appendChild(hs); tip.appendChild(h);
    var t = p.v && Array.isArray(p.v[dt.f]) ? p.v[dt.f] : null;
    if (!p.v) {
      var w = document.createElement('div'); w.className = 'tt-e'; w.textContent = 'รายละเอียดจะขึ้นหลังซิงก์ข้อมูลครั้งถัดไป';
      tip.appendChild(w);
    } else if (!t || !t.length) {
      var e = document.createElement('div'); e.className = 'tt-e'; e.textContent = dt.empty;
      tip.appendChild(e);
    } else {
      var max = dt.bars ? (Number(t[0][1]) || 1) : 0;
      t.forEach(function (r) {
        var row = document.createElement('div'); row.className = 'tt-r';
        if (max) {
          var bar = document.createElement('i'); bar.style.width = Math.max(4, Math.round((r[1] / max) * 100)) + '%';
          row.appendChild(bar);
        }
        var nm = document.createElement('span'); nm.className = 'tt-n'; nm.textContent = dt.name(String(r[0]));
        var ct = document.createElement('span'); ct.className = 'tt-c'; ct.textContent = dt.val(r[1]);
        row.appendChild(nm); row.appendChild(ct); tip.appendChild(row);
      });
      var rest = dt.more ? Number(p.v[dt.more]) || 0 : 0;
      if (rest > 0) {
        var more = document.createElement('div'); more.className = 'tt-e'; more.textContent = 'และอีก ' + nf.format(rest) + ' ชนิด';
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

  /* ---------- โพเดียม 1-3 + อนิเมชันตอนอันดับเปลี่ยน ---------- */
  var pod = document.createElement('div');
  pod.className = 'mcx-pod'; pod.hidden = true;
  list.parentNode.insertBefore(pod, list);
  var prevRank = {}, prevTop = {}, lastKind = null;

  /* ---------- ฉายา + ความหายากของการ์ด (คำนวณจากอันดับในทุกหมวด) ---------- */
  var KINDS = ['blocks', 'ores', 'mobs', 'hours', 'deaths', 'dist'];
  var KIND_NAME = { blocks: 'ขุดบล็อก', ores: 'ขุดแร่', mobs: 'ฆ่ามอนสเตอร์', hours: 'เวลาเล่น', deaths: 'ตาย', dist: 'เดินทาง' };
  var TITLE = { blocks: 'นักขุดผู้ไม่เคยหลับ', ores: 'ราชาแร่', mobs: 'นักล่ามอนสเตอร์', hours: 'ติดเกมตัวพ่อ', deaths: 'ลูกครีปเปอร์ประจำเซิร์ฟ', dist: 'นักเดินทางไกล' };
  var MINOR = { blocks: 'มือขุดฝีมือดี', ores: 'นักสำรวจแร่', mobs: 'นักรบแนวหน้า', hours: 'เซียนเกมตัวจริง', deaths: 'เพื่อนซี้ลาวา', dist: 'เท้าไฟ' };
  var RARITY = [
    { k: 'legendary', name: 'Legendary', min: 0.78 }, { k: 'epic', name: 'Epic', min: 0.58 },
    { k: 'rare', name: 'Rare', min: 0.4 }, { k: 'uncommon', name: 'Uncommon', min: 0.22 }, { k: 'common', name: 'Common', min: 0 }
  ];
  var meta = {};
  function off(kd) { var b = box.querySelector('[data-k="' + kd + '"]'); return !!b && b.hasAttribute('data-off'); }
  function activeKinds() { return KINDS.filter(function (kd) { return !off(kd); }); }
  function fixKind() {
    if (!off(kind)) return;
    for (var i = 0; i < tabs.length; i++) if (!tabs[i].hasAttribute('data-off')) {
      kind = tabs[i].getAttribute('data-k'); tabs.forEach(function (x) { x.setAttribute('aria-pressed', x === tabs[i] ? 'true' : 'false'); }); break;
    }
  }
  function computeMeta(players) {
    var out = {}, byKind = {};
    players.forEach(function (p) { out[p.n] = { ranks: {}, titles: [], score: 0 }; });
    var kinds = activeKinds(), nk = kinds.filter(function (kd) { return kd !== 'deaths'; }).length || 1;
    kinds.forEach(function (kd) {
      var k = KEY[kd];
      var arr = players.filter(function (p) { return p[k] > 0; }).sort(function (a, b) { return b[k] - a[k] || a.n.localeCompare(b.n); });
      byKind[kd] = arr.length;
      arr.forEach(function (p, i) {
        var m = out[p.n]; m.ranks[kd] = i + 1;
        if (kd !== 'deaths') m.score += (arr.length - i - 0.5) / arr.length;   // ตายเยอะไม่ทำให้การ์ดหายากขึ้น
        if (i === 0) m.titles.push({ kd: kd, text: TITLE[kd], top: true });
        else if (i < 3 && arr.length >= 4) m.titles.push({ kd: kd, text: MINOR[kd], top: false });
      });
    });
    players.forEach(function (p) {
      var m = out[p.n], v = m.score / nk, r = RARITY[RARITY.length - 1];
      for (var i = 0; i < RARITY.length; i++) if (v >= RARITY[i].min) { r = RARITY[i]; break; }
      m.rarity = r; m.main = m.titles.length ? (m.titles.filter(function (t) { return t.top; })[0] || m.titles[0]).text : 'นักผจญภัยหน้าใหม่';
      m.total = byKind;
    });
    return out;
  }

  /* ---------- การ์ดผู้เล่นสะสม ---------- */
  var cardOv = null, cardPrevFocus = null;
  function closeCard() { if (cardOv) { cardOv.parentNode && cardOv.parentNode.removeChild(cardOv); cardOv = null; if (cardPrevFocus && cardPrevFocus.focus) { try { cardPrevFocus.focus(); } catch (e) {} } } }
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function showCard(p) {
    closeCard(); hideTip();
    var m = meta[p.n] || { ranks: {}, titles: [], rarity: RARITY[4], main: 'นักผจญภัยหน้าใหม่', total: {} };
    cardPrevFocus = document.activeElement;
    var ov = mk('div', 'mcx-card-ov'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'การ์ดผู้เล่น ' + p.n);
    var card = mk('div', 'mcx-card r-' + m.rarity.k);
    var top = mk('div', 'mcx-card-top'); top.appendChild(mk('span', 'mcx-card-r', m.rarity.name));
    var x = mk('button', 'mcx-card-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'ปิดการ์ด'); x.addEventListener('click', closeCard); top.appendChild(x);
    var art = mk('div', 'mcx-card-art');
    var img = document.createElement('img'); img.alt = ''; img.referrerPolicy = 'no-referrer';
    img.src = 'https://mc-heads.net/body/' + encodeURIComponent(p.n) + '/200';
    img.addEventListener('error', function () { if (!img._fb) { img._fb = 1; img.src = 'https://mc-heads.net/avatar/' + encodeURIComponent(p.n) + '/128'; } else img.style.visibility = 'hidden'; });
    if (p.known === false) img.style.visibility = 'hidden';
    art.appendChild(img);
    var nm = mk('div', 'mcx-card-n', p.n), tt = mk('div', 'mcx-card-t', m.main);
    var tbl = mk('div', 'mcx-card-stats');
    activeKinds().forEach(function (kd) {
      var v = p[KEY[kd]] || 0, r = m.ranks[kd], row = mk('div', 'mcx-card-row');
      row.appendChild(mk('span', 'l', KIND_NAME[kd])); row.appendChild(mk('b', 'v', v > 0 ? fmt(kd, v) : '–'));
      row.appendChild(mk('i', 'rk' + (r === 1 ? ' g' : ''), r ? '#' + r : ''));
      tbl.appendChild(row);
    });
    var tags = mk('div', 'mcx-card-tags');
    m.titles.forEach(function (t) { tags.appendChild(mk('span', 'tag' + (t.top ? ' top' : ''), t.text)); });
    if (!m.titles.length) tags.appendChild(mk('span', 'tag', 'ยังไม่มีฉายา ขุดเพิ่มอีกหน่อย!'));
    card.appendChild(top); card.appendChild(art); card.appendChild(nm); card.appendChild(tt); card.appendChild(tbl); card.appendChild(tags);
    ov.appendChild(card); document.body.appendChild(ov); cardOv = ov;
    ov.addEventListener('click', function (e) { if (e.target === ov) closeCard(); });
    requestAnimationFrame(function () { ov.classList.add('in'); x.focus(); });
    if (window.mcSfx) window.mcSfx('adv');
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cardOv) closeCard(); });
  function cardBtn(p) {
    var b = mk('button', 'mcx-cardbtn', 'การ์ด'); b.type = 'button'; b.setAttribute('aria-label', 'ดูการ์ดของ ' + p.n);
    b.addEventListener('click', function (e) { e.stopPropagation(); showCard(p); });
    b.addEventListener('mouseenter', function (e) { e.stopPropagation(); });
    return b;
  }

  function moveBadge(delta) {
    var b = document.createElement('i');
    b.className = 'mcx-mv ' + (delta > 0 ? 'up' : 'down');
    b.textContent = (delta > 0 ? '▲' : '▼') + Math.abs(delta);
    b.setAttribute('aria-label', delta > 0 ? 'ขึ้น ' + delta + ' อันดับ' : 'ลง ' + Math.abs(delta) + ' อันดับ');
    return b;
  }
  function wireTip(node, p) {
    node.tabIndex = 0;
    node.setAttribute('aria-label', p.n + ' — ดูรายละเอียด: ' + LABEL[kind]);
    node.addEventListener('mouseenter', function () { showTip(node, p); });
    node.addEventListener('mouseleave', hideTip);
    node.addEventListener('focus', function () { showTip(node, p); });
    node.addEventListener('blur', hideTip);
    node.addEventListener('click', function () { if (tipFor === node) hideTip(); else showTip(node, p); });
  }
  function podSpot(p, i, k, delta, newFirst) {
    var d = document.createElement('div');
    d.className = 'mcx-pd pd' + (i + 1) + (delta > 0 ? ' mv-up' : delta < 0 ? ' mv-down' : '');
    var who = document.createElement('div'); who.className = 'mcx-pd-who';
    if (i === 0) {
      var cr = document.createElement('div'); cr.className = 'mcx-crown' + (newFirst ? ' new' : '');
      cr.innerHTML = window.mcPixArt ? window.mcPixArt('crown') : '';
      who.appendChild(cr);
    }
    var hd = document.createElement('div'); hd.className = 'mcx-pd-head';
    if (p.known) {
      var img = document.createElement('img');
      img.src = 'https://mc-heads.net/avatar/' + encodeURIComponent(p.n) + '/' + (i === 0 ? 96 : 72);
      img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
      hd.appendChild(img);
    } else {
      var ph = document.createElement('div'); ph.className = 'mcx-pd-ph'; ph.textContent = '?'; hd.appendChild(ph);
    }
    if (delta) hd.appendChild(moveBadge(delta));
    var nm = document.createElement('div'); nm.className = 'mcx-pd-n'; nm.textContent = p.n;
    var vl = document.createElement('div'); vl.className = 'mcx-pd-v'; vl.textContent = fmt(kind, p[k]);
    var mt = meta[p.n], tl = mk('div', 'mcx-pd-t', mt ? mt.main : '');
    who.appendChild(hd); who.appendChild(nm); who.appendChild(tl); who.appendChild(vl); who.appendChild(cardBtn(p));
    var st = document.createElement('div'); st.className = 'mcx-pd-step'; st.textContent = i + 1;
    d.appendChild(who); d.appendChild(st);
    wireTip(d, p);
    return d;
  }

  function render() {
    fixKind();
    hideTip();
    list.textContent = '';
    pod.textContent = '';
    stat.textContent = data && data.updatedAt ? ago(data.updatedAt) : '';
    var k = KEY[kind];
    meta = computeMeta(data ? data.players : []);
    var rows = (data ? data.players : []).filter(function (p) { return p[k] > 0; })
      .sort(function (a, b) { return b[k] - a[k] || a.n.localeCompare(b.n); }).slice(0, 10);

    if (!rows.length) {
      pod.hidden = true; list.style.display = '';
      list.classList.remove('mcx-rest');
      var li = document.createElement('li');
      li.className = 'empty';
      li.textContent = data && data.updatedAt ? 'ยังไม่มีข้อมูลในหมวดนี้' : 'กำลังรอข้อมูลจากเซิร์ฟ…';
      list.appendChild(li);
      return;
    }

    // เทียบอันดับกับครั้งก่อนที่เปิดหมวดนี้ (ครั้งแรก = ไม่มีอนิเมชัน)
    var before = prevRank[kind], now = {};
    var delta = {};
    rows.forEach(function (p, i) {
      now[p.n] = i;
      if (before) delta[p.n] = before[p.n] === undefined ? 0 : before[p.n] - i; // + = ขึ้น
    });
    var topNow = rows[0].n, topBefore = prevTop[kind];
    var newFirst = !!before && topBefore !== undefined && topBefore !== topNow;
    prevRank[kind] = now; prevTop[kind] = topNow;

    // โพเดียม: เรียงซ้ายไป ขวา = 2, 1, 3
    var podRows = rows.slice(0, 3);
    var order = podRows.length === 1 ? [0] : podRows.length === 2 ? [1, 0] : [1, 0, 2];
    order.forEach(function (i) { pod.appendChild(podSpot(podRows[i], i, k, delta[podRows[i].n] || 0, newFirst && i === 0)); });
    pod.hidden = false;
    pod.classList.toggle('grow', lastKind !== kind);
    lastKind = kind;

    // รายการที่เหลือ (อันดับ 4-10)
    var rest = rows.slice(3);
    list.classList.add('mcx-rest');
    list.style.display = rest.length ? '' : 'none';
    rest.forEach(function (p, j) {
      var i = j + 3, d = delta[p.n] || 0;
      var li = document.createElement('li');
      var rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = i + 1;
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
      li.appendChild(nm); if (d) li.appendChild(moveBadge(d)); li.appendChild(cardBtn(p)); li.appendChild(vl);
      li.className = 'has-tip' + (d > 0 ? ' mv-up' : d < 0 ? ' mv-down' : '');
      wireTip(li, p);
      list.appendChild(li);
    });

    if (newFirst) {
      if (window.mcAdv) window.mcAdv({ icon: 'crown', name: 'ผู้นำคนใหม่ — ' + topNow + ' ขึ้นอันดับ 1 (' + LABEL[kind] + ')', challenge: true });
      if (window.mcSfx) window.mcSfx('levelup');
    }
  }

  document.addEventListener('mc-config', function () { fixKind(); if (data) render(); });
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
