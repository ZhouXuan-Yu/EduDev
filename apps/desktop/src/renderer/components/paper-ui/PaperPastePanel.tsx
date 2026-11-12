import {useEffect, useRef, useState} from 'react';
import {Button, Card, Checkbox, Label, Modal, TextArea, TextField} from '@heroui/react';
import {MATERIAL_PASTE_SCHEMA, MATERIAL_PASTE_MAX_TEXT,
  type MaterialPasteImport, type MaterialPastePreview} from '../../../shared/material-paste';
import type {TeacherResource} from '../../../shared/contracts';
import {archiveIssueLabels} from '../../../shared/question-archive';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import {QuestionMathText} from '../QuestionMathText';
import styles from '../../ui-system/paper-studio/paper-paste-dialog.module.css';

const messages: Record<string, string> = {
  no_questions: '没有识别到独立题号。请用“1.”、“2.”标出每道题的起点，再核对。',
  too_many_questions: '一次最多核对20道题，请分批粘贴。',
  invalid_input: '请检查文字长度与内容。',
  source_changed: '原文已变化，请重新预览后确认。',
  material_busy: '资料任务正在执行，请稍后核实本次导入。',
};
function errorMessage(error: unknown) {
  const value = error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '') : '';
  return messages[value] || '本次结果尚未核实。请保留原文并核实上次导入结果。';
}

