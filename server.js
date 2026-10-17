'use strict';
require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const dns = require('dns').promises;
const mc = require('minecraft-server-util'); // ใช้เฉพาะ Bedrock

/* ---------------------------------------------------------------
 * ตั้งค่า (อ่านจาก .env)
 * ------------------------------------------------------------- */
const env = process.env;
const type = (env.MC_TYPE || 'java').toLowerCase() === 'bedrock' ? 'bedrock' : 'java';
const cfg = {
  host: env.MC_HOST || 'localhost',
  port: parseInt(env.MC_PORT || (type === 'bedrock' ? '19132' : '25565'), 10),
  type,
  name: env.SERVER_NAME || 'Minecraft Server',
  address: env.PUBLIC_ADDRESS || '',
  webPort: parseInt(env.PORT || '3000', 10),
  pollMs: Math.max(10, parseInt(env.POLL_SECONDS || '30', 10)) * 1000,
  invite: env.DISCORD_INVITE || '',
  webhook: env.DISCORD_WEBHOOK_URL || '',
  notifyRole: (env.DISCORD_NOTIFY_ROLE_ID || '').replace(/\D/g, ''),
  adminUser: (env.DISCORD_ADMIN_USER_ID || '').replace(/\D/g, ''),
  notifyPlayers: String(env.NOTIFY_PLAYERS || 'false').toLowerCase() === 'true',
  notifySkin: String(env.NOTIFY_SKIN || 'true').toLowerCase() !== 'false',
  botToken: env.DISCORD_BOT_TOKEN || '',
  adminPassword: env.ADMIN_PASSWORD || '',
  publicUrl: (env.PUBLIC_URL || '').replace(/\/+$/, ''),
};
if (!cfg.address) cfg.address = cfg.port === (type === 'bedrock' ? 19132 : 25565) ? cfg.host : `${cfg.host}:${cfg.port}`;

const BUCKET_MS = 30 * 60 * 1000; // 30 นาที ต่อ 1 ช่อง
const BUCKETS = 48; // ย้อนหลัง 24 ชม.

/* ---------------------------------------------------------------
 * สถานะ (เก็บลงไฟล์ให้รีสตาร์ทแล้วประวัติไม่หาย)
 * ------------------------------------------------------------- */
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

let state = {
  online: null, // true | false | null (ยังไม่รู้)
  since: Date.now(),
  players: { online: 0, max: 0, names: [] },
  version: '',
  motd: '',
  latency: null,
  lastChecked: null,
  fails: 0,
  buckets: {}, // { [bucketIndex]: { u: ครั้งที่ออนไลน์, n: ครั้งที่เช็คทั้งหมด, m: ผู้เล่นสูงสุดในช่วงนี้ } }
  peak: { n: 0, t: null }, // ผู้เล่นสูงสุดตลอดกาล
  requests: [], // [{ t, h }] คำขอให้เปิดเซิร์ฟ (h = แฮชของ IP ไม่เก็บ IP จริง)
  lastRequestPing: 0,
};
try {
  Object.assign(state, JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')));
} catch (_) { /* ครั้งแรกยังไม่มีไฟล์ */ }

let dirty = false;
function save() {
  if (!dirty) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE + '.tmp', JSON.stringify(state));
    fs.renameSync(STATE_FILE + '.tmp', STATE_FILE);
    dirty = false;
  } catch (e) {
    console.error('save error:', e.message);
  }
}
setInterval(save, 60 * 1000);
process.on('SIGINT', () => { save(); process.exit(0); });
process.on('SIGTERM', () => { save(); process.exit(0); });

/* ---------------------------------------------------------------
 * เช็คสถานะเซิร์ฟจริง (Server List Ping)
 * Java: ใช้ตัวเช็คของเราเอง ส่งแค่ handshake + status request แล้วอ่านคำตอบ
 *       ไม่ทำขั้น "ping/pong" เพราะบางเซิร์ฟ/proxy ตอบขั้นนั้นผิดรูปแบบ
 *       (เช่น error "Expected server to send packet type 0x01, received 26")
 * ------------------------------------------------------------- */
