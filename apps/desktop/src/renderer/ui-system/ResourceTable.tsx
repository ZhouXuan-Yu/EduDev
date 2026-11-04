import type { ReactNode } from 'react';
import { FileText } from 'lucide-react';
export type ResourceTableRow = {
  id: string;
  title: string;
  description: string;
  type: string;
  state: string;
};
/** Teacher catalogue, own table semantics; no overrides of native ListView internals. */
export function ResourceTable({
  label,
  rows,
  selected,
  onSelect,
  disabled = false,
  empty,
  testPrefix,
  className,
}: {
  label: string;
  rows: ResourceTableRow[];
  selected?: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
  empty: ReactNode;
  testPrefix: string;
  /** Optional layout owned by this caller; never affects the other catalogues. */
  className?: string;
}) {
  return (
    <div className={['edu-resource-table', className].filter(Boolean).join(' ')}>
      <table aria-label={label}>
        <thead>
          <tr>
            <th>名称</th>
            <th>格式</th>
            <th>处理状态</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              data-testid={testPrefix + '-' + row.id}
              aria-selected={selected === row.id}
            >
              <td>
                <button
                  className="edu-resource-button"
                  disabled={disabled}
                  onClick={() => onSelect(row.id)}
                >
                  <FileText size={17} />
                  <span>
                    <strong>{row.title}</strong>
                    <small>{row.description}</small>
                  </span>
                </button>
              </td>
              <td>{row.type}</td>
              <td>
                <span className="edu-resource-state">{row.state}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && empty}
    </div>
  );
}
