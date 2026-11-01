import {createHash} from 'node:crypto';

function canonical(value:unknown,budget:{nodes:number;characters:number},depth=0):unknown {
  if(depth>32||++budget.nodes>16384)throw Error('bounded');
  if(typeof value==='string'){budget.characters+=value.length;if(budget.characters>1024*1024)throw Error('bounded');}
  if(Array.isArray(value))return value.map(v=>canonical(v,budget,depth+1));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>{
    budget.characters+=k.length;if(budget.characters>1024*1024)throw Error('bounded');return[k,canonical(v,budget,depth+1)];
  }));
  return value;
}
const due=(count:number)=>[3,5,8].includes(count)||(count>=16&&Number.isInteger(Math.log2(count)));
/** DSH advisories extended to short cycles; bounded hashes only, no execution gate. */
export function createRepeatToolReminder() {
  const history:string[]=[];
  let cycle:{signature:string;period:number;count:number;phase:number}|undefined;
  function reset(){history.length=0;cycle=undefined;}
  return {
    reset,
    observe(tool:string,args:unknown,result:unknown):string|undefined {
      let encoded:string;
      try{const budget={nodes:0,characters:0};encoded=JSON.stringify(canonical([tool,args,result],budget));}catch{reset();return;}
      if(encoded.length>1024*1024){reset();return;}
      const key=createHash('sha256').update(encoded).digest('hex');
      history.push(key);if(history.length>12)history.shift();
      let period=0;
      for(let p=1;p<=4;p++)if(history.length>=3*p&&Array.from({length:2*p},(_,i)=>history[history.length-1-i]===history[history.length-1-i-p]).every(Boolean)){period=p;break;}
      if(!period){cycle=undefined;return;}
      const block=history.slice(-period),signature=block.map((_,i)=>[...block.slice(i),...block.slice(0,i)].join('')).sort()[0];
      if(!cycle||cycle.period!==period||cycle.signature!==signature)cycle={signature,period,count:3,phase:0};
      else{if(++cycle.phase<period)return;cycle.phase=0;cycle.count++;}
      if(!due(cycle.count))return;
      const repeated=period===1?`同一工具及参数已连续 ${cycle.count} 次得到相同结果。`:`最近 ${period} 步的相同工具、参数及结果循环已连续重复 ${cycle.count} 轮。`;
      return repeated+'请检查是否有实际进展，调整方法或如实说明阻碍；不要原样重复失败或已拒绝的写入。只有任务明确需要持续监测时才继续轮询。此提醒不是新权限，也不代表工具已完成。';
    },
  };
}