function writeVarInt(n) {
  const out = [];
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return Buffer.from(out);
}
function readVarInt(buf, offset) {
  let result = 0, shift = 0, i = offset;
  for (;;) {
    if (i >= buf.length) return null; // ข้อมูลยังมาไม่ครบ
    const b = buf[i++];
    result |= (b & 0x7f) << shift;
    if (!(b & 0x80)) break;
    shift += 7;
    if (shift > 35) throw new Error('VarInt ยาวผิดปกติ');
  }
  return { value: result, next: i };
}
function packet(id, payload) {
  const body = Buffer.concat([writeVarInt(id), payload || Buffer.alloc(0)]);
  return Buffer.concat([writeVarInt(body.length), body]);
}
// แปลงข้อความ MOTD (string หรือ object แบบ chat component) เป็นข้อความธรรมดา
function motdText(d) {
  if (d == null) return '';
  if (typeof d === 'string') return d.replace(/§./g, '');
  let t = typeof d.text === 'string' ? d.text : '';
  if (Array.isArray(d.extra)) t += d.extra.map(motdText).join('');
  return t.replace(/§./g, '');
}

async function resolveTarget(host, port) {
  // โดเมนที่ใช้พอร์ตมาตรฐาน อาจมี SRV record ชี้ไปที่อื่น
  if (net.isIP(host) === 0 && port === 25565) {
    try {
      const recs = await dns.resolveSrv('_minecraft._tcp.' + host);
      if (recs && recs.length) return { host: recs[0].name, port: recs[0].port, sni: host };
    } catch (_) { /* ไม่มี SRV ก็ไม่เป็นไร */ }
  }
  return { host, port, sni: host };
}

function javaStatus(host, port, timeoutMs) {
  return new Promise(async (resolve, reject) => {
    let target;
    try { target = await resolveTarget(host, port); } catch (e) { return reject(e); }

    const sock = net.connect({ host: target.host, port: target.port });
    let buf = Buffer.alloc(0);
    let t0 = 0;
    let settled = false;
    const finish = (err, val) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sock.destroy();
      err ? reject(err) : resolve(val);
    };
    const timer = setTimeout(() => finish(new Error('หมดเวลา: เซิร์ฟไม่ตอบ (timeout)')), timeoutMs);

    sock.on('error', (e) => finish(e));
    sock.on('close', () => finish(new Error('เซิร์ฟตัดการเชื่อมต่อก่อนส่งสถานะ')));
    sock.on('connect', () => {
      const hostBuf = Buffer.from(target.sni, 'utf8');
      const portBuf = Buffer.alloc(2);
      portBuf.writeUInt16BE(target.port);
      const handshake = packet(0x00, Buffer.concat([
        writeVarInt(767), writeVarInt(hostBuf.length), hostBuf, portBuf, writeVarInt(1),
      ]));
      t0 = Date.now();
      sock.write(Buffer.concat([handshake, packet(0x00)]));
    });
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      try {
        const len = readVarInt(buf, 0);
        if (!len) return;
        if (buf.length < len.next + len.value) return; // ยังรับไม่ครบ (favicon อาจใหญ่)
        const id = readVarInt(buf, len.next);
        if (!id) return;
        if (id.value !== 0x00) return finish(new Error('เซิร์ฟตอบ packet ผิดประเภท: ' + id.value));
        const sl = readVarInt(buf, id.next);
        if (!sl) return;
        const json = buf.slice(sl.next, sl.next + sl.value).toString('utf8');
        const r = JSON.parse(json);
        finish(null, { data: r, latency: Date.now() - t0 });
      } catch (e) {
        finish(e);
      }
    });
  });
}

async function check() {
  const t0 = Date.now();
  try {
    if (cfg.type === 'bedrock') {
      const r = await mc.statusBedrock(cfg.host, cfg.port, { timeout: 5000 });
      return {
        online: true,
        players: { online: r.players.online, max: r.players.max, names: [] },
        version: r.version && r.version.name ? r.version.name : '',
        motd: r.motd && r.motd.clean ? r.motd.clean : '',
        latency: Date.now() - t0,
      };
    }
    const { data, latency } = await javaStatus(cfg.host, cfg.port, 6000);
    const pl = data.players || {};
    // ผู้เล่นที่ปิด "Allow Server Listings" ในเกม เซิร์ฟจะส่งมาเป็น "Anonymous Player" (uuid ศูนย์ทั้งหมด)
    // ตัดออกจากรายชื่อ เพื่อไม่ให้ระบบเข้าใจผิดว่ามีคนออก/เข้า (ถ้ารายชื่อไม่ครบ ระบบจะแจ้งแค่จำนวนคนเอง)
    const NIL_UUID = '00000000-0000-0000-0000-000000000000';
    const names = (pl.sample || [])
      .filter((p) => p && p.name && p.name !== 'Anonymous Player' && p.id !== NIL_UUID)
      .map((p) => p.name);
    return {
      online: true,
      players: { online: pl.online || 0, max: pl.max || 0, names },
      version: data.version && data.version.name ? String(data.version.name).replace(/§./g, '') : '',
      motd: motdText(data.description),
      latency,
    };
  } catch (e) {
    return { online: false, error: e.message };
  }
}

