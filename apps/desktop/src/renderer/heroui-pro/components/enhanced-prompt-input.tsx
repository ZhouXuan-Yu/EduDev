import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PromptInput } from '../prompt-input';
import { ChatAttachmentInput } from '../chat-attachment-input';
import { ContextIndicator } from '../context-indicator';
import { ToolStatusIndicator } from '../context-indicator';
import { Badge } from '../badge';
import type { SourceInfo } from '../context-indicator';

interface Suggestion {
  id: string;
  label: string;
  prompt: string;
  description?: string;
}

interface EnhancedPromptInputProps {
  value: string;
  onSubmit: (prompt: string) => void;
  onValueChange: (value: string) => void;
  status: 'ready' | 'streaming' | 'error';
  aiRunning?: boolean;
  contextSources?: SourceInfo[];
  toolStatus?: {
    successful: number;
    failed: number;
    blocked: number;
  };
  suggestions?: Suggestion[];
  placeholder?: string;
  disabled?: boolean;
  maxChars?: number;
}

export const EnhancedPromptInput: React.FC<EnhancedPromptInputProps> = ({
  value,
  onSubmit,
  onValueChange,
  status = 'ready',
  aiRunning = false,
  contextSources = [],
  toolStatus = { successful: 0, failed: 0, blocked: 0 },
  suggestions = [],
  placeholder = "输入要生成的复盘、练习、PDF或Word文档需求...",
  disabled = false,
  maxChars = 4000
}) => {
  const [focused, setFocused] = useState(false);
  const [charCount, setCharCount] = useState(value.length);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 处理输入变化
  const handleValueChange = useCallback((newVal: string) => {
    if (newVal.length <= maxChars) {
      setCharCount(newVal.length);
      onValueChange(newVal);
    }
  }, [onValueChange, maxChars]);

  // 处理提交
  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (value.trim() && !disabled && !aiRunning) {
      onSubmit(value.trim());
    }
  }, [value, onSubmit, disabled, aiRunning]);

  // 处理选择建议
  const handleSuggestionSelect = useCallback((suggestion: Suggestion) => {
    handleValueChange(suggestion.prompt);
    // 可以自动聚焦并提交
    setTimeout(() => {
      handleSubmit();
    }, 100);
  }, [handleValueChange, handleSubmit]);

  // 处理文件选择
  const handleFilesSelected = useCallback((files: File[]) => {
    const fileNames = files.map(file => file.name).join('、');
    const fileMessage = `已选择 ${files.length} 个文件：${fileNames}。当前只纳入元数据，原始附件不上传。`;
    setCharCount(prev => prev + fileMessage.length);
    onValueChange(prev => prev + (prev ? '\n\n' : '') + fileMessage);
  }, [onValueChange]);

  // 自动调整文本框高度
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(200, textarea.scrollHeight) + 'px';
    }
  }, [value]);

  const remainingChars = maxChars - charCount;
  const isOverLimit = charCount > maxChars;
  const hasSuggestions = suggestions.length > 0;
  const hasContextSources = contextSources.length > 0;

  return (
    <PromptInput
      layout="inline"
      value={value}
      onSubmit={handleSubmit}
      onValueChange={handleValueChange}
      status={status}
      disabled={disabled}
    >
      <PromptInput.Shell>
        {/* 状态指示器 */}
        <div className="input-status-bar">
          <div className="status-indicators">
            {aiRunning && (
              <Badge tone="blue">运行中</Badge>
            )}
            {status === 'error' && (
              <Badge tone="red">出错</Badge>
            )}
            {!aiRunning && !status.includes('error') && (
              <Badge tone="green">就绪</Badge>
            )}
          </div>

          {/* 字符计数 */}
          <div className="char-counter">
            <span className={isOverLimit ? 'over-limit' : ''}>
              {charCount}/{maxChars}
            </span>
            {isOverLimit && (
              <span className="over-limit-warning">超出限制</span>
            )}
          </div>
        </div>

        {/* 上下文指示器 */}
        {hasContextSources && (
          <ContextIndicator
            sources={contextSources}
            isLoading={aiRunning}
            title="当前上下文"
          />
        )}

        {/* 建议面板 */}
        {hasSuggestions && (
          <SuggestionPanel
            suggestions={suggestions}
            onSelect={handleSuggestionSelect}
            disabled={aiRunning}
          />
        )}

        {/* 输入内容 */}
        <PromptInput.Content>
          <textarea
            ref={textareaRef}
            className="enhanced-prompt-textarea"
            placeholder={placeholder}
            value={value}
            onChange={(e) => handleValueChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={disabled}
            rows={3}
          />
        </PromptInput.Content>

        {/* 工具状态指示器 */}
        {toolStatus.successful > 0 || toolStatus.failed > 0 || toolStatus.blocked > 0 || aiRunning ? (
          <ToolStatusIndicator
            successful={toolStatus.successful}
            failed={toolStatus.failed}
            blocked={toolStatus.blocked}
            loading={aiRunning}
          />
        ) : null}

        {/* 工具栏 */}
        <PromptInput.Toolbar>
          <PromptInput.ToolbarStart>
            {/* 附件上传 */}
            <ChatAttachmentInput
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.md"
              multiple
              disabled={disabled}
              onFilesSelected={handleFilesSelected}
            >
              <ChatAttachmentInput.Trigger
                className="prompt-attachment-trigger"
                aria-label="选择附件元数据"
              >
                📎
              </ChatAttachmentInput.Trigger>
            </ChatAttachmentInput>

            {/* 快速操作按钮 */}
            <QuickActions
              onClear={() => handleValueChange('')}
              onMaximize={() => {}}
              disabled={disabled || aiRunning}
            />
          </PromptInput.ToolbarStart>

          <PromptInput.ToolbarEnd>
            {/* 发送按钮 */}
            <PromptInput.Send
              aria-label="发送消息"
              onClick={handleSubmit}
              disabled={!value.trim() || disabled || aiRunning}
            >
              {aiRunning ? (
                <span className="loading-spinner">🔄</span>
              ) : (
                '发送'
              )}
            </PromptInput.Send>
          </PromptInput.ToolbarEnd>
        </PromptInput.Toolbar>
      </PromptInput.Shell>
    </PromptInput>
  );
};

