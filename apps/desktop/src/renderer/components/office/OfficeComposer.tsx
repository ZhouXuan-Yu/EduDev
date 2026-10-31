import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Dropdown, Label, Tooltip } from '@heroui/react';
import { Archive, BookOpen, Check, ChevronDown, Command, FileText, Hand, Layers, Mic, Paperclip, Pencil, Presentation, ScanText, Settings, ShieldAlert, ShieldCheck, Target } from 'lucide-react';
import type { XiaozhiSkill } from '../../../shared/xiaozhi-skills';
import type { OfficeRunStatus } from '../../../shared/office-agent';
import { PromptInput } from '../../heroui-pro/components/prompt-input';
import { ChatAttachmentInput } from '../../heroui-pro/components/chat-attachment';
import { SkillBadgeView } from './hana-skills/SkillBadgeView';
import { useOfficeComposerState } from './OfficeComposerState';
import {useOfficeSynchronization} from './OfficeSynchronization';
import './pi-skill-settings.css';
import './office-conversation.css';
import './prompt-input.utilities.css';
import './pi-control-surfaces.css';
import {ATTACHMENT_ONLY_PROMPT} from '../../../shared/xiaozhi-start';
import {XIAOZHI_ATTACHMENT_ACCEPT} from '../../../shared/xiaozhi-attachments';
import type {XiaozhiMessagePresentation} from '../../../shared/xiaozhi-message-presentation';
import {useNativeHeroUITheme} from './useNativeHeroUITheme';
import {PI_PERMISSION_MODES, type PiPermissionMode} from './permissionModes';

export interface OfficeModelOption { id: string; label: string; disabled?: boolean }
export interface OfficeComposerProps {
  nativeAppearance?: boolean;
  sessionId: string;
  visible?: boolean;
  status?: OfficeRunStatus;
  model: string;
  models: OfficeModelOption[];
  thinkingControl?:ReactNode;
  permissionLabel: string;
  permissionMode?: PiPermissionMode;
  disabled?: boolean;
  onSubmit: (prompt: string, presentation?: XiaozhiMessagePresentation) => void | Promise<void>;
  onStop: () => void | Promise<void>;
  onModelChange?: (model: string) => void;
  onPermissions?: () => void;
  onPermissionModeChange?: (mode: PiPermissionMode) => void;
  onAttach?: () => void;
  onFilesSelected?: (files: File[]) => void | Promise<void>;
  onWorkspace?: () => void;
  attachments?: ReactNode;
  attachDisabled?: boolean;
  sendBlocked?: boolean;
  hasAttachments?: boolean;
  attachLabel?: string;
  onVoice?: () => void;
  onQueue?: (prompt:string,mode:'steer'|'followUp')=>Promise<void>;
  onNewChat?: () => void;
  onOpenGoal?: () => void;
  onCompact?: () => void;
  onSkills?: () => void;
  skills?: XiaozhiSkill[];
  taskSummary?: ReactNode;
  showQuickStarts?: boolean;
}

const COMMON_COMMANDS = [
  { id: 'clear', command: '/clear', label: '清除对话上下文', description: '开始一段新的对话，历史记录仍保留', icon: Archive },
  { id: 'goal', command: '/goal', label: '持续目标', description: '设置并跟踪一个教学目标', icon: Target },
  { id: 'compact', command: '/compact', label: '整理上下文', description: '整理较早上下文，保留关键记录', icon: Layers },
  { id: 'permissions', command: '/permissions', label: '工作目录与权限', description: '管理工作目录与操作权限', icon: Settings },
  { id: 'skills', command: '/skills', label: '教育技能', description: '选择本次任务使用的教育技能', icon: BookOpen },
] as const;

const PERMISSION_ICONS = {
  request: Hand,
  acceptEdits: Pencil,
  approveForMe: ShieldCheck,
  fullAccess: ShieldAlert,
} as const;

