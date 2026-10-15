/* แชทหน้าแรก (ฝั่งผู้เล่น) — ใช้ textContent เท่านั้น ไม่ใช้ innerHTML กับข้อความของผู้ใช้ */
(function () {
  'use strict';
  var box = document.getElementById('chatBox');
  if (!box || !window.EventSource) return;

  var $ = function (id) { return document.getElementById(id); };
  var log = $('chatLog'), stat = $('chatStat'), note = $('chatNote');
  var gate = $('chatGate'), main = $('chatMain');
  var nameIn = $('chatName'), textIn = $('chatText'), sendBtn = $('chatSend');

  var cfg = null, key = '', es = null, online = 0, connected = false;
  var msgs = [], ids = {}, hideTimer = null;

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k) || '';
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { return ''; }
    return '';
  }

  /* ---------- แสดงผล ---------- */
  var tf = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' });
  var df = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
  function fmtTime(t) {
    var d = new Date(t);
    return df.format(d) === df.format(new Date()) ? tf.format(d) : df.format(d) + ' ' + tf.format(d);
  }
  function hue(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }
  function nearBottom() { return log.scrollHeight - log.scrollTop - log.clientHeight < 60; }
  function toBottom() { log.scrollTop = log.scrollHeight; }

  function buildMsg(m) {
    var el = document.createElement('div');
    el.className = 'msg' + (m.name === nameIn.value.trim() && m.name ? ' mine' : '');
    el.setAttribute('data-id', m.id);
    var sw = document.createElement('i');
    sw.className = 'sw';
    sw.style.background = 'hsl(' + hue(m.name) + ' 55% 52%)';
    var mb = document.createElement('div'); mb.className = 'mb';
    var mh = document.createElement('div'); mh.className = 'mh';
    var mn = document.createElement('b'); mn.className = 'mn'; mn.textContent = m.name;
    var tm = document.createElement('time'); tm.className = 'small muted'; tm.textContent = fmtTime(m.t);
    tm.dateTime = new Date(m.t).toISOString();
    mh.appendChild(mn); mh.appendChild(tm);
    var mt = document.createElement('div'); mt.className = 'mt'; mt.textContent = m.text;
    mb.appendChild(mh); mb.appendChild(mt);
    el.appendChild(sw); el.appendChild(mb);
    return el;
  }
  function renderAll() {
    log.textContent = '';
    if (!msgs.length) {
      var e = document.createElement('p');
      e.className = 'chat-empty';
      e.textContent = 'ยังไม่มีข้อความ พิมพ์ทักทายเป็นคนแรกได้เลย';
      log.appendChild(e);
      return;
    }
    var frag = document.createDocumentFragment();
    msgs.forEach(function (m) { frag.appendChild(buildMsg(m)); });
    log.appendChild(frag);
    toBottom();
  }
  function addMsg(m) {
    if (ids[m.id]) return;
    ids[m.id] = 1;
    msgs.push(m);
    var stick = nearBottom();
    var first = log.querySelector('.chat-empty');
    if (first) log.removeChild(first);
    log.appendChild(buildMsg(m));
    if (stick || m.name === nameIn.value.trim()) toBottom();
  }
  function setList(list) {
    msgs = list.slice(); ids = {};
    msgs.forEach(function (m) { ids[m.id] = 1; });
    renderAll();
  }
  function setStat() {
    if (!connected) { stat.textContent = 'กำลังเชื่อมต่อ…'; return; }
    stat.textContent = online + ' คนกำลังดูแชท';
  }
  function say(t) { note.textContent = t || ''; }

  /* ---------- เชื่อมต่อ ---------- */
  function connect() {
    if (es) return;
    es = new EventSource('/api/chat/stream' + (key ? '?k=' + encodeURIComponent(key) : ''));
    es.addEventListener('init', function (e) {
      var d = JSON.parse(e.data);
      connected = true; online = d.online || 0;
      setList(d.messages || []); setStat();
    });
    es.addEventListener('msg', function (e) { addMsg(JSON.parse(e.data)); });
    es.addEventListener('del', function (e) {
      var id = JSON.parse(e.data).id;
      msgs = msgs.filter(function (m) { return m.id !== id; });
      delete ids[id];
      var el = log.querySelector('[data-id="' + id + '"]');
      if (el) el.parentNode.removeChild(el);
      if (!msgs.length) renderAll();
    });
    es.addEventListener('clear', function () { setList([]); });
    es.addEventListener('online', function (e) { online = JSON.parse(e.data).n; setStat(); });
    es.onerror = function () {
      connected = false; setStat();
      if (es && es.readyState === 2) { // เซิร์ฟเวอร์ปฏิเสธ (เช่น รหัสผ่านเปลี่ยน)
        es = null;
        recheck();
      }
    };
  }
  function disconnect() {
    if (es) { es.close(); es = null; }
    connected = false;
  }
  function recheck() {
    fetch('/api/chat/config' + (key ? '?k=' + encodeURIComponent(key) : ''), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (c) {
        cfg = c;
        if (c.needPassword && !c.authorized) { key = ''; ls('chatKey', null); showGate(); }
        else setTimeout(connect, 3000);
      })
      .catch(function () { setTimeout(recheck, 5000); });
  }

  function showGate() {
    disconnect();
    gate.hidden = false; main.hidden = true;
    stat.textContent = '';
  }
  function showChat() {
    gate.hidden = true; main.hidden = false;
    setStat();
    connect();
  }

  /* ---------- ส่งข้อความ / เข้าแชท ---------- */
  $('chatJoin').addEventListener('submit', function (e) {
    e.preventDefault();
    var pw = $('chatPw').value;
    fetch('/api/chat/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.ok) { key = j.token; ls('chatKey', key); $('chatPw').value = ''; $('chatJoinNote').textContent = ''; showChat(); }
        else $('chatJoinNote').textContent = j.message || 'เข้าแชทไม่สำเร็จ';
      })
      .catch(function () { $('chatJoinNote').textContent = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง'; });
  });

  $('chatForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = nameIn.value.trim(), text = textIn.value.trim();
    if (!name || !text) return;
    ls('chatName', name);
    sendBtn.disabled = true; say('');
    var h = { 'Content-Type': 'application/json' };
    if (key) h['x-chat-token'] = key;
    fetch('/api/chat/messages', { method: 'POST', headers: h, body: JSON.stringify({ name: name, text: text }) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, message: 'เซิร์ฟเวอร์ตอบผิดรูปแบบ' }; }); })
      .then(function (j) {
        if (j.ok) { textIn.value = ''; if (j.message) addMsg(j.message); }
        else {
          say(j.message || 'ส่งไม่สำเร็จ');
          if (j.needJoin) { key = ''; ls('chatKey', null); showGate(); }
        }
      })
      .catch(function () { say('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองส่งใหม่อีกครั้ง'); })
      .then(function () { sendBtn.disabled = false; textIn.focus(); });
  });

  // ชื่อที่พิมพ์ใหม่ ให้ไฮไลต์ข้อความของตัวเองตามทันที
  nameIn.addEventListener('change', function () {
    var n = nameIn.value.trim();
    [].forEach.call(log.querySelectorAll('.msg'), function (el) {
      var mn = el.querySelector('.mn');
      el.classList.toggle('mine', !!n && mn && mn.textContent === n);
    });
  });

  // ซ่อนแท็บนาน ๆ แล้วปิดการเชื่อมต่อ เพื่อลดภาระเซิร์ฟเวอร์ กลับมาแล้วต่อใหม่
  document.addEventListener('visibilitychange', function () {
    if (main.hidden) return;
    if (document.hidden) {
      hideTimer = setTimeout(disconnect, 60000);
    } else {
      clearTimeout(hideTimer);
      if (!es) { setStat(); connect(); }
    }
  });

  /* ---------- เริ่มต้น ---------- */
  nameIn.value = ls('chatName');
  key = ls('chatKey');
  fetch('/api/chat/config' + (key ? '?k=' + encodeURIComponent(key) : ''), { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (c) {
      if (!c || !c.enabled) return;
      cfg = c;
      nameIn.maxLength = c.maxName || 20;
      textIn.maxLength = c.maxText || 300;
      box.hidden = false;
      if (c.needPassword && !c.authorized) { key = ''; ls('chatKey', null); showGate(); }
      else showChat();
    })
    .catch(function () { /* ไม่มีแชท/เชื่อมต่อไม่ได้ ก็ซ่อนไว้ ไม่กระทบส่วนอื่นของหน้า */ });
})();
