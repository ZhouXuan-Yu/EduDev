/* Synthetic question selection workbench; no real search or generation. */
(function(D){
 const bank=[
  {id:'PHY-001',point:'浮力方向',type:'选择题',level:'基础',text:'物体浸在水中，所受浮力的方向是什么？',answer:'竖直向上。'},
  {id:'PHY-002',point:'称重法',type:'计算题',level:'基础',text:'物体在空气中测力计示数为3N，浸没后为2N，求浮力。',answer:'F浮=3−2=1N。'},
  {id:'PHY-003',point:'阿基米德原理',type:'实验题',level:'中等',text:'设计实验，比较浮力与排开液体重力的关系。',answer:'测量浮力和排开液体重力，多组比较。'},
  {id:'PHY-004',point:'浮沉条件',type:'解答题',level:'提高',text:'物体受到浮力就一定上浮吗？结合受力解释。',answer:'不一定，应比较浮力与重力及其他作用力。'}
 ];
 let selected=[],query='',point='全部知识点',sequence=0;
 D.paperSelection={snapshot:()=>JSON.parse(JSON.stringify(selected))};
 function render(){
  const area=D.$('#question-selection');if(!area)return;
  const results=bank.filter(q=>(point==='全部知识点'||q.point===point)&&[q.id,q.text,q.point,q.type,q.level].join(' ').includes(query));
  area.innerHTML='<h2>选题与出题工作台</h2><p>直接找题、精确指定原题二改，或按知识点要求补题。以下均为合成样例。</p><div class="paper-field-grid"><label class="field">搜索题号、题干、知识点<input id="question-query" value="'+D.escape(query)+'" placeholder="如 PHY-002、称重法、浮力"></label><label class="field">知识点<select id="question-point">'+['全部知识点',...new Set(bank.map(q=>q.point))].map(p=>'<option '+(point===p?'selected':'')+'>'+p+'</option>').join('')+'</select></label></div><div class="detail-actions"><button class="button primary" id="question-create">按教师需求出题</button><button class="button outline" id="question-auto">默认按蓝图自动选题</button></div><div class="paper-grid"><section><h3>题库结果 · '+results.length+'</h3>'+results.map(q=>'<section class="paper-section"><small>'+q.id+' · '+q.point+' · '+q.type+' · '+q.level+' · 题库原题</small><p>'+q.text+'</p><details><summary>答案与来源</summary><p>'+q.answer+'</p><p>合成题库 · 浮力单元 · 演示版本v1</p></details><button class="button secondary" data-select-question="'+q.id+'" '+(selected.some(s=>s.id===q.id)?'disabled':'')+'>加入试卷</button><button class="button outline" data-adapt-question="'+q.id+'">指定此题二改</button></section>').join('')+(results.length?'':'<p class="empty">没有匹配题目，请调整筛选或按需求出题。</p>')+'</section><aside><h3>已选题篮 · '+selected.length+' 题</h3><p>共 '+selected.reduce((sum,q)=>sum+q.points,0)+' 分；此处是独立选题草稿，尚未提交整卷。</p>'+selected.map((q,i)=>'<section class="paper-section"><small>'+D.escape(q.id)+' · '+D.escape(q.kind||'题库原题')+'</small><p>'+D.escape(q.text)+'</p><small>知识点：'+D.escape(q.point)+(q.parent?' · 原题：'+q.parent:'')+'</small>'+(q.request?'<details><summary>教师要求与二改依据</summary><p>'+D.escape(q.request)+'</p></details>':'')+'<label class="field">分值<input type="number" min="1" max="100" value="'+q.points+'" data-question-score="'+i+'"></label><button class="text-button" data-question-up="'+i+'" '+(!i?'disabled':'')+'>上移</button><button class="text-button" data-question-remove="'+i+'">移除</button></section>').join('')+'<p class="notice">生成/二改题标记为待教师核对。正式产品须核对答案、来源版本、总分与蓝图；不自动替换已选题，不因选入即视为审批通过。</p></aside></div>';
  D.$('#question-query').onchange=e=>{query=e.target.value.trim();render();};D.$('#question-point').onchange=e=>{point=e.target.value;render();};
  D.all('[data-select-question]').forEach(b=>b.onclick=()=>{selected.push({...bank.find(q=>q.id===b.dataset.selectQuestion),points:5});render();});
  D.all('[data-adapt-question]').forEach(b=>b.onclick=()=>generate(bank.find(q=>q.id===b.dataset.adaptQuestion)));
  D.$('#question-create').onclick=()=>generate();
  D.$('#question-auto').onclick=()=>D.form('默认自动选题 · 演示','<p>正式产品按当前蓝图的题型、数量、分值、难度和知识点匹配，不悄悄放宽条件。此原型仅把四道合成题加入草稿，不代表已满足真实蓝图。</p><label><input type="checkbox" name="keep" checked>保留已经手动选择的题目</label>',data=>{if(!data.get('keep'))selected=[];for(const q of bank)if(!selected.some(s=>s.id===q.id))selected.push({...q,points:5});render();},'演示自动选题');
  D.all('[data-question-score]').forEach(input=>input.onchange=()=>{const n=Number(input.value);if(!Number.isInteger(n)||n<1||n>100){D.toast('分值需为1至100的整数');render();return;}selected[+input.dataset.questionScore].points=n;render();});
  D.all('[data-question-remove]').forEach(b=>b.onclick=()=>{selected.splice(+b.dataset.questionRemove,1);render();});
  D.all('[data-question-up]').forEach(b=>b.onclick=()=>{const i=+b.dataset.questionUp;[selected[i-1],selected[i]]=[selected[i],selected[i-1]];render();});
 }
 function generate(parent){
  D.form(parent?'依据 '+parent.id+' 二改':'按教师需求出题',
   (parent?'<p class="notice">原题：'+D.escape(parent.text)+'<br>保留原题ID、版本与二改要求，生成题不覆盖原题。</p>':'')+
   D.field('目标知识点','point',parent?.point||(point==='全部知识点'?'称重法':point))+
   '<label class="field">教师要求<textarea name="request" required rows="3" placeholder="题型、数量、难度、年级；改数字、情境或设问；哪些条件必须保留"></textarea></label><p class="muted">本次仅产生一条待核对的占位草稿，不执行模型，不表示要求已完成。正式页面支持指定数量逐题核对。</p>',data=>{selected.push({id:'DRAFT-'+(++sequence),kind:parent?'二改草稿 · 待核对':'原创草稿 · 待核对',parent:parent?.id,point:String(data.get('point')),request:String(data.get('request')),text:'待生成题目占位：'+String(data.get('request')),points:5});render();},'加入待核对草稿');
 }
 const original=D.paper.render;
 D.paper.render=function(){original();const area=document.createElement('section');area.id='question-selection';area.className='paper-section';D.$('.paper-page').append(area);render();};
})(window.Design);
