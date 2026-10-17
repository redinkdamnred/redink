'use strict';
/* แท็บ/หมวดอันดับที่แอดมินปิดได้ (ใช้ร่วมกันระหว่าง server.js และการทดสอบ)
 * ภาพรวม (overview) ปิดไม่ได้ เพื่อให้หน้าแรกมีอะไรแสดงเสมอ */
const TAB_IDS = ['addr', 'players', 'chat', 'rank', 'games', 'chart', 'history', 'sched'];
const RANK_IDS = ['blocks', 'ores', 'mobs', 'hours', 'deaths', 'dist'];

function pick(list, allowed, fallback) {
  if (!Array.isArray(list)) return fallback;
  const out = [];
  for (const x of list) if (typeof x === 'string' && allowed.includes(x) && !out.includes(x)) out.push(x);
  return out;
}
// input: ค่าจากผู้ใช้ (undefined = ไม่แตะค่าเดิม) prev: ค่าเดิม
function parseHidden(input, prev) {
  const b = input || {}, p = prev || {};
  return {
    hiddenTabs: pick(b.hiddenTabs, TAB_IDS, p.hiddenTabs || []),
    hiddenRank: pick(b.hiddenRank, RANK_IDS, p.hiddenRank || []),
  };
}
module.exports = { TAB_IDS, RANK_IDS, parseHidden };
