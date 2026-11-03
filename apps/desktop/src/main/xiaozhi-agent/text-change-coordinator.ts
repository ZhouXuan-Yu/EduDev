import {scienceFigureParameters} from '../../shared/science-figure';
import {buoyancyDemoParameters} from '../../shared/buoyancy-demo';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { XiaozhiAgentEventPayload } from '../../shared/xiaozhi-agent';
import type { XiaozhiChangeDecision, XiaozhiChangeReviewInput, XiaozhiChangeResult,
  XiaozhiChangeReview, XiaozhiChangeSummary, XiaozhiChangeError } from '../../shared/xiaozhi-changes';
import { createTextChangeState, changeSummary } from './text-change-state';
import { createTextChangeService } from './text-change-service';
import {CHECKS_PARAMETERS,withCheckReceipt,type CheckPreflight,type CheckReceipt} from './checks/preflight';

type Wait = (action: () => Promise<boolean>) => Promise<boolean>;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const session = (v: unknown): v is string => typeof v === 'string' && /^aisession_[a-f0-9-]{36}$/i.test(v);
const change = (v: unknown): v is string => typeof v === 'string' && /^xichange_[a-f0-9-]{36}$/i.test(v);
const errorCode = (raw: unknown): XiaozhiChangeError => {
  const message = raw instanceof Error ? raw.message : '';
  return ['file_writes_disabled','invalid_input', 'permission_denied', 'conflict', 'busy'].includes(message) ? message as XiaozhiChangeError : 'configuration';
};
const receipt = async (row: XiaozhiChangeSummary, sanitize: (value: string) => Promise<string>) => ({
  // No file content, differences, private root or hash is sent to the model.
  content: [{ type: 'text' as const, text: JSON.stringify({ success: row.state === 'applied',
    file: await sanitize(row.path), operation: row.operation, outcome: row.state,
    message: row.state === 'applied' ? '教师已确认，文件已保存并核验。' : row.state === 'rejected' ? '教师拒绝，本次没有写入。'
      : row.state === 'conflict' ? '文件版本已变化，本次没有覆盖。原内容和提议均保留在本地审阅。请先读取当前文件核对教师修改；只有教师明确继续时才基于最新内容提出新审阅并重新确认，不复用旧批准。' : '本次未确认完成，请查看实际状态。' }) }],
  details: { success: row.state === 'applied' }, isError: row.state !== 'applied',
});