const TEACHER_QUICK_STARTS = [
  {
    id: 'materials',
    title: '根据资料备课',
    description: '先读资料，再整理可修改的备课稿',
    icon: FileText,
    prompt: '请根据我添加的教学资料，按学生年级、学科、课题和课时整理一份可直接修改的备课稿。先读取资料，不猜测缺失内容；如果学科、课题或课时缺失，请一次性集中询问，不要用空白骨架冒充完整备课稿。形成结果后先让我审阅，确认后再保存。',
  },
  {
    id: 'mistakes',
    title: '讲清一道错题',
    description: '本机识别题目，校正后讲错因并少练几题',
    icon: ScanText,
    prompt: '请先确认我添加的学生错题图片；如果尚未附上，请提示我补充，不要猜测题目。请先在本机识别，等我校正题目和答案后，明确讲解错因，并结合当前学生记录只生成少量针对性练习。没有依据时不要猜知识点或学习结果。',
  },
  {
    id: 'classroom',
    title: '做一份课堂课件',
    description: '预览并修改，确认后保存并导出课件',
    icon: Presentation,
    prompt: '请根据我说明的年级、学科和知识点准备一节约 3 分钟的课堂演示，讲清一个知识点。若我尚未说明年级、学科、知识点或时长，请一次性集中询问，不要自行假设。请提供可播放的图示或动图、分步讲解和理解检查，先生成教学预览；等我修改并确认后再保存和导出可编辑课件。',
  },
] as const;

export function OfficeComposer(props: OfficeComposerProps) {
  return <OfficeComposerDraft key={props.sessionId} {...props} />;
}

