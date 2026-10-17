'use strict';
/* ---------------------------------------------------------------
 * กระดานคะแนนมินิเกมของกลุ่ม (แยกไฟล์เหมือน chat.js)
 *
 * - เกม: dash (Creeper Dash, คะแนน = ระยะ) และ mole (Whack-a-Mole, คะแนน = แต้ม)
 * - โหมด: best (สถิติตลอดกาล) และ daily (ท้าทายรายวัน ทุกคนได้ด่านเดียวกันตามวันที่ไทย)
 * - เก็บใน data/games.json ไม่ต้องสมัครสมาชิก ใช้ชื่อที่พิมพ์เอง
 * - กันโกงเบื้องต้น: จำกัดคะแนนตามเวลาที่เล่น, จำกัดความถี่ต่อไอพี (เก็บเป็นแฮช)
 *   (เบราว์เซอร์ส่งคะแนนเอง จึงกันคนที่ตั้งใจโกงจริงจังไม่ได้ ใช้แข่งกันเล่นๆ ในกลุ่ม)
 * - ตั้งค่าใน .env:  GAMES_ENABLED=true (ปิดด้วย false)
 * ------------------------------------------------------------- */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GAMES = {
  dash: { minMs: 1500, maxMs: 15 * 60 * 1000, perSec: 45, cap: 40000 },   // คะแนน <= วินาที*45 + 10
  mole: { minMs: 30000, maxMs: 75 * 1000, perSec: 28, cap: 1800 },
};
const KEEP = 20;       // เก็บกี่อันดับต่อกระดาน
const KEEP_DAYS = 14;  // เก็บผลรายวันย้อนหลังกี่วัน

