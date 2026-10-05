import type { OmniEduStore } from '../db';

/** Main-owned, same-conversation facts. A summary never grants new authority. */
export async function getPiProtectedContext(store: OmniEduStore, sessionId: string, excludedRunIds: readonly string[] = []): Promise<string> {
  const [controls, approvals, detail, changes, artifacts] = await Promise.all([
    store.xiaozhiState.controls(sessionId), store.xiaozhiState.approvals(sessionId), store.getAiConversationSession(sessionId),
    store.xiaozhiState.changes?.list(sessionId) || [],
    store.xiaozhiState.officeArtifacts?.list(sessionId)||[],
  ]);
  const excluded = new Set(excludedRunIds);
  const plans = controls.filter(item => item.kind === 'plan' && !excluded.has(item.runId));
  const safeApprovals = approvals.filter(item => !excluded.has(item.runId));
  const safeChanges = changes.filter(item => !excluded.has(item.runId));
  const safeArtifacts=artifacts.filter(item=>!excluded.has(item.runId));
  const titles = new Set<string>();
  for (const message of detail.messages) {
    if (excluded.has(String(message.metadata.agentRunId))) continue;
    if (message.metadata.piVersion !== 'xiaozhi.pi.education.v1' || !Array.isArray(message.metadata.publicItems)) continue;
    for (const item of message.metadata.publicItems) {
      if (!item || item.kind !== 'tool' || !Array.isArray(item.sources)) continue;
      for (const source of item.sources) if (typeof source?.title === 'string') titles.add(source.title.slice(0, 200));
    }
  }
  const learning=detail.session.studentId?(await store.learningReviews?.list(sessionId).catch(()=>[])||[]).filter(item=>!excluded.has(item.runId)):[];
  const practices=detail.session.studentId?(await store.practiceReviews?.list(sessionId).catch(()=>[])||[]).filter(item=>!excluded.has(item.runId)):[];
  const questions=(await store.questionReviews?.list(sessionId).catch(()=>[])||[]).filter(item=>!excluded.has(item.runId));
  if (!plans.length && !safeApprovals.length && !safeChanges.length && !safeArtifacts.length && !titles.size&&!learning.length&&!questions.length&&!practices.length) return '';
  const lines = [
    '[小智本会话本地记录，非新增授权]',
    '以下只是当前本地事实索引；计划步骤是公开声明，不代表产物已提交。审批状态不可由摘要改变，旧写入不可自动重放；不确定效果仅核验，新的文件效果仍需新确认。',
  ];
  for(const item of learning.slice(-8))lines.push(`学习核对：${JSON.stringify({kind:item.kind,state:item.state,version:item.version})}。状态仅供索引，不改变授权；未确认项须教师在本地重新核对，不重放旧工具。最新学习结论与策略须实读SQLite核验。`);
  for(const item of practices.slice(-8))lines.push(`练习核对：${JSON.stringify({state:item.state,count:item.count})}。仅供索引，不重放旧提议；最终安排须实读本地练习，不是学生已完成。`);
  for(const item of questions.slice(-8))lines.push(`题目核对：${JSON.stringify({state:item.state,count:item.count})}。仅供索引，不改变授权，不重放旧提议。教师最终答案须重新检索读取本地题库；题目保存不表示练习集合或学生作答完成。`);
  const included = { plans: 0, approvals: 0, changes: 0, artifacts:0,titles: 0 };
  let length = lines.join('\n').length;
  const add = (line: string, kind: keyof typeof included) => {
    // Reserve the omissions receipt; never cut a JSON record/hash in half.
    if (length + line.length + 1 > 11700) return;
    lines.push(line); length += line.length + 1; included[kind]++;
  };
  // Preserve the most recent file authority first; every omitted record is counted.
  for (const item of safeApprovals.slice(-16).reverse()) add(`文件审批：${JSON.stringify({ source: item.source, target: item.target, state: item.state, sourceSha256: item.sourceSha256 })}`, 'approvals');
  for (const item of safeChanges.slice(-16).reverse()) add(`文件修改：${JSON.stringify({ file: item.path, operation: item.operation, state: item.state })}`, 'changes');
  for(const item of safeArtifacts.slice(-16).reverse())add(`办公产物：${JSON.stringify({file:item.path,format:item.format,state:item.state,artifactId:item.state==='saved'?item.artifactId:null})}`,'artifacts');
  for (const plan of plans.slice(-8).reverse()) add(`计划：${JSON.stringify((plan.steps || []).slice(0, 12).map(step => ({ text: step.text.slice(0, 200), status: step.status })))}`, 'plans');
  for (const title of [...titles].slice(-16).reverse()) add(`已检索来源标题：${title}`, 'titles');
  lines.push(`本索引省略记录：计划${plans.length - included.plans}，审批${safeApprovals.length - included.approvals}，修改${safeChanges.length - included.changes}，产物${safeArtifacts.length-included.artifacts}，来源${titles.size - included.titles}；计划长步骤仅索引前200字，完整事实保留本地。`);
  // Apply the same education redaction before any facts enter SDK history/API.
  return (await store.sanitizeProblemText(lines.join('\n'))).sanitizedText;
}
