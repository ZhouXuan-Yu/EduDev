// Frozen synthetic FX01 input/content for host acceptance. Not an AI quality result.
export const fx01Revision='FX01-20261102-full-static-equilibrium-v1';
export const fx01Input='为八年级制作一节10分钟的浮力科普课。主线题：边长10cm正方体木块，密度600kg/m³，水密度1000kg/m³，g=10N/kg，容器足够大且足够深。木块可附加向下的载荷力，忽略载荷体积与空气浮力，载荷不脱落。生成一份8页可编辑PPTX，每页有教师讲解备注；一份离线HTML动态演示，可调木块密度、液体密度、载荷，能重置，数据与图示联动。PPT含2道理解检查，学生可见页不直接显示答案，教师备注保留答案。给我实际文件。题目为合成自拟，不能说来自题库。';
// Independent frozen answers, not calculated with the HTML implementation.
export const fx01Cases=[
 {id:'default',wood:600,liquid:1000,load:0,mass:0.6,weight:6,total:6,buoyancy:6,max:10,volume:600,depth:6,exposed:4,net:0,status:'漂浮平衡'},
 {id:'neutral',wood:600,liquid:1000,load:4,mass:0.6,weight:6,total:10,buoyancy:10,max:10,volume:1000,depth:10,exposed:0,net:0,status:'中性浮力边界'},
 {id:'overload',wood:600,liquid:1000,load:5,mass:0.6,weight:6,total:11,buoyancy:10,max:10,volume:1000,depth:10,exposed:0,net:1,status:'未触底，向下合力'},
 {id:'lighter-liquid',wood:600,liquid:800,load:0,mass:0.6,weight:6,total:6,buoyancy:6,max:8,volume:750,depth:7.5,exposed:2.5,net:0,status:'漂浮平衡'},
 {id:'lighter-wood',wood:500,liquid:1000,load:0,mass:0.5,weight:5,total:5,buoyancy:5,max:10,volume:500,depth:5,exposed:5,net:0,status:'漂浮平衡'},
];

