import { useEffect, useState, type ReactNode } from 'react';
import { Button, Dropdown, Label, Tooltip } from '@heroui/react';
import { BookOpen, ChevronDown, Mic, Plus, ShieldCheck } from 'lucide-react';
import type { XiaozhiSkill } from '../../../shared/xiaozhi-skills';
import type { OfficeRunStatus } from '../../../shared/office-agent';
import { PromptInput } from '../../heroui-pro/components/prompt-input';
import { SkillBadgeView } from './hana-skills/SkillBadgeView';
import { useOfficeComposerState } from './OfficeComposerState';
import './pi-skill-settings.css';
import './office-conversation.css';
import './pi-control-surfaces.css';
import {ATTACHMENT_ONLY_PROMPT} from '../../../shared/xiaozhi-start';
import type {XiaozhiMessagePresentation} from '../../../shared/xiaozhi-message-presentation';
import {useNativeHeroUITheme} from './useNativeHeroUITheme';

export interface OfficeModelOption { id: string; label: string; disabled?: boolean }
export interface OfficeComposerProps {
  nativeAppearance?: boolean;
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
}

export function OfficeComposer(props: OfficeComposerProps) {
  return <OfficeComposerDraft key={props.sessionId} {...props} />;
}

function OfficeComposerDraft({ sessionId, status, model, models, permissionLabel, disabled = false, visible=true, nativeAppearance=false,
  onSubmit, onStop, onModelChange, onPermissions, onAttach, onWorkspace, attachments, attachDisabled=false,sendBlocked=false,hasAttachments=false, onVoice, onQueue, skills = [], taskSummary, attachLabel = '添加附件' }: OfficeComposerProps) {
  const { draft, draftRef, storageFailed, setDraft, submitting, setSubmitting, stopping, setStopping, failedPrompt, setFailedPrompt,
    failedPresentation,setFailedPresentation,stopFailed, setStopFailed, sendLock, stopLock, queueMode, setQueueMode, skillName, setSkillName, showSkill, setShowSkill } = useOfficeComposerState();
  const skill = skills.find(item => item.name === skillName);
  const nativeTheme=useNativeHeroUITheme();
  const nativeProps={'data-heroui-native':nativeAppearance?'':undefined,'data-theme':nativeAppearance?nativeTheme:undefined};
  const [openMenu,setOpenMenu]=useState<'permissions'|'skills'|'models'>();
  const menuChange=(menu:'permissions'|'skills'|'models',open:boolean)=>setOpenMenu(previous=>open?menu:previous===menu?undefined:previous);
  useEffect(()=>{if(!visible)setOpenMenu(undefined);},[visible]);
  useEffect(() => { if (!disabled && skillName && !skills.some(item => item.name === skillName)) { setSkillName(''); setShowSkill(false); } }, [skills, skillName,disabled]);
  const running = status === 'running' || status === 'waiting_approval' || status === 'waiting_input';

  async function send(prompt: string, clearDraft: boolean, retryPresentation?: XiaozhiMessagePresentation) {
    if (disabled || (!running&&sendBlocked) || (running && !onQueue) || sendLock.current || (!prompt.trim()&&(running||!hasAttachments))) return;
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
    <div className={`office-composer-container${nativeAppearance?' default':''}`} data-session-id={sessionId} {...nativeProps}>
      {taskSummary}
      {storageFailed && <p className="office-send-error" role="status">草稿暂时无法保存到本机，请在离开对话前复制保留。</p>}
      {running && onQueue && <div className="pi-queue-actions pi-composer-queue"><label>补充处理时间 <select aria-label="补充处理时间" data-testid="pi-queue-mode" value={queueMode} onChange={e=>setQueueMode(e.target.value as 'steer'|'followUp')}><option value="steer">小智下一步开始时</option><option value="followUp">本轮结束后</option></select></label><Button size="sm" data-testid="pi-queue-submit" isDisabled={disabled || submitting || !draft.trim()} onPress={()=>void send(draft,true)}>发送补充</Button></div>}
      {failedPrompt && <div className="office-send-error" role="alert"><span>消息未确认发送，原文保留在输入框，可修改后重新发送。</span><Button size="sm" variant="ghost" onPress={() => {setFailedPrompt(undefined);setFailedPresentation(undefined);}}>关闭提示</Button></div>}
      {stopFailed && <p className="office-send-error" role="alert">停止请求未送达，任务可能仍在运行，请重试。</p>}
      {stopping && <p className="office-history-notice" role="status">正在请求停止…</p>}
      {skill && showSkill && <section className="pi-skill-preview" data-testid="pi-skill-preview" aria-label="教育技能说明">
        <h4>{skill.title}</h4><p>{skill.description}</p><p>当前支持：{skill.supports.join('、')}</p>
        <pre>{skill.instructions}</pre><Button size="sm" variant="ghost" onPress={() => setShowSkill(false)}>关闭说明</Button>
      </section>}
      <PromptInput value={draft} onValueChange={setDraft} onSubmit={() => void send(draft, true)}
        onStop={() => void stop()} status={running ? 'streaming' : submitting ? 'submitted' : 'ready'}
        lockInputOnRun={false} isDisabled={disabled} maxHeight={220} className="office-composer" data-testid="office-composer">
        <PromptInput.Shell>
          {attachments&&<PromptInput.Attachments>{attachments}</PromptInput.Attachments>}
          <PromptInput.Content>
            {skill && <div className="pi-skill-tag" data-testid="pi-skill-badge"><SkillBadgeView name={skill.title} /><Button size="sm" variant="ghost" aria-label="移除所选技能" onPress={() => { setSkillName(''); setShowSkill(false); }}>×</Button></div>}
            <PromptInput.TextArea aria-label="给小智发送消息" maxLength={running?8192:32768} placeholder={running ? '补充要求，小智会在下一步处理' : '告诉小智年级、课题和需要的内容，也可以添加资料…'} data-testid="office-prompt-input" />
          </PromptInput.Content>
          <PromptInput.Toolbar>
            <PromptInput.ToolbarStart>
              <Tooltip><Button variant="ghost" isIconOnly aria-label={attachLabel} isDisabled={disabled || attachDisabled || !onAttach} onPress={onAttach}><Plus size={20} /></Button><Tooltip.Content {...nativeProps} className={nativeAppearance?'default':undefined}>{attachLabel}</Tooltip.Content></Tooltip>
              <Dropdown isOpen={visible&&openMenu==='permissions'} onOpenChange={open=>menuChange('permissions',open)}>
                <Button variant="ghost" size="sm" className="office-permission" aria-label={permissionLabel} data-testid="pi-permission-picker" isDisabled={disabled}><ShieldCheck size={15} /><span title={permissionLabel}>{permissionLabel}</span></Button>
                <Dropdown.Popover {...nativeProps} className={`pi-office-menu${nativeAppearance?' default':''}`} placement="top start">
                  <Dropdown.Menu aria-label="资料与操作权限" onAction={key=>{if(key==='choose-directory'&&!running&&!submitting)(onWorkspace||onAttach)?.();if(key==='permissions-settings')onPermissions?.();}}>
                    <Dropdown.Item id="current-scope" className="pi-permission-fact" textValue={permissionLabel} isDisabled><Label>{permissionLabel}</Label></Dropdown.Item>
                    <Dropdown.Item id="write-policy" className="pi-permission-fact" textValue="文件写入逐次由教师确认" isDisabled><Label>文件写入逐次由教师确认</Label></Dropdown.Item>
                    <Dropdown.Item id="choose-directory" textValue="选择教学工作目录" isDisabled={!(onWorkspace||onAttach)||running||submitting}><Label>选择教学工作目录</Label></Dropdown.Item>
                    <Dropdown.Item id="permissions-settings" textValue="管理工作目录与权限" isDisabled={!onPermissions}><Label>管理工作目录与权限</Label></Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
              {skills.length > 0 && <><Dropdown isOpen={visible&&openMenu==='skills'} onOpenChange={open=>menuChange('skills',open)}>
                <Button variant="ghost" size="sm" className="office-skill-picker" aria-label="选择教育技能" data-testid="pi-skill-picker" isDisabled={disabled || running || submitting}><BookOpen size={15} /><span title={skill?.title || '选择教育技能'}>{skill?.title || '技能'}</span><ChevronDown size={13} /></Button>
                  <Dropdown.Popover {...nativeProps} className={`pi-office-menu${nativeAppearance?' default':''}`} placement="top start"><Dropdown.Menu aria-label="教育技能" selectionMode="single" selectedKeys={[skillName || 'automatic']} onAction={key => {
                  if (!running && !sendLock.current) { setSkillName(key === 'automatic' ? '' : String(key)); setShowSkill(false); }
                }}>
                  <Dropdown.Item id="automatic" key="automatic" textValue="按任务自动选择"><Label>按任务自动选择</Label><Dropdown.ItemIndicator /></Dropdown.Item>
                  {skills.map(item => <Dropdown.Item id={item.name} key={item.name} textValue={item.title}><Label>{item.title}</Label><Dropdown.ItemIndicator /></Dropdown.Item>)}
                </Dropdown.Menu></Dropdown.Popover>
              </Dropdown>{skill && <Button variant="ghost" size="sm" data-testid="pi-skill-view" aria-expanded={showSkill} onPress={() => setShowSkill(value => !value)}>查看说明</Button>}</>}
            </PromptInput.ToolbarStart>
            <PromptInput.ToolbarEnd>
              <Dropdown isOpen={visible&&openMenu==='models'} onOpenChange={open=>menuChange('models',open)}>
                <Button variant="ghost" size="sm" className="office-model-picker" aria-label="选择模型" isDisabled={running || submitting || disabled || !onModelChange || models.length === 0}>
                  <span title={selectedModel?.label ?? model}>{selectedModel?.label ?? model}</span><ChevronDown size={14} />
                </Button>
                <Dropdown.Popover {...nativeProps} className={`pi-office-menu${nativeAppearance?' default':''}`} placement="top end">
                  <Dropdown.Menu aria-label="模型" selectionMode="single" selectedKeys={[model]} onAction={key => {
                    const option = models.find(candidate => candidate.id === String(key));
                    if (option && !option.disabled && !running && !sendLock.current) onModelChange?.(option.id);
                  }}>
                    {models.map(option => <Dropdown.Item key={option.id} id={option.id} textValue={option.label} isDisabled={option.disabled}><Label>{option.label}</Label><Dropdown.ItemIndicator /></Dropdown.Item>)}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
              {onVoice && <Tooltip><Button variant="ghost" isIconOnly aria-label="语音输入" isDisabled={disabled} onPress={onVoice}><Mic size={17} /></Button><Tooltip.Content {...nativeProps} className={nativeAppearance?'default':undefined}>语音输入</Tooltip.Content></Tooltip>}
              <PromptInput.Send aria-label={running ? '停止本轮' : '发送消息'} isDisabled={disabled || stopping || (!running && (submitting || sendBlocked || (!draft.trim()&&!hasAttachments)))} />
            </PromptInput.ToolbarEnd>
          </PromptInput.Toolbar>
        </PromptInput.Shell>
      </PromptInput>
    </div>
  );
}
