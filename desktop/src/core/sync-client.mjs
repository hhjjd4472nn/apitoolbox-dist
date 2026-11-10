import os from 'node:os';
import {appendLog, mergeAccounts, saveState} from './state.mjs';
import {importMobileSnapshot} from './full-sync.mjs';

export const SYNC_PORT = 19300;
export const SYNC_PROTOCOL = 'apitoolbox-sync-v2';
const MAX_PAYLOAD = 8 * 1024 * 1024;
function localIPv4() { const out = new Set(); for (const list of Object.values(os.networkInterfaces())) for (const item of list || []) if (item.family === 'IPv4' && !item.internal) out.add(item.address); return [...out]; }
function candidates() {
  const out = new Set();
  for (const ip of localIPv4()) { const match = ip.match(/^(\d+\.\d+\.\d+)\.(\d+)$/); if (!match) continue; for (let last = 1; last <= 254; last++) out.add(`${match[1]}.${last}`); }
  return [...out];
}
async function probe(ip, timeoutMs = 700) {
  try {
    const response = await fetch(`http://${ip}:${SYNC_PORT}/ping`, {signal:AbortSignal.timeout(timeoutMs), headers:{accept:'application/json'}});
    if (!response.ok) return null;
    const value = await response.json();
    return value?.app === 'apitoolbox-sync' && value.protocol === SYNC_PROTOCOL && value.schemaVersion === 2 ? value : null;
  } catch { return null; }
}
export async function findPhone(onProgress = () => {}) {
  const ips = candidates(); let cursor = 0; const found = [];
  const workers = Array.from({length:Math.min(32, Math.max(1, ips.length))}, async () => { while (cursor < ips.length) { const ip = ips[cursor++]; const info = await probe(ip); if (info) { found.push({ip,info}); onProgress({stage:'found',ip,info}); } } });
  await Promise.all(workers); return found;
}
async function readJsonResponse(response) {
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_PAYLOAD) throw new Error('手机同步快照超过8MB限制');
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_PAYLOAD) throw new Error('手机同步快照超过8MB限制');
  try { return {payload:JSON.parse(text),raw:text}; } catch { throw new Error('手机返回的同步快照不是JSON'); }
}
export async function syncFromPhone(state, secretStore, pairCode, manualIp = '', onProgress = () => {}) {
  if (typeof manualIp === 'function') { onProgress = manualIp; manualIp = ''; }
  const code = String(pairCode || state.sync.pairCode || '').trim();
  if (!/^\d{6}$/.test(code)) return {ok:false,error:'请输入手机「电脑同步」页面显示的6位配对码'};
  const wanted = String(manualIp || '').trim();
  let phone = null;
  if (wanted) {
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(wanted)) return {ok:false,error:'手机地址格式不对，应类似 192.168.31.56'};
    onProgress({stage:'probe',ip:wanted});
    const info = await probe(wanted, 3000);
    if (!info) return {ok:false,error:`连不上 ${wanted}:19300。请确认：①手机「电脑同步」开关是开启 ②手机页面是否显示「正在监听」 ③电脑和手机在同一 Wi-Fi（手机不能是流量/访客网络）④Windows 防火墙允许本程序访问网络`,ip:wanted};
    phone = {ip:wanted,info};
  }
  if (!phone && state.sync.phoneIp) phone = {ip:state.sync.phoneIp,info:await probe(state.sync.phoneIp,1500)};
  if (!phone?.info) {
    onProgress({stage:'scan'});
    const found = await findPhone(onProgress);
    if (found.length === 1) phone = found[0];
    else if (found.length > 1) { phone = found.find(item => item.info?.pair === code) || null; if (!phone) return {ok:false,error:`发现${found.length}台手机，请确认配对码`,found:found.map(item => item.ip)}; }
  }
  if (!phone) return {ok:false,error:'局域网里没找到手机。请确认手机已开启「电脑同步」并在「正在监听」状态，电脑与手机连同一个 Wi-Fi；也可以在「手机地址」里直接填手机 IP（手机页面上会显示）。'};
  onProgress({stage:'pull',ip:phone.ip});
  const response = await fetch(`http://${phone.ip}:${SYNC_PORT}/sync?code=${encodeURIComponent(code)}`, {signal:AbortSignal.timeout(30000), headers:{accept:'application/json'}});
  const {payload,raw} = await readJsonResponse(response);
  if (response.status === 403) return {ok:false,error:payload.error === 'pair_code_rotated' ? '配对码错误次数过多，手机已自动生成新配对码' : '配对码错误',ip:phone.ip};
  if (!response.ok) return {ok:false,error:`手机返回HTTP ${response.status}`,ip:phone.ip};
  const result = importMobileSnapshot(payload, code, state, secretStore, raw);
  Object.assign(state, result.state);
  state.accounts = mergeAccounts(state.accounts, result.imported);
  state.sync = {...state.sync,pairCode:code,phoneIp:phone.ip,lastSyncAt:Date.now(),schemaVersion:2};
  appendLog(state,'info','sync_import',{ip:phone.ip,imported:result.imported.length,modules:[...new Set(result.imported.map(row=>row.moduleId))],protocol:SYNC_PROTOCOL});
  saveState(state);
  return {ok:true,ip:phone.ip,imported:result.imported.length,source:result.source,counts:Object.fromEntries([...new Set(result.imported.map(row=>row.moduleId))].map(id=>[id,result.imported.filter(row=>row.moduleId===id).length]))};
}