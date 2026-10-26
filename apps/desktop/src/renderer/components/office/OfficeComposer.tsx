import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Dropdown, Label, Tooltip } from '@heroui/react';
import { BookOpen, ChevronDown, FileText, Mic, Paperclip, Presentation, ScanText, ShieldCheck } from 'lucide-react';
import type { XiaozhiSkill } from '../../../shared/xiaozhi-skills';
import type { OfficeRunStatus } from '../../../shared/office-agent';
import { PromptInput } from '../../heroui-pro/components/prompt-input';
import { ChatAttachmentInput } from '../../heroui-pro/components/chat-attachment';
import { SkillBadgeView } from './hana-skills/SkillBadgeView';
import { useOfficeComposerState } from './OfficeComposerState';
import {useOfficeSynchronization} from './OfficeSynchronization';
import './pi-skill-settings.css';
import './office-conversation.css';
import './pi-control-surfaces.css';
import {ATTACHMENT_ONLY_PROMPT} from '../../../shared/xiaozhi-start';
import type {XiaozhiMessagePresentation} from '../../../shared/xiaozhi-message-presentation';

export interface OfficeModelOption { id: string; label: string; disabled?: boolean }
export interface OfficeComposerProps {
  sessionId: string;
  visible?: boolean;
  status?: OfficeRunStatus;
  model: string;
  models: OfficeModelOption[];
  permissionLabel: string;
  disabled?: boolean;
  onSubmit: (prompt: string, presentation?: XiaozhiMessagePresentation) => void | Promise<void>;
  onStop: () => void | Promise<void>;
  onModelChange?: (model: string) => void;
  onPermissions?: () => void;
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
  skills?: XiaozhiSkill[];
  taskSummary?: ReactNode;
  showQuickStarts?: boolean;
}

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

