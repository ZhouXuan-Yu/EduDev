/* Shared, offline prototype primitives. No IPC, network, storage, or real files. */
window.Design = { state: { route: 'chat', draft: '', space: '', panel: false, files: [], student: '', studentTab: '档案', settings: {} } };
(function (D) {
  D.$ = (selector, root = document) => root.querySelector(selector);
  D.all = (selector, root = document) => [...root.querySelectorAll(selector)];
  D.escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const paths = {
    book: 'M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3z M12 6v15',
    chat: 'M4 4h16v13H9l-5 4z', plus: 'M12 5v14 M5 12h14', star: 'M12 3l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
    search: 'M20 20l-5-5 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
    folder: 'M3 7V4h6l2 3h10v13H3z', 'folder-plus': 'M3 7V4h6l2 3h10v13H3z M12 11v6 M9 14h6',
    'panel-left': 'M4 3h16v18H4z M9 3v18 M15 9l-3 3 3 3',
    'panel-right': 'M4 3h16v18H4z M15 3v18 M9 9l3 3-3 3',
    library: 'M4 4v16 M9 4v16 M14 4l5 16',
    users: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-3a5 5 0 0 1 10 0v3 M16 4a4 4 0 0 1 0 8 M17 15a5 5 0 0 1 5 5',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M4 21v-3a8 5 0 0 1 16 0v3',
    settings: 'M9 3h6l1 3 3 1 2 5-2 3-1 4-4 2-4-2-4-1-2-5 2-3 1-4z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    clip: 'M8 13l6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9',
    arrow: 'M12 19V5 M6 11l6-6 6 6', chevron: 'M9 5l7 7-7 7',
    external: 'M7 17L18 6 M7 6h11v11', file: 'M5 3h9l5 5v13H5z M14 3v6h5 M9 13h6 M9 17h6',
    slides: 'M3 4h18v13H3z M8 22l4-5 4 5 M12 17v5',
    chart: 'M4 20V10h4v10 M10 20V4h4v16 M16 20v-7h4v7',
    check: 'M5 12l4 4L19 6', clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2',
    globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18',
    shield: 'M12 3l8 3v6c0 5-8 9-8 9S4 17 4 12V6z M8 12l3 3 5-6',
    close: 'M6 6l12 12 M18 6L6 18', more: 'M5 12h.1 M12 12h.1 M19 12h.1',
    edit: 'M4 20l1-5L16 4l4 4L9 19z M13 7l4 4', copy: 'M9 8h12v13H9z M15 8V3H3v13h6',
    stop: 'M7 7h10v10H7z', download: 'M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4',
    alert: 'M12 3l10 18H2z M12 9v5 M12 17h.1', refresh: 'M20 8a8 8 0 1 0 0 8 M20 3v5h-5',
    spark: 'M12 3l2 6 7 3-7 2-2 7-2-7-7-2 7-3z', filter: 'M4 5h16l-6 7v6l-4 3v-9z',
    target: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0 M12 12h.1'
  };
  D.icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.file}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  D.icons = (root = document) => D.all('[data-icon]', root).forEach(el => { el.innerHTML = D.icon(el.dataset.icon); });
  let toastTimer;
  D.toast = text => {
    const node = D.$('#toast'); node.textContent = text; node.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, 3200);
  };
  D.heading = (title, description, action = '') => `<header class="page-heading"><div><h1>${title}</h1><p>${description}</p></div>${action}</header>`;
  D.button = (label, action, variant = 'secondary', icon = '') => `<button class="button ${variant}" data-action="${action}">${icon ? D.icon(icon) : ''}${label}</button>`;
  D.empty = (title, description, action = '') => `<div class="empty">${D.icon('folder')}<strong>${title}</strong><p>${description}</p>${action}</div>`;
  D.dialog = (title, content, footer = '') => {
    const modal = D.$('#modal');
    modal.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${title}</h2><button class="icon-button" aria-label="关闭对话框" data-close>${D.icon('close')}</button></div>${content}${footer}`;
    D.all('[data-close]', modal).forEach(button => button.onclick = () => modal.close());
    if (!modal.open) modal.showModal();
    return modal;
  };
  D.form = (title, fields, save, label = '保存') => {
    const modal = D.dialog(title, `<form id="design-form">${fields}<div class="dialog-footer"><button type="button" class="button secondary" data-close>取消</button><button class="button primary" type="submit">${label}</button></div></form>`);
    modal.querySelector('form').onsubmit = event => {
      event.preventDefault(); save(new FormData(event.currentTarget)); modal.close();
      D.toast('已更新演示内容，未写入项目或本地资料。');
    };
    return modal;
  };
  D.field = (label, name, value = '', placeholder = '') => `<label class="field">${label}<input name="${name}" required value="${D.escape(value)}" placeholder="${placeholder}"></label>`;
  D.sampleFiles = [
    { name: '浮力教学设计.docx', type: '教学设计', format: 'Word', date: '今天 10:24', icon: 'file' },
    { name: '浮力与密度课件.pptx', type: '课堂演示', format: 'PPT', date: '今天 09:18', icon: 'slides' },
    { name: '浮力课堂练习.pdf', type: '课堂练习', format: 'PDF', date: '昨天 16:30', icon: 'file' }
  ];
  D.fileRow = (file, index) => `<button class="file-row" data-preview="${index}">${D.icon(file.icon)}<span><b>${D.escape(file.name)}</b><small>${file.format} · ${file.date}</small></span></button>`;
  D.attention = (label = '') => {
    const button = D.$('#attention'); button.hidden = !label; button.textContent = label;
  };
  let panelTrigger;
  D.closePanel = () => {
    D.state.panel = false; D.$('#context').hidden = true;
    D.$('#panel-toggle').setAttribute('aria-expanded', 'false');
    if (panelTrigger?.isConnected) panelTrigger.focus();
    else D.$('#panel-toggle').focus();
  };
  D.openPanel = (tab = 'files', trigger = document.activeElement) => {
    if (!D.state.panel) panelTrigger = trigger;
    D.state.panel = true;
    const root = D.$('#context'); root.hidden = false;
    D.$('#panel-toggle').setAttribute('aria-expanded', 'true');
    root.innerHTML = `<header class="context-head"><strong>任务与文件</strong><button class="icon-button" id="context-close" aria-label="收起任务与文件">${D.icon('panel-right')}</button></header>
      <div class="context-tabs" role="tablist" aria-label="任务与文件视图"><button role="tab" aria-selected="${tab === 'tasks'}" data-panel-tab="tasks">当前任务</button><button role="tab" aria-selected="${tab === 'files'}" data-panel-tab="files">文件</button></div>
      <div class="context-body" role="tabpanel">${tab === 'files'
        ? `<section class="context-section"><h3>当前教学空间</h3><strong>${D.escape(D.state.space || '尚未关联教学空间')}</strong><small>空间用于整理会话，不等于文件授权。</small></section><section class="context-section"><h3>可查看的演示文件</h3>${D.sampleFiles.map(D.fileRow).join('')}</section>`
        : `<section class="context-section"><h3>当前任务</h3><strong>${D.state.chatScene && D.state.chatScene !== 'home' ? '准备一节浮力实验课' : '还没有进行中的任务'}</strong><p class="muted">${D.state.chatScene === 'completed' ? '结果已整理，请在对话中核对。' : '任务要求、公开执行记录和待确认操作在对话中查看。'}</p></section><section class="context-section"><h3>资料来源</h3><button class="file-row" data-preview="0">${D.icon('file')}八年级物理 · 浮力章节</button><small>演示来源，可点击查看排版与引用位置。</small></section>`}</div>`;
    D.$('#context-close').onclick = D.closePanel;
    D.all('[data-panel-tab]', root).forEach(button => button.onclick = () => { D.openPanel(button.dataset.panelTab); D.$(`[data-panel-tab="${button.dataset.panelTab}"]`).focus(); });
    D.all('[data-preview]', root).forEach(button => button.onclick = () => D.preview(D.sampleFiles[+button.dataset.preview]));
    D.$('#context-close').focus();
  };
  D.preview = file => {
    D.openPanel('files');
    const body = D.$('.context-body');
    body.innerHTML = `<button class="text-button" id="back-files">返回文件列表</button><h3 class="preview-filename">${D.escape(file.name)}</h3><div class="preview-tabs">预览 <span class="muted">· 演示排版</span></div>
      ${file.format === 'PPT' ? `<div class="slide-preview"><span>八年级物理 · 课堂实验</span><h2>浮力从哪里来？</h2><div class="water-diagram"><div class="block-diagram">物体</div></div><p>观察物体浸入水中时，测力计的示数变化。</p></div><div class="preview-pages"><button class="icon-button" id="slide-prev" aria-label="上一页">${D.icon('chevron')}</button><span id="slide-number">1 / 6</span><button class="icon-button" id="slide-next" aria-label="下一页">${D.icon('chevron')}</button></div>`
      : `<article class="document-preview"><small>演示内容 · 第 1 页</small><h2>浮力实验课</h2><h3>从一个问题开始</h3><p>把同一块物体缓缓浸入水中，弹簧测力计的示数会怎样变化？先让学生写下预测，再用实验验证。</p><h3>观察与记录</h3><p>记录物体在空气中、部分浸入水中和完全浸没时的测力计示数。每次读数保持视线与刻度相平。</p><h3>回到证据</h3><p>比较重力与拉力的差值，用自己的话解释浮力的方向和大小。讨论时区分“物体受到浮力”与“物体一定会上浮”。</p></article>`}
      <div class="preview-actions">${D.button('编辑副本', 'edit-preview', 'secondary', 'edit')}${D.button('导出', 'export-preview', 'outline', 'download')}</div><small>只演示界面，未读取或生成真实 Office 文件。</small>`;
    D.$('#back-files').onclick = () => D.openPanel('files');
    D.$('[data-action="edit-preview"]').onclick = () => D.form('编辑演示副本', `<label class="field">内容<textarea rows="9" name="content">浮力方向竖直向上；用实验记录支持解释。</textarea></label>`, () => {});
    D.$('[data-action="export-preview"]').onclick = () => D.form('导出文件 · 演示', D.field('文件名', 'name', file.name) + `<label class="field">导出格式<select name="format"><option>${file.format}</option><option>PDF</option></select></label><label class="field">保存位置<input readonly value="教师选择的本地导出目录 · 演示"></label><p class="notice">正式导出沿用原有路径确认、同名冲突和错误恢复。本稿不生成文件。</p>`, () => {}, '完成导出演示');
    let slide = 1;
    for (const [id, delta] of [['slide-prev', -1], ['slide-next', 1]]) if (D.$('#' + id)) D.$('#' + id).onclick = () => { slide = Math.max(1, Math.min(6, slide + delta)); D.$('#slide-number').textContent = `${slide} / 6`; D.$('.slide-preview h2').textContent = ['浮力从哪里来？', '先预测，再实验', '记录测力计读数', '比较重力与拉力', '用证据解释', '课堂理解检查'][slide - 1]; };
  };
})(window.Design);
