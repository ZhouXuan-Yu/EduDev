import React, { useState } from 'react';
import { ChatMessage } from '../chat-message';
import { EnhancedChainOfThought } from '../chain-of-thought/enhanced-chain-of-thought';
import type { AiThoughtStep, AiToolRun } from '../../../../shared/contracts';
import { Badge } from '../badge';

interface AiChatMessageAssistantProps {
  message: {
    id: string;
    role: 'assistant';
    content: string;
    metadata?: {
      thoughtSteps?: AiThoughtStep[];
      toolRuns?: AiToolRun[];
      agentRunId?: string;
      ok?: boolean;
      model?: string;
      errorMessage?: string;
    };
  };
  avatar?: React.ReactNode;
}

export const AiChatMessageAssistant: React.FC<AiChatMessageAssistantProps> = ({
  message,
  avatar
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    content,
    metadata = {}
  } = message;

  const {
    thoughtSteps = [],
    toolRuns = [],
    agentRunId,
    ok = true,
    model,
    errorMessage
  } = metadata;

  const hasThoughtSteps = thoughtSteps.length > 0;
  const hasToolRuns = toolRuns.length > 0;

  // 计算工具状态
  const successfulTools = toolRuns.filter(tool => tool.status === 'used').length;
  const failedTools = toolRuns.filter(tool => tool.status === 'failed').length;
  const blockedTools = toolRuns.filter(tool => tool.status === 'blocked').length;

  return (
    <ChatMessage.Assistant>
      {avatar ? (
        <ChatMessage.Avatar show alt="小智">
          {avatar}
        </ChatMessage.Avatar>
      ) : (
        <ChatMessage.Avatar show alt="小智" fallback="AI" />
      )}
      <ChatMessage.Body>
        {/* 思考过程 */}
        {hasThoughtSteps && (
          <EnhancedChainOfThought
            defaultExpanded={true}
            isStreaming={false} // 可以根据实际状态调整
            steps={thoughtSteps}
            title="思考过程"
            subtitle={`${thoughtSteps.length} 个思考步骤`}
          />
        )}

        {/* 消息状态指示 */}
        <div className="message-status-indicator">
          <div className="status-meta">
            {model && (
              <Badge tone="blue">{model}</Badge>
            )}
            {!ok && (
              <Badge tone="red">
                {errorMessage || '生成失败'}
              </Badge>
            )}
            {hasToolRuns && (
              <div className="tool-status-badges">
                {successfulTools > 0 && (
                  <Badge tone="green">{successfulTools} 成功</Badge>
                )}
                {failedTools > 0 && (
                  <Badge tone="red">{failedTools} 失败</Badge>
                )}
                {blockedTools > 0 && (
                  <Badge tone="amber">{blockedTools} 阻塞</Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 错误提示 */}
        {!ok && errorMessage && (
          <div className="error-banner">
            <div className="error-icon">❌</div>
            <div className="error-content">
              <strong>生成过程中遇到问题</strong>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* 消息内容 */}
        <div className={`message-content ${ok ? 'success' : 'error'}`}>
          <ChatMessage.Content>
            {content}
          </ChatMessage.Content>
        </div>

        {/* 工具调用指示器 */}
        {hasToolRuns && (
          <div className="tool-indicators">
            <div className="tool-header">
              <h4>工具调用</h4>
              <span className="tool-summary">
                总共 {toolRuns.length} 个工具
                {successfulTools > 0 && ` | ${successfulTools} 成功`}
                {failedTools > 0 && ` | ${failedTools} 失败`}
                {blockedTools > 0 && ` | ${blockedTools} 阻塞`}
              </span>
            </div>
            <div className="tool-list">
              {toolRuns.map((tool, index) => (
                <ToolIndicator
                  key={`${tool.name}-${index}`}
                  tool={tool}
                  index={index + 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        {agentRunId && (
          <div className="message-actions">
            <div className="action-buttons">
              {hasToolRuns && (
                <button
                  className="secondary-action compact-button"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? '收起详情' : '查看详情'}
                </button>
              )}
            </div>
          </div>
        )}
      </ChatMessage.Body>
    </ChatMessage.Assistant>
  );
};

// 工具指示器组件
const ToolIndicator: React.FC<{
  tool: AiToolRun;
  index: number;
}> = ({ tool, index }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'used':
        return 'green';
      case 'failed':
        return 'red';
      case 'blocked':
        return 'amber';
      default:
        return 'gray';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'used':
        return '已使用';
      case 'failed':
        return '失败';
      case 'blocked':
        return '被阻止';
      default:
        return '待执行';
    }
  };

  return (
    <div className="tool-indicator">
      <div className="tool-header">
        <Badge tone={getStatusColor(tool.status)}>
          {getStatusText(tool.status)}
        </Badge>
        <span className="tool-name">{index}. {tool.name}</span>
      </div>
      <div className="tool-info">
        <div className="tool-detail">
          <strong>描述:</strong> {tool.detail}
        </div>
        {tool.effect && (
          <div className="tool-effect">
            <strong>操作:</strong> {tool.effect}
          </div>
        )}
        {tool.inputSummary && (
          <div className="tool-input">
            <strong>输入:</strong> {JSON.stringify(tool.inputSummary)}
          </div>
        )}
        {tool.outputSummary && (
          <div className="tool-output">
            <strong>输出:</strong> {JSON.stringify(tool.outputSummary)}
          </div>
        )}
      </div>
    </div>
  );
};

// 错误提示组件
const ErrorBanner: React.FC<{
  title: string;
  message: string;
}> = ({ title, message }) => {
  return (
    <div className="error-banner">
      <div className="error-icon">❌</div>
      <div className="error-content">
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
    </div>
  );
};

// 工具状态指示器组件
const ToolStatusIndicators: React.FC<{
  successful: number;
  failed: number;
  blocked: number;
  total: number;
}> = ({ successful, failed, blocked, total }) => {
  return (
    <div className="tool-status-indicators">
      <div className="indicator-group">
        <div className="indicator">
          <span className="indicator-number">{successful}</span>
          <span className="indicator-label">成功</span>
        </div>
        <div className="indicator">
          <span className="indicator-number">{failed}</span>
          <span className="indicator-label">失败</span>
        </div>
        <div className="indicator">
          <span className="indicator-number">{blocked}</span>
          <span className="indicator-label">阻塞</span>
        </div>
        <div className="indicator">
          <span className="indicator-number">{total}</span>
          <span className="indicator-label">总计</span>
        </div>
      </div>
    </div>
  );
};

// 样式定义
const styles = `
.message-status-indicator {
  margin: 8px 0;
  padding: 8px;
  background: var(--surface-soft);
  border-radius: 6px;
}

.status-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.tool-status-badges {
  display: flex;
  gap: 4px;
  align-items: center;
}

.tool-status-badges .badge {
  font-size: 11px;
  padding: 2px 6px;
}

.error-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 8px 0;
  padding: 12px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  background: rgba(254, 226, 226, 0.3);
}

.error-icon {
  font-size: 18px;
  line-height: 1;
}

.error-content strong {
  color: #991b1b;
  display: block;
  margin-bottom: 4px;
}

.error-content p {
  color: #7f1d1d;
  margin: 0;
  font-size: 13px;
}

.message-content {
  margin: 8px 0;
}

.message-content.success {
  color: var(--text);
}

.message-content.error {
  color: #991b1b;
}

.tool-indicators {
  margin: 12px 0;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-soft);
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
}

.tool-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.tool-summary {
  font-size: 12px;
  color: var(--muted);
}

.tool-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-indicator {
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
}

.tool-indicator .tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--line);
  border: none;
  background: none;
}

.tool-indicator .badge {
  font-size: 11px;
  padding: 2px 6px;
}

.tool-name {
  font-weight: 600;
  font-size: 13px;
}

.tool-info {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
}

.tool-info > div {
  margin: 4px 0;
}

.tool-info strong {
  color: var(--text);
  font-weight: 600;
}

.tool-info .tool-detail,
.tool-info .tool-effect,
.tool-info .tool-input,
.tool-info .tool-output {
  margin: 4px 0;
}

.tool-info .tool-output {
  color: #059669;
}

.message-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.tool-status-indicators {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 8px 0;
  padding: 8px;
  background: var(--surface-soft);
  border-radius: 6px;
}

.indicator-group {
  display: flex;
  gap: 12px;
}

.indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 40px;
}

.indicator-number {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.indicator-label {
  font-size: 11px;
  color: var(--muted);
}
`;

// 添加样式
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}