module.exports = function setupGames({ app, DATA_DIR, adminAuth, sendWebhook, cfg }) {
  const env = process.env;
  const enabled = !(String(env.GAMES_ENABLED || 'true').toLowerCase() === 'false');
  if (!enabled) {
    app.get('/api/games/config', (req, res) => res.json({ enabled: false }));
    return { enabled: false };
  }

  const FILE = path.join(DATA_DIR, 'games.json');
  let db = { best: { dash: [], mole: [] }, daily: {} };
  try {
    const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (j && j.best) db = { best: { dash: j.best.dash || [], mole: j.best.mole || [] }, daily: j.daily || {} };
  } catch (_) { /* ยังไม่เคยมีคะแนน */ }

  let dirty = false;
  function flush() {
    if (!dirty) return;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(FILE + '.tmp', JSON.stringify(db));
      fs.renameSync(FILE + '.tmp', FILE);
      dirty = false;
    } catch (e) { console.error('games save error:', e.message); }
  }
  setInterval(flush, 5000).unref();
  process.on('exit', flush);

  /* ---------- วันที่/seed (เวลาไทย) ---------- */
  const today = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const seedOf = (day) => parseInt(crypto.createHash('sha256').update('mc-daily:' + day).digest('hex').slice(0, 8), 16) >>> 0;
  const hashIp = (ip) => crypto.createHash('sha256').update(String(ip) + 'mc-games-salt').digest('hex').slice(0, 12);

  function clean(s, max) {
    s = String(s == null ? '' : s)
      .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/g, ' ')
      .replace(/\s+/g, ' ').trim();
    s = s.replace(/\p{M}{4,}/gu, (m) => Array.from(m).slice(0, 3).join(''));
    return Array.from(s).slice(0, max).join('');
  }

  /* ---------- กันสแปม ---------- */
  const log = new Map(); // h -> [เวลา]
  function limited(h) {
    const now = Date.now();
    const arr = (log.get(h) || []).filter((t) => now - t < 3600000);
    if (arr.length && now - arr[arr.length - 1] < 6000) { log.set(h, arr); return 'ส่งคะแนนเร็วเกินไป รอสักครู่'; }
    if (arr.length >= 40) { log.set(h, arr); return 'ส่งคะแนนถี่เกินไป รอสักพักแล้วลองใหม่'; }
    arr.push(now); log.set(h, arr);
    return '';
  }
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of log) if (!v.length || now - v[v.length - 1] > 3600000) log.delete(k);
  }, 600000).unref();

  /* ---------- กระดาน ---------- */
  function board(mode, game, day) {
    if (mode === 'daily') {
      const d = db.daily[day] || (db.daily[day] = { dash: [], mole: [] });
      return d[game] || (d[game] = []);
    }
    return db.best[game];
  }
  function pruneDaily() {
    const keys = Object.keys(db.daily).sort();
    while (keys.length > KEEP_DAYS) delete db.daily[keys.shift()];
  }
  // เพิ่ม/อัปเดตคะแนน (หนึ่งชื่อมีได้หนึ่งอันดับ เก็บค่าสูงสุด) คืนค่า {rank, improved}
  function put(list, name, score) {
    const key = name.toLowerCase();
    let e = list.find((x) => x.name.toLowerCase() === key);
    let improved = false;
    if (!e) { e = { name, score, t: Date.now() }; list.push(e); improved = true; }
    else if (score > e.score) { e.score = score; e.t = Date.now(); e.name = name; improved = true; }
    list.sort((a, b) => b.score - a.score || a.t - b.t);
    if (list.length > KEEP) list.length = KEEP;
    const rank = list.indexOf(e) + 1; // 0 = หลุดอันดับ
    return { rank, improved };
  }
  const pub = (list) => list.map((e) => ({ name: e.name, score: e.score, t: e.t }));

  /* ---------- เส้นทาง ---------- */
  app.get('/api/games/config', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const day = today();
    res.json({ enabled: true, day, seed: seedOf(day), maxName: 20 });
  });

  app.get('/api/games/scores', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const day = today();
    const dd = db.daily[day] || { dash: [], mole: [] };
    res.json({
      day,
      best: { dash: pub(db.best.dash), mole: pub(db.best.mole) },
      daily: { dash: pub(dd.dash || []), mole: pub(dd.mole || []) },
    });
  });

  app.post('/api/games/score', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const b = req.body || {};
    const game = String(b.game || '');
    const g = GAMES[game];
    if (!g) return res.status(400).json({ ok: false, message: 'ไม่รู้จักเกมนี้' });
    const mode = b.mode === 'daily' ? 'daily' : 'best';
    const name = clean(b.name, 20);
    if (!name) return res.status(400).json({ ok: false, message: 'ใส่ชื่อก่อนส่งคะแนน' });
    const score = Math.floor(Number(b.score));
    const dur = Math.floor(Number(b.dur));
    if (!Number.isFinite(score) || score <= 0 || score > g.cap) return res.status(400).json({ ok: false, message: 'คะแนนไม่ถูกต้อง' });
    if (!Number.isFinite(dur) || dur < g.minMs || dur > g.maxMs) return res.status(400).json({ ok: false, message: 'ข้อมูลการเล่นไม่ถูกต้อง' });
    if (score > (dur / 1000) * g.perSec + 10) return res.status(400).json({ ok: false, message: 'คะแนนสูงเกินเวลาที่เล่น ไม่บันทึก' });
    const day = today();
    if (mode === 'daily') {
      if (String(b.day) !== day || Number(b.seed) !== seedOf(day)) return res.status(409).json({ ok: false, message: 'ด่านรายวันเปลี่ยนแล้ว (ข้ามเที่ยงคืน) รีเฟรชหน้าแล้วเล่นใหม่' });
    }
    const wait = limited(hashIp(req.ip));
    if (wait) return res.status(429).json({ ok: false, message: wait });

    const prevTop = db.best[game][0];
    const r = put(board(mode, game, day), name, score);
    if (mode === 'best') { /* ผลรายวันนับเป็นสถิติรวมด้วย */ }
    else put(db.best[game], name, score);
    pruneDaily();
    dirty = true;

    // ทำลายสถิติสูงสุดของกลุ่ม -> แจ้ง Discord (ถ้าตั้ง webhook ไว้)
    const top = db.best[game][0];
    const record = !!top && top.name.toLowerCase() === name.toLowerCase() && top.score === score && (!prevTop || score > prevTop.score);
    if (record && typeof sendWebhook === 'function') {
      const title = game === 'dash' ? 'Creeper Dash' : 'Whack-a-Mole';
      try { sendWebhook({ content: `🏆 **${name}** ทำลายสถิติกลุ่มใน ${title}: **${score}** แต้ม` }); } catch (_) { /* ไม่ให้กระทบการบันทึก */ }
    }
    res.json({ ok: true, rank: r.rank, improved: r.improved, record });
  });

  /* ---------- แอดมิน: ลบคะแนนที่น่าสงสัย ---------- */
  app.post('/api/admin/games/remove', adminAuth, (req, res) => {
    const b = req.body || {};
    if (!GAMES[b.game]) return res.status(400).json({ ok: false, message: 'ไม่รู้จักเกมนี้' });
    const day = today();
    const name = String(b.name || '').toLowerCase();
    let n = 0;
    const lists = [db.best[b.game]];
    for (const d of Object.values(db.daily)) if (d[b.game]) lists.push(d[b.game]);
    for (const l of lists) {
      for (let i = l.length - 1; i >= 0; i--) if (l[i].name.toLowerCase() === name) { l.splice(i, 1); n++; }
    }
    dirty = true;
    res.json({ ok: true, removed: n, day });
  });

  return { enabled: true };
};
