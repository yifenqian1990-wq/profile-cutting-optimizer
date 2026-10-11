// 测试 ip-gate.ts 的门控逻辑（node 直接运行，文件是纯 JS 写法）
import { createIpGate, normalizeIp, loadWhitelist, isPageLoad } from './ip-gate.ts';
import fs from 'fs';
import os from 'os';
import path from 'path';

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗ FAIL:', name); }
}
function stubReq(ip, method, reqPath) {
  return { ip, method: method || 'GET', path: reqPath || '/' };
}
function stubRes() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = String(v); },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
    send(t) { this.body = t; return this; },
  };
}
function run(gate, req) {
  const res = stubRes();
  let nextCalled = false;
  gate(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

console.log('— normalizeIp —');
ok(normalizeIp('::ffff:1.2.3.4') === '1.2.3.4', 'IPv4 映射地址还原');
ok(normalizeIp('  9.9.9.9 ') === '9.9.9.9', '去空格');
ok(normalizeIp('::1') === '::1', 'IPv6 本机保留');

console.log('— loadWhitelist —');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-'));
fs.writeFileSync(path.join(tmp, 'a.json'), JSON.stringify({ '1.1.1.1': { remark: 'x' }, '2.2.2.2': { remark: 'y' } }));
ok(loadWhitelist(path.join(tmp, 'a.json')).has('1.1.1.1'), '对象map格式读取');
fs.writeFileSync(path.join(tmp, 'b.json'), JSON.stringify(['3.3.3.3']));
ok(loadWhitelist(path.join(tmp, 'b.json')).has('3.3.3.3'), '纯数组格式读取');
ok(loadWhitelist(path.join(tmp, 'nope.json')).has('127.0.0.1'), '文件缺失时回退本机');

console.log('— isPageLoad —');
ok(isPageLoad({ method: 'GET', path: '/' }), 'GET / 计次');
ok(isPageLoad({ method: 'GET', path: '/foo/bar' }), '深链接计次');
ok(!isPageLoad({ method: 'GET', path: '/assets/app.123.js' }), '静态资源不计次');
ok(!isPageLoad({ method: 'GET', path: '/api/optimize' }), 'API 不计次');
ok(!isPageLoad({ method: 'POST', path: '/' }), 'POST 不计次');

console.log('— 白名单放行 —');
{
  const gate = createIpGate({ whitelist: new Set(['127.0.0.1', '10.0.0.1']) });
  const { res, nextCalled } = run(gate, stubReq('127.0.0.1', 'GET', '/'));
  ok(nextCalled && res.headers['x-access-mode'] === 'whitelist', '白名单 IP 直接放行');
  const r2 = run(gate, stubReq('::ffff:10.0.0.1', 'GET', '/'));
  ok(r2.nextCalled && r2.res.headers['x-access-mode'] === 'whitelist', '::ffff: 映射匹配白名单');
}

console.log('— 试用计数与拒绝 —');
{
  const gate = createIpGate({ whitelist: new Set(), trialDays: 7, trialMaxVisits: 2 });
  let r = run(gate, stubReq('9.9.9.9', 'GET', '/'));
  ok(r.nextCalled && r.res.headers['x-access-mode'] === 'trial', '试用 IP 首次放行');
  ok(r.res.headers['x-trial-remaining-visits'] === '1', '剩余次数头正确');
  r = run(gate, stubReq('9.9.9.9', 'GET', '/assets/x.js'));
  ok(r.nextCalled, '静态资源不消耗次数');
  r = run(gate, stubReq('9.9.9.9', 'POST', '/api/optimize'));
  ok(r.nextCalled, 'API 不消耗次数');
  r = run(gate, stubReq('9.9.9.9', 'GET', '/'));
  ok(r.nextCalled, '第 2 次页面访问放行');
  r = run(gate, stubReq('9.9.9.9', 'GET', '/'));
  ok(!r.nextCalled && r.res.statusCode === 403 && typeof r.res.body === 'string' && r.res.body.includes('试用已结束'), '次数用完页面返回中文提示页');
  r = run(gate, stubReq('9.9.9.9', 'POST', '/api/optimize'));
  ok(!r.nextCalled && r.res.statusCode === 403 && r.res.body && r.res.body.success === false, '次数用完 API 返回 403 JSON');
  ok(r.res.headers['x-access-mode'] === 'trial-expired', '拒绝时带 trial-expired 头');
}

console.log('— 试用期过期 —');
{
  // 用极短试用期 + 确定性等待验证过期分支（窗口 50ms，等待 250ms）
  const gate2 = createIpGate({ whitelist: new Set(), trialDays: 50 / 86400000, trialMaxVisits: 100 });
  run(gate2, stubReq('8.8.8.8', 'GET', '/'));
  const waitUntil = Date.now() + 250;
  while (Date.now() < waitUntil) { /* busy wait */ }
  const r = run(gate2, stubReq('8.8.8.8', 'GET', '/'));
  ok(!r.nextCalled && r.res.statusCode === 403, '试用期满后拒绝');
}

console.log(`\n结果：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
