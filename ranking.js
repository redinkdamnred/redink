'use strict';
/* ---------------------------------------------------------------
 * อันดับผู้เล่น: ขุดแร่ / ขุดบล็อกรวม / ฆ่ามอนสเตอร์ / เวลาเล่น / ตายมากสุด / เดินทางไกลสุด (แยกไฟล์ เพื่ออัปเดตง่าย)
 *
 * ข้อมูลมาจากไฟล์สถิติที่ Minecraft เก็บเอง: <โลก>/stats/<uuid>.json
 * และ usercache.json (แปลง uuid เป็นชื่อ) ดึงมาได้ 2 ทาง
 *   1) SFTP (ใช้ข้อมูลจากหน้า SFTP Connection Info ของแผงควบคุมเซิร์ฟ)
 *        SFTP_HOST, SFTP_PORT (ค่าเริ่มต้น 2022), SFTP_USER, SFTP_PASSWORD
 *   2) โฟลเดอร์ในเครื่อง  STATS_LOCAL_DIR=<โฟลเดอร์ที่มี world/stats และ usercache.json>
 * ตัวเลือกอื่น:
 *   STATS_WORLD_DIR=world        ชื่อโฟลเดอร์โลก (level-name ใน server.properties)
 *   SFTP_BASE_DIR=/              โฟลเดอร์รากของเซิร์ฟบน SFTP
 *   STATS_SYNC_MINUTES=10        ดึงข้อมูลใหม่ทุกกี่นาที (2-1440)
 *   STATS_EXTRA_ORES=a:b,c:d     id บล็อกแร่ของม็อดที่ชื่อไม่ลงท้าย _ore (คั่นด้วยจุลภาค)
 * ไม่ตั้งค่าอะไรเลย = ปิดระบบอันดับ
 * ------------------------------------------------------------- */
const fs = require('fs');
const path = require('path');

