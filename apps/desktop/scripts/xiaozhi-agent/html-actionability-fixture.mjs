const result='<output id="result">0</output>',set="document.getElementById('result').textContent='10'",trusted="document.getElementById('result').textContent=event.isTrusted?'10':'-1'";
const html=body=>'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>body{font:20px sans-serif;padding:24px}button,input,select,textarea{font:inherit;margin:12px;padding:8px}button{min-width:150px;min-height:48px}output{display:block}</style><h1>教学演示控件</h1>'+body+result+'</html>';
const click=(id,body,expected='failed')=>({id,html:html(body),rules:{interactions:[{id:'probe',actions:[{kind:'click',selector:'#control'}],observe:'#result',expectedNumber:10}]},expected});
const value=(id,body,value,expected='passed',expectedText)=>({id,html:html(body),rules:{interactions:[{id:'probe',actions:[{kind:'set',selector:'#control',value}],observe:'#result',...(expectedText?{expectedText}:{expectedNumber:10})}]},expected});
export const htmlActionabilityFixtures=[
 click('covered',`<button id="control" onclick="${set}">开始演示</button><div style="position:fixed;inset:0;z-index:10;background:rgba(255,255,255,.01)"></div>`),
 click('hidden',`<button id="control" style="display:none" onclick="${set}">开始</button>`),
 click('transparent-ancestor',`<div style="opacity:0"><button id="control" onclick="${set}">开始</button></div>`),
 click('inert',`<div inert><button id="control" onclick="${set}">开始</button></div>`),
 click('aria-disabled',`<button id="control" aria-disabled="true" onclick="${set}">开始</button>`),
 click('pointer-disabled',`<button id="control" style="pointer-events:none" onclick="${set}">开始</button>`),
 click('duplicate',`<button id="control" onclick="${set}">开始一</button><button id="control" onclick="${set}">开始二</button>`),
 value('readonly',`<input id="control" readonly value="1" oninput="${set}">`,'5','failed'),
 value('disabled',`<input id="control" disabled value="1" oninput="${set}">`,'5','failed'),
 click('native-trusted-click',`<button id="control" onclick="${trusted}">开始</button>`,'passed'),
 click('native-nested-click',`<button id="control" onclick="${trusted}"><span>开始演示</span></button>`,'passed'),
 value('native-range',`<input id="control" type="range" min="0" max="6" step="1" value="0" oninput="${trusted}">`,'4'),
 value('native-number',`<input id="control" type="number" value="1" oninput="${trusted}">`,'5'),
 value('native-text',`<input id="control" value="旧内容" oninput="document.getElementById('result').textContent=event.isTrusted?this.value:'-1'">`,'中文5','passed','中文5'),
 value('native-select',`<select id="control" onchange="document.getElementById('result').textContent=event.isTrusted?this.value:'-1'"><option value="a">甲</option><option value="b">乙</option></select>`,'b','passed','b'),
 value('disabled-option',`<select id="control" onchange="${set}"><option value="a">甲</option><option value="b" disabled>乙</option></select>`,'b','failed'),
 click('below-fold',`<div style="height:1300px">向下滚动</div><button id="control" onclick="${trusted}">底部开始</button>`,'passed'),
 {id:'native-key',html:html(`<input id="control" type="range" min="0" max="6" step="1" value="0" oninput="${trusted}">`),rules:{interactions:[{id:'probe',actions:[{kind:'key',selector:'#control',key:'ArrowRight'}],observe:'#result',expectedNumber:10}]},expected:'passed'},
];
export const htmlInputBoundaryFixtures=[
 value('continuous-range',`<input id="control" type="range" step="any" value="0" oninput="${set}">`,'25','unchecked'),
 value('unsupported-date',`<input id="control" type="date" oninput="${set}">`,'2026-11-02','unchecked'),
 value('bounded-range',`<input id="control" type="range" min="0" max="10000" value="0" oninput="${set}">`,'5000','unchecked'),
 value('empty-text',`<input id="control" value="旧内容" oninput="${trusted}">`,'','passed'),
];