function recordBucket(up, playersOnline) {
  const idx = Math.floor(Date.now() / BUCKET_MS);
  const b = state.buckets[idx] || { u: 0, n: 0 };
  b.n += 1;
  if (up) {
    b.u += 1;
    b.m = Math.max(b.m || 0, playersOnline || 0);
  }
  state.buckets[idx] = b;
  for (const k of Object.keys(state.buckets)) {
    if (+k < idx - BUCKETS) delete state.buckets[k];
  }
}

let firstPoll = true; // รอบแรกหลังเปิดเว็บใช้เป็นฐานเทียบ ไม่แจ้งเตือน (กันแจ้งผิดจากข้อมูลเก่าในไฟล์)
const dcEsc = (x) => String(x).replace(/([\\_*~`|>])/g, '\\$1'); // ชื่อผู้เล่นมี _ บ่อย กัน Discord จัดเป็นตัวเอียง
async function poll() {
  const res = await check();
  const prev = state.online;
  const prevNames = new Set(state.players.names);
  const prevCount = state.players.online || 0;

  state.lastChecked = Date.now();
  recordBucket(res.online, res.online ? res.players.online : 0);

  if (res.online) {
    state.fails = 0;
    state.lastError = '';
    state.players = res.players;
    state.version = res.version;
    state.motd = res.motd;
    state.latency = res.latency;
    if (res.players.online > ((state.peak && state.peak.n) || 0)) {
      state.peak = { n: res.players.online, t: Date.now() };
    }
    if (prev !== true) {
      state.online = true;
      state.since = Date.now();
      state.requests = [];
      if (prev === false) notifyState(true);
    } else if (cfg.notifyPlayers && !firstPoll) {
      const names = res.players.names;
      const total = `(${res.players.online}/${res.players.max || '?'})`;
      // เซิร์ฟ Java ส่งรายชื่อมาแค่ "ตัวอย่าง" (มักไม่เกิน 12 คน หรือซ่อนทั้งหมด)
      // ถ้ารายชื่อครบทั้งรอบนี้และรอบก่อน เทียบรายชื่อได้ ไม่ครบก็แจ้งแค่จำนวนที่เปลี่ยน
      const complete = names.length >= res.players.online && prevNames.size >= prevCount;
      if (complete) {
        const now = new Set(names);
        const joined = [...now].filter((n) => !prevNames.has(n));
        const left = [...prevNames].filter((n) => !now.has(n));
        if (cfg.notifySkin) {
          // การ์ดต่อคน พร้อมหัวสกิน (Discord รับได้สูงสุด 10 การ์ดต่อข้อความ)
          const card = (n, isJoin) => ({
            author: { name: `${n} ${isJoin ? 'เข้าเกม' : 'ออกจากเกม'}`, icon_url: `https://mc-heads.net/avatar/${encodeURIComponent(n)}/64` },
            color: isJoin ? 0x3ed48a : 0x8b8794,
            footer: { text: `ผู้เล่น ${total}` },
          });
          const cards = [...joined.map((n) => card(n, true)), ...left.map((n) => card(n, false))];
          for (let i = 0; i < cards.length; i += 10) sendWebhook({ embeds: cards.slice(i, i + 10), allowed_mentions: { parse: [] } });
        } else {
          if (joined.length) sendWebhook({ content: `🟢 ${joined.map(dcEsc).join(', ')} เข้าเกม ${total}`, allowed_mentions: { parse: [] } });
          if (left.length) sendWebhook({ content: `⚪ ${left.map(dcEsc).join(', ')} ออกจากเกม ${total}`, allowed_mentions: { parse: [] } });
        }
      } else if (res.players.online !== prevCount) {
        const up = res.players.online > prevCount;
        sendWebhook({ content: `${up ? '🟢 มีผู้เล่นเข้าเกม' : '⚪ มีผู้เล่นออกจากเกม'} ${total}`, allowed_mentions: { parse: [] } });
      }
    }
  } else {
    state.fails += 1;
    if (res.error && res.error !== state.lastError) { console.log('เช็คเซิร์ฟไม่ติด:', res.error); }
    state.lastError = res.error || '';
    state.latency = null;
    // กันสถานะกระพริบ: ต้องเช็คไม่ติด 2 ครั้งติดกันถึงจะถือว่าปิด
    if (state.fails >= 2 && prev !== false) {
      state.online = false;
      state.since = Date.now();
      state.players = { online: 0, max: state.players.max, names: [] };
      if (prev === true) notifyState(false);
    }
  }
  dirty = true;
  firstPoll = false;
  updateBotPresence();
}

