import {useEffect, useRef, useState} from 'react';
import {Button, Input, Label, ListBox, Select, TextField} from '@heroui/react';
import {TEACHER_GRADES, TEACHER_SUBJECTS, type TeacherMemoryPolicy, type TeacherMemorySettings, type TeacherMemorySettingsInput, type TeacherPreferenceUse, type TeacherProfile} from '../../../shared/teacher-memory-settings';
import {useDesktopNavigationGuard} from '../desktop/DesktopFrame';
import {SettingsGrid, SettingsInline, SettingsStack} from './hana-settings/SettingsPrimitives';
import {SettingsRow} from './hana-settings/SettingsRow';
import {SettingsSection} from './hana-settings/SettingsSection';

const fields = {
  length: {label: '讲解篇幅', values: {concise: '简明', detailed: '详细'}},
  structure: {label: '讲解结构', values: {step_by_step: '分步骤讲解', continuous: '连贯讲解'}},
  answerOrder: {label: '答案顺序', values: {hint_first: '先提示再给答案', answer_first: '先给答案'}},
  presentation: {label: '呈现方式', values: {table: '适合时用表格', paragraph: '使用段落'}},
  exportFormat: {label: '导出格式', values: {docx: 'Word', pdf: 'PDF', pptx: 'PowerPoint'}},
} as const;
const scopes = [
  {id: 'relevant', label: '按任务应用'},
  {id: 'profile', label: '仅匹配教学画像'},
  {id: 'off', label: '已停用'},
];
const errors = {
  configuration: '暂时无法读取或保存本机教师记忆，请重试。',
  conflict: '读取后设置或偏好已变更。请重新读取，再应用你的更改。',
  invalid_input: '请核对学科、年级和教材。',
  busy: '小智正在处理任务，请在本轮结束后重试。',
  permission_denied: '当前窗口无法管理教师记忆。',
};

function Choice({label, value, onChange, options, disabled, testId, showLabel}: {
  label: string; value: string; onChange: (value: string) => void;
  options: readonly {id: string; label: string}[]; disabled: boolean; testId: string; showLabel?: boolean;
}) {
  return <Select aria-label={label} selectedKey={value || 'empty'} isDisabled={disabled}
    onSelectionChange={key => onChange(!key || key === 'empty' ? '' : String(key))}>
    {showLabel && <Label>{label}</Label>}
    <Select.Trigger data-testid={testId}><Select.Value/><Select.Indicator/></Select.Trigger>
    <Select.Popover><ListBox>
      {options.map(option => <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
        <Label>{option.label}</Label><ListBox.ItemIndicator/>
      </ListBox.Item>)}
    </ListBox></Select.Popover>
  </Select>;
}
const profileOptions = (values: readonly string[]) => [{id: 'empty', label: '未设置'}, ...values.map(value => ({id: value, label: value}))];
const subjectOptions = profileOptions(TEACHER_SUBJECTS);
const gradeOptions = profileOptions(TEACHER_GRADES);

const inputFrom = ({revision, profile, use, preference}: TeacherMemorySettings): TeacherMemorySettingsInput =>
  ({revision, profile, use, preferenceRevision: preference.revision});

