import { useEffect, useState } from 'react';
import { Button, Dropdown, Label } from '@heroui/react';
import { BookOpen, ChevronDown, Mic, Plus, ShieldCheck } from 'lucide-react';
import type { XiaozhiSkill } from '../../../shared/xiaozhi-skills';
import type { OfficeRunStatus } from '../../../shared/office-agent';
import { PromptInput } from '../../heroui-pro/components/prompt-input';
import { SkillBadgeView } from './hana-skills/SkillBadgeView';
import { useOfficeComposerState } from './OfficeComposerState';
import './pi-skill-settings.css';
import './office-conversation.css';
import './pi-control-surfaces.css';

export interface OfficeModelOption { id: string; label: string; disabled?: boolean }
export interface OfficeComposerProps {
  sessionId: string;
  visible?: boolean;
  status?: OfficeRunStatus;
  model: string;
  models: OfficeModelOption[];
  permissionLabel: string;
  disabled?: boolean;
  onSubmit: (prompt: string) => void | Promise<void>;
  onStop: () => void | Promise<void>;
  onModelChange?: (model: string) => void;
  onPermissions?: () => void;
  onAttach?: () => void;
  attachLabel?: string;
  onVoice?: () => void;
  onQueue?: (prompt:string,mode:'steer'|'followUp')=>Promise<void>;
  skills?: XiaozhiSkill[];
}

export function OfficeComposer(props: OfficeComposerProps) {
  return <OfficeComposerDraft key={props.sessionId} {...props} />;
}

