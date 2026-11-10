import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {dataRoot} from './state.mjs';

const MANIFEST_URLS = [
  'https://cdn.jsdelivr.net/gh/hhjjd4472nn/apitoolbox-dist@main/desktop/update.json',
  'https://raw.githubusercontent.com/hhjjd4472nn/apitoolbox-dist/main/desktop/update.json',
  'https://gh-proxy.com/https://raw.githubusercontent.com/hhjjd4472nn/apitoolbox-dist/main/desktop/update.json',
  'https://cdn.statically.io/gh/hhjjd4472nn/apitoolbox-dist/main/desktop/update.json',
];
export async function fetchManifest() {
  for (const url of MANIFEST_URLS) {
    try { const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(r.ok)return await r.json(); }
    catch {}
  }
  throw new Error('Windows更新清单暂不可用');
}
export function sha256File(file) { const hash=crypto.createHash('sha256');hash.update(fs.readFileSync(file));return hash.digest('hex'); }
export function validateManifest(manifest) {
  if (!manifest || manifest.platform !== 'win32' || manifest.arch !== 'x64') throw new Error('更新平台不匹配');
  if (!Number.isInteger(manifest.versionCode) || !manifest.versionName || !manifest.url || !/https:/.test(manifest.url)) throw new Error('更新清单无效');
  if (!/^[a-f0-9]{64}$/i.test(manifest.sha256) || manifest.size <= 0 || manifest.size > 800_000_000) throw new Error('更新哈希或大小无效');
  return manifest;
}
export async function downloadUpdate(manifest, onProgress = () => {}) {
  validateManifest(manifest);
  const response=await fetch(manifest.url,{redirect:'follow',signal:AbortSignal.timeout(120000)});if(!response.ok)throw new Error(`下载HTTP ${response.status}`);
  const file=path.join(dataRoot(),'update.tmp');const stream=fs.createWriteStream(file);const reader=response.body.getReader();let total=0;
  try { while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>manifest.size)throw new Error('更新文件超出声明大小');stream.write(Buffer.from(value));onProgress(total,manifest.size);} }
  finally {stream.end();}
  if(total!==manifest.size || sha256File(file).toLowerCase()!==manifest.sha256.toLowerCase()){fs.rmSync(file,{force:true});throw new Error('更新文件校验失败');}
  return file;
}