import { Button } from '@heroui/react';
import type { TeacherResource } from '../../../shared/contracts';
import { materialReadiness } from './material-library';
import { catalogKey, type CatalogScope, type CatalogFacets, type CatalogFacet } from '../../../shared/material-catalog';
import styles from '../../ui-system/material-catalog.module.css';
/** Legacy loaded-page helper retained for existing callers; the workspace uses the SQL catalogue. */
export type MaterialCatalogFilter = {
    format: string;
    state: string;
};
export const materialFormat = (row: TeacherResource) => row.originalFileName.split('.').at(-1)?.toUpperCase() || '资料';
export function filterMaterialCatalog(rows: TeacherResource[], filter: MaterialCatalogFilter) {
    return rows.filter(row => (!filter.format || materialFormat(row) === filter.format) &&
        (!filter.state || materialReadiness(row).tone === filter.state));
}
const choices = (values: CatalogFacet[], selected: string[]) => [...values, ...selected.filter(v => !values.some(f => catalogKey(f.value) === catalogKey(v))).map(value => ({ value, count: 0 }))];
/** Facets cover the full database, independently of the loaded fifty rows. */
function CatalogFilters({ facets, value, disabled, onChange, onClear, active }: {
    facets?: CatalogFacets;
    value: CatalogScope;
    disabled: boolean;
    onChange: (value: CatalogScope) => void;
    onClear: () => void;
    active: boolean;
}) {
    const directories = choices(facets?.directories || [], value.directory === null ? [] : [value.directory]);
    const tags = choices(facets?.tags || [], value.tags), formats = choices(facets?.formats || [], value.format ? [value.format] : []);
    return <div className={styles.filters} data-testid="materials-filters">
  <label className={styles.field}>教学目录<select
        className={styles.control}
        value={JSON.stringify(value.directory)}
        disabled={disabled}
        onChange={e => onChange({ ...value, directory: JSON.parse(e.target.value) })}
        data-testid="materials-filter-directory"
    >
   <option value="null">全部目录</option>{directories.map(f => <option key={f.value} value={JSON.stringify(f.value)}>{f.value || '未整理'}（{f.count}）</option>)}
  </select></label>
  <label className={styles.field}>标签（全部命中，可多选）<select
        multiple
        size={Math.max(2, Math.min(4, tags.length))}
        className={styles.control}
        value={value.tags.map(catalogKey)}
        disabled={disabled}
        onChange={e => onChange({ ...value, tags: Array.from(e.target.selectedOptions).map(o => o.value) })}
        data-testid="materials-filter-tags"
    >
   {tags.map(f => <option key={catalogKey(f.value)} value={catalogKey(f.value)}>{f.value}（{f.count}）</option>)}
  </select></label>
  <label className={styles.field}>格式<select
        className={styles.control}
        value={value.format}
        disabled={disabled}
        onChange={e => onChange({ ...value, format: e.target.value })}
        data-testid="materials-filter-format"
    ><option value="">全部格式</option>{formats.map(f => <option key={f.value} value={f.value}>{f.value}（{f.count}）</option>)}</select></label>
  <label className={styles.field}>收录状态<select
        className={styles.control}
        value={value.state}
        disabled={disabled}
        onChange={e => onChange({ ...value, state: e.target.value as CatalogScope['state'] })}
        data-testid="materials-filter-state"
    ><option value="">全部状态</option><option value="ready">可用于查找</option><option value="waiting">待处理／部分收录</option><option value="error">读取失败</option></select></label>
  <Button variant="ghost" isDisabled={disabled || !active} onPress={onClear} data-testid="materials-filter-clear">清除全部筛选</Button>
 </div>;
}
function LegacyPageFilters({ rows, value, disabled, onChange }: {
    rows: TeacherResource[];
    value: MaterialCatalogFilter;
    disabled: boolean;
    onChange: (value: MaterialCatalogFilter) => void;
}) {
    const formats = [...new Set(rows.map(materialFormat))].sort();
    return <div className="edu-material-filters" data-testid="materials-filters">
    <label>当前页格式<select value={value.format} disabled={disabled} onChange={e => onChange({ ...value, format: e.target.value })}>
      <option value="">全部格式</option>{formats.map(format => <option key={format}>{format}</option>)}
    </select></label>
    <label>当前页状态<select value={value.state} disabled={disabled} onChange={e => onChange({ ...value, state: e.target.value })}>
      <option value="">全部状态</option><option value="ready">可用于查找</option>
      <option value="waiting">待处理／部分收录</option><option value="error">读取失败</option>
    </select></label>
    {(value.format || value.state) && <Button size="sm" variant="ghost" isDisabled={disabled} onPress={() => onChange({ format: '', state: '' })}>清除筛选</Button>}
  </div>;
}
/** Existing loaded-page consumers keep their explicitly local contract. */
export function MaterialCatalogFilters(props: Parameters<typeof CatalogFilters>[0] | Parameters<typeof LegacyPageFilters>[0]) {
    return 'rows' in props ? <LegacyPageFilters {...props}/> : <CatalogFilters {...props}/>;
}
