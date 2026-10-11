// ip-gate.ts — IP 白名单 + 试用额度访问控制（无第三方依赖，纯 JS 写法，可直接被 node/tsx 运行）
//
// 策略：
//  - 白名单 IP：无障碍访问，不计数、不设限（你自己、保活任务、付费客户加进来）
//  - 其他 IP：试用模式 —— 首次访问起 TRIAL_DAYS 天内、最多 TRIAL_MAX_VISITS 次页面访问；
//    超出后拒绝访问（页面返回中文提示页，API 返回 403 JSON）。用途：给别人体验一段时间。
//  - 白名单文件：database/ip-whitelist.json（对象形式 {"1.2.3.4": {"remark": "备注"}}，
//    也兼容纯数组 ["1.2.3.4"]）；改完 push 后 Render 重新部署即生效。
//  - 试用状态存在内存 Map 里（Render 免费版文件系统是临时的，重启/重部署后试用计数清零）。
//  - 每次响应会带 X-Access-Mode 响应头（whitelist / trial / trial-expired），方便确认部署与排查。

import fs from 'fs';
import path from 'path';

// ===== 可调参数 =====
const DEFAULT_TRIAL_DAYS = 7; // 非白名单 IP 试用有效期（天，从该 IP 首次访问算起）
const DEFAULT_TRIAL_MAX_VISITS = 100; // 试用期内最多页面访问次数（只统计页面打开，API/静态资源不计）
const MAX_TRIAL_RECORDS = 20000; // 内存中最多保留的试用 IP 记录数，超了清理过期条目

function defaultWhitelistFile() {
  return path.join(process.cwd(), 'database', 'ip-whitelist.json');
}

// 把 ::ffff:1.2.3.4 这类 IPv4 映射地址还原成 1.2.3.4，统一比对
export function normalizeIp(ip) {
  if (!ip) return '';
  let s = String(ip).trim().toLowerCase();
  if (s.startsWith('::ffff:')) s = s.slice(7);
  // 去掉端口（若有）
  const lastColon = s.lastIndexOf(':');
  if (s.indexOf(':') === lastColon && /^\d+\.\d+\.\d+\.\d+:\d+$/.test(s)) {
    s = s.slice(0, lastColon);
  }
  return s;
}

export function loadWhitelist(file) {
  const set = new Set();
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    const add = (ip) => {
      const n = normalizeIp(ip);
      if (n) set.add(n);
    };
    if (Array.isArray(data)) {
      data.forEach(add);
    } else if (data && typeof data === 'object') {
      const inner = data.ips || data.whitelist;
      const keys = Array.isArray(inner) ? inner : inner && typeof inner === 'object' ? Object.keys(inner) : Object.keys(data);
      keys.forEach((k) => { if (!String(k).startsWith('_')) add(k); }); // _ 开头的是注释键，跳过
    }
  } catch (e) {
    console.warn('[ip-gate] 白名单文件读取失败，使用默认本机白名单:', String((e && e.message) || e));
    set.add('127.0.0.1');
    set.add('::1');
  }
  if (set.size === 0) {
    set.add('127.0.0.1');
    set.add('::1');
  }
  return set;
}

// 判断是否为内网/回环地址（Render 这类云平台的代理层一般使用内网地址转发请求）
export function isPrivateOrLocalIp(ip) {
  if (!ip) return false;
  const s = normalizeIp(ip);
  if (s === '127.0.0.1' || s === '::1') return true;
  if (/^10\./.test(s)) return true;
  if (/^192\.168\./.test(s)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(s)) return true;
  if (/^fd[0-9a-f]{2}:/.test(s) || s.indexOf('fc00:') === 0) return true; // IPv6 ULA
  if (s.indexOf('fe80:') === 0) return true; // IPv6 link-local
  return false;
}

// 是否为“页面打开”（计入试用次数）：GET 请求、非 /api、非静态资源
export function isPageLoad(req) {
  if (!req || req.method !== 'GET') return false;
  const p = req.path || '/';
  if (p.startsWith('/api')) return false;
  if (/\.[a-zA-Z0-9]{1,8}(\?.*)?$/.test(p)) return false;
  return true;
}

