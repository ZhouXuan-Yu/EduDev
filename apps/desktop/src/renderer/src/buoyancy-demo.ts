import {analyzeBuoyancy,type BuoyancyInput} from '../../shared/buoyancy';
import {validBuoyancyDemo,type BuoyancyDemo} from '../../shared/buoyancy-demo';

// Build-time browser entry: no Node, provider, fetch, parent access or persisted learner data.
const node=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const spec:BuoyancyDemo=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(node('buoyancy-data').textContent!.trim()),c=>c.charCodeAt(0))));
if(!validBuoyancyDemo(spec))throw Error('invalid buoyancy demonstration');
const initial=structuredClone(spec.model),base=analyzeBuoyancy(initial).values!;
const rho=(v:NonNullable<BuoyancyInput['blockDensity']>)=>Number(v.value)*(v.unit==='g/cm^3'?1000:1);
let state={block:rho(initial.blockDensity!),liquid:rho(initial.liquidDensity!),load:Number(base.load.decimal),placement:'free' as 'free'|'bottom'};
const start={...state};let timer:ReturnType<typeof setTimeout>|undefined;
const play=node<HTMLButtonElement>('play'),svg=node<SVGElement & HTMLElement>('scene');
const shown=(n:number,digits=1)=>Number(n.toFixed(digits)).toString();
const set=(id:string,text:string)=>{node(id).textContent=text;};
function input():BuoyancyInput{return{...initial,blockDensity:{value:String(state.block),unit:'kg/m^3'},liquidDensity:{value:String(state.liquid),unit:'kg/m^3'},downwardLoad:{value:String(state.load),unit:'N'},placement:state.placement};}
function pause(){clearTimeout(timer);timer=undefined;play.textContent='播放载荷变化';play.setAttribute('aria-pressed','false');}
function draw(){
 const r=analyzeBuoyancy(input()),q=r.values!;
 set('regime',r.state==='constraint_conflict'?'此条件不能保持触底静止':r.regime==='floating'?'漂浮平衡':r.regime==='neutral'?'全浸没临界 · 深度不唯一':state.placement==='bottom'?'全浸没触底静止':'超载 · 完全浸没未触底');
 const facts:{[id:string]:string}={volume:shown(Number(q.volume.decimal),9)+' m³',mass:shown(Number(q.mass.decimal),6)+' kg',weight:shown(Number(q.weight.decimal))+' N',buoyancy:shown(Number(q.buoyancy.decimal))+' N',maximum:shown(Number(q.maximumBuoyancy.decimal))+' N',downward:shown(Number(q.totalDownwardForce.decimal))+' N',net:shown(Number(q.netDownwardForce.decimal))+' N',support:q.supportForce?shown(Number(q.supportForce.decimal))+' N':'不成立',immersed:shown(Number(q.immersedHeight.decimal)*100)+' cm',emerged:shown(Number(q.emergedHeight.decimal)*100)+' cm',displaced:shown(Number(q.displacedVolume.decimal),9)+' m³',critical:shown(Number(q.criticalLoad.decimal))+' N'};
 Object.entries(facts).forEach(([id,value])=>set(id,value));
 set('model-note',r.state==='constraint_conflict'?'浮力大于向下力，没有额外向下约束就不能触底静止；请切回自由状态。':r.regime==='floating'?'图示为最终漂浮平衡，不模拟到达平衡的运动。':r.regime==='neutral'?'全浸没时合力为0；此模型不能唯一确定悬浮深度。图中虚线位置仅为示意。':state.placement==='bottom'?'底面须仍受液体作用，支撑力抵消多出的向下力，合力为0。密封贴底不适用。':'此处计算完全浸没未触底时的向下合力。图中位置不代表实际深度，合力方向不等于速度方向。');
 const top=state.placement==='bottom'?300:r.regime==='floating'?150-Number(q.emergedHeight.decimal)/Number(q.side.decimal)*100:r.regime==='neutral'?150:200;
 node('cube').setAttribute('y',String(top));node('cube').setAttribute('stroke-dasharray',r.regime==='neutral'?'5 4':'none');
 node('cube-label').setAttribute('y',String(top+46));
 node('force-up').setAttribute('d',`M 200 ${top+80} v -${20+Number(q.buoyancy.decimal)/Number(q.maximumBuoyancy.decimal)*60}`);
 node('force-down').setAttribute('d',`M 280 ${top+20} v ${Math.min(105,20+Number(q.totalDownwardForce.decimal)/Number(q.maximumBuoyancy.decimal)*60)}`);
 svg.dataset.regime=r.regime!;svg.dataset.placement=state.placement;svg.dataset.immersed=q.immersedHeight.decimal;
 const conflict=r.state==='constraint_conflict';node('cube').setAttribute('opacity',conflict?'0.25':'1');
 for(const key of ['block','load'] as const){node<HTMLInputElement>(key).value=String(state[key]);node<HTMLInputElement>(key+'-number').value=String(state[key]);}
 node<HTMLSelectElement>('liquid').value=String(state.liquid);node<HTMLSelectElement>('placement').value=state.placement;
}
function update(key:'block'|'load',raw:string){
 pause();const n=Number(raw),min=key==='block'?200:0,max=key==='block'?950:6;
 if(!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/.test(raw)||!Number.isFinite(n)||n<min||n>max){set('input-error',key==='block'?'木块密度须为200–950kg/m³，已保留上次有效结果。':'载荷须为0–6N，已保留上次有效结果。');return;}
 set('input-error','');state[key]=n;draw();
}
for(const key of ['block','load'] as const)for(const id of [key,key+'-number'])node<HTMLInputElement>(id).addEventListener('input',e=>update(key,(e.target as HTMLInputElement).value));
node<HTMLSelectElement>('liquid').addEventListener('change',e=>{pause();const value=Number((e.target as HTMLSelectElement).value);if(![800,1000,1200].includes(value)){set('input-error','请选择800、1000或1200kg/m³。');return;}state.liquid=value;set('input-error','');draw();});
node<HTMLSelectElement>('placement').addEventListener('change',e=>{pause();const value=(e.target as HTMLSelectElement).value;if(value!=='free'&&value!=='bottom')return;state.placement=value;draw();});
play.addEventListener('click',()=>{
 if(timer!==undefined){pause();return;}
 set('input-error','');state.placement='free';if(state.load>=6)state.load=0;
 play.textContent='暂停';play.setAttribute('aria-pressed','true');
 const tick=()=>{state.load=Number(Math.min(6,state.load+0.1).toFixed(6));draw();if(state.load>=6)pause();else timer=setTimeout(tick,500);};
 timer=setTimeout(tick,500);
});
node('reset').addEventListener('click',()=>{pause();state={...start};set('input-error','');draw();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('pagehide',pause);
const phases=[
 ['观察','保持初始条件，观察露出与浸入部分，比较向下力和浮力。'],
 ['预测','先不操作：只增加载荷，排液体积会怎样改变？何时完全浸没？请说出理由。'],
 ['实验','保持其余参数不变，逐步改变一个参数。可用播放观察载荷等步长变化，暂停后记录。'],
 ['解释','用F浮=ρ液gV排和完整受力关系解释观察。漂浮时浮力平衡向下力；完全浸没后不能继续增加排液体积。'],
 ['检查','问题①：木块密度保持初值、液体800、载荷0，能否漂浮，浮力多少？问题②：液体1000、载荷5N且完全浸没未触底，向下力减浮力是多少？先预测，再用控件检验。']
];
document.querySelectorAll<HTMLButtonElement>('[data-phase]').forEach(b=>b.addEventListener('click',()=>{pause();const [label,text]=phases[Number(b.dataset.phase)];set('phase-title',label);set('phase-text',text);document.querySelectorAll('[data-phase]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));
const check1=analyzeBuoyancy({...initial,liquidDensity:{value:'800',unit:'kg/m^3'},downwardLoad:{value:'0',unit:'N'}}),check2=analyzeBuoyancy({...initial,liquidDensity:{value:'1000',unit:'kg/m^3'},downwardLoad:{value:'5',unit:'N'}});
set('teacher-answer',`检查①：${check1.regime==='floating'?'可漂浮':check1.regime==='neutral'?'全浸没临界':'超载不能漂浮'}，浮力${shown(Number(check1.values!.buoyancy.decimal))}N。检查②：完全浸没时向下力减浮力=${shown(Number(check2.values!.totalDownwardForce.decimal)-Number(check2.values!.maximumBuoyancy.decimal))}N；正值向下，负值向上，0为临界。若触底静止还需单独核对支持力。两题依本页原始模型，改变其他条件后须重新计算。`);
node('teacher-toggle').addEventListener('click',()=>{const b=node('teacher-toggle'),panel=node('teacher-answer'),open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(open));panel.hidden=!open;});
set('fixed-conditions',`边长${shown(Number(base.side.decimal)*100,6)}cm · g=${initial.gravity!.value}N/kg · 按当前任务声明的条件计算，原题出处沿任务引用核对`);
draw();
