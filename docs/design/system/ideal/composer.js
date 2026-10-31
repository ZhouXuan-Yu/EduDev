/* The production OfficeComposer stays unchanged. This HTML mirrors its controls. */
(function (D) {
  const state = D.state;
  const permissions = ['请求批准', '接受编辑', '替我批准', '完全访问'];
  const skills = ['按任务自动选择', '教学设计', '试卷编制', '学情分析'];
  const commands = [['clear', '/clear', '清除对话上下文'], ['goal', '/goal', '持续目标'], ['compact', '/compact', '整理上下文'], ['permissions', '/permissions', '工作目录与权限'], ['skills', '/skills', '教育技能']];
  const thinking = ['跟随全局默认 · 自动', '自动', '关闭思考 · disabled / none', '低 · low', '高 · high', '最高 · max'];
  const option = (value, selected, description = '') => `<button type="button" role="menuitemradio" aria-checked="${value === selected}" data-menu-value="${D.escape(value)}"><span class="menu-check">${value === selected ? D.icon('check') : ''}</span><span>${D.escape(value)}${description ? `<small>${description}</small>` : ''}</span></button>`;
  const menu = (id, label, body) => `<div id="${id}" popover="auto" class="preserved-menu" role="menu" aria-label="${label}">${body}</div>`;
  D.composer = {
    html() {
      const running = state.chatScene === 'running';
      return `<div class="preserved-composer"><form class="composer" id="composer"><div class="preserved-shell"><div id="attachment-preview" ${state.attachment ? '' : 'hidden'}>${this.attachment()}</div>${state.skill && state.skill !== skills[0] ? `<div class="chip">${D.icon('book')}${D.escape(state.skill)}</div>` : ''}<textarea id="prompt" rows="2" aria-label="给小智发送消息" placeholder="${running ? '补充要求，小智会在下一步处理' : '告诉小智年级、课题和需要的内容，也可以添加资料…'}">${D.escape(state.draft)}</textarea><div class="composer-tools"><button class="icon-button" type="button" id="attach" aria-label="添加附件">${D.icon('clip')}</button><button class="model-button" type="button" id="model-options" aria-expanded="false" aria-haspopup="menu">${D.escape(state.model || 'deepseek-flash')} ${D.icon('chevron')}</button><button class="send-button" id="send" type="submit" aria-label="${running ? '停止本轮' : '发送消息'}" ${!state.draft.trim() && !state.attachment && !running ? 'disabled' : ''}>${D.icon(running ? 'stop' : 'arrow')}</button></div></div><div class="preserved-toolbar" aria-label="对话选项"><button type="button" id="permission-options" aria-haspopup="menu" aria-expanded="false">${D.icon('shield')}<span>${state.permission || permissions[0]}</span></button><button type="button" id="skill-options" aria-haspopup="menu" aria-expanded="false">${D.icon('book')}<span>技能</span>${D.icon('chevron')}</button><button type="button" id="commands" aria-haspopup="menu" aria-expanded="false">${D.icon('target')}<span>命令</span>${D.icon('chevron')}</button><button type="button" id="thinking-options" aria-haspopup="menu" aria-expanded="false"><span>思考：${D.escape(state.thinking || '跟随默认 · 自动')}</span>${D.icon('chevron')}</button></div></form><p class="composer-disclaimer">AI 可能会出错，请核对重要信息。</p>
      ${menu('model-menu', '模型', ['deepseek-flash', 'deepseek-v4-pro'].map(x => option(x, state.model || 'deepseek-flash')).join(''))}
      ${menu('permission-menu', '资料与操作权限', permissions.map((x, i) => option(x, state.permission || permissions[0], ['在设置未允许的编辑和命令前询问', '批准文件编辑和文件命令；其余操作会询问', '代你审核批准请求', '编辑或运行命令前从不询问'][i])).join('') + '<p class="menu-note">文件写入逐次由教师确认</p><button type="button" data-menu-command="directory">选择教学工作目录</button><button type="button" data-menu-command="permissions">管理工作目录与权限</button>')}
      ${menu('skill-menu', '教育技能', skills.map(x => option(x, state.skill || skills[0])).join(''))}
      ${menu('command-menu', '常用命令', commands.map(([id, command, label]) => `<button type="button" data-menu-command="${id}"><code>${command}</code><span>${label}</span></button>`).join(''))}
      ${menu('thinking-menu', '思考强度', thinking.map(x => option(x, state.thinking || thinking[0])).join('') + '<p class="menu-note">只改变下一轮配置；高强度通常更慢，可能消耗更多额度。</p>')}</div>`;
    },
    attachment() { return state.attachment ? `<span class="chip">${D.icon('file')}浮力章节.pdf · 演示<button type="button" class="icon-button small" id="remove-attachment" aria-label="移除演示附件">${D.icon('close')}</button></span>` : ''; },
    bind() {
      for (const [buttonId, menuId, key, fallback] of [['model-options', 'model-menu', 'model', 'deepseek-flash'], ['permission-options', 'permission-menu', 'permission', permissions[0]], ['skill-options', 'skill-menu', 'skill', skills[0]], ['commands', 'command-menu'], ['thinking-options', 'thinking-menu', 'thinking', thinking[0]]]) {
        const button = D.$('#' + buttonId), popup = D.$('#' + menuId);
        button.onclick = () => {
          popup.showPopover(); const rect = button.getBoundingClientRect(), size = popup.getBoundingClientRect();
          popup.style.left = `${Math.max(8, Math.min(innerWidth - size.width - 8, rect.left))}px`;
          popup.style.top = `${Math.max(8, rect.top - size.height - 8)}px`;
          button.setAttribute('aria-expanded', 'true'); popup.querySelector('button').focus();
        };
        popup.addEventListener('toggle', event => { if (event.newState === 'closed') button.setAttribute('aria-expanded', 'false'); });
        D.all('[data-menu-value]', popup).forEach(item => item.onclick = () => {
          state[key] = item.dataset.menuValue; popup.hidePopover();
          if (key === 'model') button.innerHTML = `${D.escape(state[key])} ${D.icon('chevron')}`;
          if (key === 'permission') button.innerHTML = `${D.icon('shield')}<span>${D.escape(state[key])}</span>`;
          if (key === 'thinking') button.innerHTML = `<span>思考：${D.escape(state[key])}</span>${D.icon('chevron')}`;
          D.all('[data-menu-value]', popup).forEach(row => { row.setAttribute('aria-checked', String(row.dataset.menuValue === state[key])); row.querySelector('.menu-check').innerHTML = row.dataset.menuValue === state[key] ? D.icon('check') : ''; });
          button.focus(); if (key === 'skill') D.toast('教育技能仅在演示中选择，正式组件与权限不变。');
        });
        D.all('[data-menu-command]', popup).forEach(item => item.onclick = () => {
          popup.hidePopover(); const command = item.dataset.menuCommand;
          if (command === 'clear') { D.$('#new-chat').click(); return; }
          if (command === 'directory') { D.dialog('选择教学工作目录', '<p>正式实现复用当前原生目录选择与会话授权。本 HTML 不读取真实目录。</p>'); return; }
          if (command === 'permissions') { state.settingsTab = '资料与权限'; D.navigate('settings'); return; }
          const proxy = document.createElement('button'); proxy.dataset.command = command; document.body.append(proxy); proxy.click(); proxy.remove();
        });
        popup.onkeydown = event => {
          if (event.key === 'Escape') { popup.hidePopover(); button.focus(); }
          if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
          event.preventDefault(); const items = D.all('button', popup), index = items.indexOf(document.activeElement);
          items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
        };
      }
    }
  };
})(window.Design);
