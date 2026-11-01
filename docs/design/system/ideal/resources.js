(function (D) {
  const state = D.state;
  const teachingTabs = ['教学文件', '备课本', '讲义', '题本', '组卷'];
  function resourceTable(items, mode) {
    return `<div class="table-wrap"><table><thead><tr><th>名称</th><th>${mode === 'library' ? '处理状态' : '类型'}</th><th>更新</th><th><span class="sr-only">操作</span></th></tr></thead><tbody>${items.map((item, index) => `<tr data-resource-row="${D.escape(item.name)}"><td><button class="table-name" data-resource="${index}">${D.icon(item.icon || 'file')}<span>${D.escape(item.name)}<small>${mode === 'library' ? item.type + ' · ' + item.pages + ' 页' : '八年级物理 · 浮力'}</small></span></button></td><td>${mode === 'library' ? `<span class="chip ${item.status.includes('待') ? 'warning' : 'success'}">${item.status}</span>` : item.format || '文档'}</td><td class="muted">${item.date}</td><td><button class="icon-button" data-resource-more="${index}" aria-label="${D.escape(item.name)}的更多操作">${D.icon('more')}</button></td></tr>`).join('')}</tbody></table><p class="table-summary">共 ${items.length} 项 · 演示数据</p><div id="resource-empty" hidden>${D.empty('没有匹配内容', '试试更短的关键词，或调整筛选。')}</div></div>`;
  }
  function bindTable(items, mode) {
    D.all('[data-resource]').forEach(button => button.onclick = () => D.resources.editor(items[+button.dataset.resource]));
    D.all('[data-resource-more]').forEach(button => button.onclick = () => {
      const item = items[+button.dataset.resourceMore];
      const dialog = D.dialog(item.name, `<div class="action-list"><button id="rename-resource">${D.icon('edit')}重命名<small>仅修改设计稿中的演示名称</small></button><button id="archive-resource">${D.icon('folder')}移入归档<small>实际产品需保留原件与来源引用</small></button></div>`);
      D.$('#rename-resource', dialog).onclick = () => D.form('重命名', D.field('名称', 'name', item.name), data => { item.name = data.get('name'); D.navigate(mode === 'library' ? 'library' : 'teaching'); });
      D.$('#archive-resource', dialog).onclick = () => { dialog.close(); item.archived = !item.archived; D.toast('演示归档状态已更新，没有删除真实文件。'); };
    });
    D.$('#resource-search').oninput = event => {
      let count = 0;
      D.all('[data-resource-row]').forEach(row => { row.hidden = !row.dataset.resourceRow.toLowerCase().includes(event.target.value.toLowerCase()); if (!row.hidden) count++; });
      D.$('#resource-empty').hidden = count > 0;
    };
  }
  function newTeaching() {
    const tab = state.teachingTab || '教学文件';
    if (tab === '教学文件') { D.resources.importDialog('teaching'); return; }
    D.form(tab === '组卷' ? '创建试卷蓝图' : `新建${tab}`, `${D.field('标题', 'title', '', tab === '组卷' ? '例如：一元一次方程单元测验' : '例如：浮力实验课')}${D.field('学科与年级', 'subject', '八年级物理')}<label class="field">${tab === '组卷' ? '范围与要求' : '目标与内容'}<textarea name="requirements" rows="3" placeholder="描述本次教学任务"></textarea></label>`, data => D.resources.editor({ name: data.get('title'), format: tab === '组卷' ? '试卷蓝图' : '教学草稿', date: '刚刚', icon: 'book' }), '创建草稿');
  }
  D.resources = {
    library() { D.library.render(); },
    importDialog(target) {
      if (target === 'library') { D.library.importDialog(); return; }
      D.form('添加教学文件 · 演示', D.field('文件名称', 'name', '新增教学资料.pdf') + '<p class="notice">只添加演示名称，不读取真实文件。</p>', data => { D.sampleFiles.unshift({name:data.get('name'),format:'PDF',date:'刚刚',icon:'file'}); D.resources.teaching(); }, '添加演示文件');
    },
    teaching() {
      const tab = state.teachingTab || '教学文件';
      if (tab === '组卷') { D.paper.render(); return; }
      const action = tab === '教学文件' ? '导入文件' : tab === '组卷' ? '新建试卷' : `新建${tab}`;
      const rows = tab === '教学文件' ? D.sampleFiles : [
        { name: { '备课本': '浮力实验课 · 教学设计', '讲义': '浮力与物体浮沉 · 课堂讲义', '题本': '浮力基础与实验 · 题目整理', '组卷': '八年级物理 · 单元测验' }[tab], format: tab === '组卷' ? '试卷蓝图' : '教学草稿', date: '今天 10:24', icon: 'file' },
        { name: `${tab} · 新任务草稿`, format: '草稿', date: '昨天 16:30', icon: 'book' }
      ];
      D.$('#content').innerHTML = `<div class="page">${D.heading('教学工作台', '围绕教学文件与课堂成果继续工作。', D.button(action, 'new-teaching', 'primary', 'plus'))}<nav class="tabs" role="tablist" aria-label="教学功能">${teachingTabs.map(label => `<button role="tab" data-teaching-tab="${label}" aria-selected="${tab === label}">${label}</button>`).join('')}</nav><div class="teaching-overview"><div><h2>${tab}</h2><p>${tab === '组卷' ? '先确定蓝图，再核对题目、答案与来源，最后确认导出。' : '打开已有成果继续编辑，或从新的教学任务开始。'}</p></div></div><div class="toolbar"><label class="search-box">${D.icon('search')}<input id="resource-search" placeholder="搜索${tab}" aria-label="搜索教学内容"></label><select aria-label="教学空间"><option>全部教学空间</option><option>八年级物理</option><option>七年级数学</option></select></div>${resourceTable(rows, 'teaching')}</div>`;
      D.all('[data-teaching-tab]').forEach(button => button.onclick = () => { state.teachingTab = button.dataset.teachingTab; D.navigate('teaching'); });
      D.$('[data-action="new-teaching"]').onclick = newTeaching;
      if (tab === '备课本') {
        const overview = D.$('.teaching-overview');
        overview.insertAdjacentHTML('beforeend', D.button('课堂设计与预演', 'lesson-preview', 'outline', 'slides'));
        D.$('[data-action="lesson-preview"]').onclick = D.lesson.open;
      }
      bindTable(rows, 'teaching');
    },
    editor(file) {
      if (file.format === 'PPT' || file.format === 'PDF' || file.format === 'Word') { D.preview(file); return; }
      const paper = file.format === '试卷蓝图';
      D.$('#content').innerHTML = `<article class="page editor-page"><button class="back-link" id="teaching-back">${D.icon('chevron')}教学工作台</button>${D.heading(D.escape(file.name), paper ? '试卷草稿 · 待教师核对' : '教学草稿 · 可继续修改')}<div class="editor-toolbar"><span id="editor-status">所有更改仅保留在本次演示中</span>${D.button('请小智修改', 'ask-edit', 'secondary', 'chat')}${D.button('保存草稿', 'save-edit', 'primary')}</div>${paper ? `<section class="detail-section"><h2>试卷蓝图</h2><div class="meta-list"><span>八年级物理</span><span>100 分</span><span>45 分钟</span><span class="chip warning">待审阅</span></div><label class="field">范围与结构<textarea rows="3" id="editor-text">浮力方向与测量、阿基米德原理、物体浮沉。基础题 60 分，实验与应用 40 分。</textarea></label><p class="notice warning">题目、答案、来源和难度需逐题核对，确认后才可正式交付。</p>${D.button('核对题目与来源', 'review-paper', 'outline', 'check')}</section>` : `<div class="editor-paper"><h2>浮力实验课 · 教学设计</h2><h3>教学目标</h3><p>通过测力计示数变化认识浮力，并用实验记录解释浮力的方向和大小。</p><label class="field">课堂活动<textarea id="editor-text" rows="8">先提出问题，让学生预测同一物体浸入水中后的示数变化。
分组记录空气中、部分浸入与完全浸没时的读数。
比较重力与拉力，讨论浮力的方向，并解释沉在水底的物体是否受到浮力。</textarea></label><h3>理解检查</h3><p>请学生区分“受到浮力”与“会上浮”，并为自己的回答提供实验依据。</p></div>`}</article>`;
      D.$('#teaching-back').onclick = () => D.navigate('teaching');
      D.$('#editor-text').oninput = () => { D.$('#editor-status').textContent = '有未保存的演示更改'; };
      D.$('[data-action="save-edit"]').onclick = () => { D.$('#editor-status').textContent = '已保存到本次演示（非正式文件）'; D.toast('演示草稿已更新。'); };
      D.$('[data-action="ask-edit"]').onclick = () => D.openDraft(`请根据这份「${file.name}」继续完善课堂活动。`);
      D.$('[data-action="review-paper"]')?.addEventListener('click', () => D.dialog('核对试卷', '<h3>题目 1 · 浮力方向</h3><p class="notice">浸没在水中的物体受到的浮力方向为竖直向上。</p><details><summary>答案与来源</summary><p>演示答案：竖直向上。来源：浮力章节，第 24 页。</p></details><p class="muted">正式产品沿用逐题核对、结构修改和教师确认流程。</p>'));
    }
  };
})(window.Design);
