import {useState} from 'react';
import {Button} from '@heroui/react';
import type {MockExamCatalog} from '../../../shared/mock-exam-compilation';
import type {MockExamExportFormat} from '../../../shared/mock-exam-export';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import styles from '../../ui-system/teaching-catalogue-alignment.module.css';

const formats={docx:'Word',pdf:'PDF'} as const;

export function MockExamExportActions({catalog,sessionId}:{catalog:MockExamCatalog['summary'];sessionId:string}) {
  const [busy,setBusy]=useState(false),[problem,setProblem]=useState('');
  const navigation=useDesktopNavigation();

  async function start(format:MockExamExportFormat){
    if(busy)return;
    setBusy(true);
    setProblem('');
    try{
      const result=await window.omniEdu?.startXiaozhi({
        sessionId,commandId:'xicmd_'+crypto.randomUUID(),
        prompt:`请把我在教学工作台选中的已确认模考目录导出为 ${formats[format]} 文件。保留试卷出处和答案册配对状态，先提交预览。`,
        mockExamExportIntent:{catalogId:catalog.id,revision:catalog.revision,digest:catalog.digest,format},
      });
      if(result?.ok)navigation.navigate({view:'ai',sessionId});
      else if(result?.error==='command_conflict')setProblem('目录版本已变化，请重新打开目录后再导出。');
      else if(result?.error==='busy')setProblem('来源对话正在处理任务，请稍后再试。');
      else if(result?.error==='attachment_changed')setProblem('来源对话有待发送附件，请先处理附件。');
      else setProblem('暂时无法开始导出，请检查来源对话及模型设置。');
    }catch{setProblem('暂时无法开始导出，请重试。');}
    finally{setBusy(false);}
  }

  return <>
    <Button variant="secondary" size="sm" data-testid="mock-exam-export-docx" isDisabled={busy} onPress={()=>void start('docx')}>导出 Word 目录</Button>
    <Button variant="secondary" size="sm" data-testid="mock-exam-export-pdf" isDisabled={busy} onPress={()=>void start('pdf')}>导出 PDF 目录</Button>
    {busy&&<span role="status">正在准备导出…</span>}
    {problem&&<p role="alert" className={styles.error}>{problem}</p>}
  </>;
}
