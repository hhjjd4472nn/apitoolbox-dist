import {app, BrowserWindow, ipcMain, shell, dialog, Notification, safeStorage} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadState,saveState,clone,appendLog,dataRoot} from './core/state.mjs';
import crypto from 'node:crypto';
import {SecretStore} from './core/secret-store.mjs';
import {ProxyServer} from './core/proxy-server.mjs';
import {syncFromPhone} from './core/sync-client.mjs';
import {fetchManifest,validateManifest} from './core/update.mjs';
import {JobQueue} from './core/job-queue.mjs';
import {writeBackup,importBackup} from './core/backup.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const osCredential={available:()=>safeStorage.isEncryptionAvailable(),encrypt:bytes=>safeStorage.encryptString(Buffer.from(bytes).toString('base64')),decrypt:blob=>Buffer.from(safeStorage.decryptString(blob),'base64')};
const localKeyRef='desktop:local-proxy-key';
let state=loadState();const secrets=new SecretStore(undefined,osCredential);const jobs=new JobQueue(state);let proxy;let windowRef;
function ensureLocalKey(){const existing=secrets.get(localKeyRef);if(existing)return existing;if(!osCredential.available())throw new Error('OS credential encryption unavailable');const key=`sk-atb-${crypto.randomBytes(18).toString('base64url')}`;secrets.set(localKeyRef,key);return key;}
function persist(){saveState(state);}
function safeSnapshot(){const snapshot=clone(state);delete snapshot.settings.localKey;return {...snapshot,credentials:{},proxyRunning:!!proxy?.started,jobStatus:jobs.status(),paths:{data:dataRoot()}};}
function localKey(){return ensureLocalKey();}
function send(channel,payload){if(windowRef&&!windowRef.isDestroyed())windowRef.webContents.send(channel,payload);}
function createWindow(){windowRef=new BrowserWindow({width:1450,height:920,minWidth:1100,minHeight:720,backgroundColor:'#f4f7fb',title:'API 工具箱',webPreferences:{preload:path.join(HERE,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});windowRef.loadFile(path.join(HERE,'../renderer/index.html'));windowRef.on('closed',()=>windowRef=null);}
app.whenReady().then(()=>{createWindow();proxy=new ProxyServer(state,secrets);if(state.proxyEnabled){ensureLocalKey();proxy.start();}app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});});
app.on('before-quit',()=>{proxy?.stop();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('web-contents-created',(_,contents)=>contents.setWindowOpenHandler(({url})=>{try{if(new URL(url).protocol==='https:')shell.openExternal(url);}catch{}return {action:'deny'};}));

ipcMain.handle('app:snapshot',()=>safeSnapshot());
ipcMain.handle('app:modules',()=>clone(state.modules));
ipcMain.handle('app:setTheme',(_,theme)=>{if(!['system','light','dark'].includes(theme))throw new Error('theme invalid');state.settings.theme=theme;persist();return safeSnapshot();});
ipcMain.handle('app:toggleProxy',(_,enabled)=>{if(enabled){ensureLocalKey();proxy.start();}else proxy.stop();state.proxyEnabled=!!enabled;appendLog(state,'info',enabled?'proxy_started':'proxy_stopped');persist();send('state:changed',safeSnapshot());return proxy.started;});
ipcMain.handle('app:localKey',async()=>{const answer=await dialog.showMessageBox(windowRef,{type:'warning',buttons:['显示一次','取消'],defaultId:1,cancelId:1,title:'本机代理密钥',message:'密钥仅在确认后显示。请勿公开分享。'});return answer.response===0?localKey():null;});
ipcMain.handle('accounts:upsert',(_,account)=>{if(!account?.moduleId||!account?.identity)throw new Error('moduleId and identity required');const ref=`manual:${account.moduleId}:${account.identity}`;const sensitive={};for(const key of Object.keys(account)){const lower=key.toLowerCase().replaceAll('_','');if(lower.includes('token')||lower.includes('password')||lower.includes('secret')||['apikey','key','cookie','session'].includes(lower))sensitive[key]=account[key];}if(account.credential)sensitive.credential=account.credential;if(Object.keys(sensitive).length)secrets.set(ref,JSON.stringify(sensitive));const visible={...account,credential:undefined,credentialRef:Object.keys(sensitive).length?ref:(account.credentialRef||null),enabled:account.enabled??true,fixed:account.fixed??false,updatedAt:Date.now()};for(const key of Object.keys(visible)){const lower=key.toLowerCase().replaceAll('_','');if(lower.includes('token')||lower.includes('password')||lower.includes('secret')||['apikey','key','cookie','session'].includes(lower))delete visible[key];}const i=state.accounts.findIndex(a=>a.moduleId===visible.moduleId&&a.identity===visible.identity);if(i<0)state.accounts.push(visible);else state.accounts[i]={...state.accounts[i],...visible};persist();send('state:changed',safeSnapshot());return true;});
ipcMain.handle('accounts:delete',(_,moduleId,identity)=>{const account=state.accounts.find(a=>a.moduleId===moduleId&&a.identity===identity);if(account?.credentialRef){try{secrets.remove(account.credentialRef);}catch{}}state.accounts=state.accounts.filter(a=>!(a.moduleId===moduleId&&a.identity===identity));persist();send('state:changed',safeSnapshot());return true;});
ipcMain.handle('accounts:toggle',(_,moduleId,identity,field,value)=>{if(!['enabled','fixed'].includes(field))throw new Error('account field not editable');const a=state.accounts.find(x=>x.moduleId===moduleId&&x.identity===identity);if(!a)throw new Error('account not found');a[field]=!!value;a.updatedAt=Date.now();persist();send('state:changed',safeSnapshot());return true;});
ipcMain.handle('accounts:credentialStatus',(_,moduleId,identity)=>{const a=state.accounts.find(x=>x.moduleId===moduleId&&x.identity===identity);return {hasCredential:!!(a?.credentialRef&&secrets.get(a.credentialRef)),ref:a?.credentialRef||null};});
ipcMain.handle('sync:run',async(_,pairCode)=>{try{const result=await syncFromPhone(state,secrets,pairCode,progress=>send('sync:progress',progress));persist();send('state:changed',safeSnapshot());return result;}catch(error){appendLog(state,'error','sync_failed',{message:error.message});persist();return {ok:false,error:error.message};}});
ipcMain.handle('sync:forgetPhone',()=>{state.sync.phoneIp='';state.sync.pairCode='';persist();return true;});
ipcMain.handle('modules:toggle',(_,id,enabled)=>{const m=state.modules.find(x=>x.id===id);if(!m)throw new Error('module not found');m.enabled=!!enabled;persist();if(!state.proxyEnabled)return true;proxy.stop();if(state.modules.some(x=>x.enabled))proxy.start();send('state:changed',safeSnapshot());return true;});
ipcMain.handle('settings:update',(_,patch)=>{if(patch.rotation&&!['quota','round_robin','fixed','disabled'].includes(patch.rotation))throw new Error('rotation invalid');if(patch.localBind&&!['127.0.0.1','0.0.0.0'].includes(patch.localBind))throw new Error('bind address invalid');if(patch.localBind==='0.0.0.0'&&!patch.confirmLan)throw new Error('LAN exposure needs explicit confirmation');delete patch.confirmLan;state.settings={...state.settings,...patch};persist();return safeSnapshot();});
ipcMain.handle('update:check',async()=>{try{const m=validateManifest(await fetchManifest());return {ok:true,versionCode:m.versionCode,versionName:m.versionName,notes:m.notes||'',platform:m.platform,arch:m.arch};}catch(e){return {ok:false,error:e.message};}});
ipcMain.handle('backup:export',async()=>{const result=await dialog.showSaveDialog(windowRef,{defaultPath:'apitoolbox-desktop-backup.json',filters:[{name:'API Toolbox backup',extensions:['json']}]});if(result.canceled)return {ok:false,canceled:true};return {ok:true,...writeBackup(result.filePath,state)};});
ipcMain.handle('backup:import',async()=>{const result=await dialog.showOpenDialog(windowRef,{properties:['openFile'],filters:[{name:'API Toolbox backup',extensions:['json']}]});if(result.canceled)return {ok:false,canceled:true};const incoming=importBackup(fs.readFileSync(result.filePaths[0],'utf8'),state);state=incoming;persist();send('state:changed',safeSnapshot());return {ok:true,path:result.filePaths[0]};});
ipcMain.handle('jobs:status',()=>jobs.status());
ipcMain.handle('app:openDataFolder',()=>shell.openPath(dataRoot()));
ipcMain.handle('notifications:show',(_,title,body)=>{if(Notification.isSupported())new Notification({title:String(title).slice(0,100),body:String(body).slice(0,500)}).show();return true;});
