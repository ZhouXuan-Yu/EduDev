(function (D) {
  const state = D.state;
  let timers = [], started = 0, stage = 0, composing = false;
  const prompts = {
    prep: '帮我准备一节八年级物理浮力实验课。',
    paper: '我想围绕一元一次方程组一份练习，请先帮我确认要求。',
    analysis: '请根据已有学习记录，帮我分析学生近期的薄弱知识点。'
  };
  const answerText = '可以把这节课围绕一个可观察的变化展开：同一物体逐渐浸入水中时，测力计的示数为什么变小？先让学生预测，再用实验记录支持自己的解释，比一开始就给出定义更容易建立理解。';
  function cancelTimers() { timers.forEach(clearTimeout); timers = []; }
  function composer() { return D.composer.html(); }
  function processBody() {
    if (state.chatScene === 'failed') return `<p class="process-commentary">先核对教材范围，再整理课堂活动。</p><div class="tool-entry">${D.icon('file')}<details open><summary>读取资料 · 浮力章节<small class="danger">未成功 · 资料暂时不可用</small></summary><div class="detail-content">未获得资料内容，没有据此生成教案或写入文件。你可以重新读取或更换资料。</div></details></div>`;
    const count = state.chatScene === 'running' ? stage : 3;
    return `<p class="process-commentary">先核对浮力章节的教学范围，再把课堂活动与理解检查串起来。</p>
      ${count >= 1 ? `<div class="tool-entry">${D.icon('file')}<details><summary>读取资料 · 八年级物理 / 浮力章节<small>已读取 · 教学空间中的参考资料</small></summary><div class="detail-content">教材要求：通过实验认识浮力，知道浮力的方向，能够解释测力计示数的变化。此为设计稿演示文本。</div></details></div>` : ''}
      ${count >= 2 ? `<p class="process-commentary">把“受到浮力”和“是否上浮”分开讨论。课堂先做预测和读数比较，再让学生用证据解释。</p><div class="tool-entry">${D.icon('search')}<details><summary>查找参考活动 · 浮力与测力计<small>已找到 · 2 处演示来源</small></summary><div class="detail-content">本稿不发起联网检索；此项展示搜索工具的图标、来源入口与完成状态。</div></details></div>` : ''}
      ${count >= 3 ? `<div class="tool-entry">${D.icon('edit')}<details><summary>整理教学设计 · 草稿已准备<small>写入前需教师确认</small></summary><div class="detail-content">拟生成：浮力教学设计.docx。实际产品继续保留原有写入授权与确认。</div></details></div>` : ''}`;
  }
  function finalAnswer() {
    return `<article class="answer" id="answer"><h2>用一次实验，讲清浮力</h2><p id="answer-opening">${state.streamingAnswer ? '' : answerText}</p><div id="answer-rest" ${state.streamingAnswer ? 'hidden' : ''}><p>课堂开始时，让学生画出物体在空气中与浸入水中时的受力示意图。教师暂不评价预测，而是请各组记录三个位置的测力计读数，随后一起讨论：哪一个量保持不变，哪一个量发生了变化？<button class="source-link" id="answer-source">教材 · 浮力章节</button></p><p>在解释环节，引导学生把“重力减去拉力”与浮力联系起来，明确浮力方向竖直向上。最后用“沉在水底的物体是否受到浮力”检查理解，避免把浮力等同于上浮。</p><p>教学设计与课堂练习已整理为可审阅的演示成果。你可以打开文件检查活动安排，再决定如何修改。</p><button class="artifact" id="answer-file">${D.icon('file')}<span><b>浮力教学设计.docx</b><small>教学设计 · 待教师审阅</small></span>${D.icon('external')}</button><div class="answer-actions"><button class="icon-button" id="copy-answer" aria-label="复制回复">${D.icon('copy')}</button><button class="icon-button" id="revise-answer" aria-label="继续修改">${D.icon('edit')}</button></div></div></article>`;
  }
  function bindComposer() {
    const input = D.$('#prompt');
    input.oninput = () => { state.draft = input.value; D.$('#send').disabled = !state.draft.trim() && !state.attachment && state.chatScene !== 'running'; };
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => { composing = false; });
    input.onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !composing) { event.preventDefault(); D.$('#composer').requestSubmit(); } };
    D.$('#composer').onsubmit = event => {
      event.preventDefault(); if (composing) return;
      if (state.chatScene === 'running') { D.chat.scene('stopped'); return; }
      if (!state.draft.trim() && !state.attachment) return;
      state.userPrompt = state.draft; state.draft = ''; D.chat.run();
    };
    D.composer.bind();
    const bindAttachment = () => {
      const remove = D.$('#remove-attachment');
      if (remove) remove.onclick = () => { state.attachment = false; D.$('#attachment-preview').innerHTML = ''; D.$('#attachment-preview').hidden = true; input.dispatchEvent(new Event('input')); D.$('#attach').focus(); };
    };
    D.$('#attach').onclick = () => { state.attachment = true; const node = D.$('#attachment-preview'); node.hidden = false; node.innerHTML = D.composer.attachment(); bindAttachment(); input.dispatchEvent(new Event('input')); };
    bindAttachment();
    D.all('[data-prompt]').forEach(button => button.onclick = () => {
      if (state.draft.trim()) { D.toast('已保留你的草稿，请先发送或清空。'); return; }
      input.value = button.dataset.prompt; input.dispatchEvent(new Event('input')); input.focus();
    });
  }
  function bindTurn() {
    const trigger = D.$('#process-trigger');
    if (trigger) trigger.onclick = () => { const open = trigger.getAttribute('aria-expanded') !== 'true'; trigger.setAttribute('aria-expanded', String(open)); D.$('#process-body').hidden = !open; };
    if (D.$('#retry')) D.$('#retry').onclick = D.chat.run;
    if (D.$('#continue')) D.$('#continue').onclick = () => { if (!state.draft.trim()) { state.draft = '保留已有结果，继续完成浮力教学设计。'; D.$('#prompt').value = state.draft; D.$('#prompt').dispatchEvent(new Event('input')); D.$('#prompt').focus(); } else D.toast('原草稿已保留。'); };
    if (D.$('#approve')) D.$('#approve').onclick = () => { D.chat.scene('completed'); D.toast('演示：教师确认后生成文件。没有实际写入。'); };
    if (D.$('#reject')) D.$('#reject').onclick = () => { D.$('.approval-card').innerHTML = '<strong>已拒绝保存</strong><p>没有写入文件；对话与草稿保留。</p>'; D.attention(); };
    if (D.$('#answer-file')) D.$('#answer-file').onclick = () => D.preview(D.sampleFiles[0]);
    if (D.$('#answer-source')) D.$('#answer-source').onclick = () => D.dialog('资料来源', '<article class="source-detail"><h3>八年级物理 · 浮力章节</h3><p>演示引文：通过实验认识浮力，知道浮力的方向。</p><p class="muted">来源位置：教材示例，第 24 页。正式页面将指向真实来源与版本。</p></article>');
    if (D.$('#copy-answer')) D.$('#copy-answer').onclick = async () => { try { await navigator.clipboard.writeText(D.$('#answer').innerText); D.toast('已复制演示回复。'); } catch { D.toast('浏览器未允许复制，请选择正文后复制。'); } };
    if (D.$('#revise-answer')) D.$('#revise-answer').onclick = () => { if (!state.draft.trim()) { state.draft = '请把这份教学设计调整为 40 分钟，并增加课堂互动。'; D.$('#prompt').value = state.draft; D.$('#prompt').dispatchEvent(new Event('input')); D.$('#prompt').focus(); } else D.toast('已保留输入框中的草稿。'); };
  }
  D.chat = {
    render() {
      const previousInput = D.$('#prompt');
      const restoreInputFocus = previousInput && document.activeElement === previousInput;
      const selection = restoreInputFocus ? [previousInput.selectionStart, previousInput.selectionEnd] : null;
      const scene = state.chatScene || 'home'; state.chatScene = scene;
      D.$('#scene').value = scene;
      const isHome = scene === 'home', running = scene === 'running';
      D.$('#content').innerHTML = `<div class="chat-page" data-scene="${scene}">${isHome
        ? `<section class="chat-home"><header class="chat-home-heading"><h1>今天想完成什么教学任务？</h1><p>从你的教学需求开始。</p></header>${composer()}<div class="home-shortcuts">${[['prep', 'book', '智能备课'], ['paper', 'file', '智能组卷'], ['analysis', 'chart', '学情分析']].map(([id, icon, label]) => `<button data-prompt="${prompts[id]}">${D.icon(icon)}${label}</button>`).join('')}</div><div class="home-examples"><button data-prompt="${prompts.prep}"><span>设计一个浮力课堂实验</span>${D.icon('external')}</button><button data-prompt="${prompts.analysis}"><span>从错题中梳理薄弱知识点</span>${D.icon('external')}</button></div></section>`
        : `<div class="conversation"><div class="message-user">${D.escape(state.userPrompt || prompts.prep)}</div><section class="agent-turn"><div class="process"><button class="process-summary" id="process-trigger" aria-expanded="${scene !== 'completed'}" aria-controls="process-body">${D.icon(running ? 'refresh' : scene === 'failed' ? 'alert' : 'check', running ? 'spin' : '')}<span id="process-label">${running ? '正在整理教学设计 · 0 秒' : scene === 'completed' ? `已完成 · 用时 ${state.completedSeconds ?? 8} 秒` : scene === 'failed' ? '本次未完成 · 用时 6 秒' : scene === 'stopped' ? '已停止 · 用时 4 秒' : '等待教师确认 · 用时 5 秒'}</span>${D.icon('chevron')}</button><div class="process-body" id="process-body" ${scene === 'completed' ? 'hidden' : ''}>${processBody()}</div></div>
          ${scene === 'failed' ? `<div class="notice error">参考资料暂时无法读取。已有内容和草稿保留，尚未生成文件。<div class="approval-actions">${D.button('重新读取', 'retry', 'outline', 'refresh')}</div></div>` : ''}
          ${scene === 'stopped' ? `<div class="notice">本轮已停止，已有记录保留。${D.button('准备继续', 'continue', 'secondary')}</div>` : ''}
          ${scene === 'approval' ? `<div class="approval-card"><strong>需要你确认文件写入</strong><p>拟保存「浮力教学设计.docx」到当前教学工作目录。</p><small>确认只适用于本次操作。你可以先查看草稿。</small><details><summary>预览草稿与保存位置</summary><div class="detail-content">演示教学设计：预测—实验—讨论—检查。保存位置：当前会话教学工作目录。</div></details><div class="approval-actions"><button class="button primary" id="approve">确认保存</button><button class="button secondary" id="reject">拒绝</button></div></div>` : ''}
          ${scene === 'completed' ? finalAnswer() : ''}</section></div><div class="active-composer">${running ? '<p class="queue-note">任务进行中，可以先写补充；停止按钮始终可用。</p>' : ''}${composer()}</div>`}</div>`;
      D.$('[data-action="retry"]')?.setAttribute('id', 'retry');
      D.$('[data-action="continue"]')?.setAttribute('id', 'continue');
      bindComposer(); bindTurn();
      if (restoreInputFocus) { D.$('#prompt').focus(); D.$('#prompt').setSelectionRange(...selection); }
      D.attention(scene === 'approval' ? '1 项待确认' : scene === 'completed' ? '1 个新成果' : '');
    },
    scene(value) { cancelTimers(); state.chatScene = value; state.streamingAnswer = false; state.completedSeconds = null; stage = 3; D.navigate('chat'); },
    pause: cancelTimers,
    run() {
      cancelTimers(); stage = 0; started = performance.now(); state.chatScene = 'running'; state.streamingAnswer = false; D.navigate('chat');
      for (const [index, delay] of [900, 2200, 3700].entries()) timers.push(setTimeout(() => {
        stage = index + 1; if (!D.$('#process-body')) return;
        D.$('#process-body').innerHTML = processBody();
        D.$('#process-label').textContent = `正在整理教学设计 · ${Math.round((performance.now() - started) / 1000)} 秒`;
      }, delay));
      timers.push(setTimeout(() => {
        state.chatScene = 'completed'; state.completedSeconds = Math.round((performance.now() - started) / 1000); state.streamingAnswer = true;
        if (state.route !== 'chat') { state.streamingAnswer = false; return; }
        D.chat.render();
        let position = 0;
        const type = () => {
          const node = D.$('#answer-opening'); if (!node) return;
          position += 4; node.textContent = answerText.slice(0, position);
          if (position < answerText.length) timers.push(setTimeout(type, 38));
          else { state.streamingAnswer = false; D.$('#answer-rest').hidden = false; }
        };
        type();
      }, 4900));
    }
  };
})(window.Design);
