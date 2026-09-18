import React from 'react';
import { Badge } from '../badge';

interface SourceInfo {
  title: string;
  source: string;
  count: number;
  detail?: string;
}

interface ContextIndicatorProps {
  sources: SourceInfo[];
  isLoading?: boolean;
  title?: string;
}

export const ContextIndicator: React.FC<ContextIndicatorProps> = ({
  sources,
  isLoading = false,
  title = "数据上下文"
}) => {
  if (sources.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="context-indicator">
      <div className="context-header">
        <h4>{title}</h4>
        <span className="context-count">
          {isLoading ? '加载中...' : `${sources.length} 个数据源`}
        </span>
      </div>

      <div className="context-chips">
        {sources.map((source, index) => (
          <ContextChip key={source.title} source={source} />
        ))}
        {isLoading && sources.length === 0 && (
          <LoadingChip />
        )}
      </div>
    </div>
  );
};

interface ContextChipProps {
  source: SourceInfo;
}

const ContextChip: React.FC<ContextChipProps> = ({ source }) => {
  const getIcon = (sourceType: string) => {
    switch (sourceType.toLowerCase()) {
      case 'student':
      case '学生档案':
        return '👤';
      case 'records':
      case '学习记录':
        return '📚';
      case 'knowledge':
      case '知识库':
        return '📖';
      case 'graph':
      case '知识图谱':
        return '🔗';
      case 'attachments':
      case '附件':
        return '📎';
      case 'teacher':
        return '👩‍🏫';
      default:
        return '📄';
    }
  };

  const getStatusColor = (sourceType: string, count: number) => {
    if (count === 0) return 'gray';
    if (count > 10) return 'blue';
    if (count > 5) return 'green';
    return 'amber';
  };

  return (
    <div className="context-chip">
      <div className="chip-icon">
        {getIcon(source.source)}
      </div>
      <div className="chip-content">
        <div className="chip-title">{source.title}</div>
        <div className="chip-detail">{source.detail}</div>
      </div>
      <div className="chip-stats">
        <div className="stat-badge">
          <Badge tone={getStatusColor(source.source, source.count)}>
            {source.count}
          </Badge>
        </div>
        <div className="stat-source">{source.source}</div>
      </div>
    </div>
  );
};

const LoadingChip: React.FC = () => {
  return (
    <div className="context-chip loading">
      <div className="chip-icon">
        <span className="loading-spinner">⏳</span>
      </div>
      <div className="chip-content">
        <div className="chip-title">准备数据...</div>
        <div className="chip-detail">正在加载相关资料</div>
      </div>
    </div>
  );
};

interface ToolStatusIndicatorProps {
  successful: number;
  failed: number;
  blocked: number;
  loading?: boolean;
}

export const ToolStatusIndicator: React.FC<ToolStatusIndicatorProps> = ({
  successful = 0,
  failed = 0,
  blocked = 0,
  loading = false
}) => {
  const total = successful + failed + blocked;

  return (
    <div className="tool-status-indicator">
      <div className="status-header">
        <h4>工具调用状态</h4>
        <span className="status-summary">
          {loading ? '执行中...' : `总计 ${total} 个工具`}
        </span>
      </div>

      <div className="status-grid">
        <StatusCard
          label="成功"
          count={successful}
          color="green"
          icon="✅"
          loading={loading && total === 0}
        />
        <StatusCard
          label="失败"
          count={failed}
          color="red"
          icon="❌"
          loading={loading && total === 0}
        />
        <StatusCard
          label="阻塞"
          count={blocked}
          color="amber"
          icon="⚠️"
          loading={loading && total === 0}
        />
      </div>

      {total > 0 && (
        <div className="status-detail">
          <span>成功率: {Math.round((successful / total) * 100)}%</span>
        </div>
      )}
    </div>
  );
};

interface StatusCardProps {
  label: string;
  count: number;
  color: 'green' | 'red' | 'amber' | 'gray';
  icon: string;
  loading?: boolean;
}

const StatusCard: React.FC<StatusCardProps> = ({
  label,
  count,
  color,
  icon,
  loading = false
}) => {
  return (
    <div className={`status-card ${color} ${loading ? 'loading' : ''}`}>
      <div className="status-icon">{loading ? '⏳' : icon}</div>
      <div className="status-content">
        <div className="status-label">{label}</div>
        <div className="status-count">{count}</div>
      </div>
    </div>
  );
};

// 样式定义
const styles = `
.context-indicator {
  margin: 8px 0;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-soft);
}

.context-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
}

.context-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.context-count {
  font-size: 12px;
  color: var(--muted);
  background: var(--surface);
  padding: 2px 8px;
  border-radius: 12px;
}

.context-chips {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
}

.context-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  transition: all 0.2s ease;
}

.context-chip:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 4px rgba(0, 47, 167, 0.1);
}

.context-chip.loading {
  opacity: 0.6;
  background: var(--surface-soft);
}

.chip-icon {
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--surface-soft);
  border-radius: 6px;
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

.chip-content {
  flex: 1;
  min-width: 0;
}

.chip-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-detail {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.stat-badge {
  display: flex;
  align-items: center;
}

.stat-source {
  font-size: 10px;
  color: var(--muted);
  background: var(--surface-soft);
  padding: 1px 4px;
  border-radius: 8px;
}

.tool-status-indicator {
  margin: 12px 0;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-soft);
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
}

.status-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.status-summary {
  font-size: 12px;
  color: var(--muted);
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
}

.status-card.green {
  border-color: #86cfa4;
  background: rgba(134, 207, 164, 0.1);
}

.status-card.red {
  border-color: #e9a2a2;
  background: rgba(233, 162, 162, 0.1);
}

.status-card.amber {
  border-color: #e7c577;
  background: rgba(231, 197, 119, 0.1);
}

.status-card.gray {
  border-color: var(--line);
  background: var(--surface-soft);
}

.status-card.loading {
  opacity: 0.6;
  background: var(--surface-soft);
}

.status-icon {
  font-size: 16px;
}

.status-content {
  flex: 1;
}

.status-label {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-count {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.status-detail {
  display: flex;
  justify-content: center;
  gap: 16px;
  font-size: 12px;
  color: var(--muted);
  border-top: 1px solid var(--line);
  padding-top: 8px;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 480px) {
  .context-chips {
    grid-template-columns: 1fr;
  }

  .status-grid {
    grid-template-columns: 1fr;
  }

  .status-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .status-detail {
    flex-direction: column;
    gap: 4px;
  }
}
`;

// 添加样式
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}