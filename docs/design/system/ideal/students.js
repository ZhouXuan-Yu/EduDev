(function (D) {
  const state = D.state;
  const students = [
    { id: 'sample-a', name: '林同学', grade: '八年级', subject: '物理', initials: '林', focus: '浮力与受力分析' },
    { id: 'sample-b', name: '陈同学', grade: '七年级', subject: '数学', initials: '陈', focus: '一元一次方程' },
    { id: 'sample-c', name: '周同学', grade: '八年级', subject: '物理', initials: '周', focus: '实验读数与单位' }
  ];
  const tabs = ['档案', '学习记录', '错题与练习', '学习计划', '学习复盘', '学习概览'];
  const entries = [];
  function student() { return students.find(row => row.id === state.student); }
  function newRecord() {
    const current = student();
    D.form('添加学习记录', `<p class="muted">当前学生：${D.escape(current.name)} · 演示档案</p><label class="field">记录类型<select name="type"><option>课堂观察</option><option>练习反馈</option><option>教师备注</option></select></label>${D.field('记录标题', 'title', '', '例如：浮力实验中的解释与表现')}<label class="field">内容<textarea name="content" required rows="4" placeholder="记录实际观察，避免没有依据的标签"></textarea></label>`, data => {
      entries.unshift({ studentId: current.id, title: data.get('title'), content: data.get('content') });
      state.studentTab = '学习记录'; D.students.render();
    });
  }
  function body(current) {
    const subject = current.subject === '物理' ? '浮力方向与受力分析' : '移项与去括号';
    switch (state.studentTab) {
      case '档案': return `<section><div class="student-facts"><div><dt>年级</dt><dd>${current.grade}</dd></div><div><dt>学科</dt><dd>${current.subject}</dd></div><div><dt>当前关注</dt><dd>${current.focus}</dd></div><div><dt>资料范围</dt><dd>该学生的学习记录与教师备注</dd></div></div><section class="insight"><h3>教师备注</h3><p>先让学生解释自己的判断，再通过练习核对理解。这里的内容是设计稿样例，不是对真实学生的评价。</p></section><div class="detail-actions">${D.button('编辑档案', 'edit-student', 'outline', 'edit')}${D.button('围绕该学生提问', 'ask-student', 'secondary', 'chat')}</div></section>`;
      case '学习记录': return `<div class="toolbar"><label class="search-box">${D.icon('search')}<input id="record-search" aria-label="查找学习记录" placeholder="查找该学生的记录"></label>${D.button('添加记录', 'add-record', 'primary', 'plus')}</div><div class="timeline">${entries.filter(row => row.studentId === current.id).map(row => `<article class="timeline-item" data-record><time>刚刚 · 教师记录</time><h3>${D.escape(row.title)}</h3><p>${D.escape(row.content)}</p></article>`).join('')}<article class="timeline-item" data-record><time>今天 · 课堂观察（演示）</time><h3>${subject}</h3><p>能描述操作过程，解释原因时仍需回到实验记录。</p></article><article class="timeline-item" data-record><time>昨天 · 练习反馈（演示）</time><h3>课堂练习后的回顾</h3><p>请学生用自己的话解释关键步骤，并补充依据。</p></article></div>`;
      case '错题与练习': return `<div class="toolbar"><span class="muted">从原题与教师校正出发安排练习</span>${D.button('添加错题', 'add-mistake', 'primary', 'plus')}</div><section class="question-row"><h3>${current.subject === '物理' ? '浸没物体的浮力判断' : '去括号时的符号处理'} <span class="chip warning">待教师核对</span></h3><p>${current.subject === '物理' ? '学生把“物体下沉”理解成“不受浮力”。' : '学生在括号前有负号时漏改了第二项的符号。'}</p><details><summary>原题、实际作答与校正</summary><div class="detail-content"><p>原题与作答图将在此并排对照；不把推测当作已确认错因。</p><p>演示校正：请学生重新解释判断，并指出依据。</p></div></details><div class="detail-actions">${D.button('核对并校正', 'correct-mistake', 'outline', 'edit')}${D.button('安排针对性练习', 'practice', 'secondary', 'file')}</div></section>`;
      case '学习计划': return `<div class="toolbar"><span class="muted">基于已经确认的记录安排下一步</span>${D.button('新建计划', 'new-plan', 'primary', 'plus')}</div><section class="insight"><h3>本周：解释清楚关键步骤 <span class="chip blue">进行中</span></h3><p>用 2 道基础题核对 ${subject}，完成后说清判断依据。记录表现，再决定是否增加练习。</p><div class="detail-actions">${D.button('查看与调整', 'edit-plan', 'outline', 'edit')}${D.button('记录完成情况', 'add-record', 'secondary', 'check')}</div></section>`;
      case '学习复盘': return `<div class="toolbar"><span class="muted">保留学生反思与教师观察</span>${D.button('添加复盘', 'new-review', 'primary', 'plus')}</div><section class="insight"><h3>本周学习回顾</h3><p>能够复述主要过程，但还需要把结论与依据连接起来。下一次先请学生独立解释，再用少量练习检验。</p><details><summary>查看本次复盘依据</summary><div class="detail-content">关联演示记录：课堂观察、练习反馈。正式结论必须来自该学生已确认的学习证据。</div></details></section>`;
      case '学习概览': return `<p class="notice">依据 3 条演示记录展示信息层级；样例数据不代表真实掌握率或模型评价。</p><div class="bar-chart" aria-label="演示记录分布">${[['课堂观察', 2, 66], ['练习反馈', 1, 33], ['学习复盘', 0, 0]].map(([label, count, width]) => `<div class="bar-row"><span>${label}</span><div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div><span>${count} 条</span></div>`).join('')}</div><section class="insight"><h3>值得继续核对</h3><p>${subject} 在近期记录中多次出现。建议先查看具体记录，再安排教学；不根据少量数据下固定能力结论。</p>${D.button('查看关联记录', 'show-records', 'secondary', 'file')}</section>`;
    }
  }
  D.students = {
    render() {
      const current = student();
      D.$('#content').innerHTML = `<div class="page">${D.heading('学生工作台', '先选择学生，再围绕学习记录安排下一步教学。', D.button('添加学生', 'new-student', 'primary', 'plus'))}<div class="student-layout"><aside class="student-list" aria-label="学生列表"><label class="search-box">${D.icon('search')}<input id="student-search" aria-label="搜索学生" placeholder="搜索学生"></label><div>${students.map(row => `<button class="student-option" data-student="${row.id}" ${state.student === row.id ? 'aria-current="true"' : ''}><span class="avatar">${D.escape(row.initials)}</span><span>${D.escape(row.name)}<small>${row.grade} · ${row.subject}</small></span></button>`).join('')}</div><p id="no-students" class="muted" hidden>没有匹配的演示档案</p><p class="table-summary">以上均为演示学生</p></aside><section class="student-detail" aria-label="学生详情">${current ? `<header class="student-heading"><div><h2>${D.escape(current.name)}</h2><p>${current.grade} · ${current.subject} · 演示档案</p></div><button class="icon-button" data-action="student-more" aria-label="学生档案操作">${D.icon('more')}</button></header><nav class="tabs" role="tablist" aria-label="学生信息">${tabs.map(label => `<button role="tab" data-student-tab="${label}" aria-selected="${state.studentTab === label}">${label}</button>`).join('')}</nav><section id="student-tab-content" data-student-id="${current.id}" aria-label="${state.studentTab}">${body(current)}</section>` : D.empty('选择一位学生', '查看该学生的档案、学习记录、错题与计划。也可以先创建一份档案。')}</section></div></div>`;
      D.$('[data-action="new-student"]').onclick = () => D.form('添加学生 · 演示', `${D.field('称呼', 'name', '', '只填写教学需要的称呼')}${D.field('年级', 'grade', '八年级')}${D.field('学科', 'subject', '物理')}<p class="muted">正式产品只保存必要学习资料，不要求敏感身份信息。</p>`, data => {
        const id = 'sample-' + students.length; students.push({ id, name: data.get('name'), grade: data.get('grade'), subject: data.get('subject'), initials: String(data.get('name')).slice(0, 1), focus: '待记录' }); state.student = id; state.studentTab = '档案'; D.students.render();
      }, '创建档案');
      D.all('[data-student]').forEach(button => button.onclick = () => { state.student = button.dataset.student; D.students.render(); });
      D.all('[data-student-tab]').forEach(button => button.onclick = () => { state.studentTab = button.dataset.studentTab; D.students.render(); });
      D.$('#student-search').oninput = event => { D.all('[data-student]').forEach(row => { row.hidden = !row.textContent.includes(event.target.value); }); D.$('#no-students').hidden = D.all('[data-student]').some(row => !row.hidden); };
      if (!current) return;
      D.all('[data-action="add-record"]').forEach(button => button.onclick = newRecord);
      D.$('[data-action="ask-student"]')?.addEventListener('click', () => D.openDraft(`请依据${current.name}已有的学习记录，整理需要关注的问题。`));
      D.$('[data-action="edit-student"]')?.addEventListener('click', () => D.form('编辑档案', D.field('称呼', 'name', current.name) + D.field('当前关注', 'focus', current.focus), data => { current.name = data.get('name'); current.focus = data.get('focus'); D.students.render(); }));
      D.$('[data-action="student-more"]').onclick = () => D.dialog('学生档案操作', '<p>归档会保留学习记录与历史来源。正式实现需确认未保存内容后才能切换或归档。</p>', '<div class="dialog-footer"><button class="button secondary" data-close>返回</button></div>');
      D.$('#record-search')?.addEventListener('input', event => D.all('[data-record]').forEach(row => { row.hidden = !row.textContent.includes(event.target.value); }));
      for (const action of ['add-mistake', 'correct-mistake', 'practice']) D.$(`[data-action="${action}"]`)?.addEventListener('click', () => D.form(action === 'practice' ? '安排练习' : '错题与校正', `<p class="muted">${D.escape(current.name)} · ${current.subject} · 演示</p><label class="field">原题与教学观察<textarea name="content" rows="5" required placeholder="核对原题与实际作答后，记录观察"></textarea></label>`, () => {}));
      for (const action of ['new-plan', 'edit-plan', 'new-review']) D.$(`[data-action="${action}"]`)?.addEventListener('click', () => D.form(action === 'new-review' ? '添加学习复盘' : '学习计划', D.field('标题', 'title', '解释清楚关键步骤') + '<label class="field">内容<textarea name="content" rows="4" required>先说清依据，再用少量练习检查理解。</textarea></label>', () => {}));
      D.$('[data-action="show-records"]')?.addEventListener('click', () => { state.studentTab = '学习记录'; D.students.render(); });
    }
  };
})(window.Design);
