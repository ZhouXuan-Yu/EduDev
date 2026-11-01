import {Button} from '@heroui/react';
import type {PaperExportInput} from '../../../shared/paper-export';

const options = [
  {id:'student',title:'学生卷',description:'不包含参考答案与解析',audience:'student'},
  {id:'teacher',title:'教师答案卷',description:'包含参考答案与解析，仍需教师核对',audience:'teacher'},
  {id:'answer_sheet',title:'答题卡',description:'仅学生作答区域，不包含答案或解析',audience:'student',template:'answer_sheet'},
] as const;

export function PaperExportChoices({disabled,onPrepare}: {
  disabled: boolean;
  onPrepare: (audience: PaperExportInput['audience'],format: PaperExportInput['format'],template?: PaperExportInput['template']) => void;
}) {
  return <div className="edu-paper-export-options">{options.map(option =>
    <section className="edu-paper-export-option" key={option.id}>
      <div><h3>{option.title}</h3><p>{option.description}</p></div>
      <div className="edu-paper-export-buttons">{(['docx','pdf'] as const).map(format =>
        <Button key={format} variant="secondary" data-testid={'paper-export-'+option.id+'-'+format}
          isDisabled={disabled} onPress={() => onPrepare(option.audience,format,'template' in option ? option.template : undefined)}>
          {option.title} · {format==='docx'?'Word':'PDF'}
        </Button>)}</div>
    </section>)}</div>;
}
