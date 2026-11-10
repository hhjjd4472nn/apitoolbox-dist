import http from 'node:http';
import {URL} from 'node:url';
import {appendLog, nextAccount} from './state.mjs';
import {ModuleAdapterRegistry} from './module-adapters.mjs';

const HEADER_DENY = new Set(['host','content-length','connection','authorization','transfer-encoding']);
function json(res,status,value) { const body=JSON.stringify(value); res.writeHead(status,{'content-type':'application/json','content-length':Buffer.byteLength(body),'cache-control':'no-store'}); res.end(body); }
async function readBody(req,limit=8*1024*1024) { const chunks=[]; let size=0; for await (const chunk of req) { size+=chunk.length; if (size>limit) throw new Error('request_body_too_large'); chunks.push(chunk); } return Buffer.concat(chunks); }
function authOk(req,key) { return typeof key==='string'&&key.length>=16&&req.headers.authorization===`Bearer ${key}`; }
export function upstreamPath(moduleId,pathName,body='') {
  let path=pathName||'/';
  if (moduleId==='vsllm') { while(path.startsWith('/v1/v1'))path=path.slice(3); if ((path==='/v1'||path==='/v1/')&&body) { try { const value=JSON.parse(body); path=value.input&&!value.messages?'/v1/responses':'/v1/chat/completions'; } catch { path='/v1/chat/completions'; } } }
  return path;
}
export class ProxyServer {
  constructor(state,secrets,{fetcher=fetch}={}) { this.state=state; this.secrets=secrets; this.servers=new Map(); this.started=false; this.adapters=new ModuleAdapterRegistry({state,secrets,fetcher}); }
  localKey() { return this.state.settings.localKey || this.secrets.get('desktop:local-proxy-key') || ''; }
  module(id) { return this.state.modules.find(row=>row.id===id); }
  async pipe(response,res) {
    const headers=Object.fromEntries([...response.headers].filter(([name])=>!HEADER_DENY.has(name.toLowerCase())));
    res.writeHead(response.status,headers);
    if(response.body) for await(const chunk of response.body) if(!res.write(chunk)) await new Promise(resolve=>res.once('drain',resolve));
    res.end();
  }
  async forward(id,req,res,body) {
    const account=nextAccount(this.state,id); if(!account)return json(res,503,{error:'no_available_account',module:id});
    try { const response=await this.adapters.request(id,account,req.method,new URL(req.url,'http://127.0.0.1').pathname,body,req.headers); await this.pipe(response,res); }
    catch(error) { appendLog(this.state,'error','proxy_error',{module:id,message:String(error.message).slice(0,300)}); if(!res.headersSent)json(res,error.message==='request_body_too_large'?413:502,{error:error.message==='request_body_too_large'?'request_body_too_large':'upstream_error',message:error.message}); else res.end(); }
  }
  handler(id) {
    return async(req,res)=>{
      const module=this.module(id);
      if(!module?.enabled)return json(res,503,{error:'module_disabled',module:id});
      if(!authOk(req,this.localKey()))return json(res,401,{error:'unauthorized'});
      const url=new URL(req.url,'http://127.0.0.1');
      if(url.pathname==='/status'&&req.method==='GET')return json(res,200,{module:id,port:module.port,adapter:!!this.adapters.adapter(id),accounts:this.state.accounts.filter(row=>row.moduleId===id).map(row=>({identity:row.identity,enabled:row.enabled,fixed:row.fixed,quota:row.quota,lastResult:row.lastResult||null}))});
      if(url.pathname==='/v1/models'&&req.method==='GET')return this.forward(id,req,res,Buffer.alloc(0));
      if(!url.pathname.startsWith('/v1/')&&!(id==='wbhub'&&url.pathname==='/v2/chat/completions'))return json(res,404,{error:'not_found'});
      try { const body=await readBody(req); return this.forward(id,req,res,body); }
      catch(error) { return json(res,error.message==='request_body_too_large'?413:400,{error:error.message}); }
    };
  }
  start() {
    if(this.started)return;
    this.started=true;
    for(const module of this.state.modules) {
      if(!module.enabled)continue;
      const server=http.createServer((req,res)=>this.handler(module.id)(req,res));
      server.on('error',error=>appendLog(this.state,'error','proxy_listen_error',{module:module.id,port:module.port,message:error.message}));
      server.listen(module.port,this.state.settings.localBind); this.servers.set(module.id,server);
    }
  }
  stop() { for(const server of this.servers.values())server.close(); this.servers.clear(); this.started=false; }
}