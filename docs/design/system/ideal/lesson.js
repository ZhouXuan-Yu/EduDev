(function (D) {
  // Design proposal, not a new production module. All data stays in page memory.
  const state = { step: 0, goal: '通过测力计示数的变化认识浮力，能用实验记录解释浮力方向和大小，并区分浮力与浮沉。', question: '沉在水底的物体，是否一定不受浮力？', minutes: [5, 12, 10, 8, 5], checked: [false, false, false], depth: 60, answer: '', feedback: false, confirmed: false };
  const segments = [
    ['提出问题', '同一物体浸入水中后，测力计的示数会如何变化？', '导入'],
    ['预测与实验', '分组改变浸入体积，记录测力计示数。', '互动'],
    ['用证据解释', '比较重力与拉力，认识浮力的方向和大小。', '讲解'],
    ['检查理解', '沉在水底的物体，是否受到浮力？', '练习'],
    ['回顾与迁移', '区分“受到浮力”和“会上浮”。', '小结']
  ];
  function scope() {
    return `<aside class="lesson-side"><section><h3>本次课程</h3><b>八年级物理 · 浮力</b><p>40 分钟 · 先预测，再观察与解释</p><span class="chip warning">${state.confirmed ? '已完成演示核对' : '待教师核对'}</span></section><section><h3>采用的资料</h3><button id="lesson-source">${D.icon('file')}教材 · 浮力章节，第 24 页</button><p class="muted">只有明确选中的资料进入这次任务。原页、识别结果和教师补充分别标记。</p></section><section><h3>版本与任务</h3><p>课堂设计 · 草稿 v1<br>演示交互已就绪<br>尚未正式导出</p><details><summary>执行与来源详情</summary><p>真实产品应显示任务编号、来源版本、失败项与重试入口。此原型不连接模型或文件系统。</p></details></section></aside>`;
  }
  function outline() {
    return `<h2>先确定课堂怎样进行</h2><p>把资料变成可教、可观察、可检查的一节课。先调整活动安排，再进入课堂预演。</p><label class="field">教学目标<textarea id="lesson-goal" rows="2">通过测力计示数的变化认识浮力，能用实验记录解释浮力方向和大小，并区分浮力与浮沉。</textarea></label><div class="lesson-outline">${segments.map(([title, text, type], i) => `<div><span class="muted">${i + 1}</span><span><b>${title}</b><small>${text}</small></span><small class="lesson-type">${type}</small><label><input type="number" min="1" max="40" value="${state.minutes[i]}" data-lesson-minutes="${i}" aria-label="${title}分钟数"> 分</label></div>`).join('')}</div><p id="lesson-total" class="lesson-proposal">合计 ${state.minutes.reduce((a, b) => a + b, 0)} 分钟 · 可调整，40 分钟后进入预演。</p>`;
  }
  function preview() {
    return `<h2>在课堂上先试一遍</h2><p>教师预演：调整浸入体积，观察读数如何变化。这个交互是确定公式的设计样例，不是模型实时生成或真实实验测量。</p><div class="lesson-preview"><h3>为什么测力计的示数变小了？</h3><p>预测 → 改变浸入体积 → 读数 → 解释</p><div class="lesson-apparatus"><svg viewBox="0 0 360 255" role="img" aria-label="物体浸入水中的弹簧测力计示意图"><path d="M55 25H300 M180 25V45" stroke="#667382"/><rect x="160" y="45" width="40" height="55" rx="7" fill="#fff" stroke="#7a8696"/><path d="M180 52l-8 6 16 7-16 7 16 7-8 7v25" stroke="#7a8696"/><path d="M80 130v100h200V130" stroke="#8293a5"/><path d="M81 155h198v74H81z" fill="#e0effb" stroke="none"/><path d="M180 111v45" stroke="#6d7a89"/><rect id="lesson-object" x="154" y="156" width="52" height="48" rx="3" fill="#b7c8dc" stroke="#7489a0"/><path d="M228 198v-35m-6 7 6-7 6 7" stroke="#3975bd"/><text x="242" y="185" fill="#3975bd" stroke="none" font-size="14">浮力</text><text x="168" y="123" fill="#596677" stroke="none" font-size="12">拉力</text><text x="87" y="148" fill="#6e87a0" stroke="none" font-size="12">水面</text></svg><div class="lesson-controls"><label>浸入体积：<span id="lesson-depth-label">${state.depth}%</span><input type="range" min="0" max="100" value="${state.depth}" id="lesson-depth" aria-label="浸入体积"></label><div>测力计示数<br><output id="lesson-reading">${(3 - state.depth / 100).toFixed(1)} N</output></div><small>空气中读数 3.0 N<br>完全浸没读数 2.0 N</small><button class="button secondary" id="lesson-reset">重置实验</button></div></div><p class="lesson-explanation" id="lesson-explanation">请先预测：浸入体积增大时，示数会怎样变化？</p></div><div class="lesson-toolbar"><button class="button secondary" id="lesson-hint">显示教师追问</button><button class="button secondary" id="lesson-slide">查看讲义排版</button></div>`;
  }
  function quiz() {
    return `<h2>学生是否真的理解了？</h2><p>把课堂中的关键误区变成一个可检查的问题。答案解析默认在提交后出现，教师可以继续修改题目。</p><div class="lesson-quiz"><h3>沉在水底的物体，是否一定不受浮力？</h3>${[['A', '是，只有漂浮的物体才受浮力。'], ['B', '否，浮沉还取决于重力和其他作用力，不能仅据此判断。'], ['C', '是，只要物体重，浮力就会消失。']].map(([value, text]) => `<label><input type="radio" name="lesson-answer" value="${value}" ${state.answer === value ? 'checked' : ''}>${value}. ${text}</label>`).join('')}<div class="lesson-toolbar"><button class="button primary" id="lesson-submit">检查答案</button><button class="button secondary" id="lesson-edit-question">修改课堂检查</button></div><div id="lesson-feedback" class="notice ${state.answer === 'B' ? '' : 'warning'}" ${state.feedback ? '' : 'hidden'}>${state.answer === 'B' ? '这个解释更完整。' : '再想一想：受到浮力是否等于会上浮？'} 资料中的核心区分是“受到浮力”与“是否上浮”。课堂使用前仍须由教师核对具体边界条件。</div></div><p class="muted">课堂作答不自动写入学生档案。只有关联到具体学生、明确记录来源并经教师确认后，才能成为学习记录。</p>`;
  }
  function review() {
    return `<h2>核对后再用于教学</h2><p>草稿、示意实验和课堂题目保留在同一个课程上下文中。确认内容和使用范围后，再交付需要的版本。</p><div class="lesson-checks">${['已核对教学目标、课堂活动与 40 分钟安排', '已核对资料原页；区分资料事实、教师补充与 AI 草稿', '已亲自操作实验与课堂题，确认内容适合本班学生'].map((label, i) => `<label><input type="checkbox" data-lesson-check="${i}" ${state.checked[i] ? 'checked' : ''}>${label}</label>`).join('')}</div><button class="button primary" id="lesson-confirm" ${state.checked.every(Boolean) ? '' : 'disabled'}>${state.confirmed ? '已完成演示核对' : '确认此版课堂草稿'}</button><div class="lesson-delivery">${[['教学设计', 'Word'], ['课堂讲义', 'PDF'], ['互动实验', 'HTML']].map(([label, format]) => `<button class="button outline" data-lesson-export="${label}" ${state.confirmed ? '' : 'disabled'}>${D.icon('download')}${label} · ${format}</button>`).join('')}</div><p class="lesson-proposal">导出需要先选择位置，并沿用原有文件权限与逐次确认。这里仅展示交付流程，不生成文件，也不表示正式软件已具备新增能力。</p>`;
  }
  const render = () => {
    D.$('#content').innerHTML = `<article class="page lesson-page"><button class="back-link" id="lesson-back">${D.icon('chevron')}返回教学工作台</button>${D.heading('浮力实验课', '资料 → 课堂设计 → 互动预演 → 教师核对')}<nav class="lesson-steps" aria-label="课堂设计步骤">${['课堂设计', '互动预演', '理解检查', '核对与交付'].map((label, i) => `<button data-lesson-step="${i}" ${state.step === i ? 'aria-current="step"' : ''}><b>${i + 1}</b>${label}</button>`).join('')}</nav><div class="lesson-grid"><section class="lesson-main">${[outline, preview, quiz, review][state.step]()}</section>${scope()}</div><footer class="lesson-footer"><small>课堂设计提案 · 所有资料与交互均为合成样例</small>${state.step < 3 ? `<button class="button primary" id="lesson-next">${['确认安排，进入预演', '继续检查理解', '进入教师核对'][state.step]}</button>` : '<button class="button secondary" id="lesson-ask">请小智继续修改</button>'}</footer></article>`;
    D.$('#lesson-back').onclick = () => D.resources.teaching();
    D.all('[data-lesson-step]').forEach(b => b.onclick = () => { state.step = +b.dataset.lessonStep; render(); });
    D.$('#lesson-source').onclick = () => D.dialog('教材来源 · 演示', '<h3>浮力章节 · 第 24 页</h3><p>通过测力计示数的变化认识浮力。空气中读数 3 N，完全浸没时 2 N，差值对应 1 N 浮力。</p><p class="notice">合成教学样例；正式页面须绑定真实原页、资料版本和引文位置，不得用这段样例充当真实教材引用。</p>');
    D.all('[data-lesson-minutes]').forEach(input => input.oninput = () => { state.minutes[+input.dataset.lessonMinutes] = Number(input.value); state.confirmed = false; state.checked = [false,false,false]; D.$('#lesson-total').textContent = `合计 ${state.minutes.reduce((a,b) => a+b,0)} 分钟 · 目标 40 分钟`; });
    const goal = D.$('#lesson-goal');
    if (goal) { goal.value=state.goal; goal.oninput=()=>{state.goal=goal.value;state.confirmed=false;state.checked=[false,false,false];}; }
    D.$('#lesson-next')?.addEventListener('click', () => {
      if (state.step === 0 && (state.minutes.some(n => !Number.isInteger(n) || n < 1) || state.minutes.reduce((a,b) => a+b,0) !== 40)) { D.toast('请先把课堂活动调整为合计 40 分钟。'); return; }
      state.step++; render(); D.$('#content').scrollTop = 0;
    });
    const depth = D.$('#lesson-depth');
    if (depth) depth.oninput = () => { state.depth = +depth.value; D.$('#lesson-depth-label').textContent = state.depth + '%'; D.$('#lesson-reading').textContent = (3-state.depth/100).toFixed(1)+' N'; D.$('#lesson-object').setAttribute('y', String(115+state.depth*.6)); D.$('#lesson-explanation').textContent = '浸入体积增大，浮力增大，示数减小；完全浸没后，继续加深不改变本示意中的读数。'; };
    D.$('#lesson-reset')?.addEventListener('click', () => { state.depth=0; render(); D.$('#lesson-depth').dispatchEvent(new Event('input')); });
    D.$('#lesson-hint')?.addEventListener('click', () => D.dialog('教师追问', '<p>先请学生用自己的话预测变化，再记录读数。追问：“物体的重力变了吗？”“示数之差可以解释什么？”</p><p class="muted">教师可选择显示或隐藏提示，避免在学生观察前直接给出答案。</p>'));
    D.$('#lesson-slide')?.addEventListener('click', () => D.preview(D.sampleFiles[1]));
    D.all('[name=lesson-answer]').forEach(input => input.onchange = () => { state.answer=input.value; state.feedback=false; D.$('#lesson-feedback').hidden=true; });
    D.$('#lesson-submit')?.addEventListener('click', () => { if (!state.answer) { D.toast('请先选择一个解释。'); return; } state.feedback=true; render(); });
    const question = D.$('.lesson-quiz h3');
    if (question) question.textContent = state.question;
    D.$('#lesson-edit-question')?.addEventListener('click', () => D.form('修改课堂检查', `<label class="field">问题<textarea name="question" rows="3" required>${D.escape(state.question)}</textarea></label><p class="muted">此演示只编辑题干；修改后的题目与固定选项、答案仍需再次核对，不自动写入学生记录。</p>`, data => {state.question=String(data.get('question')).trim();state.confirmed=false;state.checked=[false,false,false];state.feedback=false;render();D.toast('问题已保存在本次页面内存，待重新核对。');}));
    D.all('[data-lesson-check]').forEach(input => input.onchange = () => { state.checked[+input.dataset.lessonCheck]=input.checked; state.confirmed=false; D.$('#lesson-confirm').disabled=!state.checked.every(Boolean); D.all('[data-lesson-export]').forEach(b=>b.disabled=true); });
    D.$('#lesson-confirm')?.addEventListener('click', () => { if(state.minutes.reduce((a,b)=>a+b,0)!==40 || !state.goal.trim()) {D.toast('请先核对教学目标和 40 分钟安排。');return;} state.confirmed=state.checked.every(Boolean); render(); });
    D.all('[data-lesson-export]').forEach(b => b.onclick = () => D.form('准备导出 · '+b.dataset.lessonExport, D.field('保存位置', 'directory', '当前会话教学工作目录')+'<p class="notice">正式软件沿用目录授权与文件写入确认。此处不会写入或覆盖文件。</p>', () => D.toast('交付流程演示完毕，没有实际写入。'), '准备演示导出'));
    D.$('#lesson-ask')?.addEventListener('click', () => D.openDraft('请基于当前浮力实验课草稿，调整课堂活动并保留资料出处。'));
  };
  D.lesson = { open() { state.step=0; render(); }, render };
})(window.Design);
