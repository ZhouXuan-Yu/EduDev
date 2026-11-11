import type { ReactNode } from 'react';
import type { CatalogPage } from '../../../../shared/material-catalog';
import { libraryDate, libraryFileSize, materialReadiness } from '../material-library';
import { materialFormat } from '../MaterialCatalogFilters';
import styles from '../../../ui-system/material-library/material-library.module.css';

/** Library-owned table. Shared resource tables keep their existing consumers. */
export function MaterialLibraryCatalog({ items, selected, disabled, onSelect, empty }: {
    items: CatalogPage['items'];
    selected?: string;
    disabled: boolean;
    onSelect: (id: string) => void;
    empty: ReactNode;
}) {
    return <div className={styles.catalog}>
        <table className={styles.table} aria-label="资料列表">
            <thead><tr><th scope="col">名称</th><th scope="col" className={styles.statusColumn}>收录状态</th>
                <th scope="col" className={styles.dateColumn}>最近更新</th></tr></thead>
            <tbody>{items.map(({ resource, organization }) => {
                const readiness = materialReadiness(resource);
                return <tr key={resource.id} aria-selected={selected === resource.id}
                    data-testid={'material-' + resource.id}>
                    <td><button type="button" className={styles.file} disabled={disabled}
                        onClick={() => onSelect(resource.id)}>
                        <span className={styles.fileFormat} data-format={materialFormat(resource)}>{materialFormat(resource)}</span>
                        <span className={styles.fileInfo}>
                            <strong>{resource.title}</strong>
                            <small>{organization.metadata.directory || resource.originalFileName} · {libraryFileSize(resource.fileSize)}
                                {organization.metadata.tags.length ? ' · ' + organization.metadata.tags.join('、') : ''}</small>
                        </span>
                    </button></td>
                    <td><span className={styles.readiness} data-tone={readiness.tone}>{readiness.label}</span></td>
                    <td className={styles.dateColumn}><time dateTime={resource.updatedAt}>{libraryDate(resource.updatedAt)}</time></td>
                </tr>;
            })}</tbody>
        </table>
        {!items.length && empty}
    </div>;
}