/** Transient review input. The original importer remains the only durable authority. */
export function PaperPastePanel({disabled, onDirtyChange, onMaterials, allowFileImport = false, hasBasket = true}: {
  disabled: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onMaterials: () => void;
  allowFileImport?: boolean;
  hasBasket?: boolean;
}) {
  const navigation = useDesktopNavigation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<MaterialPastePreview>();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState<'preview' | 'import'>();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<TeacherResource>();
  const [pending, setPending] = useState<MaterialPasteImport>();
  const epoch = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const guard = useRef('');
  guard.current = open && !saved ? pending ? '粘贴资料的导入结果尚未核实，请先核实原操作。'
    : '粘贴原文尚未保存，请取消本次粘贴或确认保存后离开。' : '';
  useEffect(() => navigation.registerGuard(() => guard.current || undefined), [navigation.registerGuard]);
  useEffect(() => {onDirtyChange(open && !saved);}, [open, saved, onDirtyChange]);
  useEffect(() => () => {epoch.current++; onDirtyChange(false);}, [onDirtyChange]);
  function close() {
    if (pending || busy === 'import') return;
    epoch.current++; setOpen(false); setText(''); setPreview(undefined); setChecked(false);
    setError(''); setBusy(undefined); setSaved(undefined);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  async function prepare() {
    if (!window.omniEdu || busy || pending) return;
    const stamp = ++epoch.current;
    setBusy('preview'); setError(''); setChecked(false); setPreview(undefined);
    try {
      const result = await window.omniEdu.previewPastedMaterial({schemaVersion: MATERIAL_PASTE_SCHEMA, text});
      if (epoch.current === stamp) setPreview(result);
    } catch (error) {if (epoch.current === stamp) setError(errorMessage(error));}
    finally {if (epoch.current === stamp) setBusy(undefined);}
  }
  async function save() {
    if (!window.omniEdu || busy || !preview || !checked) return;
    const input = pending || {schemaVersion: MATERIAL_PASTE_SCHEMA, text, expectedDigest: preview.digest};
    const stamp = ++epoch.current;
    setPending(input); setBusy('import'); setError('');
    try {
      const result = await window.omniEdu.importPastedMaterial(input);
      if (epoch.current !== stamp) return;
      const resource = result.resources.find(item => item.contentHash === input.expectedDigest);
      if (!resource || result.items.length !== 1 || !result.items[0].ok) throw Error('import_not_verified');
      setSaved(resource); setPending(undefined);
    } catch (error) {if (epoch.current === stamp) setError(errorMessage(error));}
    finally {if (epoch.current === stamp) setBusy(undefined);}
  }
  const cannotClose = !!pending || busy === 'import';
  return <>
    <Button ref={trigger} variant="secondary" data-testid="paper-paste-open" isDisabled={disabled}
      onPress={() => setOpen(true)}>{allowFileImport ? '上传／粘贴题目' : '粘贴题目'}</Button>
    <Modal.Backdrop isOpen={open} variant="opaque" isDismissable={false} isKeyboardDismissDisabled={cannotClose}
    onOpenChange={next => {if (!next) close();}}>
    <Modal.Container className={styles.container} scroll="inside" placement="center">
      <Modal.Dialog className={styles.dialog} data-testid="paper-paste-panel">
        <Modal.CloseTrigger data-testid="paper-paste-close" isDisabled={cannotClose}/>
        <Modal.Header><Modal.Heading>{allowFileImport ? '上传与粘贴题目' : '粘贴与核对题目'}</Modal.Heading></Modal.Header>
        <Modal.Body>
      {saved ? <div role="status" data-testid="paper-paste-saved">
        <p>已保存为本地资料，题目将按原流程抽取，仍需在题本核对后选择加入。</p>
        <p>{saved.title}</p>
        <Button variant="secondary" data-testid="paper-paste-materials" onPress={onMaterials}>
          {hasBasket ? '去资料库核对并返回题篮' : '去资料库核对'}</Button>
      </div> : <>
        {allowFileImport && <div>
          <Button variant="secondary" data-testid="paper-source-upload" isDisabled={!!text.trim() || !!busy || !!pending}
            onPress={() => {close(); requestAnimationFrame(onMaterials);}}>去资料库上传题目文件</Button>
          <p>原文件由资料库保留并处理。也可以在下方粘贴文字，逐题核对。</p>
        </div>}
        <TextField fullWidth isDisabled={!!pending}>
          <Label>题目原文</Label>
          <TextArea fullWidth rows={6} autoFocus data-testid="paper-paste-text" value={text} maxLength={MATERIAL_PASTE_MAX_TEXT}
            placeholder={'1. 第一题题干与选项\n答案：…\n解析：…\n2. 第二题…'}
            onChange={event => {epoch.current++; setText(event.target.value); setPreview(undefined); setChecked(false); setBusy(undefined); setError('');}}/>
        </TextField>
        <p>每道题以独立题号开始。请核对选项、小问和公式；图表需通过原文件或图片补充，仍保留待核对状态。</p>
        <Button variant="secondary" data-testid="paper-paste-preview" isDisabled={!text.trim() || !!busy || !!pending} onPress={() => void prepare()}>预览题目边界</Button>
        {preview && <section aria-label="粘贴题目核对" data-testid="paper-paste-preview-list">
          <p>识别到 {preview.questions.length} 道题，请逐题核对。</p>
          {preview.questions.map((question, index) => <Card.Root key={index} data-testid="paper-paste-question">
            <Card.Header><Card.Title>原题号 {question.number}</Card.Title></Card.Header>
            <Card.Content>
              <QuestionMathText text={question.fields.stem}/>
              <QuestionMathText text={'答案：' + (question.fields.answer || '待补充')}/>
              <QuestionMathText text={'解析：' + (question.fields.analysis || '待补充')}/>
              {!!question.issues.length && <p>{question.issues.map(issue => archiveIssueLabels[issue] || '待教师核对').join('、')}</p>}
            </Card.Content>
          </Card.Root>)}
          <Checkbox data-testid="paper-paste-check" isDisabled={!!pending || !!busy} isSelected={checked} onChange={setChecked}>
            <Checkbox.Content><Checkbox.Control><Checkbox.Indicator/></Checkbox.Control>已核对题目起止、选项与小问</Checkbox.Content>
          </Checkbox>
          <Button data-testid="paper-paste-save" isDisabled={!checked || !!busy} onPress={() => void save()}>
            {pending ? '核实上次导入结果' : '确认并保存为资料'}
          </Button>
        </section>}
      </>}
      {busy && <p role="status">{busy === 'preview' ? '正在核对原文结构…' : '正在保存或核实本次资料…'}</p>}
      {error && <p role="alert" data-testid="paper-paste-error">{error}</p>}
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" data-testid="paper-paste-cancel" isDisabled={cannotClose} onPress={close}>{saved ? '完成' : '取消粘贴'}</Button></Modal.Footer>
      </Modal.Dialog>
    </Modal.Container>
    </Modal.Backdrop>
  </>;
}
