(function (D) {
  const titles = { chat: '问小智', library: '资料库', teaching: '教学工作台', students: '学生工作台', settings: '设置' };
  const routes = [
    ['问小智', 'chat', ''], ['资料库', 'library', ''],
    ...['教学文件', '备课本', '讲义', '题本', '组卷'].map(tab => [tab, 'teaching', tab]),
    ...['档案', '学习记录', '错题与练习', '学习计划', '学习复盘', '学习概览'].map(tab => [tab === '档案' ? '学生档案' : tab, 'students', tab]),
    ['查找学生与记录', 'students', '查找'], ['添加学习记录', 'students', '录入'], ['设置', 'settings', '']
  ];
  D.navigate = route => {
    if (!titles[route]) return;
    if (D.state.route === 'library' && route !== 'library' && !D.library.canLeave()) return;
    const dirty = D.$('#editor-status')?.textContent.includes('未保存');
    if (dirty && !window.confirm('演示编辑尚未保存，确定离开吗？')) return;
    D.state.route = route;
    if (D.state.panel) D.closePanel();
    D.$('#page-title').textContent = titles[route];
    D.$('#page-context').textContent = route === 'chat' ? D.state.space : '';
    D.$('#scene').hidden = route !== 'chat';
    D.all('[data-route]').forEach(button => route === button.dataset.route ? button.setAttribute('aria-current', 'page') : button.removeAttribute('aria-current'));
    D.attention();
    if (route === 'chat') D.chat.render();
    else if (route === 'library') D.resources.library();
    else if (route === 'teaching') D.resources.teaching();
    else if (route === 'students') D.students.render();
    else D.settings.render();
    D.$('#content').scrollTop = 0;
  };
  D.openDraft = text => {
    if (D.state.draft.trim()) D.toast('已保留原草稿，请先发送或清空后再使用建议。');
    else D.state.draft = text;
    D.navigate('chat'); D.$('#prompt')?.focus();
  };
  D.guide = () => {
    const modal = D.dialog('完整设计稿 · 页面目录', `<p class="muted">先看整体布局，再检查真实任务会经过的状态。所有记录与文件都是演示数据，关闭页面即丢弃。</p><div class="directory-grid">${routes.map(([label, route, tab], index) => `<button data-guide-route="${index}">${D.icon(route === 'students' ? 'user' : route === 'teaching' ? 'book' : route === 'settings' ? 'settings' : 'file')}${label}</button>`).join('')}</div><details><summary>建议审阅顺序与组件参考</summary><div class="detail-content"><p>1. 空白对话：输入位置、轻量入口、默认关闭的右栏。</p><p>2. 输入一句教学任务：公开过程展开 → 工具记录 → 过程收起 → 正文流式输出。</p><p>3. 顶部状态选择：失败、停止、待确认；查看不同图标与恢复入口。</p><p>4. 资料库、教学五个页签、学生六个页签和设置七类内容。</p><p>参考 HeroUI Sidebar、PromptInput、ChainOfThought、EmptyState 的结构与交互语义。本稿为原生 HTML 设计表达，不是官方 React 组件渲染，也不是功能已交付证明。</p></div></details><p class="muted" style="margin-top:20px;font-size:12px">项目 UI Skill 与分阶段 Goal 已随 V2 交付；正式开发按用户验收后的设计实施。</p>`);
    D.all('[data-guide-route]', modal).forEach(button => button.onclick = () => {
      const [, route, tab] = routes[+button.dataset.guideRoute];
      if (route === 'teaching') D.state.teachingTab = tab;
      if (route === 'students') {
        D.state.student = 'sample-a'; D.state.studentTab = ['查找', '录入'].includes(tab) ? '学习记录' : tab;
      }
      modal.close(); D.navigate(route);
      if (tab === '查找') D.$('#record-search').focus();
      if (tab === '录入') D.$('[data-action="add-record"]').click();
    });
  };
  D.icons();
  D.all('[data-route]').forEach(button => button.onclick = () => D.navigate(button.dataset.route));
  D.$('#collapse').onclick = () => {
    const closed = D.$('#app').classList.toggle('collapsed');
    D.$('#collapse').setAttribute('aria-expanded', String(!closed));
    D.$('#collapse').setAttribute('aria-label', closed ? '展开导航' : '收起导航');
    D.$('#collapse').title = closed ? '展开导航' : '收起导航';
  };
  D.$('#new-chat').onclick = () => {
    if (D.state.chatScene === 'running') { D.toast('演示任务仍在运行，请先停止后再新建。'); return; }
    if (D.state.draft.trim() && !window.confirm('有尚未发送的草稿，清空后新建演示对话吗？')) return;
    D.state.draft = ''; D.state.userPrompt = ''; D.state.attachment = false; D.chat.scene('home'); D.$('#prompt').focus();
  };
  D.all('[data-space]').forEach(button => button.onclick = () => { D.state.space = button.dataset.space; D.navigate('chat'); });
  D.$('#new-space').onclick = () => D.form('新建教学空间', D.field('名称', 'name', '', '例如：八年级物理') + '<p class="muted">教学空间用于整理会话，不会自动授予文件访问权限。</p>', data => {
    const button = document.createElement('button'); button.className = 'nav-item space'; button.textContent = data.get('name'); button.onclick = () => { D.state.space = button.textContent; D.navigate('chat'); }; D.$('#spaces').append(button);
  }, '创建空间');
  const history = [...D.all('[data-history]')].map(button => button.dataset.history);
  D.all('[data-history]').forEach(button => button.onclick = () => { D.state.userPrompt = button.dataset.history; D.chat.scene('completed'); });
  D.$('#search-chat').onclick = () => {
    const modal = D.dialog('搜索对话', `<label class="search-box">${D.icon('search')}<input id="history-query" placeholder="搜索教学任务" aria-label="搜索对话内容"></label><div class="action-list" id="search-results">${history.map((title, index) => `<button data-search-result="${index}">${D.icon('chat')}${title}<small>演示历史 · 八年级物理</small></button>`).join('')}</div><p id="search-empty" class="empty" hidden>没有匹配的演示对话</p>`);
    D.$('#history-query').oninput = event => { D.all('[data-search-result]', modal).forEach(row => { row.hidden = !row.textContent.includes(event.target.value); }); D.$('#search-empty').hidden = D.all('[data-search-result]', modal).some(row => !row.hidden); };
    D.all('[data-search-result]', modal).forEach(button => button.onclick = () => { modal.close(); D.state.userPrompt = history[+button.dataset.searchResult]; D.chat.scene('completed'); });
  };
  D.$('#scene').onchange = event => D.chat.scene(event.target.value);
  D.$('#attention').onclick = () => D.openPanel(D.state.chatScene === 'approval' ? 'tasks' : 'files', D.$('#attention'));
  D.$('#panel-toggle').onclick = () => D.state.panel ? D.closePanel() : D.openPanel('files', D.$('#panel-toggle'));
  D.$('#guide-button').onclick = D.guide;
  D.$('#workspace-more').onclick = () => {
    const modal = D.dialog('页面操作', `<div class="action-list"><button id="more-guide">${D.icon('book')}查看全部页面<small>检查完整设计覆盖范围</small></button><button id="more-settings">${D.icon('settings')}设置<small>日常设置与高级诊断</small></button></div>`);
    D.$('#more-guide').onclick = D.guide;
    D.$('#more-settings').onclick = () => { modal.close(); D.navigate('settings'); };
  };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !D.$('#modal').open && D.state.panel) { event.preventDefault(); D.closePanel(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); D.$('#search-chat').click(); }
    const tab = event.target.closest('[role="tab"]');
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      const tabs = D.all('[role="tab"]', tab.parentElement), index = tabs.indexOf(tab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      event.preventDefault(); tabs[next].click();
      const replaced = D.all('[role="tab"]', D.$('#content')); (replaced[next] || tabs[next]).focus();
    }
  });
  document.addEventListener('click', event => {
    const command = event.target.closest('[data-command]')?.dataset.command;
    if (!command) return;
    if (command === 'skills') { D.$('#modal').close(); D.state.advanced = true; D.state.settingsTab = '教育技能'; D.navigate('settings'); }
    else if (command === 'goal') D.form('持续教学目标', D.field('希望完成的成果', 'goal', '', '例如：完成浮力单元的备课与课堂练习') + '<label class="field">如何判断完成<textarea name="criteria" rows="3" placeholder="需要哪些文件、核对与教师确认"></textarea></label>', () => {});
    else D.dialog('整理上下文', '<p>保留当前教学要求、已确认成果与关键记录，整理较早的过程。本稿仅展示操作确认。</p>', '<div class="dialog-footer"><button class="button secondary" data-close>返回</button></div>');
  });
  function openEntry() {
    const entry = new URLSearchParams(location.hash.slice(1));
    if (entry.get('tab')) D.state.teachingTab = entry.get('tab');
    D.navigate(titles[entry.get('page')] ? entry.get('page') : 'chat');
    if (entry.get('lesson') === '1' && D.state.route === 'teaching') D.lesson.open();
  }
  window.addEventListener('hashchange', openEntry);
  openEntry();
})(window.Design);
