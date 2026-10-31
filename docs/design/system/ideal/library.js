/* Library interaction design. Existing runtime and data model are untouched. */
(function (D) {
  const files = D.libraryData;
  const state = { view:'全部资料', query:'', subject:'全部学科', status:'全部状态', mode:'资料', sort:'最近更新', selected:'', tab:'概要', page:24, checked:new Set(), notes:{}, dirty:false };
  const views = ['全部资料','最近添加','待处理','收藏','归档'];
  const fileById = id => files.find(file => file.id === id);
  const status = file => { const [label,color] = D.libraryStatus[file.status]; return `<span class="chip ${color}">${label}</span>`; };
  const button = (text, action, variant='secondary', icon='') => D.button(text, 'lib-' + action, variant, icon);
  function leaveReader() { return !state.dirty || window.confirm('演示笔记尚未保存，确定切换资料吗？'); }
  function visible() {
    return files.filter(file => {
      const inView = state.view === '归档' ? file.archived : !file.archived && (state.view === '收藏' ? file.star : state.view === '待处理' ? file.status !== 'ready' || file.pending : views.includes(state.view) || file.folder === state.view);
      const matches = state.mode === '检索内容' || `${file.name} ${file.format} ${file.kind} ${file.tags.join(' ')}`.toLowerCase().includes(state.query.toLowerCase());
      return inView && matches && (state.subject === '全部学科' || state.subject === file.subject) && (state.status === '全部状态' || state.status === D.libraryStatus[file.status][0]);
    }).sort(state.sort === '按名称' ? (a,b)=>a.name.localeCompare(b.name,'zh-CN') : (a,b)=>b.order-a.order);
  }
  function tree() {
    const count = view => files.filter(x => view === '归档' ? x.archived : !x.archived && (view === '收藏' ? x.star : view === '待处理' ? x.status !== 'ready' || x.pending : true)).length;
    return `<aside class="library-tree" aria-label="资料目录">${views.map((view,i)=>`<button data-library-filter="${view}" ${state.view===view?'aria-current="page"':''}>${D.icon(['library','clock','alert','star','folder'][i])}${view}<small>${count(view)}</small></button>`).join('')}<h3>教学目录</h3><details open><summary>${D.icon('chevron')}八年级物理</summary><button data-library-filter="浮力单元" ${state.view==='浮力单元'?'aria-current="page"':''}>${D.icon('folder')}浮力单元</button></details><details open><summary>${D.icon('chevron')}七年级数学</summary><button data-library-filter="一元一次方程" ${state.view==='一元一次方程'?'aria-current="page"':''}>${D.icon('folder')}一元一次方程</button></details><button data-library-filter="待整理">${D.icon('folder')}待整理</button><h3>常用标签</h3><div class="library-tags"><button data-tag="浮力"># 浮力</button><button data-tag="实验"># 实验探究</button></div></aside>`;
  }
  function catalog(rows) {
    return `<table class="library-table"><thead><tr><th class="check-col"><input id="lib-select-all" type="checkbox" aria-label="选择当前列表全部资料" ${rows.length && rows.every(file=>state.checked.has(file.id))?'checked':''}></th><th>名称</th><th class="status-col">收录状态</th><th class="date-col">最近更新</th></tr></thead><tbody>${rows.map(file=>`<tr data-resource-row="${D.escape(file.name)}" data-selected="${file.id===state.selected}"><td><input data-lib-check="${file.id}" type="checkbox" aria-label="选择${D.escape(file.name)}" ${state.checked.has(file.id)?'checked':''}></td><td><button class="library-file" data-lib-open="${file.id}"><span class="file-format" data-format="${file.format}">${file.format}</span><span><b>${D.escape(file.name)}</b><small>${file.subject} · ${file.pages} 页 · ${file.size}${file.pending?' · '+file.pending+' 题待核对':''}</small></span></button></td><td>${status(file)}</td><td class="date-col muted">${file.updated}</td></tr>`).join('')}</tbody></table>${!rows.length?D.empty('没有匹配的资料','调整目录或筛选条件，或添加教学资料。',button('清除筛选','clear','outline')):''}<footer class="library-footer"><span>${rows.length} 份资料 · 演示目录</span><span>原文件留在本机</span></footer>`;
  }
  function searchResults(rows) {
    if (!state.query.trim()) return D.empty('在资料正文中查找','输入教学问题或关键词，结果会显示匹配内容和原页位置。');
    const matches = rows.filter(file=>file.status==='ready' && `${file.summary} ${file.name} ${file.tags.join(' ')}`.includes(state.query));
    return `<p class="muted" style="font-size:12px;margin:16px 0">当前范围找到 ${matches.length} 份资料 · 演示检索结果</p>${matches.map(file=>`<article class="library-search-result"><button data-lib-hit="${file.id}"><h3>${D.icon('file')} ${D.escape(file.name)}</h3><p>${file.id==='math'?'解一元一次方程时，去括号需要让括号外的系数与每一项相乘。':'将物体逐渐浸入水中，观察测力计示数的变化，通过重力与拉力的差值认识'}<mark>${D.escape(state.query)}</mark>。${D.escape(file.summary)}</p><small>${file.folder} › 第 ${file.id==='physics'?24:2} 页 · 查看原页 ${D.icon('external')}</small></button></article>`).join('')}${!matches.length?D.empty('没有找到匹配片段','试试“浮力”或“一元一次方程”；未收录的文件不会作为正文来源。'):''}`;
  }
  function preview(file) {
    if (!file) return '';
    let content = '';
    if (state.tab === '概要') content = `<dl class="library-facts"><dt>格式</dt><dd>${file.format} · ${file.pages} 页 · ${file.size}</dd><dt>学科</dt><dd>${file.grade} · ${file.subject}</dd><dt>目录</dt><dd>${file.folder}</dd><dt>资料角色</dt><dd>${file.role}</dd><dt>收录</dt><dd>${status(file)}</dd></dl><div class="library-tags">${file.tags.map(tag=>`<span class="chip">${tag}</span>`).join('')}</div><h3>内容概要</h3><p>${file.summary}</p>${file.id==='physics'?'<h3>配套资料</h3><button class="text-button" data-lib-open="answers">查看关联答案册</button><p>关联仅帮助定位，答案仍需按原题与版本核对。</p>':''}<div class="library-preview-actions">${button('带入对话','ask','primary','chat')}${button(file.star?'取消收藏':'收藏','star','outline','star')}${button('归档 / 恢复','archive','secondary')}</div><details><summary>文件、版本与诊断</summary><div class="detail-content">原始文件与内容版本保留。此处显示文件定位、原始回执和重建入口，不在首屏堆叠技术字段。${button('在文件夹中显示','locate','outline')}</div></details>`;
    if (state.tab === '原页') content = `<div class="library-page-controls"><button class="icon-button small" data-lib-page="-1" aria-label="上一页">‹</button><span>第 ${state.page} / ${file.pages} 页 · 演示原页</span><button class="icon-button small" data-lib-page="1" aria-label="下一页">›</button></div><div class="library-original"><small>${file.grade} · ${file.subject}</small><h3>${file.subject==='数学'?'一元一次方程':'认识浮力'}</h3><p>${file.subject==='数学'?'解方程 3(2x－1)＝15。请写出每一步变形的依据。':'把同一物体缓缓浸入水中，测力计的示数发生了怎样的变化？请先预测，再用实验记录支持解释。'}</p><div class="water-diagram"><div class="block-diagram">物体</div></div><p>观察与记录 → 比较读数 → 解释依据</p></div><details><summary>识别文本与原页对照</summary><div class="detail-content">保留本地识别文字与来源页码；图示不清或跨页内容继续标为待核对，不静默补写原件。</div></details><div class="library-preview-actions">${button('校正识别','correct','outline','edit')}${button('打开原文件','original','secondary','external')}</div>`;
    if (state.tab === '题目') content = `<p>${file.questions} 道演示题 · ${file.pending} 道待核对。收录完成不代表题目或答案已经正确。</p>${file.questions?`<section class="question-row"><h3>第 4 题 <span class="chip warning">需核对图示</span></h3><p>物体完全浸没后，测力计的示数如何变化？</p><details><summary>查看原文与识别对照</summary><div class="detail-content">原页第 24 页，图示存在歧义。保留原图与识别文本，待教师核对。</div></details>${button('校正题目','correct','outline','edit')}</section><div class="library-preview-actions">${button('查看原页','source','secondary')}${button('进入组卷','paper','outline','file')}</div>`:D.empty('这份资料没有已收录题目','教材正文、课件和笔记仍可作为教学参考。')}`;
    if (state.tab === '笔记') content = `<label class="field">阅读笔记<textarea id="lib-note" rows="8" placeholder="记录可复用的教学想法，保留与原页的关联">${D.escape(state.notes[file.id]||'')}</textarea></label><p id="lib-note-state">${state.dirty?'有未保存的演示笔记':'笔记仅保存在本次演示'}</p>${button('保存笔记','save-note','primary')}`;
    return `<aside class="library-preview" aria-label="资料详情"><div class="library-preview-head"><h2>${D.escape(file.name)}</h2><button class="icon-button small" data-action="lib-close" aria-label="收起资料详情">${D.icon('close')}</button></div><nav class="tabs" role="tablist" aria-label="资料内容">${['概要','原页','题目','笔记'].map(tab=>`<button role="tab" data-lib-tab="${tab}" aria-selected="${state.tab===tab}">${tab}</button>`).join('')}</nav>${content}</aside>`;
  }
  function bindActions(file) {
    const actions = {
      clear:()=>{state.query='';state.subject='全部学科';state.status='全部状态';state.view='全部资料';D.library.render();},
      import:()=>D.library.importDialog(false), folder:()=>D.library.importDialog(true), queue:()=>D.library.queue(),
      close:()=>{if(leaveReader()){state.selected='';state.dirty=false;D.library.render();}},
      ask:()=>D.openDraft(`请依据「${file.name}」中的内容，帮我准备课堂教学。`),
      star:()=>{file.star=!file.star;D.library.render();},
      archive:()=>{file.archived=!file.archived;state.selected='';D.library.render();D.toast('演示归档状态已变更，原文件与引用保留。');},
      source:()=>{state.tab='原页';D.library.render();},
      paper:()=>{D.state.teachingTab='组卷';D.navigate('teaching');},
      original:()=>D.preview({...D.sampleFiles[2],name:file.name}),
      locate:()=>D.toast('正式实现沿用已有本地文件定位；演示不打开真实目录。'),
      correct:()=>D.form('核对原页与识别', `<p class="muted">${D.escape(file.name)} · 第 ${state.page} 页 · 演示</p><label class="field">校正内容<textarea name="stem" rows="5" required>物体完全浸没后，测力计的示数如何变化？</textarea></label><label class="field">核对依据<textarea name="evidence" rows="2" placeholder="原页图示、教师说明"></textarea></label><p class="notice">确认只更新演示文本。正式实现继续保留原件、校正版本与来源。</p>`,()=>{}),
      'save-note':()=>{state.dirty=false;D.$('#lib-note-state').textContent='已保存到本次演示';D.toast('演示笔记已保存。');}
    };
    D.all('[data-action^="lib-"]').forEach(el=>el.onclick=actions[el.dataset.action.slice(4)]);
  }
  D.library = {
    render() {
      const rows=visible(), file=fileById(state.selected), selected=[...state.checked].filter(id=>fileById(id));
      D.$('#content').innerHTML=`<div class="page library-page">${D.heading('资料库','把教材、题目与教学资料整理成可以找到、核对和复用的知识。',`<div class="detail-actions">${button('添加文件夹','folder','outline','folder-plus')}${button('添加资料','import','primary','plus')}</div>`)}<div class="library-layout">${tree()}<section class="library-main"><div class="library-topline"><nav class="tabs" role="tablist" aria-label="资料查找方式">${['资料','检索内容'].map(mode=>`<button role="tab" data-lib-mode="${mode}" aria-selected="${state.mode===mode}">${mode}</button>`).join('')}</nav><button class="library-queue-link" data-action="lib-queue">${D.icon('refresh')}处理队列 · ${files.filter(x=>x.status==='processing').length} 进行中${files.some(x=>x.status==='failed')?' · 有失败项':''}</button></div><div class="library-controls"><label class="search-box">${D.icon('search')}<input id="resource-search" aria-label="查找资料或内容" placeholder="${state.mode==='资料'?'查找名称、格式、标签…':'在当前资料范围中检索教学内容…'}" value="${D.escape(state.query)}"></label><select id="lib-subject" aria-label="学科筛选">${['全部学科','物理','数学'].map(x=>`<option ${state.subject===x?'selected':''}>${x}</option>`).join('')}</select><select id="lib-status" aria-label="收录状态筛选">${['全部状态',...Object.values(D.libraryStatus).map(x=>x[0])].map(x=>`<option ${state.status===x?'selected':''}>${x}</option>`).join('')}</select><select id="library-sort" aria-label="资料排序">${['最近更新','按名称'].map(x=>`<option ${state.sort===x?'selected':''}>${x}</option>`).join('')}</select></div>${selected.length?`<div class="library-selection"><span>已选择 ${selected.length} 份</span><button class="text-button" id="lib-batch-ask">带入对话</button><button class="text-button" id="lib-batch-archive">移入归档</button><button class="icon-button small" id="lib-selection-clear" aria-label="取消选择">${D.icon('close')}</button></div>`:''}<div class="library-catalog ${file?'has-preview':''}"><div id="library-results">${state.mode==='资料'?catalog(rows):searchResults(rows)}</div>${preview(file)}</div></section></div></div>`;
      const rerender=()=>{const input=D.$('#resource-search'),focus=document.activeElement===input,position=input.selectionStart;D.library.render();if(focus){D.$('#resource-search').focus();D.$('#resource-search').setSelectionRange(position,position);}};
      D.$('#resource-search').oninput=e=>{state.query=e.target.value;rerender();};
      for(const [id,key] of [['lib-subject','subject'],['lib-status','status'],['library-sort','sort']])D.$('#'+id).onchange=e=>{state[key]=e.target.value;D.library.render();};
      D.all('[data-library-filter]').forEach(el=>el.onclick=()=>{if(!leaveReader())return;state.view=el.dataset.libraryFilter;state.selected='';state.dirty=false;D.library.render();});
      D.all('[data-tag]').forEach(el=>el.onclick=()=>{state.query=el.dataset.tag;D.library.render();});
      D.all('[data-lib-mode]').forEach(el=>el.onclick=()=>{state.mode=el.dataset.libMode;D.library.render();});
      D.all('[data-lib-open],[data-lib-hit]').forEach(el=>el.onclick=()=>{if(!leaveReader())return;state.selected=el.dataset.libOpen||el.dataset.libHit;state.tab=el.dataset.libHit?'原页':'概要';state.page=fileById(state.selected).id==='physics'?24:1;state.dirty=false;D.library.render();});
      D.all('[data-lib-tab]').forEach(el=>el.onclick=()=>{state.tab=el.dataset.libTab;D.library.render();});
      D.all('[data-lib-page]').forEach(el=>el.onclick=()=>{state.page=Math.max(1,Math.min(file.pages,state.page+Number(el.dataset.libPage)));D.library.render();});
      D.all('[data-lib-check]').forEach(el=>el.onchange=()=>{el.checked?state.checked.add(el.dataset.libCheck):state.checked.delete(el.dataset.libCheck);D.library.render();});
      if(D.$('#lib-select-all'))D.$('#lib-select-all').onchange=e=>{rows.forEach(x=>e.target.checked?state.checked.add(x.id):state.checked.delete(x.id));D.library.render();};
      D.$('#lib-selection-clear')?.addEventListener('click',()=>{state.checked.clear();D.library.render();});
      D.$('#lib-batch-ask')?.addEventListener('click',()=>D.openDraft('请根据以下资料帮助我备课：'+selected.map(id=>fileById(id).name).join('、')));
      D.$('#lib-batch-archive')?.addEventListener('click',()=>{selected.forEach(id=>{fileById(id).archived=true;});state.checked.clear();state.selected='';D.library.render();});
      D.$('#lib-note')?.addEventListener('input',e=>{state.notes[file.id]=e.target.value;state.dirty=true;D.$('#lib-note-state').textContent='有未保存的演示笔记';});
      bindActions(file);
    },
    importDialog(folder=false) {
      D.form(folder?'添加文件夹 · 演示':'添加资料 · 演示', `<p class="notice">只输入示例名称，不读取真实文件或文件夹。</p>${D.field(folder?'文件夹名称':'资料名称','name',folder?'八年级物理备课资料':'新增教学资料.pdf')}<label class="field">整理到<select name="folder"><option>待整理</option><option>浮力单元</option><option>一元一次方程</option></select></label><label class="field">资料角色<select name="role"><option>教学资料</option><option>主书</option><option>配套答案</option><option>试卷</option></select></label><p class="muted">先保存原件，再在后台收录。重复内容复用原资料；原页 AI 处理继续走已有确认流程，不随导入自动开始。</p>`,data=>{
        files.unshift({id:'import-'+Date.now(),name:data.get('name')+(folder?' / 示例文件.pdf':''),format:'PDF',subject:'物理',grade:'八年级',folder:data.get('folder'),kind:'教学资料',role:data.get('role'),pages:8,size:'1.2 MB',status:'processing',progress:0,updated:'刚刚',order:Date.now(),tags:[],questions:0,pending:0,summary:'新加入的演示资料，等待本地收录。'});state.view='全部资料';state.query='';D.library.render();
      },'添加并后台收录');
    },
    queue() {
      const pending=files.filter(x=>x.status!=='ready');
      const modal=D.dialog('资料处理队列',`<p class="muted">浏览和检索继续可用；停止处理会保留原始文件与已完成内容。</p>${pending.length?pending.map(file=>`<section class="queue-row"><header><strong>${D.escape(file.name)}</strong>${status(file)}</header><p>${file.status==='processing'?`本地收录 · 第 ${file.progress} / ${file.pages} 页`:file.status==='failed'?'未能读取完整图像，请检查原件后重试。':'已停止，原件与已保存内容保留。'}</p>${file.status==='processing'?`<div class="library-progress"><span style="width:${file.progress/file.pages*100}%"></span></div>`:''}<div class="detail-actions"><button class="button outline" data-queue-id="${file.id}" data-queue-action="${file.status==='processing'?'stop':'retry'}">${file.status==='processing'?'停止这份':'重试收录'}</button>${file.status==='processing'?`<button class="button secondary" data-queue-id="${file.id}" data-queue-action="priority">优先处理</button>`:''}</div><details><summary>处理详情</summary><div class="detail-content">此为演示队列；正式继续使用原有批次、来源版本和恢复记录，不创建第二套执行器。</div></details></section>`).join(''):D.empty('没有进行中的处理','所有演示资料已停止或完成。')}<div class="dialog-footer"><button class="button secondary" data-close>关闭</button></div>`);
      D.all('[data-queue-action]',modal).forEach(el=>el.onclick=()=>{const file=fileById(el.dataset.queueId);if(el.dataset.queueAction==='priority'){D.toast('演示：已安排优先处理。');return;}file.status=el.dataset.queueAction==='stop'?'stopped':'processing';modal.close();D.library.render();D.library.queue();});
    },
    canLeave:leaveReader
  };
})(window.Design);