(function loop() {
  poll()
    .catch((e) => console.error('poll error:', e.message))
    .finally(() => setTimeout(loop, cfg.pollMs));
})();

/* ---------------------------------------------------------------
 * ข้อมูลสาธารณะ
 * ------------------------------------------------------------- */
function uptimeInfo() {
  const idx = Math.floor(Date.now() / BUCKET_MS);
  const slots = [];
  let u = 0, n = 0, peak24 = 0;
  for (let i = BUCKETS - 1; i >= 0; i--) {
    const k = idx - i;
    const b = state.buckets[k];
    const m = b && b.u > 0 ? (b.m || 0) : null; // ผู้เล่นสูงสุดในช่วงนั้น (null = ไม่มีข้อมูลตอนเปิด)
    slots.push({ t: k * BUCKET_MS, r: b ? b.u / b.n : null, m });
    if (b) { u += b.u; n += b.n; }
    if (m != null && m > peak24) peak24 = m;
  }
  return { slots, pct: n ? Math.round((u / n) * 1000) / 10 : null, peak24 };
}

function recentRequests() {
  const cut = Date.now() - 24 * 3600 * 1000;
  state.requests = state.requests.filter((r) => r.t > cut);
  return state.requests;
}

function publicStatus() {
  const up = uptimeInfo();
  return {
    online: state.online,
    since: state.since,
    players: state.players,
    version: state.version,
    motd: state.motd,
    latency: state.latency,
    lastChecked: state.lastChecked,
    uptime: up,
    peak: state.peak && state.peak.n ? state.peak : null,
    requests: recentRequests().length,
  };
}

/* ---------------------------------------------------------------
 * Discord: webhook
 * ------------------------------------------------------------- */
async function sendWebhook(body) {
  if (!cfg.webhook) return;
  try {
    const r = await fetch(cfg.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) console.error('webhook status', r.status);
  } catch (e) {
    console.error('webhook error:', e.message);
  }
}

function statusEmbed() {
  const online = state.online === true;
  const fields = [];
  if (online) {
    fields.push({ name: 'ผู้เล่น', value: `${state.players.online}/${state.players.max}` + (state.players.names.length ? `\n${state.players.names.join(', ')}` : ''), inline: true });
    if (state.version) fields.push({ name: 'เวอร์ชัน', value: state.version, inline: true });
    if (state.latency != null) fields.push({ name: 'Ping', value: `${state.latency} ms`, inline: true });
  }
  fields.push({ name: 'ที่อยู่', value: '`' + cfg.address + '`', inline: false });
  return {
    title: `${cfg.name}: ${state.online === null ? 'กำลังตรวจสอบ' : online ? '🟢 เปิดอยู่' : '🔴 ปิดอยู่'}`,
    description: online && state.motd ? state.motd : undefined,
    color: state.online === null ? 0x8b8794 : online ? 0x3ed48a : 0xef5a48,
    fields,
    timestamp: new Date().toISOString(),
  };
}

function notifyState(online) {
  const role = cfg.notifyRole ? `<@&${cfg.notifyRole}> ` : '';
  const text = online ? 'เซิร์ฟเปิดแล้ว เข้ามาเล่นกันได้เลย!' : 'เซิร์ฟปิดแล้ว';
  sendWebhook({
    content: role + text,
    embeds: [statusEmbed()],
    allowed_mentions: { parse: [], roles: cfg.notifyRole ? [cfg.notifyRole] : [] },
  });
}

