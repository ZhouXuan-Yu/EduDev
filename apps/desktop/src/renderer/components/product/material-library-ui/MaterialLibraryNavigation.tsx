import { useState } from 'react';
import { ChevronDown, CircleAlert, Folder, Library, ListFilter } from 'lucide-react';
import { catalogKey, type CatalogFacet, type CatalogScope } from '../../../../shared/material-catalog';
import styles from '../../../ui-system/material-library/material-library.module.css';

/** Every directory, tag and count comes from the full database facets. */
export function MaterialLibraryNavigation({ directories, tags, states, value, disabled, active, onChange, onClear }: {
    directories: CatalogFacet[];
    tags: CatalogFacet[];
    states: CatalogFacet[];
    value: CatalogScope;
    disabled: boolean;
    active: boolean;
    onChange: (scope: CatalogScope) => void;
    onClear: () => void;
}) {
    const [mobileExpanded, setMobileExpanded] = useState(false);
    const total = states.reduce((sum, facet) => sum + facet.count, 0);
    const waiting = states.find(facet => facet.value === 'waiting')?.count || 0;
    const failed = states.find(facet => facet.value === 'error')?.count || 0;

    function toggleTag(tag: string, checked: boolean) {
        const remaining = value.tags.filter(selected => catalogKey(selected) !== catalogKey(tag));
        onChange({ ...value, tags: checked ? [...remaining, tag] : remaining });
    }

    return <div className={styles.tree} data-testid="materials-filters">
        <div className={styles.quickRanges} aria-label="资料快速范围">
            <button type="button" className={styles.treeButton} disabled={disabled}
                aria-pressed={!active} onClick={onClear} data-testid="materials-range-all">
                <Library size={16} aria-hidden="true"/><span>全部资料</span><small>{total}</small>
            </button>
            <button type="button" className={styles.treeButton} disabled={disabled}
                aria-pressed={value.state === 'waiting'} onClick={() => onChange({ ...value, state: value.state === 'waiting' ? '' : 'waiting' })}
                data-testid="materials-range-waiting">
                <ListFilter size={16} aria-hidden="true"/><span>待处理</span><small>{waiting}</small>
            </button>
            <button type="button" className={styles.treeButton} disabled={disabled}
                aria-pressed={value.state === 'error'} onClick={() => onChange({ ...value, state: value.state === 'error' ? '' : 'error' })}
                data-testid="materials-range-error">
                <CircleAlert size={16} aria-hidden="true"/><span>读取失败</span><small>{failed}</small>
            </button>
        </div>
        <button type="button" className={styles.mobileNavigationToggle}
            aria-expanded={mobileExpanded} aria-controls="materials-directory-tags"
            onClick={() => setMobileExpanded(value => !value)} data-testid="materials-navigation-toggle">
            目录与标签<ChevronDown size={14} aria-hidden="true"/>
        </button>
        <div id="materials-directory-tags" className={styles.navigationDetails} data-mobile-expanded={mobileExpanded}>
            <fieldset className={styles.facetGroup} disabled={disabled} data-testid="materials-filter-directory">
                <legend>教学目录</legend>
                <button type="button" className={styles.treeButton} aria-pressed={value.directory === null}
                    onClick={() => onChange({ ...value, directory: null })} data-directory="null" data-testid="materials-directory-all">
                    <Folder size={16} aria-hidden="true"/><span>全部目录</span>
                </button>
                {directories.map(facet => <button type="button" className={styles.treeButton}
                    key={catalogKey(facet.value)} data-directory={JSON.stringify(facet.value)}
                    data-testid={'materials-directory-' + encodeURIComponent(catalogKey(facet.value))}
                    aria-label={facet.value || '未整理'}
                    aria-pressed={value.directory !== null && catalogKey(value.directory) === catalogKey(facet.value)}
                    onClick={() => onChange({ ...value, directory: facet.value })}>
                    <Folder size={16} aria-hidden="true"/><span>{facet.value || '未整理'}</span><small>{facet.count}</small>
                </button>)}
            </fieldset>
            <fieldset className={styles.facetGroup} disabled={disabled} data-testid="materials-filter-tags">
                <legend>标签<span className={styles.tagHint}>全部命中</span></legend>
                {!tags.length && <p className={styles.emptyFacet}>暂无标签</p>}
                {tags.map(facet => {
                    const checked = value.tags.some(tag => catalogKey(tag) === catalogKey(facet.value));
                    return <label className={styles.tag} key={catalogKey(facet.value)}>
                        <input type="checkbox" value={catalogKey(facet.value)} checked={checked}
                            aria-label={facet.value} data-testid={'materials-tag-' + encodeURIComponent(catalogKey(facet.value))}
                            disabled={disabled || !checked && value.tags.length >= 16}
                            onChange={event => toggleTag(facet.value, event.target.checked)}/>
                        <span>{facet.value}</span><small>{facet.count}</small>
                    </label>;
                })}
            </fieldset>
        </div>
    </div>;
}
