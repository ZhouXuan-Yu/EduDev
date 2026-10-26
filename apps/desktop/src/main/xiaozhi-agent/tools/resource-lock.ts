// Process-wide: a timed-out writer holds its lock until its actual work settles.
const resources=new Map<string,{readers:number;writer:boolean}>();
export function acquireToolResource(key:string|undefined,mode:'read'|'write'){
 if(!key)return()=>{};
 const state=resources.get(key)||{readers:0,writer:false};
 if(state.writer||mode==='write'&&state.readers>0)throw Error('resource_busy');
 if(mode==='write')state.writer=true;else state.readers++;
 resources.set(key,state);let released=false;
 return()=>{if(released)return;released=true;if(mode==='write')state.writer=false;else state.readers--;if(!state.writer&&state.readers===0)resources.delete(key);};
}