/* ---------------------------------------------------------------
 * ตั้งค่าที่แก้ผ่านหน้าแอดมินได้ (ตารางเวลา + ประกาศ)
 * เก็บใน data/settings.json ถ้าไม่มีจะใช้ schedule.json เป็นค่าตั้งต้น
 * ------------------------------------------------------------- */
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DAY_NAMES = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

let fileSchedule = { days: {} };
try { fileSchedule = JSON.parse(fs.readFileSync(path.join(__dirname, 'schedule.json'), 'utf8')); } catch (_) { /* ไม่มีก็ได้ */ }
let settings = { days: null, announcement: '' };
try {
  const j = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  if (j && typeof j === 'object') settings = { days: j.days && typeof j.days === 'object' ? j.days : null, announcement: String(j.announcement || '') };
} catch (_) { /* ยังไม่เคยตั้งค่า */ }

function currentSchedule() {
  return settings.days ? { days: settings.days } : fileSchedule;
}
function saveSettings() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE + '.tmp', JSON.stringify(settings, null, 2));
  fs.renameSync(SETTINGS_FILE + '.tmp', SETTINGS_FILE);
}
function todayThai() {
  return ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][new Date(Date.now() + 7 * 3600000).getUTCDay()];
}

/* ---------------------------------------------------------------
 * ขอให้เปิดเซิร์ฟ (ใช้ร่วมกันระหว่างเว็บและคำสั่งบอท /request)
 * key = ตัวระบุคนขอ (IP หรือ Discord user id) เก็บเป็นแฮช ไม่เก็บค่าจริง
 * ------------------------------------------------------------- */
function handleRequestOpen(key) {
  if (state.online === true) return { code: 409, body: { ok: false, message: 'เซิร์ฟเปิดอยู่แล้ว' } };
  if (!cfg.webhook) return { code: 501, body: { ok: false, message: 'ยังไม่ได้เชื่อม Discord' } };

  const h = crypto.createHash('sha256').update(String(key) + 'mc-salt').digest('hex').slice(0, 12);
  const reqs = recentRequests();
  const mine = reqs.find((r) => r.h === h && Date.now() - r.t < 20 * 60 * 1000);
  if (mine) return { code: 429, body: { ok: false, message: 'คุณเพิ่งขอไปแล้ว รอสักครู่นะ', count: reqs.length } };

  reqs.push({ t: Date.now(), h });
  dirty = true;

  // ส่งเข้า Discord อย่างมาก 1 ครั้งต่อ 5 นาที
  if (Date.now() - state.lastRequestPing > 5 * 60 * 1000) {
    state.lastRequestPing = Date.now();
    const mention = cfg.adminUser ? `<@${cfg.adminUser}> ` : '';
    sendWebhook({
      content: `${mention}มีเพื่อนอยากให้เปิดเซิร์ฟ (${reqs.length} คนใน 24 ชม.ที่ผ่านมา)`,
      allowed_mentions: { parse: [], users: cfg.adminUser ? [cfg.adminUser] : [] },
    });
  }
  return { code: 200, body: { ok: true, count: reqs.length } };
}

/* ---------------------------------------------------------------
 * ข้อมูลเซิร์ฟ Discord (จำนวนคนออนไลน์) ดึงจากลิงก์เชิญ ไม่ต้องเปิด widget
 * ------------------------------------------------------------- */
