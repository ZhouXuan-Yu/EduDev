import {Button} from '@heroui/react';
import type {TeacherResource} from '../../../shared/contracts';
import {materialReadiness} from './material-library';

export type MaterialCatalogFilter = {format:string;state:string};
export const materialFormat=(row:TeacherResource)=>row.originalFileName.split('.').at(-1)?.toUpperCase()||'资料';
export function filterMaterialCatalog(rows:TeacherResource[],filter:MaterialCatalogFilter) {
  return rows.filter(row=>(!filter.format||materialFormat(row)===filter.format)&&
    (!filter.state||materialReadiness(row).tone===filter.state));
}
/** Catalogue API is paginated: never pretend these local facets search unloaded pages. */
export function MaterialCatalogFilters({rows,value,disabled,onChange}:{
  rows:TeacherResource[];value:MaterialCatalogFilter;disabled:boolean;onChange:(value:MaterialCatalogFilter)=>void;
}) {
  const formats=[...new Set(rows.map(materialFormat))].sort();
  return <div className="edu-material-filters" data-testid="materials-filters">
    <label>当前页格式<select value={value.format} disabled={disabled} onChange={e=>onChange({...value,format:e.target.value})}>
      <option value="">全部格式</option>{formats.map(format=><option key={format}>{format}</option>)}
    </select></label>
    <label>当前页状态<select value={value.state} disabled={disabled} onChange={e=>onChange({...value,state:e.target.value})}>
      <option value="">全部状态</option><option value="ready">可用于查找</option>
      <option value="waiting">待处理／部分收录</option><option value="error">读取失败</option>
    </select></label>
    {(value.format||value.state)&&<Button size="sm" variant="ghost" isDisabled={disabled} onPress={()=>onChange({format:'',state:''})}>清除筛选</Button>}
  </div>;
}
