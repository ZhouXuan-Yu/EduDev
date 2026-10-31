import {Button} from '@heroui/react';
import type {PaperStage} from './paper-workflow';

const stages: {id: PaperStage; label: string}[] = [
  {id: 'blueprint', label: '组卷蓝图'},
  {id: 'review', label: '逐题核对'},
  {id: 'delivery', label: '确认与交付'},
];

export function PaperWorkflowNavigation({stage, hasView, canDeliver, disabled, dirty=false, onChange}: {
  stage: PaperStage; hasView: boolean; canDeliver: boolean; disabled: boolean;
  dirty?: boolean;
  onChange: (stage: PaperStage) => void;
}) {
  const reason = disabled ? '正在读取或处理试卷，请稍候再切换步骤。'
    : !hasView ? '先按蓝图组卷，再逐题核对；确认有效快照后才能准备交付。'
    : dirty ? '蓝图有修改。核对页仍是原快照，切换不会丢失修改；重新组卷并确认后才可交付。'
    : !canDeliver ? '需完整选题、来源版本有效且为最新确认快照，才能准备交付。'
    : '返回前一步查看不会撤销确认；修改蓝图后需重新组卷并核对。';
  return <div><nav className="edu-paper-stages" aria-label="组卷步骤" aria-describedby="paper-step-help">
    {stages.map(({id,label},index) => <Button key={id}
      variant={stage === id ? 'secondary' : 'ghost'}
      data-testid={'paper-step-'+id} aria-current={stage === id ? 'step' : undefined}
      isDisabled={disabled || (id === 'review' && !hasView) || (id === 'delivery' && !canDeliver)}
      onPress={() => onChange(id)}>{index+1}. {label}</Button>)}
  </nav><p id="paper-step-help" role="status">{reason}</p></div>;
}