const inviteCode = (cfg.invite.match(/(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)([\w-]+)/i) || [])[1] || '';
let dcCache = { t: 0, data: {} };
async function discordInfo() {
  if (!inviteCode) return {};
  if (Date.now() - dcCache.t < 2 * 60 * 1000) return dcCache.data;
  dcCache.t = Date.now(); // กันยิงซ้ำถ้าพลาด (ลองใหม่ในอีก 2 นาที)
  try {
    const r = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(inviteCode)}?with_counts=true`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error('status ' + r.status);
    const j = await r.json();
    dcCache.data = {
      name: j.guild && j.guild.name ? j.guild.name : '',
      online: typeof j.approximate_presence_count === 'number' ? j.approximate_presence_count : null,
      members: typeof j.approximate_member_count === 'number' ? j.approximate_member_count : null,
    };
  } catch (e) {
    console.error('discord info error:', e.message);
  }
  return dcCache.data;
}

/* ---------------------------------------------------------------
 * Discord: บอท (คำสั่ง /status /players /schedule /request และสถานะบอท)
 * ------------------------------------------------------------- */
function playersEmbed() {
  const online = state.online === true;
  const names = state.players.names || [];
  let desc;
  if (!online) desc = 'เซิร์ฟปิดอยู่';
  else if (names.length) {
    desc = names.map((n) => '• ' + n.replace(/([\\*_`~|>])/g, '\\$1')).join('\n');
    const rest = state.players.online - names.length;
    if (rest > 0) desc += `\nและอีก ${rest} คน`;
  } else if (state.players.online === 0) desc = 'ยังไม่มีใครในเซิร์ฟ';
  else desc = `มีผู้เล่น ${state.players.online} คน (เซิร์ฟไม่ส่งรายชื่อ)`;
  return {
    title: online ? `ผู้เล่นออนไลน์ ${state.players.online}/${state.players.max}` : `${cfg.name}: 🔴 ปิดอยู่`,
    description: desc,
    color: online ? 0x3ed48a : 0xef5a48,
    timestamp: new Date().toISOString(),
  };
}
function scheduleEmbed() {
  const days = currentSchedule().days || {};
  const today = todayThai();
  const lines = DAY_NAMES.filter((d) => days[d]).map((d) => (d === today ? `**วัน${d} (วันนี้): ${days[d]}**` : `วัน${d}: ${days[d]}`));
  return {
    title: 'ช่วงเวลาที่มักเปิด (เวลาไทย)',
    description: lines.length ? lines.join('\n') : 'ยังไม่ได้ตั้งตารางเวลา',
    color: 0x2f6fdb,
  };
}

let bot = null;
function startBot() {
  if (!cfg.botToken) return;
  let D;
  try { D = require('discord.js'); } catch (e) { console.error('ไม่พบ discord.js:', e.message); return; }
  bot = new D.Client({ intents: [D.GatewayIntentBits.Guilds] });
  bot.once(D.Events.ClientReady, async () => {
    console.log(`Discord bot พร้อมแล้ว: ${bot.user.tag}`);
    try {
      await bot.application.commands.set([
        { name: 'status', description: 'ดูสถานะเซิร์ฟมายคราฟตอนนี้' },
        { name: 'players', description: 'ดูรายชื่อผู้เล่นที่กำลังเล่นอยู่' },
        { name: 'schedule', description: 'ดูช่วงเวลาที่เซิร์ฟมักเปิด' },
        { name: 'request', description: 'ขอให้แอดมินเปิดเซิร์ฟ (ตอนเซิร์ฟปิดอยู่)' },
      ]);
    } catch (e) { console.error('register command error:', e.message); }
    updateBotPresence();
  });
  bot.on(D.Events.InteractionCreate, async (i) => {
    if (!i.isChatInputCommand()) return;
    try {
      if (i.commandName === 'status') await i.reply({ embeds: [statusEmbed()] });
      else if (i.commandName === 'players') await i.reply({ embeds: [playersEmbed()] });
      else if (i.commandName === 'schedule') await i.reply({ embeds: [scheduleEmbed()] });
      else if (i.commandName === 'request') {
        const r = handleRequestOpen('discord:' + i.user.id);
        const msg = r.body.ok ? `ส่งคำขอให้แอดมินแล้ว (${r.body.count} คนใน 24 ชม.ที่ผ่านมา)` : r.body.message;
        await i.reply({ content: msg, flags: D.MessageFlags.Ephemeral });
      }
    } catch (e) { console.error('interaction error:', e.message); }
  });
  bot.login(cfg.botToken).catch((e) => { console.error('Discord login ล้มเหลว:', e.message); bot = null; });
}
let lastPresence = '';
function updateBotPresence() {
  if (!bot || !bot.user) return;
  const text = state.online === true ? `${state.players.online}/${state.players.max} คนกำลังเล่น` : state.online === false ? 'เซิร์ฟปิดอยู่' : 'กำลังตรวจสอบ';
  if (text === lastPresence) return;
  lastPresence = text;
  try { bot.user.setActivity(text); } catch (_) { /* ไม่เป็นไร */ }
}
startBot();

