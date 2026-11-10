import {appendLog,saveState} from './state.mjs';
export class JobQueue {
  constructor(state){this.state=state;this.jobs=new Map();}
  register(id,handler,{intervalMs=0,runOnStart=false}={}){if(this.jobs.has(id))this.remove(id);const record={id,intervalMs,running:false,lastRunAt:0,lastResult:null,failures:0};const execute=async()=>{if(record.running)return {ok:false,error:'job_already_running'};record.running=true;record.lastRunAt=Date.now();try{record.lastResult=await handler();record.failures=0;appendLog(this.state,'info','job_success',{id});return {ok:true,result:record.lastResult};}catch(error){record.failures++;record.lastResult={error:error.message};appendLog(this.state,'error','job_failure',{id,message:error.message});return {ok:false,error:error.message};}finally{record.running=false;saveState(this.state);}};record.execute=execute;if(intervalMs>0)record.timer=setInterval(execute,intervalMs);this.jobs.set(id,record);if(runOnStart)execute();return record;}
  remove(id){const item=this.jobs.get(id);if(!item)return false;if(item.timer)clearInterval(item.timer);this.jobs.delete(id);return true;}
  stop(){for(const id of this.jobs.keys())this.remove(id);}
  status(){return [...this.jobs.values()].map(({timer,execute,...publicRecord})=>publicRecord);}
}