module.exports = function setupRanking({ app, DATA_DIR, adminAuth }) {
  const env = process.env;
  const localDir = env.STATS_LOCAL_DIR || '';
  const sftp = {
    host: env.SFTP_HOST || '',
    port: parseInt(env.SFTP_PORT || '2022', 10) || 2022,
    username: env.SFTP_USER || '',
    password: env.SFTP_PASSWORD || '',
  };
  const mode = localDir ? 'local' : sftp.host && sftp.username && sftp.password ? 'sftp' : '';

  if (!mode) {
    app.get('/api/ranking', (req, res) => res.json({ enabled: false }));
    app.get('/api/admin/ranking', adminAuth, (req, res) => res.json({ ok: true, enabled: false }));
    return { enabled: false };
  }

  const worldDir = (env.STATS_WORLD_DIR || 'world').replace(/^\/+|\/+$/g, '');
  const baseDir = env.SFTP_BASE_DIR || '/';
  const minutes = Math.min(1440, Math.max(2, parseInt(env.STATS_SYNC_MINUTES || '10', 10) || 10));
  const extraOres = new Set((env.STATS_EXTRA_ORES || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean));
  const UUID_JSON = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\.json$/i;
  const MAX_PLAYERS = 500, MAX_FILE = 5 * 1024 * 1024;

  /* ---------- ตัวอ่านไฟล์ (SFTP / ในเครื่อง ใช้รูปแบบเดียวกัน) ---------- */
  function localReader(root) {
    return {
      list: async (d) => (await fs.promises.readdir(path.join(root, d), { withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name),
      read: (f) => fs.promises.readFile(path.join(root, f)),
      close: async () => {},
    };
  }
  async function sftpReader() {
    let Client;
    try { Client = require('ssh2-sftp-client'); } catch (_) {
      throw new Error('ยังไม่ได้ติดตั้งแพ็กเกจ ssh2-sftp-client (รัน npm install หรือ build Docker ใหม่)');
    }
    const c = new Client();
    await c.connect({ host: sftp.host, port: sftp.port, username: sftp.username, password: sftp.password, readyTimeout: 15000 });
    const abs = (p) => path.posix.join(baseDir, p);
    return {
      list: async (d) => (await c.list(abs(d))).filter((i) => i.type === '-').map((i) => i.name),
      read: async (f) => { const b = await c.get(abs(f)); return Buffer.isBuffer(b) ? b : Buffer.from(b); },
      close: () => c.end(),
    };
  }
  const openReader = () => (mode === 'local' ? Promise.resolve(localReader(localDir)) : sftpReader());

  /* ---------- สรุปสถิติของผู้เล่น 1 คน ---------- */
  const TRAVEL = ['walk', 'sprint', 'crouch', 'swim', 'walk_on_water', 'walk_under_water', 'fly', 'aviate', 'boat', 'horse', 'pig', 'strider', 'minecart'];
  const isOre = (id) => /_ore$/.test(id) || /:ancient_debris$/.test(id) || extraOres.has(id);
  const sum = (o) => Object.values(o || {}).reduce((a, n) => a + (Number(n) || 0), 0);
  function summarize(json) {
    const st = (json && json.stats) || {};
    const mined = st['minecraft:mined'] || {};
    let ores = 0, blocks = 0;
    for (const [id, n] of Object.entries(mined)) {
      const c = Number(n) || 0;
      blocks += c; // นับทุกบล็อกที่ขุด
      if (isOre(String(id).toLowerCase())) ores += c;
    }
    const custom = st['minecraft:custom'] || {};
    const mobs = custom['minecraft:mob_kills'] != null ? Number(custom['minecraft:mob_kills']) || 0 : sum(st['minecraft:killed']);
    const ticks = Number(custom['minecraft:play_time'] != null ? custom['minecraft:play_time'] : custom['minecraft:play_one_minute']) || 0;
    // ระยะเดินทาง (เซนติเมตร -> กม.) รวมทุกวิธี ยกเว้นตกจากที่สูงและปีนป่าย
    let cm = 0;
    for (const k of TRAVEL) cm += Number(custom[`minecraft:${k}_one_cm`]) || 0;
    return {
      o: ores, b: blocks, m: mobs, h: Math.round((ticks / 72000) * 10) / 10,
      d: Number(custom['minecraft:deaths']) || 0,
      k: Math.round((cm / 100000) * 10) / 10,
    };
  }

  /* ---------- เก็บผล ---------- */
  const FILE = path.join(DATA_DIR, 'ranking.json');
  let data = { updatedAt: 0, players: [] };
  try {
    const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (j && Array.isArray(j.players)) data = { updatedAt: j.updatedAt || 0, players: j.players };
  } catch (_) { /* ยังไม่เคยซิงก์ */ }
  let status = { ok: null, error: '', t: 0, files: 0 };
  let running = false;

  async function sync() {
    if (running) return status;
    running = true;
    let reader;
    try {
      reader = await openReader();
      const names = (await reader.list(`${worldDir}/stats`)).filter((n) => UUID_JSON.test(n)).slice(0, MAX_PLAYERS);
      if (!names.length) throw new Error(`ไม่พบไฟล์สถิติใน ${worldDir}/stats (เช็กชื่อโฟลเดอร์โลกที่ STATS_WORLD_DIR)`);

      // uuid -> ชื่อ (ถ้าอ่านไม่ได้ก็ไม่เป็นไร จะแสดงรหัสสั้น ๆ แทน)
      const nameOf = {};
      try {
        const uc = JSON.parse((await reader.read('usercache.json')).toString('utf8'));
        if (Array.isArray(uc)) for (const e of uc) if (e && e.uuid && e.name) nameOf[String(e.uuid).replace(/-/g, '').toLowerCase()] = String(e.name).slice(0, 32);
      } catch (_) { /* ไม่มี usercache */ }

      const players = [];
      let bad = 0;
      for (let i = 0; i < names.length; i += 5) {
        await Promise.all(names.slice(i, i + 5).map(async (f) => {
          try {
            const buf = await reader.read(`${worldDir}/stats/${f}`);
            if (buf.length > MAX_FILE) throw new Error('ไฟล์ใหญ่ผิดปกติ');
            const id = f.replace(/\.json$/i, '').replace(/-/g, '').toLowerCase();
            players.push({ n: nameOf[id] || `ผู้เล่น ${id.slice(0, 4)}`, known: !!nameOf[id], ...summarize(JSON.parse(buf.toString('utf8'))) });
          } catch (_) { bad++; }
        }));
      }
      if (!players.length) throw new Error('อ่านไฟล์สถิติไม่สำเร็จเลย (รูปแบบไฟล์ผิดปกติ)');

      data = { updatedAt: Date.now(), players };
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(FILE + '.tmp', JSON.stringify(data));
      fs.renameSync(FILE + '.tmp', FILE);
      status = { ok: true, error: '', t: Date.now(), files: names.length, skipped: bad };
    } catch (e) {
      status = { ok: false, error: String((e && e.message) || e).slice(0, 300), t: Date.now(), files: 0 };
      console.error('ranking sync error:', status.error);
    } finally {
      try { if (reader) await reader.close(); } catch (_) { /* ignore */ }
      running = false;
    }
    return status;
  }
  setTimeout(sync, 5000).unref();
  setInterval(sync, minutes * 60 * 1000).unref();

  /* ---------- เส้นทาง ---------- */
  app.get('/api/ranking', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      enabled: true,
      updatedAt: data.updatedAt,
      players: data.players.map((p) => ({ n: p.n, known: p.known !== false, o: p.o, b: p.b || 0, m: p.m, h: p.h, d: p.d, k: p.k || 0 })),
    });
  });
  const adminInfo = () => ({ ok: true, enabled: true, mode, minutes, updatedAt: data.updatedAt, players: data.players.length, status, running });
  app.get('/api/admin/ranking', adminAuth, (req, res) => res.json(adminInfo()));
  app.post('/api/admin/ranking/sync', adminAuth, async (req, res) => {
    await sync();
    res.json(adminInfo());
  });

  console.log(`อันดับผู้เล่น: เปิด (แหล่งข้อมูล: ${mode === 'sftp' ? `SFTP ${sftp.host}:${sftp.port}` : `โฟลเดอร์ ${localDir}`}) ดึงใหม่ทุก ${minutes} นาที`);
  return { enabled: true };
};
