/* สถานะระบบอันดับในหน้าแอดมิน + ปุ่มดึงข้อมูลตอนนี้ (ใช้รหัสผ่านแอดมินที่ล็อกอินไว้แล้ว) */
(function () {
  'use strict';
  var sec = document.getElementById('rankAdmin');
  var editor = document.getElementById('editor');
  if (!sec || !editor) return;
  var info = document.getElementById('raInfo'), btn = document.getElementById('raSync');

  function pw() { try { return sessionStorage.getItem('pw') || ''; } catch (e) { return ''; } }
  function api(method, url) {
    return fetch(url, { method: method, headers: { 'x-admin-password': pw() } })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); });
  }
  function ago(t) {
    if (!t) return 'ยังไม่เคยดึงข้อมูลสำเร็จ';
    return new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' });
  }
  function render(j) {
    if (!j || !j.ok || !j.enabled) { sec.hidden = true; return; }
    sec.hidden = false;
    var s = j.status || {};
    var t = 'แหล่งข้อมูล: ' + (j.mode === 'sftp' ? 'SFTP' : 'โฟลเดอร์ในเครื่อง') + ' · ดึงทุก ' + j.minutes + ' นาที\n' +
      'ข้อมูลล่าสุด: ' + ago(j.updatedAt) + ' (' + j.players + ' คน)\n';
    if (j.running) t += 'กำลังดึงข้อมูล…';
    else if (s.ok === true) t += 'ครั้งล่าสุด: สำเร็จ (' + s.files + ' ไฟล์' + (s.skipped ? ', ข้าม ' + s.skipped + ' ไฟล์ที่เสีย' : '') + ')';
    else if (s.ok === false) t += 'ครั้งล่าสุด: ไม่สำเร็จ — ' + s.error;
    else t += 'ยังไม่ได้ดึงข้อมูลครั้งแรก';
    info.textContent = t;
  }
  function load() {
    if (!pw() || editor.hidden) return;
    api('GET', '/api/admin/ranking').then(render);
  }
  btn.addEventListener('click', function () {
    btn.disabled = true; info.textContent = 'กำลังดึงข้อมูลจากเซิร์ฟ…';
    api('POST', '/api/admin/ranking/sync').then(render).then(function () { btn.disabled = false; });
  });
  new MutationObserver(function () {
    if (!editor.hidden) load(); else sec.hidden = true;
  }).observe(editor, { attributes: true, attributeFilter: ['hidden'] });
  load();
})();
