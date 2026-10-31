// Offline layout review only: no fetch, IPC, persistence or provider calls.
const $ = s => document.querySelector(s),
  all = s => [...document.querySelectorAll(s)];
const paths = {
  book: 'M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3z M12 6v15',
  panel: 'M4 3h16v18H4z M15 3v18 M10 9l-3 3 3 3',
  plus: 'M12 5v14 M5 12h14',
  search: 'M20 20l-5-5 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  chat: 'M4 4h16v13H9l-5 4z',
  library: 'M4 4v16 M9 4v16 M14 4l5 16',
  users: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-3a5 5 0 0 1 10 0v3 M16 4a4 4 0 0 1 0 8 M17 15a5 5 0 0 1 5 5',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M4 4l3 1 2-3h6l2 3 3-1 2 5-2 3 2 3-2 5-3-1-2 3H9l-2-3-3 1-2-5 2-3-2-3z',
  clip: 'M8 13l6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9',
  arrow: 'M12 19V5 M6 11l6-6 6 6',
  file: 'M5 3h9l5 5v13H5z M14 3v6h5'
};
all('[data-icon]').forEach(el => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(svg.namespaceURI, 'path');
  p.setAttribute('d', paths[el.dataset.icon]);
  p.setAttribute('stroke-linecap', 'round');
  p.setAttribute('stroke-linejoin', 'round');
  svg.append(p);
  el.append(svg);
});
let toastTimer,
  selectedStudent = '',
  currentTab = '学习记录',
  lastPanelTrigger;
function notice(text) {
  $('#notice').textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#notice').textContent = '', 4000);
}
function panel(open, trigger) {
  $('#context').hidden = !open;
  $('#panel-toggle').setAttribute('aria-expanded', String(open));
  $('#panel-toggle').setAttribute('aria-label', open ? '关闭任务与文件' : '打开任务与文件');
  if (open) {
    lastPanelTrigger = trigger;
    $('#context-close').focus();
  } else lastPanelTrigger?.focus();
}
function navigate(page) {
  all('[data-view]').forEach(v => v.hidden = v.dataset.view !== page);
  all('[data-page]').forEach(b => b.dataset.page === page ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  all('[data-destination]').forEach(b => {
    b.classList.toggle('selected', b.dataset.destination === page);
    b.dataset.destination === page ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
  });
  $('#page-title').textContent = {
    chat: '问小智',
    students: '学生工作台',
    settings: '设置'
  }[page];
  if (!$('#context').hidden) panel(false);
}
all('[data-page]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.page)));
all('[data-destination]').forEach(b => {
  b.title = b.textContent.trim();
  b.setAttribute('aria-label', b.title);
  b.addEventListener('click', () => ['chat', 'students', 'settings'].includes(b.dataset.destination) ? navigate(b.dataset.destination) : notice('本轮只审阅首页、学生页与设置；此入口将在正式页面复用原业务。'));
});
$('#new-chat').addEventListener('click', () => {
  navigate('chat');
  $('#prompt').focus();
  notice('样张只切换首页，保留输入草稿；不创建真实会话。');
});
$('#search-chat').addEventListener('click', () => notice('对话搜索沿用正式能力，本样张不读取历史。'));
$('#collapse').addEventListener('click', () => {
  const collapsed = $('.app').classList.toggle('collapsed');
  $('#collapse').setAttribute('aria-expanded', String(!collapsed));
  $('#collapse').setAttribute('aria-label', collapsed ? '展开导航' : '收起导航');
  $('#collapse').title = collapsed ? '展开导航' : '收起导航';
});
$('#prompt').addEventListener('input', () => $('.send').disabled = !$('#prompt').value.trim());
all('[data-prompt]').forEach(b => b.addEventListener('click', () => {
  if ($('#prompt').value.trim()) {
    notice('已有草稿，样张不会替换。');
    return;
  }
  $('#prompt').value = b.dataset.prompt;
  $('#prompt').dispatchEvent(new Event('input'));
  $('#prompt').focus();
}));
$('#composer').addEventListener('submit', e => {
  e.preventDefault();
  notice('仅布局样张：没有发送消息或调用模型。');
});
$('#attachment').addEventListener('click', () => notice('正式页面沿用附件授权与上传能力，样张不访问文件。'));
$('#model-menu').addEventListener('click', () => {
  const expanded = $('#options').hidden;
  $('#options').hidden = !expanded;
  $('#model-menu').setAttribute('aria-expanded', String(expanded));
});
$('#file-demo').addEventListener('click', () => {
  $('#file-notice').hidden = false;
  notice('已显示示例文件提示；右栏保持关闭。');
});
$('#file-notice').addEventListener('click', () => panel(true, $('#file-notice')));
$('#panel-toggle').addEventListener('click', () => panel($('#context').hidden, $('#panel-toggle')));
$('#context-close').addEventListener('click', () => panel(false));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#context').hidden) panel(false);
});
$('#sample-file').addEventListener('click', () => notice('这是合成占位文件，不是真实预览。'));
function studentContent() {
  const id = selectedStudent;
  $('#student-name').textContent = `合成学生 ${id}`;
  $('#tab-title').textContent = currentTab;
  $('#student-state').textContent = `合成学生 ${id} · 暂无${currentTab}`;
  $('#record-action').textContent = currentTab === '学习记录' ? '添加记录' : '在此查看与整理';
  all('[data-tab]').forEach(b => b.dataset.tab === currentTab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
}
all('[data-student]').forEach(b => b.addEventListener('click', () => {
  selectedStudent = b.dataset.student;
  $('#student-empty').hidden = true;
  $('#student-selected').hidden = false;
  all('[data-student]').forEach(x => x === b ? x.setAttribute('aria-current', 'true') : x.removeAttribute('aria-current'));
  studentContent();
}));
all('[data-tab]').forEach(b => b.addEventListener('click', () => {
  currentTab = b.dataset.tab;
  studentContent();
}));
$('#student-search').addEventListener('input', () => {
  const q = $('#student-search').value.toLowerCase();
  all('[data-student]').forEach(b => b.hidden = !b.textContent.toLowerCase().includes(q));
  $('#no-students').hidden = all('[data-student]').some(b => !b.hidden);
});
$('#advanced-link').addEventListener('click', () => {
  $('#advanced').open = true;
  $('#advanced summary').focus();
  $('#advanced').scrollIntoView({
    block: 'nearest'
  });
});
for (const id of ['add-student', 'record-action', 'save-demo', 'directory-demo', 'backup-demo']) $('#' + id).addEventListener('click', () => notice('仅演示操作位置；不保存数据、不修改设置或权限。'));