/* ---------------------------------------------------------------
 * เว็บ + API
 * ------------------------------------------------------------- */
const app = express();
if (env.TRUST_PROXY && env.TRUST_PROXY !== '0') app.set('trust proxy', parseInt(env.TRUST_PROXY, 10) || 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '8kb' }));

app.get('/api/config', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    name: cfg.name,
    address: cfg.address,
    type: cfg.type,
    invite: cfg.invite,
    schedule: currentSchedule(),
    announcement: settings.announcement,
    canRequest: !!cfg.webhook,
  });
});

app.get('/api/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(publicStatus());
});

app.get('/api/discord', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await discordInfo());
});

app.get('/healthz', (req, res) => res.send('ok'));

// เพื่อนกด "ขอให้เปิดเซิร์ฟ" -> ส่งแท็กแอดมินใน Discord (จำกัดอัตรา กันสแปม)
app.post('/api/request-open', (req, res) => {
  const r = handleRequestOpen(req.ip);
  res.status(r.code).json(r.body);
});

/* ---------------------------------------------------------------
 * หน้าแอดมิน (ต้องตั้ง ADMIN_PASSWORD ใน .env ไม่ตั้ง = ปิดหน้านี้)
 * ------------------------------------------------------------- */
const sha = (x) => crypto.createHash('sha256').update(String(x)).digest();
const adminFails = new Map(); // ip -> { n, t }
function adminAuth(req, res, next) {
  res.set('Cache-Control', 'no-store');
  if (!cfg.adminPassword) return res.status(501).json({ ok: false, message: 'ยังไม่ได้ตั้ง ADMIN_PASSWORD ในไฟล์ .env' });
  const now = Date.now();
  for (const [k, v] of adminFails) if (now - v.t > 10 * 60 * 1000) adminFails.delete(k);
  const f = adminFails.get(req.ip);
  if (f && f.n >= 5) return res.status(429).json({ ok: false, message: 'ใส่รหัสผิดหลายครั้ง รอ 10 นาทีแล้วลองใหม่' });
  const given = String(req.get('x-admin-password') || '');
  if (!crypto.timingSafeEqual(sha(given), sha(cfg.adminPassword))) {
    adminFails.set(req.ip, { n: (f ? f.n : 0) + 1, t: now });
    return res.status(401).json({ ok: false, message: 'รหัสผ่านไม่ถูกต้อง' });
  }
  adminFails.delete(req.ip);
  next();
}
app.get('/api/admin/settings', adminAuth, (req, res) => {
  res.json({ ok: true, days: currentSchedule().days || {}, announcement: settings.announcement, dayNames: DAY_NAMES });
});
app.put('/api/admin/settings', adminAuth, (req, res) => {
  const b = req.body || {};
  const days = {};
  if (b.days && typeof b.days === 'object') {
    for (const d of DAY_NAMES) {
      const v = typeof b.days[d] === 'string' ? b.days[d].trim() : '';
      if (v.length > 40) return res.status(400).json({ ok: false, message: `ข้อความของวัน${d}ยาวเกิน 40 ตัวอักษร` });
      if (v) days[d] = v;
    }
  }
  const announcement = typeof b.announcement === 'string' ? b.announcement.trim() : '';
  if (announcement.length > 300) return res.status(400).json({ ok: false, message: 'ประกาศยาวเกิน 300 ตัวอักษร' });
  settings = { days, announcement };
  try { saveSettings(); } catch (e) { return res.status(500).json({ ok: false, message: 'บันทึกไม่สำเร็จ: ' + e.message }); }
  res.json({ ok: true });
});

// แชท (โค้ดอยู่ในไฟล์ chat.js ปิดได้ด้วย CHAT_ENABLED=false)
require('./chat')({ app, cfg, DATA_DIR, adminAuth, sendWebhook });
// กระดานคะแนนมินิเกม (โค้ดอยู่ในไฟล์ games.js ปิดได้ด้วย GAMES_ENABLED=false)
require('./games')({ app, cfg, DATA_DIR, adminAuth, sendWebhook });
// อันดับผู้เล่น (โค้ดอยู่ในไฟล์ ranking.js ไม่ตั้งค่า SFTP_* = ปิด)
require('./ranking')({ app, DATA_DIR, adminAuth });