// 建议面板组件
const SuggestionPanel: React.FC<{
  suggestions: Suggestion[];
  onSelect: (suggestion: Suggestion) => void;
  disabled?: boolean;
}> = ({ suggestions, onSelect, disabled = false }) => {
  const [expanded, setExpanded] = useState(false);

  if (!suggestions.length) {
    return null;
  }

  return (
    <div className="suggestion-panel">
      <div
        className="suggestion-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span>💡 快速建议</span>
        <span className="expand-icon">
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {expanded && (
        <div className="suggestion-grid">
          {suggestions.map((suggestion) => (
            <SuggestionItem
              key={suggestion.id}
              suggestion={suggestion}
              onSelect={onSelect}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// 建议项组件
const SuggestionItem: React.FC<{
  suggestion: Suggestion;
  onSelect: (suggestion: Suggestion) => void;
  disabled?: boolean;
}> = ({ suggestion, onSelect, disabled = false }) => {
  return (
    <div
      className="suggestion-item"
      onClick={() => !disabled && onSelect(suggestion)}
      disabled={disabled}
    >
      <div className="suggestion-label">{suggestion.label}</div>
      {suggestion.description && (
        <div className="suggestion-description">{suggestion.description}</div>
      )}
    </div>
  );
};

// 快速操作组件
const QuickActions: React.FC<{
  onClear: () => void;
  onMaximize: () => void;
  disabled?: boolean;
}> = ({ onClear, onMaximize, disabled = false }) => {
  return (
    <div className="quick-actions">
      <button
        className="quick-action"
        onClick={onClear}
        disabled={disabled}
        title="清空输入"
      >
        🗑️
      </button>
      <button
        className="quick-action"
        onClick={onMaximize}
        disabled={disabled}
        title="最大化"
      >
        ⛶
      </button>
    </div>
  );
};

// 样式定义
const styles = `
.input-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding: 6px 8px;
  background: var(--surface-soft);
  border-radius: 6px;
}

.status-indicators {
  display: flex;
  gap: 6px;
}

.char-counter {
  font-size: 12px;
  color: var(--muted);
}

.char-counter span.over-limit {
  color: #dc2626;
  font-weight: 600;
}

.char-counter .over-limit-warning {
  color: #dc2626;
  margin-left: 4px;
  font-weight: 600;
}

.enhanced-prompt-textarea {
  min-height: 80px;
  resize: vertical;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  line-height: 1.5;
  transition: all 0.2s ease;
}

.enhanced-prompt-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(0, 47, 167, 0.1);
}

.enhanced-prompt-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.suggestion-panel {
  margin: 8px 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-soft);
}

.suggestion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}

.suggestion-header:hover {
  background: rgba(0, 47, 167, 0.05);
}

.expand-icon {
  font-size: 10px;
  color: var(--muted);
}

.suggestion-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 4px;
  padding: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.suggestion-item {
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.suggestion-item:hover:not(:disabled) {
  border-color: var(--accent);
  background: rgba(0, 47, 167, 0.05);
}

.suggestion-item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.suggestion-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 2px;
}

.suggestion-description {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.3;
}

.quick-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

.quick-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
}

.quick-action:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(0, 47, 167, 0.05);
}

.quick-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .suggestion-grid {
    grid-template-columns: 1fr;
  }

  .input-status-bar {
    flex-direction: column;
    gap: 4px;
  }

  .quick-actions {
    margin-top: 4px;
  }
}
`;

// 添加样式
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}