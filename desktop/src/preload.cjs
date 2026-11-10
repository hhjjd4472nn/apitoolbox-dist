const {contextBridge, ipcRenderer} = require('electron');
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld('atb', {
  snapshot: () => invoke('app:snapshot'),
  modules: () => invoke('app:modules'),
  setTheme: theme => invoke('app:setTheme', theme),
  toggleProxy: enabled => invoke('app:toggleProxy', enabled),
  showLocalKey: () => invoke('app:localKey'),
  upsertAccount: account => invoke('accounts:upsert', account),
  deleteAccount: (moduleId, identity) => invoke('accounts:delete', moduleId, identity),
  toggleAccount: (moduleId, identity, field, value) => invoke('accounts:toggle', moduleId, identity, field, value),
  credentialStatus: (moduleId, identity) => invoke('accounts:credentialStatus', moduleId, identity),
  sync: (pairCode, manualIp) => invoke('sync:run', pairCode, manualIp),
  forgetPhone: () => invoke('sync:forgetPhone'),
  toggleModule: (id, enabled) => invoke('modules:toggle', id, enabled),
  updateSettings: patch => invoke('settings:update', patch),
  checkUpdate: () => invoke('update:check'),
  exportBackup: () => invoke('backup:export'),
  importBackup: () => invoke('backup:import'),
  jobsStatus: () => invoke('jobs:status'),
  openDataFolder: () => invoke('app:openDataFolder'),
  notify: (title, body) => invoke('notifications:show', title, body),
  onState: fn => { const listener = (_, payload) => fn(payload); ipcRenderer.on('state:changed', listener); return () => ipcRenderer.removeListener('state:changed', listener); },
  onSyncProgress: fn => { const listener = (_, payload) => fn(payload); ipcRenderer.on('sync:progress', listener); return () => ipcRenderer.removeListener('sync:progress', listener); }
});