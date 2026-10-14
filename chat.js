'use strict';
/* ---------------------------------------------------------------
 * ระบบแชทของเว็บ (แยกไฟล์ เพื่ออัปเดตง่าย)
 *
 * - ใช้ SSE ส่งข้อความสด ไม่ต้องติดตั้งแพ็กเกจเพิ่ม
 * - เก็บข้อความล่าสุดใน data/chat.json
 * - ตั้งค่าใน .env (ไม่ตั้ง = ใช้ค่าเริ่มต้น):
 *     CHAT_ENABLED=true        เปิด/ปิดแชท
 *     CHAT_PASSWORD=           รหัสผ่านของกลุ่ม (ว่าง = ทุกคนเข้าแชทได้)
 *     CHAT_TO_DISCORD=false    ส่งข้อความแชทไปห้อง Discord ผ่าน webhook (ทางเดียว)
 *     CHAT_HISTORY=100         จำนวนข้อความที่เก็บไว้ (10-500)
 * ------------------------------------------------------------- */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function setupChat({ app, cfg, DATA_DIR, adminAuth, sendWebhook }) {
  const env = process.env;
  const on = (v, def) => (v === undefined || v === '' ? def : String(v).toLowerCase() === 'true');
  const opt = {
    enabled: on(env.CHAT_ENABLED, true),
    password: env.CHAT_PASSWORD || '',
    toDiscord: on(env.CHAT_TO_DISCORD, false),
    history: Math.min(500, Math.max(10, parseInt(env.CHAT_HISTORY || '100', 10) || 100)),
    maxName: 20,
    maxText: 300,
  };
  if (!opt.enabled) {
    app.get('/api/chat/config', (req, res) => res.json({ enabled: false }));
    return { enabled: false };
  }

  /* ---------- เก็บข้อมูล ---------- */
  const FILE = path.join(DATA_DIR, 'chat.json');
  let db = { seq: 0, messages: [], bans: [] }; // messages: {id,t,name,text,h}  bans: {h,name,t}
  try {
    const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (j && Array.isArray(j.messages)) db = { seq: j.seq || 0, messages: j.messages, bans: Array.isArray(j.bans) ? j.bans : [] };
  } catch (_) { /* ยังไม่เคยมีแชท */ }

  let dirty = false;
  function flush() {
    if (!dirty) return;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(FILE + '.tmp', JSON.stringify(db));
      fs.renameSync(FILE + '.tmp', FILE);
      dirty = false;
    } catch (e) {
      console.error('chat save error:', e.message);
    }
  }
  setInterval(flush, 5000).unref();
  process.on('exit', flush);

  /* ---------- ตัวช่วย ---------- */
  const hashIp = (ip) => crypto.createHash('sha256').update(String(ip) + 'mc-chat-salt').digest('hex').slice(0, 12);
  const safeEq = (a, b) => {
    const x = crypto.createHash('sha256').update(String(a)).digest();
    const y = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(x, y);
  };
  const token = opt.password ? crypto.createHmac('sha256', opt.password).update('mc-chat-v1').digest('hex') : '';
  const authorized = (given) => !opt.password || (!!given && safeEq(given, token));

  // ล้างตัวอักษรควบคุม/ตัวกลับทิศ และจำกัดสระ-วรรณยุกต์ซ้อน (กันข้อความล้นบรรทัด)
  function clean(s, max) {
    s = String(s == null ? '' : s)
      .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    s = s.replace(/\p{M}{4,}/gu, (m) => Array.from(m).slice(0, 3).join(''));
    return Array.from(s).slice(0, max).join('');
  }

  /* ---------- กันสแปม ---------- */
  const sendLog = new Map(); // h -> [เวลาที่ส่ง]
  function rateLimited(h) {
    const now = Date.now();
    const arr = (sendLog.get(h) || []).filter((t) => now - t < 60000);
    if (arr.length && now - arr[arr.length - 1] < 1500) { sendLog.set(h, arr); return 'ส่งเร็วเกินไป รอสักครู่'; }
    if (arr.length >= 12) { sendLog.set(h, arr); return 'ส่งข้อความถี่เกินไป รอสักครู่แล้วลองใหม่'; }
    arr.push(now);
    sendLog.set(h, arr);
    return '';
  }
  const joinFails = new Map(); // ip -> {n,t}
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of sendLog) if (!v.length || now - v[v.length - 1] > 60000) sendLog.delete(k);
    for (const [k, v] of joinFails) if (now - v.t > 10 * 60 * 1000) joinFails.delete(k);
  }, 60000).unref();

  /* ---------- SSE ---------- */
  const clients = new Set(); // {res, h}
  const MAX_CLIENTS = 300, MAX_PER_IP = 6;
  const pub = (m) => ({ id: m.id, t: m.t, name: m.name, text: m.text });
  function sse(res, event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
  function broadcast(event, data) {
    for (const c of clients) { try { sse(c.res, event, data); } catch (_) { /* ปล่อยให้ close ล้างเอง */ } }
  }
  let onlineTimer = null;
  function announceOnline() {
    if (onlineTimer) return;
    onlineTimer = setTimeout(() => { onlineTimer = null; broadcast('online', { n: clients.size }); }, 800);
  }
  setInterval(() => { for (const c of clients) { try { c.res.write(': ping\n\n'); } catch (_) { /* ignore */ } } }, 25000).unref();

  /* ---------- เส้นทางสาธารณะ ---------- */
  app.get('/api/chat/config', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      enabled: true,
      needPassword: !!opt.password,
      authorized: authorized(req.query.k),
      maxName: opt.maxName,
      maxText: opt.maxText,
    });
  });

  app.post('/api/chat/join', (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!opt.password) return res.json({ ok: true, token: '' });
    const now = Date.now();
    const f = joinFails.get(req.ip);
    if (f && f.n >= 5 && now - f.t < 10 * 60 * 1000) return res.status(429).json({ ok: false, message: 'ใส่รหัสผิดหลายครั้ง รอ 10 นาทีแล้วลองใหม่' });
    const given = String((req.body && req.body.password) || '');
    if (!safeEq(given, opt.password)) {
      joinFails.set(req.ip, { n: (f ? f.n : 0) + 1, t: now });
      return res.status(401).json({ ok: false, message: 'รหัสผ่านไม่ถูกต้อง' });
    }
    joinFails.delete(req.ip);
    res.json({ ok: true, token });
  });

  app.get('/api/chat/stream', (req, res) => {
    if (!authorized(req.query.k)) return res.status(401).end();
    const h = hashIp(req.ip);
    let mine = 0;
    for (const c of clients) if (c.h === h) mine++;
    if (clients.size >= MAX_CLIENTS || mine >= MAX_PER_IP) return res.status(429).end();

    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // กัน Nginx หน่วงข้อความ
    });
    res.flushHeaders();
    res.write('retry: 3000\n\n');
    const client = { res, h };
    clients.add(client);
    sse(res, 'init', { messages: db.messages.map(pub), online: clients.size });
    announceOnline();
    req.on('close', () => { clients.delete(client); announceOnline(); });
  });

  app.post('/api/chat/messages', (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!authorized(req.get('x-chat-token'))) return res.status(401).json({ ok: false, message: 'ต้องใส่รหัสผ่านกลุ่มก่อน', needJoin: true });
    const h = hashIp(req.ip);
    if (db.bans.some((b) => b.h === h)) return res.status(403).json({ ok: false, message: 'คุณถูกบล็อกจากแชท' });

    const b = req.body || {};
    const name = clean(b.name, opt.maxName);
    const text = clean(b.text, opt.maxText);
    if (!name) return res.status(400).json({ ok: false, message: 'ใส่ชื่อก่อนส่งข้อความ' });
    if (!text) return res.status(400).json({ ok: false, message: 'พิมพ์ข้อความก่อนส่ง' });
    const limited = rateLimited(h);
    if (limited) return res.status(429).json({ ok: false, message: limited });

    const m = { id: ++db.seq, t: Date.now(), name, text, h };
    db.messages.push(m);
    if (db.messages.length > opt.history) db.messages.splice(0, db.messages.length - opt.history);
    dirty = true;
    broadcast('msg', pub(m));

    if (opt.toDiscord && cfg.webhook) {
      const uname = /discord|clyde/i.test(name) ? 'ผู้เล่น' : name;
      sendWebhook({ username: `${uname} (เว็บ)`.slice(0, 80), content: text, allowed_mentions: { parse: [] } });
    }
    res.json({ ok: true, message: pub(m) });
  });

  /* ---------- เส้นทางแอดมิน (ใช้รหัสผ่านแอดมินเดิม) ---------- */
  app.get('/api/admin/chat', adminAuth, (req, res) => {
    res.json({ ok: true, messages: db.messages.slice(-200), bans: db.bans, online: clients.size, password: !!opt.password, toDiscord: opt.toDiscord });
  });
  app.delete('/api/admin/chat/messages/:id', adminAuth, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const i = db.messages.findIndex((m) => m.id === id);
    if (i < 0) return res.status(404).json({ ok: false, message: 'ไม่พบข้อความ (อาจถูกลบไปแล้ว)' });
    db.messages.splice(i, 1);
    dirty = true;
    broadcast('del', { id });
    res.json({ ok: true });
  });
  app.post('/api/admin/chat/clear', adminAuth, (req, res) => {
    db.messages = [];
    dirty = true;
    broadcast('clear', {});
    res.json({ ok: true });
  });
  app.post('/api/admin/chat/bans', adminAuth, (req, res) => {
    const h = String((req.body && req.body.h) || '').replace(/[^0-9a-f]/g, '').slice(0, 12);
    if (h.length !== 12) return res.status(400).json({ ok: false, message: 'รหัสผู้ส่งไม่ถูกต้อง' });
    if (!db.bans.some((b) => b.h === h)) {
      const last = [...db.messages].reverse().find((m) => m.h === h);
      db.bans.push({ h, name: last ? last.name : '', t: Date.now() });
      dirty = true;
    }
    res.json({ ok: true });
  });
  app.delete('/api/admin/chat/bans/:h', adminAuth, (req, res) => {
    db.bans = db.bans.filter((b) => b.h !== req.params.h);
    dirty = true;
    res.json({ ok: true });
  });

  console.log(`แชท: เปิด | รหัสผ่านกลุ่ม: ${opt.password ? 'ตั้งไว้' : 'ไม่ตั้ง (ทุกคนเข้าได้)'} | ส่งไป Discord: ${opt.toDiscord && cfg.webhook ? 'เปิด' : 'ปิด'}`);
  return { enabled: true };
};
