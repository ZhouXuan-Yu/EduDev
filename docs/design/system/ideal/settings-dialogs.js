/* Reviewable settings flows. All changes stay in this page's memory. */
(function (D) {
  const note = '<p class="notice">离线设计演示，不读取、备份、恢复或发送真实资料。</p>';
  const close = '<div class="dialog-footer"><button class="button secondary" data-close>完成</button></div>';
  function memory() {
    D.form('本会话记忆范围', `<p>只保留与当前教学任务有关的内容，文件访问范围另行授权。</p><div class="choice-list"><label><input type="checkbox" name="requirements" checked> 当前教学要求与教师已确认的修改</label><label><input type="checkbox" name="artifacts" checked> 已确认成果及其来源</label><label><input type="checkbox" disabled> 原始学生图片与完整私人文件</label></div>${note}`, () => {}, '确认范围');
  }
  function backup() {
    const modal = D.dialog('创建本地备份', `<p class="muted">先确认范围和位置，再开始备份。</p><div class="choice-list"><label><input type="checkbox" checked> 教学资料与原始文件</label><label><input type="checkbox" checked> 学生学习记录与教师校正</label><label><input type="checkbox" checked> 对话与已保存成果</label></div><label class="field">保存位置<input value="教师选择的本地备份目录 · 演示" readonly></label><p class="muted">备份不会删除或移动当前资料。实际产品使用原有备份引擎。</p>${note}<div class="dialog-footer"><button class="button secondary" data-close>取消</button><button class="button primary" id="backup-start">创建演示备份</button></div>`);
    D.$('#backup-start').onclick = () => { modal.close(); D.dialog('备份已准备 · 演示', `<div class="notice success">范围已核对，演示流程完成。没有生成真实备份文件。</div><dl class="flow-facts"><dt>包含</dt><dd>原始资料、学习记录、对话与成果</dd><dt>核验</dt><dd>实际产品须检查清单与可恢复性</dd><dt>当前位置</dt><dd>当前资料未改变</dd></dl>`, close); };
  }
  function restore() {
    const modal = D.dialog('检查备份', `<p class="muted">先验证备份，再决定是否恢复。不会直接覆盖现有资料。</p><label class="field">备份文件<input value="小智备份_示例.zip · 演示文件" readonly></label><div id="restore-status" class="notice">尚未检查。正式产品须确认备份格式、完整性和版本兼容性。</div>${note}<div class="dialog-footer"><button class="button secondary" data-close>取消</button><button class="button outline" id="restore-check">检查演示备份</button><button class="button primary" id="restore-confirm" disabled>下一步</button></div>`);
    D.$('#restore-check').onclick = () => { D.$('#restore-status').className = 'notice success'; D.$('#restore-status').textContent = '演示检查通过：格式、清单和版本均可继续。当前资料尚未改变。'; D.$('#restore-confirm').disabled = false; };
    D.$('#restore-confirm').onclick = () => { modal.close(); D.form('确认恢复影响', `<p class="notice warning">正式恢复可能替换当前资料。需要先创建当前数据的备份，并按原恢复流程处理冲突。</p><label class="field">恢复模式<select name="mode"><option>恢复到新的本地资料目录</option><option>替换当前资料（需额外确认）</option></select></label><label class="check-line"><input type="checkbox" required> 我已阅读影响说明，并保留当前资料副本</label>${note}`, () => {}, '完成演示确认'); };
  }
  function archive() {
    const modal = D.dialog('归档对话', `<p class="muted">归档保留历史与来源，可恢复到最近对话。</p><div class="record-row"><div><strong>一元一次方程旧稿</strong><small>七年级数学 · 已归档 · 演示记录</small></div><button class="button outline" id="unarchive">恢复到对话列表</button></div>${note}`);
    D.$('#unarchive').onclick = () => { D.$('#unarchive').disabled = true; D.$('#unarchive').textContent = '已恢复 · 演示'; D.toast('演示恢复完成，没有改动真实对话。'); };
  }
  function skill(label) {
    const descriptions = { '教学设计': ['年级、课题、课堂时长与参考资料', '教学目标、课堂活动与理解检查'], '试卷编制': ['考查范围、题型、难度与来源要求', '可逐题审阅的试卷草稿与答案'], '学情分析': ['当前学生已确认的学习记录', '有证据支持的关注点与教学建议'] };
    const [input, output] = descriptions[label] || descriptions['教学设计'];
    D.dialog(label, `<dl class="flow-facts"><dt>需要什么</dt><dd>${input}</dd><dt>提供什么</dt><dd>${output}</dd><dt>教师核对</dt><dd>确认来源、判断和最终成果</dd><dt>权限边界</dt><dd>不自动授予额外目录访问或写入权限</dd></dl>`, close);
  }
  function diagnostics() {
    D.dialog('连接与解析诊断 · 演示', `<p class="muted">只在排查问题时查看技术细节，日常设置保持简洁。</p><dl class="flow-facts"><dt>模型连接</dt><dd>未检测 · 设计稿不连接服务</dd><dt>资料解析</dt><dd>使用示例内容 · 未读取本地文件</dd><dt>界面状态</dt><dd>浅色 · HTML 审阅原型</dd></dl><details><summary>技术记录示例</summary><div class="detail-content">状态：design-only<br>网络请求：未发起<br>真实凭证：未收集<br>这里只展示记录层级，不伪造真实系统诊断结果。</div></details>`, close);
  }
  function addTool() {
    D.form('添加外部工具 · 演示', D.field('连接名称', 'name', '', '例如：公开资料查询') + D.field('服务地址', 'url', '', '仅演示，不发起连接') + '<label class="field">用途说明<textarea name="purpose" rows="3" placeholder="需要向工具提供什么，它将返回什么"></textarea></label><p class="notice warning">添加连接不等于授权执行。正式连接前核对来源、权限和可用性。</p>', data => {
      D.state.tools = [...(D.state.tools || []), { name: data.get('name'), url: data.get('url') }]; D.settings.render();
    }, '添加演示连接');
  }
  D.settingsDialogs = { memory, backup, restore, archive, skill, diagnostics, addTool };
})(window.Design);