/* ---------------------------------------------------------------
 * หน้าแรก: ใส่ Open Graph tags ตามสถานะจริง เพื่อให้ลิงก์ที่แปะใน Discord/LINE ขึ้นการ์ดสถานะ
 * ------------------------------------------------------------- */
const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function statusLine() {
  if (state.online === true) return { head: '🟢 เปิดอยู่', desc: `${state.players.online}/${state.players.max} คนกำลังเล่น` + (state.version ? ` · เวอร์ชัน ${state.version}` : '') + ` · ที่อยู่ ${cfg.address}`, color: '#3ed48a' };
  if (state.online === false) return { head: '🔴 ปิดอยู่', desc: `ตอนนี้ปิดอยู่ · ที่อยู่ ${cfg.address}`, color: '#ef5a48' };
  return { head: 'กำลังตรวจสอบ', desc: `ที่อยู่ ${cfg.address}`, color: '#8b8794' };
}
const INDEX_FILE = path.join(__dirname, 'public', 'index.html');
app.get(['/', '/index.html'], (req, res, next) => {
  fs.readFile(INDEX_FILE, 'utf8', (err, html) => {
    if (err) return next(err);
    const s = statusLine();
    const base = cfg.publicUrl || `${req.protocol}://${req.get('host')}`;
    const title = `${cfg.name}: ${s.head}`;
    const meta = [
      `<meta property="og:type" content="website">`,
      `<meta property="og:title" content="${esc(title)}">`,
      `<meta property="og:description" content="${esc(s.desc)}">`,
      `<meta property="og:url" content="${esc(base + '/')}">`,
      `<meta property="og:site_name" content="${esc(cfg.name)}">`,
      `<meta name="theme-color" content="${s.color}">`,
    ].join('\n');
    res.set('Cache-Control', 'no-cache');
    res.type('html').send(html.replace('<!--OG-->', meta));
  });
});

// ป้ายสถานะ SVG เอาไปฝังในเว็บอื่นหรือ README ได้: <img src="https://โดเมนของคุณ/badge.svg">
app.get('/badge.svg', (req, res) => {
  const s = statusLine();
  const left = cfg.name.length > 24 ? cfg.name.slice(0, 23) + '…' : cfg.name;
  const right = state.online === true ? `เปิดอยู่ ${state.players.online}/${state.players.max}` : state.online === false ? 'ปิดอยู่' : 'กำลังเช็ค';
  const w1 = 20 + left.length * 7, w2 = 20 + right.length * 7, w = w1 + w2;
  res.set('Cache-Control', 'public, max-age=30').type('image/svg+xml').send(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="24" role="img" aria-label="${esc(left + ': ' + right)}">` +
    `<rect width="${w1}" height="24" fill="#182027"/><rect x="${w1}" width="${w2}" height="24" fill="${s.color}"/>` +
    `<g font-family="Tahoma,'Noto Sans Thai',sans-serif" font-size="13" text-anchor="middle">` +
    `<text x="${w1 / 2}" y="16" fill="#fff">${esc(left)}</text>` +
    `<text x="${w1 + w2 / 2}" y="16" fill="${state.online === true ? '#06220f' : '#fff'}">${esc(right)}</text></g></svg>`
  );
});

// ไฟล์ html/js/css ให้เบราว์เซอร์เช็คเวอร์ชันใหม่ทุกครั้ง (กันค้างของเก่าหลัง deploy), รูปแคชไว้ได้
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: 0,
  setHeaders: (res, p) => {
    res.set('Cache-Control', /\.(webp|png|jpe?g|gif|ico)$/i.test(p) ? 'public, max-age=86400' : 'no-cache');
  },
}));

app.listen(cfg.webPort, () => {
  console.log(`เว็บพร้อมแล้วที่ http://localhost:${cfg.webPort}`);
  console.log(`เช็คเซิร์ฟ ${cfg.type} ${cfg.host}:${cfg.port} ทุก ${cfg.pollMs / 1000} วินาที`);
  console.log(`Discord webhook: ${cfg.webhook ? 'เปิด' : 'ปิด'} | บอท: ${cfg.botToken ? 'เปิด' : 'ปิด'} | หน้าแอดมิน: ${cfg.adminPassword ? 'เปิด' : 'ปิด'}`);
});
