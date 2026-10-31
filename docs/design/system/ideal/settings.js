(function (D) {
  const state = D.state;
  const groups = ['模型与连接', '界面偏好', '资料与权限', '备份与归档'];
  const advanced = ['教育技能', '外部工具', '策略与诊断'];
  const row = (label, hint, control) => `<div class="settings-row"><div>${label}${hint ? `<small>${hint}</small>` : ''}</div>${control}</div>`;
  const select = (key, choices) => `<select data-setting="${key}" aria-label="${key}">${choices.map(value => `<option ${state.settings[key] === value ? 'selected' : ''}>${value}</option>`).join('')}</select>`;
  const toggle = (label, checked = true) => `<input class="switch" type="checkbox" data-setting="${label}" aria-label="${label}" ${state.settings[label] ?? checked ? 'checked' : ''}>`;
  const save = label => `<div class="settings-save">${D.button(label, 'save-settings', 'primary')}</div>`;
  function section() {
    switch (state.settingsTab || groups[0]) {
      case '模型与连接': return `<section class="settings-section"><h2>模型与连接</h2><p>配置模型后，新对话使用这里的默认值。</p>${row('API 密钥', '留空时保留已有密钥。设计稿不接收真实密钥。', '<input disabled placeholder="已配置 · 仅演示" aria-label="密钥演示占位">')}${row('默认模型', '会话内可以单独选择，不改变已有对话。', select('默认模型', ['当前已配置模型', '演示模型 A', '演示模型 B']))}${row('默认思考强度', '高强度通常更慢；下一轮生效。', select('默认思考强度', ['自动', '低', '高', '最高']))}${save('保存模型设置')}</section><section class="settings-section"><h2>联网资料</h2><p>公开网页用于补充资料，原始文件与学生图片保留本机。</p>${row('允许搜索公开网页', '每次使用保留真实工具过程与来源。', toggle('允许搜索公开网页'))}${row('网络解析', '仅用于公开资料查询，不修改系统网络。', select('网络解析', ['自动（推荐）', '系统解析']))}${save('保存联网设置')}</section><details><summary>可用模型与账户信息</summary><div class="detail-content">按需刷新模型目录、查看能力和账户信息；不在默认页面铺开容量数字与接口诊断。此处不查询真实账户。</div></details>`;
      case '界面偏好': return `<section class="settings-section"><h2>界面偏好</h2><p>保持界面清晰，把主要空间留给教学内容。</p>${row('外观', '本产品当前采用浅色主题。', '<span class="chip">浅色</span>')}${row('阅读密度', '控件沿官方尺寸，正文使用舒适行距。', select('阅读密度', ['均衡易读', '紧凑']))}${row('减少动画', '系统减少动态效果的偏好始终受到尊重。', toggle('减少动画', false))}${row('右侧任务与文件', '空白会话关闭；有成果或事项时提示，点击打开。', '<span class="chip">按需显示</span>')}${save('保存界面偏好')}</section>`;
      case '资料与权限': return `<section class="settings-section"><h2>资料与权限</h2><p>授权属于当前会话，不因为切换技能而扩大。</p>${row('当前教学工作目录', '八年级物理 · 演示目录，不是真实路径。', D.button('在对话中管理', 'directory', 'outline', 'folder'))}<div class="notice warning">写入、复制和移动资料仍需按原权限流程确认。设置里的说明不能替代实际操作处的风险提示。</div></section><section class="settings-section"><h2>资料保护</h2><p>原始资料与学生图片保留本机，模型仅使用完成任务所需的脱敏内容。</p>${row('本会话记忆', '仅选择与教学相关的内容，不扩大文件权限。', D.button('查看记忆范围', 'memory', 'secondary'))}<details><summary>了解数据与授权边界</summary><div class="detail-content">教学空间只整理会话，不等于授权目录。解析缓存可以重建，原始资料与教师确认结果需要保留。</div></details></section>`;
      case '备份与归档': return `<section class="settings-section"><h2>本地备份</h2><p>在整理或迁移资料前保留可恢复的副本。</p>${row('创建备份', '选择位置并核对范围后开始。', D.button('创建备份', 'backup', 'outline', 'download'))}${row('恢复备份', '实际恢复前须校验备份并说明影响。', D.button('检查备份', 'restore', 'secondary', 'refresh'))}</section><section class="settings-section"><h2>归档</h2><p>归档保留记录，和永久删除区分。</p>${row('演示归档对话', '一元一次方程旧稿 · 记录保留。', D.button('查看记录', 'archive', 'secondary', 'chat'))}</section>`;
      case '教育技能': return `<section class="settings-section"><h2>教育技能</h2><p>根据任务选择能力。技能不自动获得额外文件或写入权限。</p>${['教学设计', '试卷编制', '学情分析'].map(label => row(label, '可在输入框选项中查看与选择。', D.button('查看说明', 'skill-details', 'outline', 'book'))).join('')}</section>`;
      case '外部工具': return `<section class="settings-section"><h2>外部工具</h2><p>仅在需要连接外部能力时配置，默认教学任务无需先理解这些选项。</p><div class="notice warning">工具连接不会绕过当前会话权限。修改连接前确认目标与授权范围。</div>${state.tools?.length ? state.tools.map(tool => `<div class="record-row"><div><strong>${D.escape(tool.name)}</strong><small>${D.escape(tool.url)}</small></div><span class="chip">未连接 · 演示</span></div>`).join('') + D.button('添加连接', 'add-tool', 'outline', 'plus') : D.empty('尚未添加外部工具', '只添加与教学任务有关的工具。', D.button('添加连接', 'add-tool', 'outline', 'plus'))}</section>`;
      case '策略与诊断': return `<section class="settings-section"><h2>策略与诊断</h2><p>供核对行为与排查问题，不混入日常教学配置。</p><details><summary>最近策略选择记录 · 演示</summary><div class="detail-content"><p>当前呈现：默认教学任务。</p><p>来源：公开执行记录。这里不展示教师原话、学生事实或私有推理。</p></div></details><details><summary>解析与连接诊断</summary><div class="detail-content">需要排查时再查看接口状态、错误码和版本；默认不向老师堆叠技术字段。</div></details>${D.button('查看诊断说明', 'diagnostics', 'secondary', 'file')}</section>`;
    }
  }
  D.settings = {
    render() {
      const active = state.settingsTab || groups[0];
      D.$('#content').innerHTML = `<div class="page">${D.heading('设置', '日常设置直接可见，技术细节按需查看。')}<div class="settings-layout"><nav class="local-nav" aria-label="设置分类"><div class="local-nav-label">日常设置</div>${groups.map(label => `<button data-settings-tab="${label}" ${active === label ? 'aria-current="page"' : ''}>${label}</button>`).join('')}<button class="advanced-toggle" id="advanced-toggle" aria-expanded="${!!state.advanced}">${D.icon('chevron')}高级与诊断</button><div id="advanced-nav" ${state.advanced ? '' : 'hidden'}>${advanced.map(label => `<button data-settings-tab="${label}" ${active === label ? 'aria-current="page"' : ''}>${label}</button>`).join('')}</div></nav><div>${section()}</div></div></div>`;
      D.all('[data-settings-tab]').forEach(button => button.onclick = () => { state.settingsTab = button.dataset.settingsTab; D.settings.render(); });
      D.$('#advanced-toggle').onclick = () => { state.advanced = !state.advanced; D.$('#advanced-nav').hidden = !state.advanced; D.$('#advanced-toggle').setAttribute('aria-expanded', String(state.advanced)); };
      D.all('[data-setting]').forEach(input => input.onchange = () => { state.settings[input.dataset.setting] = input.type === 'checkbox' ? input.checked : input.value; });
      D.all('[data-action="save-settings"]').forEach(button => button.onclick = () => D.toast('演示偏好已保留在本次页面，未修改项目设置。'));
      D.$('[data-action="directory"]')?.addEventListener('click', () => D.dialog('当前会话工作目录', '<p>八年级物理 · 演示目录</p><p class="notice warning">正式实现只允许读取已授权的本地目录。写入、复制与移动需原权限流程逐次确认。</p>', '<div class="dialog-footer"><button class="button secondary" data-close>关闭</button></div>'));
      for (const action of ['memory', 'backup', 'restore', 'archive', 'diagnostics']) D.all(`[data-action="${action}"]`).forEach(button => button.onclick = D.settingsDialogs[action]);
      D.all('[data-action="skill-details"]').forEach((button, index) => button.onclick = () => D.settingsDialogs.skill(['教学设计', '试卷编制', '学情分析'][index]));
      D.$('[data-action="add-tool"]')?.addEventListener('click', D.settingsDialogs.addTool);
    }
  };
})(window.Design);