function OfficeComposerDraft({ sessionId, status, model, models, permissionLabel, disabled = false, visible=true,
  onSubmit, onStop, onModelChange, onPermissions, onAttach, onFilesSelected, onWorkspace, attachments, attachDisabled=false,sendBlocked=false,hasAttachments=false, onVoice, onQueue, skills = [], taskSummary, showQuickStarts=false, attachLabel = '添加附件' }: OfficeComposerProps) {
  const { draft, setDraft, submitting, setSubmitting, stopping, setStopping, failedPrompt, setFailedPrompt,
    failedPresentation,setFailedPresentation,stopFailed, setStopFailed, sendLock, stopLock, queueMode, setQueueMode, skillName, setSkillName, showSkill, setShowSkill } = useOfficeComposerState();
  const skill = skills.find(item => item.name === skillName);
  const sync=useOfficeSynchronization();
  const [openMenu,setOpenMenu]=useState<'permissions'|'skills'|'models'>();
  const containerRef=useRef<HTMLDivElement|null>(null);
  const menuChange=(menu:'permissions'|'skills'|'models',open:boolean)=>setOpenMenu(previous=>open?menu:previous===menu?undefined:previous);
  useEffect(()=>{if(!visible)setOpenMenu(undefined);},[visible]);
  useEffect(()=>{if(sync.blocked)setOpenMenu(undefined);},[sync.blocked]);
  useEffect(() => { if (skillName && !skills.some(item => item.name === skillName)) { setSkillName(''); setShowSkill(false); } }, [skills, skillName]);
  const running = status === 'running' || status === 'waiting_approval' || status === 'waiting_input';
  const quickStartsVisible=showQuickStarts&&!draft.trim()&&!running&&!submitting&&!disabled&&!sync.blocked;

  function chooseQuickStart(prompt:string){
    setDraft(prompt);
    window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>{
      containerRef.current?.querySelector<HTMLTextAreaElement>('[data-testid="office-prompt-input"]')?.focus();
    }));
  }

  async function send(prompt: string, clearDraft: boolean, retryPresentation?: XiaozhiMessagePresentation) {
    if (disabled || sync.isBlocked() || (!running&&sendBlocked) || (running && !onQueue) || sendLock.current || (!prompt.trim()&&(running||!hasAttachments))) return;
    sendLock.current = true;
    setSubmitting(true);
    setFailedPrompt(undefined);
    if (clearDraft) setDraft('');
    const text=prompt.trim()||ATTACHMENT_ONLY_PROMPT;
    const injected = clearDraft && !running && skill && !text.startsWith('/skill:');
    const outgoing = injected ? `/skill:${skill.name} ${text}` : text;
    const presentation = injected ? {version:1 as const,skill:skill.name,text} : retryPresentation;
    try { if (running && onQueue) await onQueue(outgoing,queueMode); else await onSubmit(outgoing,presentation); setSkillName(''); setShowSkill(false);setFailedPresentation(undefined); }
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
    <div className="office-composer-container" data-session-id={sessionId} ref={containerRef}>
      {quickStartsVisible&&<section className="teacher-quick-starts" data-testid="teacher-quick-starts" aria-label="常用教师任务">
        {TEACHER_QUICK_STARTS.map(item=>{const Icon=item.icon;return <Button key={item.id} type="button" variant="secondary" className="teacher-quick-start"
          data-testid={`teacher-quick-start-${item.id}`} aria-label={`${item.title}：${item.description}`}
          onPress={()=>chooseQuickStart(item.prompt)}><Icon size={18} aria-hidden="true"/><span><strong>{item.title}</strong><small>{item.description}</small></span></Button>;})}
      </section>}
      {taskSummary}
      {running && onQueue && <div className="pi-queue-actions"><Button size="sm" variant="ghost" data-testid="pi-queue-mode-steer" aria-pressed={queueMode==='steer'} onPress={()=>setQueueMode('steer')}>补充本轮</Button><Button size="sm" variant="ghost" data-testid="pi-queue-mode-followup" aria-pressed={queueMode==='followUp'} onPress={()=>setQueueMode('followUp')}>接着处理</Button><Button size="sm" data-testid="pi-queue-submit" isDisabled={disabled || sync.blocked || submitting || !draft.trim()} onPress={()=>void send(draft,true)}>发送补充</Button></div>}
      {failedPrompt && <div className="office-send-error" role="alert"><span>消息未发送。你的新输入已保留。</span><Button size="sm" variant="ghost" isDisabled={running || submitting || disabled || sync.blocked} onPress={() => void send(failedPrompt, false,failedPresentation)}>重试发送</Button><Button size="sm" variant="ghost" onPress={() => {setFailedPrompt(undefined);setFailedPresentation(undefined);}}>关闭</Button></div>}
      {stopFailed && <p className="office-send-error" role="alert">停止请求未送达，任务可能仍在运行，请重试。</p>}
      {stopping && <p className="office-history-notice" role="status">正在请求停止…</p>}
      {skill && showSkill && <section className="pi-skill-preview" data-testid="pi-skill-preview" aria-label="教育技能说明">
        <h4>{skill.title}</h4><p>{skill.description}</p><p>当前支持：{skill.supports.join('、')}</p>
        <pre>{skill.instructions}</pre><Button size="sm" variant="ghost" onPress={() => setShowSkill(false)}>关闭说明</Button>
      </section>}
      <PromptInput value={draft} onValueChange={setDraft} onSubmit={() => void send(draft, true)}
        onStop={() => void stop()} status={running ? 'streaming' : submitting ? 'submitted' : 'ready'}
        lockInputOnRun={false} isDisabled={disabled} maxHeight={220} className="office-composer" data-testid="office-composer">
        <ChatAttachmentInput onFilesSelected={files => void onFilesSelected?.(files)} disabled={disabled || sync.blocked || attachDisabled} multiple>
          <ChatAttachmentInput.Dropzone render={dropzoneProps => (
            <PromptInput.Shell {...dropzoneProps}>
              <PromptInput.Content>
                {attachments&&<PromptInput.Attachments>{attachments}</PromptInput.Attachments>}
            {skill && <div className="pi-skill-tag" data-testid="pi-skill-badge"><SkillBadgeView name={skill.title} /><Button size="sm" variant="ghost" aria-label="移除所选技能" onPress={() => { setSkillName(''); setShowSkill(false); }}>×</Button></div>}
            <PromptInput.TextArea aria-label="给小智发送消息" placeholder="随心输入" data-testid="office-prompt-input" />
          </PromptInput.Content>
          <PromptInput.Toolbar>
            <PromptInput.ToolbarStart>
                  <ChatAttachmentInput.Trigger render={triggerProps => (
                    <PromptInput.Action {...triggerProps} aria-label={attachLabel} tooltip={attachLabel} isDisabled={disabled || sync.blocked || attachDisabled || !onFilesSelected}>
                      <Paperclip size={20} />
                    </PromptInput.Action>
                  )}/>
              <Dropdown isOpen={visible&&openMenu==='permissions'} onOpenChange={open=>menuChange('permissions',open)}>
                <Button variant="ghost" size="sm" className="office-permission" aria-label={permissionLabel} data-testid="pi-permission-picker" isDisabled={disabled || sync.blocked}><ShieldCheck size={15} /><span title={permissionLabel}>{permissionLabel}</span></Button>
                <Dropdown.Popover className="pi-office-menu" placement="top start">
                  <Dropdown.Menu aria-label="资料与操作权限" onAction={key=>{if(key==='choose-directory'&&!sync.isBlocked()&&!running&&!submitting)(onWorkspace||onAttach)?.();if(key==='permissions-settings')onPermissions?.();}}>
                    <Dropdown.Item id="current-scope" className="pi-permission-fact" textValue={permissionLabel} isDisabled><Label>{permissionLabel}</Label></Dropdown.Item>
                    <Dropdown.Item id="write-policy" className="pi-permission-fact" textValue="文件写入逐次由教师确认" isDisabled><Label>文件写入逐次由教师确认</Label></Dropdown.Item>
                    <Dropdown.Item id="choose-directory" textValue="选择教学工作目录" isDisabled={!(onWorkspace||onAttach)||running||submitting}><Label>选择教学工作目录</Label></Dropdown.Item>
                    <Dropdown.Item id="permissions-settings" textValue="管理工作目录与权限" isDisabled={!onPermissions}><Label>管理工作目录与权限</Label></Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
              {skills.length > 0 && <><Dropdown isOpen={visible&&openMenu==='skills'} onOpenChange={open=>menuChange('skills',open)}>
                <Button variant="ghost" size="sm" className="office-skill-picker" aria-label="选择教育技能" data-testid="pi-skill-picker" isDisabled={disabled || sync.blocked || running || submitting}><BookOpen size={15} /><span title={skill?.title || '选择教育技能'}>{skill?.title || '技能'}</span><ChevronDown size={13} /></Button>
                  <Dropdown.Popover className="pi-office-menu" placement="top start"><Dropdown.Menu aria-label="教育技能" selectionMode="single" selectedKeys={[skillName || 'automatic']} onAction={key => {
                  if (!sync.isBlocked() && !running && !sendLock.current) { setSkillName(key === 'automatic' ? '' : String(key)); setShowSkill(false); }
                }}>
                  <Dropdown.Item id="automatic" key="automatic" textValue="按任务自动选择"><Label>按任务自动选择</Label><Dropdown.ItemIndicator /></Dropdown.Item>
                  {skills.map(item => <Dropdown.Item id={item.name} key={item.name} textValue={item.title}><Label>{item.title}</Label><Dropdown.ItemIndicator /></Dropdown.Item>)}
                </Dropdown.Menu></Dropdown.Popover>
              </Dropdown>{skill && <Button variant="ghost" size="sm" data-testid="pi-skill-view" aria-expanded={showSkill} onPress={() => setShowSkill(value => !value)}>查看说明</Button>}</>}
            </PromptInput.ToolbarStart>
            <PromptInput.ToolbarEnd>
              <Dropdown isOpen={visible&&openMenu==='models'} onOpenChange={open=>menuChange('models',open)}>
                <Button variant="ghost" size="sm" className="office-model-picker" aria-label="选择模型" isDisabled={running || submitting || disabled || sync.blocked || !onModelChange || models.length === 0}>
                  <span title={selectedModel?.label ?? model}>{selectedModel?.label ?? model}</span><ChevronDown size={14} />
                </Button>
                <Dropdown.Popover className="pi-office-menu" placement="top end">
                  <Dropdown.Menu aria-label="模型" selectionMode="single" selectedKeys={[model]} onAction={key => {
                    const option = models.find(candidate => candidate.id === String(key));
                    if (option && !option.disabled && !sync.isBlocked() && !running && !sendLock.current) onModelChange?.(option.id);
                  }}>
                    {models.map(option => <Dropdown.Item key={option.id} id={option.id} textValue={option.label} isDisabled={option.disabled}><Label>{option.label}</Label><Dropdown.ItemIndicator /></Dropdown.Item>)}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
              <Tooltip><Button variant="ghost" isIconOnly aria-label={onVoice ? '语音输入' : '语音输入尚未配置'} isDisabled={disabled || !onVoice} onPress={onVoice}><Mic size={17} /></Button><Tooltip.Content>{onVoice ? '语音输入' : '语音输入尚未配置'}</Tooltip.Content></Tooltip>
              <PromptInput.Send aria-label={running ? '停止本轮' : '发送消息'} isDisabled={disabled || stopping || (!running && (submitting || sync.blocked || sendBlocked || (!draft.trim()&&!hasAttachments)))} />
            </PromptInput.ToolbarEnd>
            </PromptInput.Toolbar>
            </PromptInput.Shell>
          )}/>
        </ChatAttachmentInput>
      </PromptInput>
    </div>
  );
}
