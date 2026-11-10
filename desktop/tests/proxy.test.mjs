import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {initialState} from '../src/core/state.mjs';
import {ProxyServer} from '../src/core/proxy-server.mjs';

async function listen(server){server.listen(0,'127.0.0.1');await once(server,'listening');return server.address().port;}
async function close(server){server.close();await once(server,'close');}
test('module-disabled route cannot proxy or reveal account metadata',async()=>{
 const state=initialState();state.settings.localKey='0123456789abcdef-test';state.modules=state.modules.map(m=>({...m,port:0,enabled:m.id==='vsllm'}));const secret={get:()=>null,set(){}};const proxy=new ProxyServer(state,secret);proxy.start();const server=proxy.servers.get('vsllm');await once(server,'listening');const port=server.address().port;
 try {let r=await fetch(`http://127.0.0.1:${port}/status`);assert.equal(r.status,401);r=await fetch(`http://127.0.0.1:${port}/v1/models`,{headers:{authorization:`Bearer ${state.settings.localKey}`}});assert.equal(r.status,503);assert.equal((await r.json()).error,'no_available_account');} finally {proxy.stop();}
});
test('disabled module endpoints are not opened',async()=>{
 const state=initialState();state.settings.localKey='0123456789abcdef-test';state.modules=[{id:'vsllm',label:'维云',port:0,enabled:false}];const proxy=new ProxyServer(state,{get:()=>null});proxy.start();assert.equal(proxy.servers.size,0);proxy.stop();
});
test('enabled module binds selected ephemeral port and authenticates status',async()=>{
 const state=initialState();state.settings.localBind='127.0.0.1';state.settings.localKey='0123456789abcdef-test';state.modules=[{id:'vsllm',label:'维云',port:0,enabled:true}];state.accounts=[{moduleId:'vsllm',identity:'user-one',username:'user-one',enabled:true,fixed:false,quota:3}];const proxy=new ProxyServer(state,{get:()=>null});proxy.start();const server=proxy.servers.get('vsllm');await once(server,'listening');const port=server.address().port;
 try {const r=await fetch(`http://127.0.0.1:${port}/status`,{headers:{authorization:`Bearer ${state.settings.localKey}`}});assert.equal(r.status,200);const payload=await r.json();assert.equal(payload.accounts[0].identity,'user-one');} finally {proxy.stop();}
});