function OfficeComposerDraft({ sessionId, status, model, models, permissionLabel, disabled = false, visible=true,
  onSubmit, onStop, onModelChange, onPermissions, onAttach, onVoice, onQueue, skills = [], attachLabel = '添加附件' }: OfficeComposerProps) {
  const { draft, setDraft, submitting, setSubmitting, stopping, setStopping, failedPrompt, setFailedPrompt,
    stopFailed, setStopFailed, sendLock, stopLock, queueMode, setQueueMode, skillName, setSkillName, showSkill, setShowSkill } = useOfficeComposerState();
  const skill = skills.find(item => item.name === skillName);
  const [openMenu,setOpenMenu]=useState<'permissions'|'skills'|'models'>();
  const menuChange=(menu:'permissions'|'skills'|'models',open:boolean)=>setOpenMenu(previous=>open?menu:previous===menu?undefined:previous);
  useEffect(()=>{if(!visible)setOpenMenu(undefined);},[visible]);
  useEffect(() => { if (skillName && !skills.some(item => item.name === skillName)) { setSkillName(''); setShowSkill(false); } }, [skills, skillName]);
  const running = status === 'running' || status === 'waiting_approval' || status === 'waiting_input';

  async function send(prompt: string, clearDraft: boolean) {
    if (disabled || (running && !onQueue) || sendLock.current || !prompt.trim()) return;
    sendLock.current = true;
    setSubmitting(true);
    setFailedPrompt(undefined);
    if (clearDraft) setDraft('');
    const outgoing = !running && skill && !prompt.startsWith('/skill:') ? `/skill:${skill.name} ${prompt.trim()}` : prompt.trim();
    try { if (running && onQueue) await onQueue(outgoing,queueMode); else await onSubmit(outgoing); setSkillName(''); setShowSkill(false); }
    catch { setFailedPrompt(outgoing); }
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
    <div className="office-composer-container" data-session-id={sessionId}>
      {running && onQueue && <div className="pi-queue-actions"><Button size="sm" variant="ghost" data-testid="pi-queue-mode-steer" aria-pressed={queueMode==='steer'} onPress={()=>setQueueMode('steer')}>补充本轮</Button><Button size="sm" variant="ghost" data-testid="pi-queue-mode-followup" aria-pressed={queueMode==='followUp'} onPress={()=>setQueueMode('followUp')}>接着处理</Button><Button size="sm" data-testid="pi-queue-submit" isDisabled={disabled || submitting || !draft.trim()} onPress={()=>void send(draft,true)}>发送补充</Button></div>}
      {failedPrompt && <div className="office-send-error" role="alert"><span>消息未发送。你的新输入已保留。</span><Button size="sm" variant="ghost" isDisabled={running || submitting || disabled} onPress={() => void send(failedPrompt, false)}>重试发送</Button><Button size="sm" variant="ghost" onPress={() => setFailedPrompt(undefined)}>关闭</Button></div>}
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
          <PromptInput.Content>
            {skill && <div className="pi-skill-tag" data-testid="pi-skill-badge"><SkillBadgeView name={skill.title} /><Button size="sm" variant="ghost" aria-label="移除所选技能" onPress={() => { setSkillName(''); setShowSkill(false); }}>×</Button></div>}
            <PromptInput.TextArea aria-label="给小智发送消息" placeholder="随心输入" data-testid="office-prompt-input" />
          </PromptInput.Content>
          <PromptInput.Toolbar>
            <PromptInput.ToolbarStart>
              <Button variant="ghost" isIconOnly aria-label={attachLabel} isDisabled={disabled || !onAttach} onPress={onAttach}><Plus size={20} /></Button>
              <Dropdown isOpen={visible&&openMenu==='permissions'} onOpenChange={open=>menuChange('permissions',open)}>
                <Button variant="ghost" size="sm" className="office-permission" aria-label={permissionLabel} data-testid="pi-permission-picker" isDisabled={disabled}><ShieldCheck size={15} /><span title={permissionLabel}>{permissionLabel}</span></Button>
                <Dropdown.Popover className="pi-office-menu" placement="top start">
                  <Dropdown.Menu aria-label="资料与操作权限" onAction={key=>{if(key==='choose-directory'&&!running&&!submitting)onAttach?.();if(key==='permissions-settings')onPermissions?.();}}>
                    <Dropdown.Item id="current-scope" className="pi-permission-fact" textValue={permissionLabel} isDisabled><Label>{permissionLabel}</Label></Dropdown.Item>
                    <Dropdown.Item id="write-policy" className="pi-permission-fact" textValue="文件写入逐次由教师确认" isDisabled><Label>文件写入逐次由教师确认</Label></Dropdown.Item>
                    <Dropdown.Item id="choose-directory" textValue="选择教学工作目录" isDisabled={!onAttach||running||submitting}><Label>选择教学工作目录</Label></Dropdown.Item>
                    <Dropdown.Item id="permissions-settings" textValue="管理工作目录与权限" isDisabled={!onPermissions}><Label>管理工作目录与权限</Label></Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
              {skills.length > 0 && <><Dropdown isOpen={visible&&openMenu==='skills'} onOpenChange={open=>menuChange('skills',open)}>
                <Button variant="ghost" size="sm" className="office-skill-picker" aria-label="选择教育技能" data-testid="pi-skill-picker" isDisabled={disabled || running || submitting}><BookOpen size={15} /><span title={skill?.title || '选择教育技能'}>{skill?.title || '技能'}</span><ChevronDown size={13} /></Button>
                <Dropdown.Popover><Dropdown.Menu aria-label="教育技能" selectionMode="single" selectedKeys={[skillName || 'automatic']} onAction={key => {
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
                <Dropdown.Popover className="pi-office-menu" placement="top end">
                  <Dropdown.Menu aria-label="模型" selectionMode="single" selectedKeys={[model]} onAction={key => {
                    const option = models.find(candidate => candidate.id === String(key));
                    if (option && !option.disabled && !running && !sendLock.current) onModelChange?.(option.id);
                  }}>
                    {models.map(option => <Dropdown.Item key={option.id} id={option.id} textValue={option.label} isDisabled={option.disabled}><Label>{option.label}</Label><Dropdown.ItemIndicator /></Dropdown.Item>)}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
              <Button variant="ghost" isIconOnly aria-label={onVoice ? '语音输入' : '语音输入尚未配置'} isDisabled={disabled || !onVoice} onPress={onVoice}><Mic size={17} /></Button>
              <PromptInput.Send aria-label={running ? '停止本轮' : '发送消息'} isDisabled={disabled || stopping || (!running && (submitting || !draft.trim()))} />
            </PromptInput.ToolbarEnd>
          </PromptInput.Toolbar>
        </PromptInput.Shell>
      </PromptInput>
    </div>
  );
}
