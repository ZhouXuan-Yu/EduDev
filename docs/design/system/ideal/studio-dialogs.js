/* Upload and AI are explicit workflow simulations. Nothing leaves the browser. */
(function(D){
  const S=D.studio,e=D.escape;
  const btn=(text,id,primary=true)=>`<button type="button" class="button ${primary?'primary':'outline'}" id="${id}">${text}</button>`;
  function dialog(title,body){
    const m=D.dialog(title,body);m.classList.add('qs-dialog');
    m.addEventListener('close',()=>m.classList.remove('qs-dialog'),{once:true});return m;
  }
  function done(m,message){S.save();m.close();S.render();D.toast(message);}
  function edit(id){
    const q=S.state.draft.items.find(x=>x.id===id);
    const m=dialog('编辑与核对题目',`<p class="muted">${e(q.kind)} · ${e(q.source||'教师提供')} · 修改题干后需重新核对答案</p><form id="qs-edit-form"><label class="field">题干<textarea name="text" required rows="4">${e(q.text)}</textarea></label>${q.options?`<label class="field">选项（每行一项）<textarea name="options" rows="4">${e(q.options.join('\n'))}</textarea></label>`:''}<div class="qs-form-grid"><label class="field">答案<textarea name="answer" rows="3">${e(q.answer||'')}</textarea></label><label class="field">解析<textarea name="analysis" rows="3">${e(q.analysis||'')}</textarea></label></div><label class="qs-check"><input type="checkbox" name="reviewed">我已核对当前题干、图片、答案与解析</label><div class="dialog-footer"><button type="button" data-close class="button outline">取消</button><button class="button primary" type="submit">保存本题</button></div></form>`);
    const form=D.$('#qs-edit-form',m);
    form.oninput=event=>{if(event.target.name!=='reviewed')form.elements.reviewed.checked=false;};
    form.onsubmit=event=>{
      event.preventDefault();const data=new FormData(form);
      if(data.get('reviewed')&&(!String(data.get('answer')).trim()||!String(data.get('analysis')).trim())){D.toast('核对前请补充答案和解析。');return;}
      q.text=String(data.get('text')).trim();q.answer=String(data.get('answer')).trim();q.analysis=String(data.get('analysis')).trim();
      if(q.options)q.options=String(data.get('options')).split('\n').filter(Boolean);
      q.reviewed=!!data.get('reviewed');q.revision++;q.kind='教师编辑';done(m,q.reviewed?'已保存并核对本题。':'已保存修改，本题待重新核对。');
    };
  }
  function upload(){
    const m=dialog('上传或粘贴题目',`<p class="muted">先检查题目边界，再加入当前题组。不会自动存入正式题库。</p><label class="field">选择文件<input id="qs-upload-file" type="file" accept=".pdf,.docx,.png,.jpg,.jpeg"></label><p class="notice">文件识别仅为演示，不读取文件内容。可载入示例体验；粘贴文本则按你的输入保留。</p><label class="field">或直接粘贴题目（多题之间用一行 --- 分隔）<textarea id="qs-paste" rows="4" placeholder="粘贴题干…"></textarea></label><div class="qs-inline-actions">${btn('整理粘贴内容','qs-parse')}${btn('载入演示识别结果','qs-demo-upload',false)}</div><div id="qs-upload-review"></div>`);
    let candidates=[],source='演示参考文件';
    D.$('#qs-upload-file',m).onchange=event=>{source=event.target.files[0]?.name||'演示参考文件';D.$('#qs-demo-upload',m).textContent='查看演示识别结果（非此文件内容）';};
    const review=()=>{
      D.$('#qs-upload-review',m).innerHTML=`<h3 class="qs-section-title">核对识别结果 · ${candidates.length}题</h3><p class="muted">可以修改题干、取消选中。答案在加入后逐题补充核对。</p>${candidates.map((q,i)=>`<div class="qs-upload-row"><label class="qs-check"><input type="checkbox" data-import-check="${i}" checked>选用第${i+1}题 · ${e(q.point)}</label><textarea aria-label="导入第${i+1}题题干" data-import-text="${i}" rows="3">${e(q.text)}</textarea></div>`).join('')}<div class="dialog-footer">${btn('加入选中的题目','qs-import-accept')}</div>`;
      D.$('#qs-import-accept',m).onclick=()=>{
        const chosen=D.all('[data-import-check]:checked',m);if(!chosen.length){D.toast('请至少选中一道题。');return;}
        if(chosen.some(el=>!D.$(`[data-import-text="${el.dataset.importCheck}"]`,m).value.trim())){D.toast('选中的题干不能为空。');return;}
        for(const el of chosen){const i=+el.dataset.importCheck;S.add({...candidates[i],id:S.uid(),text:D.$(`[data-import-text="${i}"]`,m).value.trim(),source},'上传 / 粘贴 · 待核对');}
        done(m,'已加入当前题组，请在编辑页核对答案。');
      };
    };
    D.$('#qs-parse',m).onclick=()=>{
      const text=D.$('#qs-paste',m).value.trim();if(!text){D.toast('请先粘贴题目。');return;}
      source='教师粘贴';candidates=text.split(/\n\s*---\s*\n/).filter(t=>t.trim()).map(text=>({text,point:'待标注',level:'待核对',type:'待分类',answer:'',analysis:''}));review();
    };
    D.$('#qs-demo-upload',m).onclick=()=>{candidates=[S.bank[1],S.bank[4]].map(q=>({...q,text:q.text}));source='演示识别样例（所选文件名：'+source+'）';review();};
  }
  function blueprintFields(rows){
    return `<div class="qs-blueprint"><div class="qs-blueprint-head"><span>题型</span><span>知识点</span><span>目标题量</span></div>${rows.map((r,i)=>`<div class="qs-blueprint-row"><select aria-label="第${i+1}行题型" data-plan-type="${i}">${['选择题','填空题','计算题','实验题'].map(t=>`<option ${t===r.type?'selected':''}>${t}</option>`).join('')}</select><select aria-label="第${i+1}行知识点" data-plan-point="${i}">${['全部','浮力方向','称重法','阿基米德原理','物体浮沉'].map(p=>`<option ${p===r.point?'selected':''}>${p}</option>`).join('')}</select><input aria-label="第${i+1}行题量" type="number" min="0" max="20" data-plan-count="${i}" value="${r.count}"></div>`).join('')}</div>`;
  }
  function readPlan(m){
    const rows=D.all('[data-plan-type]',m).map((el,i)=>({type:el.value,point:D.$(`[data-plan-point="${i}"]`,m).value,count:Number(D.$(`[data-plan-count="${i}"]`,m).value)}));
    if(rows.some(r=>!Number.isInteger(r.count)||r.count<0||r.count>20)||!rows.some(r=>r.count)){D.toast('题量须为0–20的整数，至少设置一道题。');return null;}return rows;
  }
  function generate(){
    const rows=S.state.draft.blueprint.length?S.state.draft.blueprint:[{type:'选择题',point:'全部',count:2},{type:'计算题',point:'称重法',count:1}];
    const m=dialog('按要求出题',`<label class="field">教学要求<textarea id="qs-demand" rows="2" placeholder="例如：浮力基础练习，3道题，保留已经选好的题">浮力基础练习，保留已经选好的题。</textarea></label><p class="notice">原型不调用模型。下方是可修改的命题方案，匹配只使用8道示例题；不会假装理解任意要求。</p><h3>核对命题方案</h3>${blueprintFields(rows)}<label class="field">难度<select id="qs-plan-level"><option>全部</option><option>基础</option><option>中等</option><option>提升</option></select></label>${btn('匹配示例题库','qs-match')}<div id="qs-match-results"></div>`);
    D.$('#qs-match',m).onclick=()=>{
      const plan=readPlan(m);if(!plan)return;
      const draft=S.state.draft,used=new Set(draft.items.map(q=>q.sourceId)),assigned=new Set(),candidates=[];let shortage=0;
      const level=D.$('#qs-plan-level',m).value;
      const matches=(q,r)=>q.type===r.type&&(r.point==='全部'||q.point===r.point)&&(level==='全部'||q.level===level);
      for(const row of plan){
        const existing=draft.items.filter(q=>!assigned.has(q.id)&&matches(q,row)).slice(0,row.count);existing.forEach(q=>assigned.add(q.id));
        const need=Math.max(0,row.count-existing.length),available=S.bank.filter(q=>!used.has(q.id)&&matches(q,row)).slice(0,need);
        available.forEach(q=>{used.add(q.id);candidates.push(q);});shortage+=need-available.length;
      }
      D.$('#qs-match-results',m).innerHTML=`<div class="notice ${shortage?'warning':'success'}">保留当前 ${draft.items.length} 题，可补充 ${candidates.length} 题${shortage?'；仍缺 '+shortage+' 题，请调整条件或上传题目。':'。'}</div>${candidates.map(q=>`<div class="qs-candidate"><small>${e(q.type)} · ${e(q.point)}</small>${S.questionBody(q)}</div>`).join('')}<div class="dialog-footer">${btn('确认方案'+(candidates.length?'并加入候选':'（不添加题目）'),'qs-plan-accept')}</div>`;
      const frozen=structuredClone(plan),requirement=D.$('#qs-demand',m).value;
      D.$('#qs-plan-accept',m).onclick=()=>{draft.blueprint=frozen;draft.requirement=requirement;candidates.forEach(q=>S.add(q));done(m,'已保留原题并应用本次候选。');};
      D.all('[data-plan-type],[data-plan-point],[data-plan-count],#qs-plan-level,#qs-demand',m).forEach(el=>el.oninput=()=>{D.$('#qs-match-results',m).innerHTML='<p class="notice">方案已变化，请重新匹配。</p>';});
    };
  }
  function reference(){
    const m=dialog('从参考卷开始',`<p>先核对原卷，再决定沿用命题结构、卷面版式，或两者一起。</p><label class="field">参考卷文件<input type="file" id="qs-reference-file" accept=".pdf,.docx,.png,.jpg,.jpeg"></label><div class="notice">此原型不读取或识别文件。下一步展示固定示例，不是你上传文件的提取结果。</div><div class="dialog-footer">${btn('查看参考卷示例','qs-reference-next')}</div>`);
    D.$('#qs-reference-next',m).onclick=()=>template({name:'浮力单元测验模板',version:0,layout:'A4双栏测验',source:D.$('#qs-reference-file',m).files[0]?.name||'内置参考卷示例',blueprint:[{type:'选择题',point:'全部',count:2},{type:'计算题',point:'称重法',count:1}]});
  }
  function template(t){
    const m=dialog('核对与应用参考卷模板',`<p class="notice">示例结构 · 未进行OCR。文件名：${e(t.source||'保存的原型模板')}。结构与版式可以分别应用；现有题目不会被覆盖。</p><label class="field">模板名称<input id="qs-template-name" value="${e(t.name)}"></label><div class="qs-form-grid"><section><h3>命题结构</h3>${blueprintFields(t.blueprint)}<label class="qs-check"><input id="qs-use-structure" type="checkbox" checked>沿用结构（开启试卷分值）</label></section><section><h3>卷面版式</h3><div class="qs-template-paper"><b>浮力单元测验</b><span>班级 ____ 姓名 ____</span><div><i>一、选择题<br>1. ______<br>2. ______</i><i>二、计算题<br>3. ______<br>________</i></div></div><label class="field">纸张与栏数<select id="qs-template-layout">${['A4单栏测验','A4双栏测验'].map(v=>`<option ${v===t.layout?'selected':''}>${v}</option>`).join('')}</select></label><label class="qs-check"><input id="qs-use-layout" type="checkbox" checked>沿用版式</label></section></div><p class="muted">公式、配图及分页需教师核对。替换题目后长度会改变，不承诺任意扫描卷像素级复刻。</p><div class="dialog-footer">${btn('另存模板版本','qs-template-save',false)}${btn('应用到当前题组','qs-template-apply')}</div>`);
    const collect=()=>{
      const blueprint=readPlan(m),name=D.$('#qs-template-name',m).value.trim();
      if(!blueprint||!name){if(!name)D.toast('请填写模板名称。');return null;}
      return {...t,id:S.uid(),name,blueprint,layout:D.$('#qs-template-layout',m).value,version:Math.max(t.version,...S.state.templates.filter(x=>x.name===name).map(x=>x.version))+1};
    };
    D.$('#qs-template-save',m).onclick=()=>{const value=collect();if(!value)return;S.state.templates.unshift(value);done(m,'模板已另存为新版本，当前题组不变。');};
    D.$('#qs-template-apply',m).onclick=()=>{
      const structure=D.$('#qs-use-structure',m).checked,layout=D.$('#qs-use-layout',m).checked;
      if(!structure&&!layout){D.toast('请选择至少一项应用内容。');return;}
      const value=collect();if(!value)return;
      if(structure){S.state.draft.blueprint=value.blueprint;S.state.draft.purpose='exam';}
      if(layout)S.state.draft.layout=value.layout;
      S.state.templates.unshift(value);S.save();m.close();S.go('edit');D.toast('已应用'+(structure&&layout?'命题结构与卷面版式':structure?'命题结构':'卷面版式')+'，原题全部保留。');
    };
  }
  function adapt(id){
    const original=S.state.draft.items.find(q=>q.id===id)||S.bank.find(q=>q.id===id);
    const m=dialog('基于这道题改编',`<div class="qs-candidate"><small>原题 · ${e(original.source||original.id)}</small>${S.questionBody(original)}</div><label class="field">修改要求<textarea id="qs-adapt-demand" rows="2" placeholder="例如：保留知识点，增加解释理由的小问"></textarea></label><p class="notice">不调用模型。下一步演示“增加解释理由”这一固定变式，任意输入不会真实生成。</p>${btn('查看演示改编对照','qs-adapt-next')}`);
    D.$('#qs-adapt-next',m).onclick=()=>{
      const requirement=D.$('#qs-adapt-demand',m).value.trim();if(!requirement){D.toast('请填写修改要求。');return;}
      const candidate={...structuredClone(original),id:S.uid(),text:original.text+'\n请说明判断或计算所依据的物理原理。',answer:original.answer,analysis:original.analysis,source:original.source,parent:original.sourceId||original.id,requirement};
      dialog('改编对照 · 固定演示候选',`<div class="qs-form-grid"><section><h3>原题</h3>${S.questionBody(original)}</section><section><h3>候选题</h3>${S.questionBody(candidate)}${S.answer(candidate)}</section></div><p class="notice warning">演示增加了原理说明小问。接受后仍须核对答案；原题来源及修改要求会保留。</p><div class="dialog-footer">${btn('加入为新题','qs-adapt-add',false)}${S.state.draft.items.some(q=>q.id===id)?btn('替换当前题','qs-adapt-replace'):''}</div>`);
      D.$('#qs-adapt-add').onclick=()=>{S.add(candidate,'改编演示 · 待核对');done(m,'候选已加入，原题保留。');};
      D.$('#qs-adapt-replace')?.addEventListener('click',()=>{const i=S.state.draft.items.findIndex(q=>q.id===id),old=S.state.draft.items[i];S.state.draft.items[i]={...candidate,id:old.id,sourceId:candidate.id,points:old.points,kind:'改编演示',reviewed:false,revision:old.revision+1};done(m,'已替换该位置，等待重新核对。');});
    };
  }
  function replace(id){
    const q=S.state.draft.items.find(q=>q.id===id),choices=S.bank.filter(x=>x.point===q.point&&!S.state.draft.items.some(y=>y.sourceId===x.id));
    const m=dialog('换一道同知识点的题',`<p class="muted">保留原位置与分值 · ${e(q.point)}</p>${choices.length?choices.map(c=>`<article class="qs-candidate">${S.questionBody(c)}${S.answer(c)}${btn('选用此题','replace-'+c.id)}</article>`).join(''):'<div class="empty"><strong>示例题库暂无其他候选</strong><p>可以取消后使用改编或上传题目。</p></div>'}`);
    choices.forEach(c=>D.$('#replace-'+c.id,m).onclick=()=>{const i=S.state.draft.items.findIndex(x=>x.id===id);S.state.draft.items[i]={...structuredClone(c),id:q.id,sourceId:c.id,points:q.points,kind:'题库替换',reviewed:false,revision:q.revision+1};done(m,'已换题，请核对新题与答案。');});
  }
  S.dialogs={edit,upload,generate,reference,template,adapt,replace};
})(window.Design);
