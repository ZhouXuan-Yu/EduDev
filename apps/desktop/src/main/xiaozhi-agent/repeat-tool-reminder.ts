import {createHash} from 'node:crypto';

function canonical(value:unknown):unknown {
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
  return value;
}
/** DSH 3/5/8 advisory pattern. Result digest allows legitimate changing polls. */
export function createRepeatToolReminder() {
  let previous='',count=0;
  return {
    reset(){previous='';count=0;},
    observe(tool:string,args:unknown,result:unknown):string|undefined {
      let encoded:string;
      try{encoded=JSON.stringify([tool,canonical(args),canonical(result)]);}catch{return;}
      if(encoded.length>1024*1024){previous='';count=0;return;}
      const key=createHash('sha256').update(encoded).digest('hex');
      count=key===previous?count+1:1;previous=key;
      if(![3,5,8].includes(count))return;
      return `同一工具及参数已连续 ${count} 次得到相同结果。请检查是否缺少条件或授权，调整方法或如实说明阻碍；不要重复已拒绝的写入。确有必要的轮询仍可继续。此提醒不是新权限。`;
    },
  };
}
