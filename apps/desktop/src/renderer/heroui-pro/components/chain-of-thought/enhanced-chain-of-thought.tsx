import React, { useState } from 'react';
import type { AiThoughtStep } from '../../../../shared/contracts';
import { ChainOfThought } from './chain-of-thought';

interface EnhancedChainOfThoughtProps {
  defaultExpanded?: boolean;
  isStreaming?: boolean;
  steps: AiThoughtStep[];
  title?: string;
  subtitle?: string;
}

export const EnhancedChainOfThought: React.FC<EnhancedChainOfThoughtProps> = ({
  defaultExpanded = true,
  isStreaming = false,
  steps,
  title = 'AI 思考过程',
  subtitle
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!steps || steps.length === 0) {
    return null;
  }

  return (
    <ChainOfThought
      defaultExpanded={defaultExpanded}
      isStreaming={isStreaming}
      onTriggerClick={() => setIsExpanded(!isExpanded)}
    >
      <ChainOfThought.Trigger>
        <div className="enhanced-thought-trigger">
          <span className="trigger-title">{title}</span>
          {subtitle && (
            <span className="trigger-subtitle">{subtitle}</span>
          )}
          {isStreaming && (
            <span className="streaming-indicator">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </span>
          )}
        </div>
      </ChainOfThought.Trigger>
      <ChainOfThought.Content>
        <ChainOfThought.Steps>
          {steps.map((step, index) => (
            <ChainOfThought.Step
              key={step.label || index}
              label={step.label}
              status={isStreaming && index === steps.length - 1 ? 'streaming' : 'complete'}
            >
              <div className="step-content">
                <div className="step-header">
                  <span className="step-number">{index + 1}</span>
                  <span className="step-label">{step.label}</span>
                  {isStreaming && index === steps.length - 1 && (
                    <span className="step-streaming">
                      <span className="dot"></span>
                      <span className="dot"></span>
                      <span className="dot"></span>
                    </span>
                  )}
                </div>
                <div className="step-detail">{step.detail}</div>
              </div>
            </ChainOfThought.Step>
          ))}
        </ChainOfThought.Steps>

        {/* 总体状态指示器 */}
        {steps.length > 0 && (
          <div className="thought-summary">
            <div className="summary-stats">
              <span className="stat-item">
                总步骤: <strong>{steps.length}</strong>
              </span>
              {isStreaming && (
                <span className="stat-item streaming">
                  正在思考...
                </span>
              )}
            </div>
          </div>
        )}
      </ChainOfThought.Content>
    </ChainOfThought>
  );
};

// 样式定义
const styles = `
.enhanced-thought-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--surface-soft);
  border-radius: 8px;
}

.trigger-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
}

.trigger-subtitle {
  font-size: 12px;
  color: var(--muted);
}

.streaming-indicator {
  display: inline-flex;
  gap: 2px;
  margin-left: auto;
}

.dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1.4s infinite;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes pulse {
  0%, 60%, 100% {
    opacity: 0.3;
  }
  30% {
    opacity: 1;
  }
}

.step-content {
  padding: 8px 0;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
}

.step-streaming {
  display: inline-flex;
  gap: 2px;
  margin-left: auto;
}

.step-streaming .dot {
  width: 4px;
  height: 4px;
  background: var(--accent);
}

.step-detail {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text);
  margin-left: 28px;
}

.thought-summary {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.summary-stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stat-item {
  font-size: 12px;
  color: var(--muted);
}

.stat-item strong {
  color: var(--text);
  font-weight: 600;
}

.stat-item.streaming {
  color: var(--accent);
  font-weight: 600;
}
`;

// 添加样式
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}