function trialExpiredHtml(reason) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>试用已结束</title>
<style>
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.08);max-width:420px;width:90%;overflow:hidden}
.head{background:#f8fafc;padding:32px;text-align:center;border-bottom:1px solid #f1f5f9}
.icon{width:56px;height:56px;border-radius:50%;background:#fef3c7;color:#d97706;display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 12px}
h1{font-size:20px;color:#1e293b;margin:0 0 8px}
p.sub{font-size:13px;color:#64748b;margin:0}
.body{padding:28px}
.tip{background:#eff6ff;border:1px solid #dbeafe;color:#1d4ed8;border-radius:10px;padding:14px;font-size:14px;line-height:1.7}
</style>
</head>
<body>
<div class="card">
<div class="head"><div class="icon">⏳</div><h1>试用已结束</h1><p class="sub">感谢体验型材优化套裁软件</p></div>
<div class="body"><div class="tip"><b>原因：</b>${reason}<br><br>如需继续使用，请联系管理员开通正式访问（白名单无限制）。</div></div>
</div>
</body>
</html>`;
}

export function createIpGate(options) {
  const opts = options || {};
  const trialDays = Number(opts.trialDays) > 0 ? Number(opts.trialDays) : DEFAULT_TRIAL_DAYS;
  const trialMaxVisits = Number(opts.trialMaxVisits) > 0 ? Number(opts.trialMaxVisits) : DEFAULT_TRIAL_MAX_VISITS;
  const whitelist = opts.whitelist instanceof Set ? opts.whitelist : loadWhitelist(opts.whitelistFile || defaultWhitelistFile());
  const trials = new Map(); // ip -> { firstSeen, visits }

  console.log(`[ip-gate] 白名单 ${whitelist.size} 个 IP；试用策略：${trialDays} 天有效期 / ${trialMaxVisits} 次页面访问`);

  function pruneIfNeeded() {
    if (trials.size <= MAX_TRIAL_RECORDS) return;
    const cutoff = Date.now() - trialDays * 86400000;
    for (const [ip, st] of trials) {
      if (st.firstSeen < cutoff) trials.delete(ip);
      if (trials.size <= MAX_TRIAL_RECORDS * 0.8) break;
    }
  }

  function deny(req, res, reason) {
    res.setHeader('X-Access-Mode', 'trial-expired');
    const msg = `试用已结束（${reason}），请联系管理员开通正式访问。`;
    if ((req.path || '').startsWith('/api')) {
      return res.status(403).json({ success: false, message: msg });
    }
    return res.status(403).send(trialExpiredHtml(reason));
  }

  return function ipGate(req, res, next) {
    const ip = normalizeIp(req.ip);
    // 调试头：排查代理层级/真实 IP 用，确认无误后可删除
    res.setHeader('X-Debug-Req-Ip', ip || 'none');
    const hdrs = req.headers || {};
    const xff = hdrs['x-forwarded-for'];
    if (xff) res.setHeader('X-Debug-Xff', String(xff).slice(0, 220));
    const xri = hdrs['x-real-ip'];
    if (xri) res.setHeader('X-Debug-X-Real-Ip', String(xri).slice(0, 64));
    if (whitelist.has(ip)) {
      res.setHeader('X-Access-Mode', 'whitelist');
      return next();
    }
    const now = Date.now();
    let st = trials.get(ip);
    if (!st) {
      st = { firstSeen: now, visits: 0 };
      trials.set(ip, st);
      pruneIfNeeded();
    }
    const daysUsed = (now - st.firstSeen) / 86400000;
    if (daysUsed > trialDays) return deny(req, res, '试用期已满');
    if (st.visits >= trialMaxVisits) return deny(req, res, '试用次数已用完');
    if (isPageLoad(req)) st.visits += 1;
    res.setHeader('X-Access-Mode', 'trial');
    res.setHeader('X-Trial-Remaining-Days', String(Math.max(0, Math.ceil(trialDays - daysUsed))));
    res.setHeader('X-Trial-Remaining-Visits', String(Math.max(0, trialMaxVisits - st.visits)));
    return next();
  };
}