export const fx01Html=String.raw`<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>浮力：从漂浮到下沉</title>
<style>
*{box-sizing:border-box}body{margin:0;color:#18283c;background:#f4f7fb;font:18px/1.6 system-ui,"Microsoft YaHei",sans-serif}
main{max-width:1140px;padding:24px;margin:auto}h1{font-size:30px;margin:0}h2{font-size:20px;margin:0 0 12px}p{margin:8px 0}
.columns{display:grid;grid-template-columns:340px 1fr;gap:20px;margin:20px 0}.card{background:white;border:1px solid #d9e1ec;border-radius:14px;padding:20px}
label{display:block;margin-bottom:18px}input,select,button{font:inherit}input[type=range]{width:100%;margin-top:10px}input[type=number]{width:100px}select{padding:5px}
button{padding:8px 20px;border:1px solid #aac0db;background:#edf4ff;border-radius:8px;cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #2563eb;outline-offset:3px}
dl{display:grid;grid-template-columns:1fr 1fr;gap:5px 12px;margin:0}dt{color:#4b596c}dd{margin:0;font-variant-numeric:tabular-nums}svg{display:block;width:100%;max-height:330px}
#status{font-weight:600;color:#174d87}#limit-message{min-height:29px;color:#8d4500}.muted{color:#526177;font-size:16px}.formula{font-family:serif;font-size:21px}
@media(max-width:760px){.columns{grid-template-columns:1fr}main{padding:16px}h1{font-size:25px}}
</style>
<main><h1>浮力：从漂浮到下沉</h1><p>八年级 · 10分钟课堂演示 · 合成自拟题</p>
<p class="muted">边长10cm，g=10N/kg；容器足够大且深。忽略空气浮力和载荷体积，载荷始终附着。无底面接触。</p>
<div class="columns"><section class="card" aria-label="实验参数"><h2>一次只改变一个变量</h2>
<label>木块密度（kg/m³）<input id="wood-number" type="number" min="200" max="950" step="1" value="600" aria-label="木块密度数值"><input id="wood" type="range" min="200" max="950" step="1" value="600" aria-label="木块密度滑块"></label>
<label>液体密度（kg/m³）<select id="liquid" aria-label="液体密度"><option value="800">800</option><option value="1000" selected>1000（水）</option><option value="1200">1200</option></select></label>
<label>附加载荷（N）<input id="load-number" type="number" min="0" max="6" step="0.1" value="0" aria-label="载荷数值"><input id="load" type="range" min="0" max="6" step="0.1" value="0" aria-label="载荷滑块"></label>
<button id="reset" type="button">重置实验</button><p id="limit-message" role="status" aria-live="polite"></p>
<p class="muted">范围：木块200–950kg/m³；液体800/1000/1200kg/m³；载荷0–6N。非法数值不参与计算，并说明限制。</p></section>
<section class="card" aria-label="实验结果"><h2 id="status" aria-live="polite"></h2>
<svg id="scene" viewBox="0 0 480 310" role="img" aria-labelledby="scene-title scene-desc"><title id="scene-title">木块与液面示意</title><desc id="scene-desc"></desc>
<rect x="20" y="130" width="440" height="170" fill="#c3e7ff"/><path d="M20 130H460" stroke="#1376ae" stroke-width="3"/>
<text x="325" y="118" fill="#125b85">液面</text><g id="block"><rect x="175" y="0" width="100" height="100" fill="#c69757" stroke="#805526" stroke-width="2"/><text x="184" y="55" font-size="18">10cm木块</text></g>
<text id="scene-label" x="28" y="30" font-size="18" fill="#18283c"></text><text x="28" y="286" font-size="15" fill="#125b85">教学示意；未显示底面，不计算运动时间</text></svg>
<dl id="readings"><dt>木块质量</dt><dd><output id="mass"></output> kg</dd><dt>木块重力</dt><dd><output id="weight"></output> N</dd>
<dt>总向下力</dt><dd><output id="total"></output> N</dd><dt>最大浮力</dt><dd><output id="max"></output> N</dd>
<dt>当前浮力</dt><dd><output id="buoyancy"></output> N</dd><dt>排液体积</dt><dd><output id="volume"></output> cm³</dd>
<dt>浸入高度</dt><dd><output id="depth"></output> cm</dd><dt>露出高度</dt><dd><output id="exposed"></output> cm</dd>
<dt>向下合力</dt><dd><output id="net"></output> N</dd></dl></section></div>
<section class="card"><p class="formula">F浮 = ρ液 g V排　　V木 = 0.001m³　　底面积 = 0.01m²</p>
<p id="explanation"></p><p class="muted">这是静力关系的交互教学示意，并未做真实速度/加速度的时间积分。中性浮力时仅由平衡条件不能唯一确定完全浸没后的深度；全浸没图示位置不代表唯一解。若木块触底静止，应另计支撑力；本演示不把支撑力混为浮力。</p></section></main>
<script>
(()=>{'use strict';const $=id=>document.getElementById(id),state={wood:600,liquid:1000,load:0};
function render(){const volume=0.001,area=0.01,g=10,mass=state.wood*volume,weight=mass*g,total=weight+state.load,max=state.liquid*g*volume;
 const buoyancy=Math.min(total,max),displaced=buoyancy/(state.liquid*g),depth=displaced/area*100,exposed=Math.max(0,10-depth),net=Math.max(0,total-max);
 const status=total<max-1e-9?'漂浮平衡':total>max+1e-9?'未触底，向下合力':'中性浮力边界';
 for(const [key,value] of Object.entries({mass,weight,total,max,buoyancy,volume:displaced*1e6,depth,exposed,net}))$(key).textContent=value.toFixed(1);
 $('status').textContent=status;$('block').setAttribute('transform','translate(0,'+(net>1e-9?170:130-(10-depth)*10)+')');
 const description='木块密度'+state.wood+'，液体密度'+state.liquid+'，载荷'+state.load+'N；'+status+'；浸入'+depth.toFixed(1)+'cm，浮力'+buoyancy.toFixed(1)+'N';
 $('scene-desc').textContent=description;$('scene-label').textContent='载荷 '+state.load.toFixed(1)+' N · '+status;
 $('explanation').textContent=net>1e-9?'全浸没后浮力达到上限；尚未触底，向下合力为'+net.toFixed(1)+'N。若另有底面支撑而静止，支撑力才等于此差值。':total>=max-1e-9?'总向下力等于最大浮力，是全浸没/中性浮力边界，不能仅由受力平衡确定悬浮深度。':'先由平衡求浮力，再由排液体积求浸入高度；浮力不等于物体整个体积所对应的最大浮力。';
 for(const key of ['wood','load']){ $(key).value=state[key];$(key+'-number').value=state[key]; }$('liquid').value=state.liquid;
}
function update(key,value){const number=Number(value),min=key==='wood'?200:0,max=key==='wood'?950:6;
 if(value.trim()===''||!Number.isFinite(number)||number<min||number>max){$('limit-message').textContent='输入无效：'+(key==='wood'?'木块密度须为200–950kg/m³':'载荷须为0–6N')+'，已保留上一有效值。';render();return;}
 state[key]=number;$('limit-message').textContent='';render();}
for(const key of ['wood','load']){ $(key).addEventListener('input',e=>update(key,e.target.value));$(key+'-number').addEventListener('change',e=>update(key,e.target.value)); }
$('liquid').addEventListener('change',e=>{const value=Number(e.target.value);if([800,1000,1200].includes(value)){state.liquid=value;$('limit-message').textContent='';render();}});
$('reset').addEventListener('click',()=>{Object.assign(state,{wood:600,liquid:1000,load:0});$('limit-message').textContent='';render();});render();})();
</script></html>`;
