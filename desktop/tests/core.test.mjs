import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {DEFAULT_MODULES,initialState,mergeAccounts,nextAccount,saveState,loadState} from '../src/core/state.mjs';
import {SecretStore} from '../src/core/secret-store.mjs';
import {validateManifest} from '../src/core/update.mjs';
import {validateMobileSnapshot,importMobileSnapshot,buildFullSnapshot,validateFullSnapshot} from '../src/core/full-sync.mjs';
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'atb-desktop-test-'));
const keyAdapter={available:()=>true,encrypt:v=>Buffer.from(`sealed:${v.toString('base64')}`),decrypt:b=>Buffer.from(b.toString().slice(7),'base64')};
const keys=()=>new SecretStore(path.join(temp(),'secrets.bin'),keyAdapter);
function mobileSnapshot(pair='123456'){
 const salt=Buffer.alloc(16,7),key=crypto.pbkdf2Sync(pair,salt,120000,32,'sha1'),iv=Buffer.alloc(12,3),aad='vsllm:alice';
 const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(aad));const encrypted=Buffer.concat([cipher.update(JSON.stringify({accessToken:'tok-a',cookie:'c-a'}),'utf8'),cipher.final(),cipher.getAuthTag()]);
 const value={app:'apitoolbox-sync',protocol:'apitoolbox-sync-v2',schemaVersion:2,createdAt:1,source:{versionCode:159,versionName:'159.0'},crypto:{kdf:'PBKDF2-HMAC-SHA1',iterations:120000,salt:salt.toString('base64')},modules:DEFAULT_MODULES.map(m=>({id:m.id,enabled:true,accountCount:m.id==='vsllm'?1:0})),accounts:[{moduleId:'vsllm',identity:'alice',username:'alice',enabled:true,verified:'true',credentialRef:'phone:vsllm:alice',sealed:JSON.stringify({alg:'A256GCM',iv:iv.toString('base64'),data:encrypted.toString('base64')})}],settings:{},groups:{},credentialEnvelope:[]};
 const before=JSON.stringify(value);value.hmac=crypto.createHmac('sha256',key).update(before).digest('base64');return value;
}
test('nine modules have unique proxy ports',()=>{assert.equal(DEFAULT_MODULES.length,9);assert.equal(new Set(DEFAULT_MODULES.map(x=>x.id)).size,9);assert.equal(new Set(DEFAULT_MODULES.map(x=>x.port)).size,9);});
test('account merge preserves desktop enabled and fixed settings',()=>{const x=mergeAccounts([{moduleId:'vsllm',identity:'a',enabled:false,fixed:true}],[{moduleId:'vsllm',identity:'a',enabled:true,fixed:false,username:'updated'}])[0];assert.equal(x.enabled,false);assert.equal(x.fixed,true);assert.equal(x.username,'updated');});
test('fixed account precedes rotation',()=>{const s=initialState();s.accounts=[{moduleId:'vsllm',identity:'a',enabled:true},{moduleId:'vsllm',identity:'b',enabled:true,fixed:true}];assert.equal(nextAccount(s,'vsllm').identity,'b');});
test('rotation visits enabled accounts',()=>{const s=initialState();s.accounts=[{moduleId:'vsllm',identity:'a',enabled:true},{moduleId:'vsllm',identity:'b',enabled:true}];assert.deepEqual([nextAccount(s,'vsllm').identity,nextAccount(s,'vsllm').identity],['a','b']);});
test('state write is atomic and upgrades defaults',()=>{const file=path.join(temp(),'state.json');saveState({accounts:[],modules:[],sync:{}},file);const s=loadState(file);assert.equal(s.modules.length,9);assert.equal(s.sync.schemaVersion,2);});
test('SecretStore encrypts and refuses unavailable OS storage',()=>{const file=path.join(temp(),'secret.bin'),store=new SecretStore(file,keyAdapter);store.set('a','topsecret');assert.equal(fs.readFileSync(file,'utf8').includes('topsecret'),false);assert.equal(store.get('a'),'topsecret');assert.throws(()=>new SecretStore(path.join(temp(),'x'),{available:()=>false}).set('x','secret'),/OS credential encryption unavailable/);});
test('v2 verifies raw HMAC and imports AES-GCM credentials',()=>{const p=mobileSnapshot(),raw=JSON.stringify(p),secret=keys();assert.equal(validateMobileSnapshot(p),p);const r=importMobileSnapshot(p,'123456',initialState(),secret,raw);assert.equal(r.imported.length,1);assert.equal(secret.get('phone:vsllm:alice'),JSON.stringify({accessToken:'tok-a',cookie:'c-a'}));assert.throws(()=>importMobileSnapshot(p,'123456',initialState(),keys(),JSON.stringify({...p,source:{...p.source,versionName:'tampered'}})),/HMAC mismatch/);});
test('v2 rejects wrong pair code and plaintext credential fields',()=>{const p=mobileSnapshot();assert.throws(()=>importMobileSnapshot(p,'000000',initialState(),keys(),JSON.stringify(p)),/HMAC mismatch/);const bad=mobileSnapshot();bad.accounts[0].accessToken='plaintext';assert.throws(()=>validateMobileSnapshot(bad),/plaintext-sensitive/);});
test('desktop sync export excludes credentials and local key',()=>{const p=buildFullSnapshot({...initialState(),accounts:[{moduleId:'vsllm',identity:'a',credentialRef:'secret-ref',accessToken:'secret'}]});const text=JSON.stringify(p);assert.equal(text.includes('secret"'),false);assert.equal(text.includes('localKey'),false);assert.doesNotThrow(()=>validateFullSnapshot(p));});
test('Windows update rejects Android and insecure manifests',()=>{const m={platform:'win32',arch:'x64',versionCode:2,versionName:'1.0.1',url:'https://example.invalid/app.exe',sha256:'a'.repeat(64),size:20};assert.equal(validateManifest(m),m);assert.throws(()=>validateManifest({...m,platform:'android'}));assert.throws(()=>validateManifest({...m,url:'http://example.invalid/a'}));});