/** One Pi tool awaits one durable local proposal. No additional agent loop. */
export function createTextChangeCoordinator(options: {
  state: ReturnType<typeof createTextChangeState>; service: ReturnType<typeof createTextChangeService>;
  isCurrent: (sessionId: string, runId: string) => boolean;
  emit: (sessionId: string, runId: string, event: XiaozhiAgentEventPayload) => void;
  sanitize: (value: string) => Promise<string>;
  preflight?:CheckPreflight;
  checkReceipt?:CheckReceipt;
}) {
  const waits = new Map<string, { sessionId: string; runId: string; finish: (approved: boolean) => void }>();
  const publish = async (sessionId: string, id: string) => {
    const row = await options.state.get(id);
    if (!row || row.sessionId !== sessionId) throw new Error('permission_denied');
    const summary = changeSummary(row); options.emit(sessionId, row.runId, { kind: 'change', change: summary }); return summary;
  };
  async function cancel(runId: string) {
    await options.state.invalidateRun(runId);
    for (const [id, waiting] of waits) if (waiting.runId === runId) {
      try { await publish(waiting.sessionId, id); } finally { waiting.finish(false); }
    }
  }
  return {
    service:options.service,
    cancel,
    async review(input: XiaozhiChangeReviewInput): Promise<XiaozhiChangeResult<XiaozhiChangeReview>> {
      if (!object(input) || Object.keys(input).some(key => !['sessionId', 'changeId'].includes(key))
        || !session(input.sessionId) || !change(input.changeId)) return { ok: false, error: 'invalid_input' };
      try { return { ok: true, value: await options.service.review(input.sessionId, input.changeId) }; }
      catch (error) { return { ok: false, error: errorCode(error) }; }
    },
    async decide(input: XiaozhiChangeDecision): Promise<XiaozhiChangeResult<XiaozhiChangeSummary>> {
      if (!object(input) || !session(input.sessionId) || !change(input.changeId)) return { ok: false, error: 'invalid_input' };
      const waiting = waits.get(input.changeId);
      if (['approve', 'reject'].includes(input.action) && (!waiting || waiting.sessionId !== input.sessionId
        || !options.isCurrent(waiting.sessionId, waiting.runId))) return { ok: false, error: 'permission_denied' };
      try {
        const result = await options.service.decision(input);
        await publish(input.sessionId, result.id);
        if (waiting) waiting.finish(result.state === 'approved' && options.isCurrent(waiting.sessionId, waiting.runId));
        return { ok: true, value: changeSummary(result) };
      } catch (error) { return { ok: false, error: errorCode(error) }; }
    },
    tools(sessionId: string, runId: string, wait: Wait): ToolDefinition[] {
      const execute = async (callId: string, raw: unknown, signal: AbortSignal | undefined, operation: 'create' | 'edit' | 'science') => {
        if (!object(raw) || 'operation' in raw) throw new Error('invalid_input');
        const {checks,...proposal}=raw;
        const row = await options.service.propose(sessionId, runId, callId, operation === 'science' ? proposal : { ...proposal, operation }, signal, operation === 'science');
        if (row.state !== 'pending') return receipt(changeSummary(row), options.sanitize);
        const blocked=await options.preflight?.(sessionId,runId,callId,[{kind:'text',id:row.id}],checks,signal);
        if(blocked){const current=await options.state.get(row.id);if(current?.state==='pending')await options.state.transition(current,['pending'],'interrupted');await publish(sessionId,row.id);return blocked;}
        try {
          const approved = await wait(() => new Promise<boolean>(resolve => {
            const finish = (value: boolean) => { waits.delete(row.id); signal?.removeEventListener('abort', abort); resolve(value); };
            const abort = () => { void cancel(runId).catch(() => undefined).finally(() => finish(false)); };
            waits.set(row.id, { sessionId, runId, finish }); signal?.addEventListener('abort', abort, { once: true });
            if (signal?.aborted || !options.isCurrent(sessionId, runId)) abort();
            else void publish(sessionId, row.id).catch(() => abort());
          }));
          signal?.throwIfAborted();
          if (approved) { const outcome = await options.service.apply(sessionId, row.id, signal); await publish(sessionId, row.id); const result=await receipt(changeSummary(outcome), options.sanitize);return withCheckReceipt(result,await options.checkReceipt?.(sessionId,runId,callId)); }
          return receipt(await publish(sessionId, row.id), options.sanitize);
        } catch (error) {
          await cancel(runId); await publish(sessionId, row.id).catch(() => undefined); throw error;
        }
      };
      const safeExecute = async (...args: Parameters<typeof execute>) => {
        try { return await execute(...args); }
        catch (error) {
          const code = error instanceof Error ? error.message : '';
          if (args[2]?.aborted || code === 'cancelled' || code === 'budget_exhausted') throw new Error(code === 'budget_exhausted' ? code : 'cancelled');
          return { content: [{type:'text' as const,text:JSON.stringify({success:false,message:
            code==='file_writes_disabled'?'小智自动文件生成已暂停，本次没有提出或写入文件。已有成果仍可读取；恢复生成需取消启动停写设置并重启。':code==='too_large'?'内容超过UTF8 64KiB上限（HTML含宿主策略头），没有保存或截断。请减少冗余或拆成多份后重新提交。':code==='conflict'?'文件或修改记录已变化，本次没有覆盖；请先重新读取当前文件核对教师修改。原提议仍保留；教师明确继续后，基于最新内容提出新审阅并重新确认，不能沿旧批准强写。':code==='permission_denied'?'当前操作未获授权或确认已失效。':args[3]==='science'?'科普图未生成，但尚未提交审阅。请只修正本轮工具参数后重试，不要改为普通文本。必须40至80个实体、恰好一个lit、圆柱w=d；实体包围盒不能相交或形成循环遮挡；SVG/HTML上限64KiB。平板重复肋片可直接使用：底板box x=0,y=0,z=0,w=120,d=60,h=4,tone=lo,label=底板；肋片box x=0,y=5,z=4,w=1.5,d=50,h=24,tone=lit,label=散热肋片,repeat={count:40,dx:3,dy:0,dz:0}。teaching.steps的part必须使用实际类别“底板”“散热肋片”。若部件更多，按同样最小角与面接触关系扩展。不能宣称已保存。':'未完成本次文件修改。请核对授权范围、实际文本及支持格式；不能宣称已经保存。'})}],
            details:{success:false},isError:true };
        }
      };
      const path = { type: 'string', minLength: 1, maxLength: 500 };
      return [{ name: 'office_create_text', label: '创建教学文档',
        description: '交付前宿主自动检查真实候选，明确失败先返回原Pi修复，每类最多2轮；checks可按教师要求声明[{path,rules}]（规则同education_check_delivery），未检查不冒充通过。在本会话生成文件区或教师授权目录提出新UTF8 .md/.txt/.csv/.html，最多64KiB（含宿主HTML头）。正方体浮力探究可用buoyancyDemo代替content，宿主复用精确模型生成参数联动与五步探究HTML，不要自行抄写数值计算；二者互斥，仅.html，须给实际模型/适用条件。一般HTML须完整、自包含，使用内联CSS/JS和本地Canvas/SVG/MathML，不依赖外网、CDN或Node；可做滑块/动画/讲解交互。既有父目录、相对路径；不能覆盖已有文件。展示真实审阅并等待教师确认后才保存。教师拒绝后本轮不得自动重复请求；教师后续重新发起任务时可以创建新的审阅，必须重新确认，不复用旧批准。',
        parameters: { type: 'object', properties: { path, content: { type: 'string', maxLength: 65536 }, buoyancyDemo:buoyancyDemoParameters, checks:CHECKS_PARAMETERS }, required: ['path'], oneOf:[{required:['content'],not:{required:['buoyancyDemo']}},{required:['buoyancyDemo'],not:{required:['content']}}], additionalProperties: false } as ToolDefinition['parameters'],
        execute: (callId, args, signal) => safeExecute(callId, args, signal, 'create'),
      }, { name: 'office_edit_text', label: '修改教学文档',
        description: '修改当前文件区现有UTF8 .md/.txt/.csv/.html，最多64KiB。HTML保留宿主离线策略头，只改实际教学内容。先读取实际文本再提出1至16处唯一oldText/newText替换；原文等于全文时也可按教师明确要求替换。复用Pi编辑算法。展示真实差异，教师确认且原版本仍一致才写。拒绝或冲突后本轮不得自动重试或强写；教师后续重新发起同一修改也属于新任务，应重新实读当前文件并创建新审阅，必须取得新的确认，不能因旧拒绝永久禁止新任务。',
        parameters: { type: 'object', properties: { path, checks:CHECKS_PARAMETERS, edits: { type: 'array', minItems: 1, maxItems: 16, items: { type: 'object', properties: { oldText: { type: 'string', minLength: 1, maxLength: 65536 }, newText: { type: 'string', maxLength: 65536 } }, required: ['oldText', 'newText'], additionalProperties: false } } }, required: ['path', 'edits'], additionalProperties: false } as ToolDefinition['parameters'],
        execute: (callId, args, signal) => safeExecute(callId, args, signal, 'edit'),
      }, { name: 'office_create_science_figure', label: '绘制科普图',
        description: '复用Anatomy绘制40至80个真实部件的等轴测SVG科普图。教学演示优先.html（离线逐部件装配、播放/暂停/拖动/全貌），静态图.svg；不是物理仿真。先用office_list_files核实父目录，相对路径以.html或.svg结束。用box/cylinder描述实体；重复结构优先repeat={count,dx,dy,dz}，宿主精确展开，lit重复组仅首个强调。x/y/z是包围盒最小角起点，绝不是中心；沿+x/+y/+z延伸w/d/h，部件必须落在支撑面上，不改教师指定数量与尺寸；w/d/h为尺寸，圆柱w=d。lo底座、mid结构、hi主体、lit唯一强调。平板重复肋片的安全构造：底板一实体x=0,y=0,z=0,w=120,d=60,h=4,tone=lo,label=底板；肋片一重复实体x=0,y=5,z=4,w=1.5,d=50,h=24,tone=lit,label=散热肋片,repeat={count:40,dx:3,dy:0,dz:0}，展开40片后再加底板共41实体。title/caption/label只填文字，caption说明科学含义与待教师核对处；teaching.steps.part使用实际类别“底板”“散热肋片”。几何失败时只修正参数重试，不改用普通文本工具。禁止脚本、外链、原始SVG或伪造已有资料。提出本机图像预览，教师确认后才保存；拒绝/取消不重试，不覆盖已有文件。',
        parameters: scienceFigureParameters as unknown as ToolDefinition['parameters'],
        execute: (callId,args,signal)=>safeExecute(callId,args,signal,'science'),
      }];
    },
  };
}
