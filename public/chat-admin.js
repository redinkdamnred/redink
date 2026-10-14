/* จัดการแชทในหน้าแอดมิน: ลบข้อความ / บล็อกผู้ส่ง / ปลดบล็อก (ใช้รหัสผ่านแอดมินที่ล็อกอินไว้แล้ว) */
(function () {
  'use strict';
  var sec = document.getElementById('chatAdmin');
  var editor = document.getElementById('editor');
  if (!sec || !editor) return;
  var $ = function (id) { return document.getElementById(id); };
  var list = $('caList'), bans = $('caBans'), info = $('caInfo');
  var timer = null;

  function pw() { try { return sessionStorage.getItem('pw') || ''; } catch (e) { return ''; } }
  function api(method, url, body) {
    var o = { method: method, headers: { 'x-admin-password': pw() } };
    if (body) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
    return fetch(url, o).then(function (r) { return r.json().catch(function () { return { ok: false }; }); });
  }
  function btn(label, fn) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.addEventListener('click', fn);
    return b;
  }
  function fmt(t) {
    return new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' });
  }

  function render(j) {
    sec.hidden = false;
    info.textContent = j.online + ' คนกำลังดูแชท' + (j.password ? ' · มีรหัสผ่านกลุ่ม' : ' · ไม่มีรหัสผ่านกลุ่ม (ใครก็เข้าได้)') + (j.toDiscord ? ' · ส่งไป Discord' : '');

    list.textContent = '';
    if (!j.messages.length) {
      var e = document.createElement('p'); e.className = 'chat-empty'; e.textContent = 'ยังไม่มีข้อความ';
      list.appendChild(e);
    }
    var banned = {};
    j.bans.forEach(function (b) { banned[b.h] = 1; });
    j.messages.slice().reverse().forEach(function (m) {
      var row = document.createElement('div'); row.className = 'msg';
      var mb = document.createElement('div'); mb.className = 'mb';
      var mh = document.createElement('div'); mh.className = 'mh';
      var n = document.createElement('b'); n.className = 'mn'; n.textContent = m.name;
      var t = document.createElement('span'); t.className = 'small muted'; t.textContent = fmt(m.t) + ' · #' + m.h.slice(0, 4);
      mh.appendChild(n); mh.appendChild(t);
      var tx = document.createElement('div'); tx.className = 'mt'; tx.textContent = m.text;
      mb.appendChild(mh); mb.appendChild(tx);
      var act = document.createElement('div'); act.className = 'mact';
      act.appendChild(btn('ลบ', function () {
        api('DELETE', '/api/admin/chat/messages/' + m.id).then(load);
      }));
      if (!banned[m.h]) {
        act.appendChild(btn('บล็อก', function () {
          if (confirm('บล็อก "' + m.name + '" ไม่ให้ส่งข้อความ?\n(บล็อกตามไอพี ถ้าใช้เน็ตเดียวกัน เช่น บ้านเดียวกัน จะโดนด้วยกัน)')) {
            api('POST', '/api/admin/chat/bans', { h: m.h }).then(load);
          }
        }));
      }
      row.appendChild(mb); row.appendChild(act);
      list.appendChild(row);
    });

    bans.textContent = '';
    if (!j.bans.length) {
      var p = document.createElement('p'); p.className = 'small muted'; p.textContent = 'ไม่มีคนถูกบล็อก';
      bans.appendChild(p);
    }
    j.bans.forEach(function (b) {
      var s = document.createElement('span'); s.className = 'ban chip has-head';
      var l = document.createElement('span'); l.textContent = (b.name || 'ไม่ทราบชื่อ') + ' #' + b.h.slice(0, 4);
      s.appendChild(l);
      s.appendChild(btn('ปลดบล็อก', function () { api('DELETE', '/api/admin/chat/bans/' + b.h).then(load); }));
      bans.appendChild(s);
    });
  }

  function load() {
    if (!pw() || editor.hidden) return;
    api('GET', '/api/admin/chat').then(function (j) {
      if (j && j.ok) render(j);
      else if (j && j.message === undefined) sec.hidden = true; // แชทปิดอยู่ (ไม่มีเส้นทางนี้)
    });
  }

  $('caRefresh').addEventListener('click', load);
  $('caClear').addEventListener('click', function () {
    if (confirm('ลบข้อความแชททั้งหมด?')) api('POST', '/api/admin/chat/clear').then(load);
  });

  // โหลดทันทีเมื่อล็อกอินสำเร็จ (ฟอร์มแก้ไขถูกเปิดขึ้น) และรีเฟรชเองทุก 10 วินาทีระหว่างเปิดหน้านี้
  new MutationObserver(function () {
    if (!editor.hidden) { load(); if (!timer) timer = setInterval(load, 10000); }
    else { sec.hidden = true; clearInterval(timer); timer = null; }
  }).observe(editor, { attributes: true, attributeFilter: ['hidden'] });
  load();
})();
