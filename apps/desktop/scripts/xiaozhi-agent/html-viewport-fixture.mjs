const rules={interactions:[
 {id:'start',actions:[{kind:'click',selector:'#start'}],observe:'#result',expectedNumber:10},
 {id:'keyboard',actions:[{kind:'key',selector:'#load',key:'ArrowRight'}],observe:'#result',expectedNumber:1},
 {id:'reset',actions:[{kind:'set',selector:'#load',value:'5'},{kind:'click',selector:'#reset'}],observe:'#result',expectedNumber:0},
 {id:'canvas',actions:[{kind:'set',selector:'#load',value:'4'}],observe:'#scene'},
]};
const page=condition=>`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>body{font:20px sans-serif;margin:24px}button,input{font:inherit;margin:12px;padding:8px}canvas,output{display:block}#veil{display:none;position:fixed;inset:0;z-index:10;background:rgba(255,255,255,.01)}${condition?`@media (${condition}){#veil{display:block}}`:''}</style><h1>双尺寸课堂控件</h1><button id="start" onclick="result.textContent=event.isTrusted?'10':'-1'">开始</button><input id="load" type="range" min="0" max="6" step="1" value="0"><button id="reset" onclick="load.value=0;draw()">重置</button><output id="result">0</output><canvas id="scene" width="320" height="140"></canvas><div id="veil"></div><script>function draw(){result.textContent=String(Number(load.value));const c=scene.getContext('2d');c.clearRect(0,0,320,140);c.fillStyle='#2563eb';c.fillRect(20,20,20+Number(load.value)*40,90)}load.oninput=()=>{if(!event.isTrusted){result.textContent='-1';return}draw()};draw();</script></html>`;
export const htmlViewportFixtures=[
 {id:'narrow-covered',html:page('max-width:1500px'),rules,expected:{'1366×768':'failed','1920×1080':'passed'}},
 {id:'wide-covered',html:page('min-width:1600px'),rules,expected:{'1366×768':'passed','1920×1080':'failed'}},
 {id:'both-operable',html:page(''),rules,expected:{'1366×768':'passed','1920×1080':'passed'}},
];