function OfficeComposerDraft({ sessionId, status, model, models, thinkingControl, permissionLabel, permissionMode='request', disabled = false, visible=true, nativeAppearance=false,
  onSubmit, onStop, onModelChange, onPermissions, onPermissionModeChange, onAttach, onFilesSelected, onWorkspace, attachments, attachDisabled=false,sendBlocked=false,hasAttachments=false, onVoice, onQueue, onNewChat, onOpenGoal, onCompact, onSkills, skills = [], taskSummary, showQuickStarts=false, attachLabel = '添加附件' }: OfficeComposerProps) {
  const { draft, draftRef, storageFailed, setDraft, submitting, setSubmitting, stopping, setStopping, failedPrompt, setFailedPrompt,
    failedPresentation,setFailedPresentation,stopFailed, setStopFailed, sendLock, stopLock, queueMode, setQueueMode, skillName, setSkillName, showSkill, setShowSkill } = useOfficeComposerState();
  const skill = skills.find(item => item.name === skillName);
  const nativeTheme=useNativeHeroUITheme();
  const nativeProps={'data-heroui-native':nativeAppearance?'':undefined,'data-theme':nativeAppearance?nativeTheme:undefined};
  const sync=useOfficeSynchronization();
  const [openMenu,setOpenMenu]=useState<'permissions'|'skills'|'models'|'commands'>();
  const containerRef=useRef<HTMLDivElement|null>(null);
  const menuChange=(menu:'permissions'|'skills'|'models'|'commands',open:boolean)=>setOpenMenu(previous=>open?menu:previous===menu?undefined:previous);
  useEffect(()=>{if(!visible)setOpenMenu(undefined);},[visible]);
  useEffect(()=>{if(sync.blocked)setOpenMenu(undefined);},[sync.blocked]);
  useEffect(() => { if (!disabled && skillName && !skills.some(item => item.name === skillName)) { setSkillName(''); setShowSkill(false); } }, [skills, skillName,disabled]);
  const running = status === 'running' || status === 'waiting_approval' || status === 'waiting_input';
  const selectedPermission = PI_PERMISSION_MODES.find(item => item.id === permissionMode);
  const permissionText = selectedPermission?.label ?? permissionLabel;
  const quickStartsVisible=showQuickStarts&&!draft.trim()&&!running&&!submitting&&!disabled&&!sync.blocked;

  function chooseQuickStart(prompt:string){
    setDraft(prompt);
    window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>{
      containerRef.current?.querySelector<HTMLTextAreaElement>('[data-testid="office-prompt-input"]')?.focus();
    }));
  }

  function runCommand(id:string){
    if(id==='clear')onNewChat?.();
    else if(id==='goal')onOpenGoal?.();
    else if(id==='compact')onCompact?.();
    else if(id==='permissions')onPermissions?.();
    else if(id==='skills')onSkills?.();
  }

  async function send(prompt: string, clearDraft: boolean, retryPresentation?: XiaozhiMessagePresentation) {
    if (disabled || sync.isBlocked() || (!running&&sendBlocked) || (running && !onQueue) || sendLock.current || (!prompt.trim()&&(running||!hasAttachments))) return;
    sendLock.current = true;
    setSubmitting(true);
    setFailedPrompt(undefined);
    const text=prompt.trim()||ATTACHMENT_ONLY_PROMPT;
    const injected = clearDraft && !running && skill && !text.startsWith('/skill:');
    const outgoing = injected ? `/skill:${skill.name} ${text}` : text;
    const presentation = injected ? {version:1 as const,skill:skill.name,text} : retryPresentation;
    try { if (running && onQueue) await onQueue(outgoing,queueMode); else await onSubmit(outgoing,presentation); if(clearDraft && draftRef.current === prompt)setDraft(''); setSkillName(''); setShowSkill(false);setFailedPresentation(undefined); }
    catch { setFailedPrompt(outgoing);setFailedPresentation(presentation); }
    finally { sendLock.current = false; setSubmitting(false); }
  }

  async function stop() {
    if (!running || stopLock.current) return;
    stopLock.current = true;
    setStopping(true);
    setStopFailed(false);
    try { await onStop(); }
    catch { setStopFailed(true); }
    finally { stopLock.current = false; setStopping(false); }
  }

  const selectedModel = models.find(option => option.id === model);
  return (
    <div className={`office-composer-container${nativeAppearance?' default':''}`} data-session-id={sessionId} {...nativeProps} ref={containerRef}>
      {quickStartsVisible&&<section className="teacher-quick-starts" data-testid="teacher-quick-starts" aria-label="常用教师任务">
        {TEACHER_QUICK_STARTS.map(item=>{const Icon=item.icon;return <Button key={item.id} type="button" variant="secondary" className="teacher-quick-start"
          data-testid={`teacher-quick-start-${item.id}`} aria-label={`${item.title}：${item.description}`}
          onPress={()=>chooseQuickStart(item.prompt)}><Icon size={18} aria-hidden="true"/><span><strong>{item.title}</strong><small>{item.description}</small></span></Button>;})}
      </section>}
      {taskSummary}
      {storageFailed && <p className="office-send-error" role="status">草稿暂时无法保存到本机，请在离开对话前复制保留。</p>}
      {running && onQueue && <div className="pi-queue-actions pi-composer-queue"><label>补充处理时间 <select aria-label="补充处理时间" data-testid="pi-queue-mode" value={queueMode} onChange={e=>setQueueMode(e.target.value as 'steer'|'followUp')}><option value="steer">小智下一步开始时</option><option value="followUp">本轮结束后</option></select></label><Button size="sm" data-testid="pi-queue-submit" isDisabled={disabled || sync.blocked || submitting || !draft.trim()} onPress={()=>void send(draft,true)}>发送补充</Button></div>}
      {failedPrompt && <div className="office-send-error" role="alert"><span>消息未确认发送，原文保留在输入框，可修改后重新发送。</span><Button size="sm" variant="ghost" isDisabled={running || submitting || disabled || sync.blocked} onPress={() => void send(failedPrompt, false,failedPresentation)}>重试发送</Button><Button size="sm" variant="ghost" onPress={() => {setFailedPrompt(undefined);setFailedPresentation(undefined);}}>关闭提示</Button></div>}
      {stopFailed && <p className="office-send-error" role="alert">停止请求未送达，任务可能仍在运行，请重试。</p>}
      {stopping && <p className="office-history-notice" role="status">正在请求停止…</p>}
      {skill && showSkill && <section className="pi-skill-preview" data-testid="pi-skill-preview" aria-label="教育技能说明">
        <h4>{skill.title}</h4><p>{skill.description}</p><p>当前支持：{skill.supports.join('、')}</p>
        <pre>{skill.instructions}</pre><Button size="sm" variant="ghost" onPress={() => setShowSkill(false)}>关闭说明</Button>
      </section>}
      <PromptInput value={draft} onValueChange={setDraft} onSubmit={() => void send(draft, true)}
        onStop={() => void stop()} status={running ? 'streaming' : submitting ? 'submitted' : 'ready'}
        lockInputOnRun={false} isDisabled={disabled} maxHeight={220} className="wb-composer" data-testid="office-composer">
        <div className="wb-input-frame">
        <ChatAttachmentInput accept={XIAOZHI_ATTACHMENT_ACCEPT} onFilesSelected={files => void onFilesSelected?.(files)} disabled={disabled || sync.blocked || attachDisabled} multiple>
          <ChatAttachmentInput.Dropzone render={dropzoneProps => (
            <PromptInput.Shell {...dropzoneProps}>
              <PromptInput.Content>
                {attachments&&<PromptInput.Attachments>{attachments}</PromptInput.Attachments>}
            {skill && <div className="pi-skill-tag" data-testid="pi-skill-badge"><SkillBadgeView name={skill.title} /><Button size="sm" variant="ghost" aria-label="移除所选技能" onPress={() => { setSkillName(''); setShowSkill(false); }}>×</Button></div>}
            <PromptInput.TextArea aria-label="给小智发送消息" maxLength={running?8192:32768} placeholder={running ? '补充要求，小智会在下一步处理' : '告诉小智年级、课题和需要的内容，也可以添加资料…'} data-testid="office-prompt-input" />
          </PromptInput.Content>
          <PromptInput.Toolbar>
            <PromptInput.ToolbarStart>
                  <ChatAttachmentInput.Trigger render={triggerProps => (
                    <PromptInput.Action {...triggerProps} {...nativeProps} aria-label={attachLabel} tooltip={<span {...nativeProps} className={nativeAppearance?'default':undefined}>{attachLabel}</span>} isDisabled={disabled || sync.blocked || attachDisabled || !onFilesSelected}>
                      <Paperclip size={20} />
                    </PromptInput.Action>
                  )}/>
            </PromptInput.ToolbarStart>
            <PromptInput.ToolbarEnd>
              <Dropdown isOpen={visible&&openMenu==='models'} onOpenChange={open=>menuChange('models',open)}>
                <Button variant="ghost" size="sm" className="office-model-picker" aria-label="选择模型" isDisabled={running || submitting || disabled || sync.blocked || !onModelChange || models.length === 0}>
                  <span title={selectedModel?.label ?? model}>{selectedModel?.label ?? model}</span><ChevronDown size={14} />
                </Button>
                <Dropdown.Popover {...nativeProps} className={`pi-office-menu${nativeAppearance?' default':''}`} placement="top end">
                  <Dropdown.Menu aria-label="模型" selectionMode="single" selectedKeys={[model]} onAction={key => {
                    const option = models.find(candidate => candidate.id === String(key));
                    if (option && !option.disabled && !sync.isBlocked() && !running && !sendLock.current) onModelChange?.(option.id);
                  }}>
                    {models.map(option => <Dropdown.Item key={option.id} id={option.id} textValue={option.label} isDisabled={option.disabled}><Label>{option.label}</Label><Dropdown.ItemIndicator /></Dropdown.Item>)}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
              {onVoice && <Tooltip><Button variant="ghost" isIconOnly aria-label="语音输入" isDisabled={disabled} onPress={onVoice}><Mic size={17} /></Button><Tooltip.Content {...nativeProps} className={nativeAppearance?'default':undefined}>语音输入</Tooltip.Content></Tooltip>}
              <PromptInput.Send aria-label={running ? '停止本轮' : '发送消息'} isDisabled={disabled || stopping || (!running && (submitting || sync.blocked || sendBlocked || (!draft.trim()&&!hasAttachments)))} />
            </PromptInput.ToolbarEnd>
          </PromptInput.Toolbar>
            </PromptInput.Shell>
          )}/>
        </ChatAttachmentInput>
        <div className="wb-composer-tools" aria-label="对话选项">
              <Dropdown isOpen={visible&&openMenu==='permissions'} onOpenChange={open=>menuChange('permissions',open)}>
                <Button variant="ghost" size="sm" className="office-permission" aria-label={permissionText} data-testid="pi-permission-picker" isDisabled={disabled || sync.blocked}><ShieldCheck size={15} /><span title={permissionText}>{permissionText}</span></Button>
                <Dropdown.Popover {...nativeProps} className={`pi-office-menu pi-permission-menu${nativeAppearance?' default':''}`} placement="top start">
                  <Dropdown.Menu aria-label="资料与操作权限" onAction={key=>{
                    if(key==='choose-directory'&&!sync.blocked&&!running&&!submitting)(onWorkspace||onAttach)?.();
                    if(key==='permissions-settings'){onPermissions?.();return;}
                    const mode=PI_PERMISSION_MODES.find(item=>item.id===key);
                    if(mode)onPermissionModeChange?.(mode.id);
                  }}>
                    {PI_PERMISSION_MODES.map(mode=>{const Icon=PERMISSION_ICONS[mode.id];return <Dropdown.Item key={mode.id} id={mode.id} data-testid={`pi-permission-${mode.id}`} textValue={`${mode.label}：${mode.description}`} isDisabled={!onPermissionModeChange}>
                      <span className="pi-permission-option"><Icon size={17} aria-hidden="true"/><span data-slot="label"><strong>{mode.label}</strong><small>{mode.description}</small></span>{mode.id===permissionMode&&<Check size={15} aria-hidden="true"/>}</span>
                    </Dropdown.Item>;})}
                    <Dropdown.Item id="write-policy" className="pi-permission-fact" textValue="文件写入逐次由教师确认" isDisabled><Label>文件写入逐次由教师确认</Label></Dropdown.Item>
                    <Dropdown.Item id="choose-directory" aria-label="选择教学工作目录" textValue="选择教学工作目录" isDisabled={!(onWorkspace||onAttach)||running||submitting}><Label>选择教学工作目录</Label></Dropdown.Item>
                    <Dropdown.Item id="permissions-settings" aria-label="管理工作目录与权限" textValue="管理工作目录与权限" isDisabled={!onPermissions}><Label>管理工作目录与权限</Label></Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
              {skills.length > 0 && <><Dropdown isOpen={visible&&openMenu==='skills'} onOpenChange={open=>menuChange('skills',open)}>
                <Button variant="ghost" size="sm" className="office-skill-picker" aria-label="选择教育技能" data-testid="pi-skill-picker" isDisabled={disabled || sync.blocked || running || submitting}><BookOpen size={15} /><span title={skill?.title || '选择教育技能'}>{skill?.title || '技能'}</span><ChevronDown size={13} /></Button>
                  <Dropdown.Popover {...nativeProps} className={`pi-office-menu${nativeAppearance?' default':''}`} placement="top start"><Dropdown.Menu aria-label="教育技能" selectionMode="single" selectedKeys={[skillName || 'automatic']} onAction={key => {
                  if (!sync.blocked && !running && !sendLock.current) { setSkillName(key === 'automatic' ? '' : String(key)); setShowSkill(false); }
                }}>
                  <Dropdown.Item id="automatic" key="automatic" textValue="按任务自动选择"><Label>按任务自动选择</Label><Dropdown.ItemIndicator /></Dropdown.Item>
                  {skills.map(item => <Dropdown.Item id={item.name} key={item.name} textValue={item.title}><Label>{item.title}</Label><Dropdown.ItemIndicator /></Dropdown.Item>)}
                </Dropdown.Menu></Dropdown.Popover>
              </Dropdown>{skill && <Button variant="ghost" size="sm" data-testid="pi-skill-view" aria-expanded={showSkill} onPress={() => setShowSkill(value => !value)}>查看说明</Button>}</>}
              <Dropdown isOpen={visible&&openMenu==='commands'} onOpenChange={open=>menuChange('commands',open)}>
                <Button variant="ghost" size="sm" className="wb-command-picker" aria-label="常用命令" data-testid="pi-command-picker" isDisabled={disabled || sync.blocked}><Command size={15} /><span>命令</span><ChevronDown size={13} /></Button>
                <Dropdown.Popover {...nativeProps} className={`pi-office-menu pi-command-menu${nativeAppearance?' default':''}`} placement="top start">
                  <Dropdown.Menu aria-label="常用命令" onAction={key=>runCommand(String(key))}>
                    {COMMON_COMMANDS.map(item=>{const Icon=item.icon;const available=item.id==='clear'?Boolean(onNewChat):item.id==='goal'?Boolean(onOpenGoal):item.id==='compact'?Boolean(onCompact):item.id==='permissions'?Boolean(onPermissions):Boolean(onSkills);return <Dropdown.Item key={item.id} id={item.id} data-testid={`pi-command-${item.id}`} textValue={`${item.command} ${item.label}`} isDisabled={running||submitting||sync.blocked||!available}>
                      <span className="pi-command-option"><Icon size={17} aria-hidden="true"/><span><strong><code>{item.command}</code> {item.label}</strong><small>{item.description}</small></span></span>
                    </Dropdown.Item>;})}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
          {thinkingControl}
        </div>
        </div>
        <PromptInput.Footer data-testid="pi-composer-disclaimer">AI 可能会出错，请核对重要信息。</PromptInput.Footer>
      </PromptInput>
    </div>
  );
}