export function PiTeacherMemorySettings({running, onBusyChange}: {running: boolean; onBusyChange: (busy: boolean) => void}) {
  const [saved, setSaved] = useState<TeacherMemorySettings>();
  const [draft, setDraft] = useState<TeacherMemorySettingsInput>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef(0);
  const mutation = useRef(false);
  const dirty = !!saved && !!draft && JSON.stringify(inputFrom(saved)) !== JSON.stringify(draft);
  const disabled = loading || saving || running;
  const needsProfile = !!draft && Object.values(draft.use).includes('profile') && (!draft.profile.subject || !draft.profile.grade);
  useDesktopNavigationGuard(dirty || saving, '教师记忆有未保存的更改，请先保存或放弃。');
  useEffect(() => {
    onBusyChange(dirty || saving);
    return () => onBusyChange(false);
  }, [dirty, saving, onBusyChange]);

  async function read() {
    const current = ++request.current;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const result = await window.omniEdu?.getTeacherMemorySettings();
      if (current !== request.current) return;
      if (!result?.ok) setError(errors[result?.error || 'configuration']);
      else { setSaved(result.value); setDraft(inputFrom(result.value)); }
    } catch {
      if (current === request.current) setError(errors.configuration);
    } finally {
      if (current === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    void read();
    return () => { request.current++; };
  }, []);
  function updateProfile<K extends keyof TeacherProfile>(field: K, value: TeacherProfile[K]) {
    setNotice('');
    setDraft(previous => previous && {...previous, profile: {...previous.profile, [field]: value}});
  }
  function updateUse(field: keyof TeacherMemoryPolicy['use'], mode: TeacherPreferenceUse) {
    setNotice('');
    setDraft(previous => {
      if (!previous) return previous;
      const use = {...previous.use};
      if (mode === 'relevant') delete use[field];
      else use[field] = mode;
      return {...previous, use};
    });
  }
  async function save() {
    if (!draft || !dirty || disabled || needsProfile || mutation.current) return;
    mutation.current = true;
    const current = request.current;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await window.omniEdu?.saveTeacherMemorySettings(draft);
      if (current !== request.current) return;
      if (!result?.ok) setError(errors[result?.error || 'configuration']);
      else {
        setSaved(result.value);
        setDraft(inputFrom(result.value));
        setNotice('已保存。从下一次请求开始生效。');
      }
    } catch {
      if (current === request.current) setError(errors.configuration);
    } finally {
      mutation.current = false;
      if (current === request.current) setSaving(false);
    }
  }
  return <SettingsStack gap="lg" className="pi-teacher-memory" data-testid="pi-teacher-memory">
    {loading && <p role="status">正在读取教师记忆…</p>}
    {saved && draft && <>
      <SettingsSection className="pi-teacher-memory-profile" title="教学画像" description="仅匹配教学画像的偏好，需要当轮的学科和年级都相符。教材记录保存在本机。">
        <SettingsGrid columns={2} gap="md">
          <Choice label="学科" showLabel value={draft.profile.subject} options={subjectOptions} disabled={disabled}
            testId="teacher-memory-subject" onChange={value => updateProfile('subject', value as TeacherProfile['subject'])}/>
          <Choice label="年级" showLabel value={draft.profile.grade} options={gradeOptions} disabled={disabled}
            testId="teacher-memory-grade" onChange={value => updateProfile('grade', value as TeacherProfile['grade'])}/>
        </SettingsGrid>
        <TextField isDisabled={disabled} value={draft.profile.textbook} onChange={value => updateProfile('textbook', value)}>
          <Label>教材版本（选填）</Label>
          <Input maxLength={60} placeholder="如 人教版" data-testid="teacher-memory-textbook"/>
        </TextField>
      </SettingsSection>
      <SettingsSection title="已确认偏好" description="在对话中可明确保存新的长期偏好。每轮明确提出的要求优先。">
        {Object.keys(fields).map(key => {
          const field = key as keyof typeof fields;
          const value = saved.preference.values[field];
          if (!value && !draft.use[field]) return null;
          const item = fields[field];
          const hint = value ? (item.values as Record<string, string>)[value] : '当前无已确认的偏好值';
          return <SettingsRow key={key} label={item.label} hint={hint}
            control={<Choice label={item.label + '使用范围'} value={draft.use[field] || 'relevant'}
              onChange={mode => updateUse(field, mode as TeacherPreferenceUse)} options={scopes}
              disabled={disabled} testId={`teacher-memory-use-${key}`}/>}/>;
        })}
        {Object.keys(saved.preference.values).length === 0 && <p data-testid="teacher-memory-empty">还没有已确认的长期偏好。</p>}
        {saved.preferenceUpdatedAt && <SettingsSection.Note>
          来自本机对话确认 · 版本 {saved.preference.revision} · {new Date(saved.preferenceUpdatedAt).toLocaleString('zh-CN')}
        </SettingsSection.Note>}
        {Object.keys(draft.use).length > 0 && <SettingsSection.Note>自定义范围期间暂停自动学习。你仍可在对话中明确保存或撤销。</SettingsSection.Note>}
      </SettingsSection>
      {running && dirty && <p role="status">本轮结束后可以保存。</p>}
      {needsProfile && <p role="alert">请补齐学科和年级，或调整偏好的适用范围。</p>}
      <SettingsInline wrap>
        <Button isDisabled={disabled || !dirty || needsProfile} data-testid="teacher-memory-save" onPress={() => void save()}>
          {saving ? '正在保存…' : '保存教师记忆'}
        </Button>
        {dirty && <Button variant="ghost" isDisabled={loading || saving} onPress={() => void read()}>放弃修改并重新读取</Button>}
        {dirty && <span>有未保存的更改</span>}
      </SettingsInline>
    </>}
    {error && <div role="alert" data-testid="teacher-memory-error">{error}
      {!dirty && <Button size="sm" variant="ghost" isDisabled={loading || saving} onPress={() => void read()}>重新读取</Button>}
    </div>}
    {notice && <p role="status" data-testid="teacher-memory-notice">{notice}</p>}
  </SettingsStack>;
}
