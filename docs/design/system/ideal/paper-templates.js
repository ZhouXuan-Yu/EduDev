/* Offline template review. No document parsing, upload or production writes. */
(function(D){
  const templates=[];
  let selected=null;
  function editor(template){
    const modal=D.form(template?'修改模板 · 保存新版本':'导入参考卷 · 提取模板',
      (!template?'<label class="field">参考试卷<input type="file" name="source" accept=".pdf,.docx,.png,.jpg,.jpeg" required></label>':'')+
      D.field('模板名称','title',template?.title||'八年级物理仿真卷')+
      '<p class="notice">原型不解析文件。以下是可修改的提取样例，正式开发须逐项对照原卷确认，不能承诺扫描件自动精确复刻。</p>'+
      '<div class="paper-field-grid"><label class="field">纸张<select name="paper"><option>A4</option><option>A3</option></select></label><label class="field">分栏<select name="columns"><option>单栏</option><option>双栏</option></select></label></div>'+
      D.field('卷头与学生信息','header',template?.header||'学校____ 班级____ 姓名____ 考号____')+
      D.field('字体、字号与行距','font',template?.font||'宋体 · 正文五号 · 1.5倍行距')+
      D.field('页边距 / 装订线','margin',template?.margin||'上下20mm，左右18mm；左侧装订线')+
      '<label class="field">题型结构与答题空间<textarea name="structure" rows="4">'+D.escape(template?.structure||'一、选择题 10题×3分\n二、填空题 5题×4分\n三、实验题 2题×25分；每题留白6行')+'</textarea></label>'+
      '<label><input type="checkbox" required>已核对卷头、题型顺序、分值与答题空间</label><p class="muted">模板保存格式和结构，不自动收藏原卷题目。图片、公式、跨页与密封线需正式预览核对。</p>', data=>{
        const item={id:template?.id||String(Date.now()),version:(template?.version||0)+1,source:template?.source||data.get('source').name};
        for(const key of ['title','paper','columns','header','font','margin','structure'])item[key]=String(data.get(key));
        const index=templates.findIndex(t=>t.id===item.id);
        if(index<0)templates.push(item);else templates[index]=item;
        D.paper.render();
      },'核对并保存模板');
    if(template){modal.querySelector('[name=paper]').value=template.paper;modal.querySelector('[name=columns]').value=template.columns;}
  }
  function library(){
    const modal=D.dialog('我的试卷模板', '<p class="muted">演示模板只保存在本页内存，刷新后清空。修改保存新版本，不覆盖已组卷的格式快照。</p><div class="action-list">'+(templates.length?templates.map((t,i)=>`<section><h3>${D.escape(t.title)} · v${t.version}</h3><p>${D.escape(t.paper)} · ${D.escape(t.columns)} · 来源：${D.escape(t.source)}</p><button class="button secondary" data-template-edit="${i}">修改模板</button><button class="button primary" data-template-use="${i}">用于本次组卷</button></section>`).join(''):'<p class="empty">还没有模板，请先导入一份参考试卷。</p>')+'</div>');
    D.all('[data-template-edit]',modal).forEach(b=>b.onclick=()=>editor(templates[+b.dataset.templateEdit]));
    D.all('[data-template-use]',modal).forEach(b=>b.onclick=()=>{selected=JSON.parse(JSON.stringify(templates[+b.dataset.templateUse]));modal.close();D.paper.render();});
  }
  const original=D.paper.render;
  D.paper.render=function(){
    original();
    const panel=document.createElement('section');panel.className='notice';panel.style.marginBlock='18px';
    panel.innerHTML='<h3>参考卷与卷面模板</h3><p>沿用参考卷的排版和题型结构，重新选题；格式模板与题目来源分别选择。</p><div class="detail-actions"><button class="button outline" id="template-import">导入参考卷</button><button class="button secondary" id="template-library">我的模板 · '+templates.length+'</button>'+(selected?'<button class="button secondary" id="template-clear">移除模板</button>':'')+'</div><p class="muted">'+(selected?'当前格式：'+D.escape(selected.title)+' · v'+selected.version+' · '+D.escape(selected.paper)+' / '+D.escape(selected.columns)+'。已绑定本次演示格式快照；题量与分值冲突须核对，正式输出需逐页比对原卷。':'未使用模板 · 使用默认卷面。支持导入、核对、保存和二次修改的流程演示。')+'</p>';
    D.$('.paper-steps').after(panel);
    D.$('#template-import').onclick=()=>editor();D.$('#template-library').onclick=library;
    D.$('#template-clear')?.addEventListener('click',()=>{selected=null;D.paper.render();});
  };
})(window.Design);
