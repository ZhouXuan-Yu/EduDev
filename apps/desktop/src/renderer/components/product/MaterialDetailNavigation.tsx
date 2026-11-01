import {Button} from '@heroui/react';

export const materialDetailSections = [
  ['overview','概要'], ['original','原页'], ['content','正文'],
  ['questions','题目与校正'], ['notes','阅读笔记'], ['advanced','处理详情'],
] as const;
export type MaterialDetailSection = typeof materialDetailSections[number][0];

/** Application navigation; native buttons keep their shipped design and keyboard behavior. */
export function MaterialDetailNavigation({section,disabled,onChange}:{
  section:MaterialDetailSection;disabled:boolean;onChange:(section:MaterialDetailSection)=>void;
}) {
  return <nav className="edu-material-sections" aria-label="资料详情分区">
    {materialDetailSections.map(([id,label])=><Button key={id} size="sm"
      variant={section===id?'secondary':'ghost'} aria-pressed={section===id}
      isDisabled={disabled&&section!==id} onPress={()=>onChange(id)}
      data-testid={'materials-section-'+id}>{label}</Button>)}
  </nav>;
}
