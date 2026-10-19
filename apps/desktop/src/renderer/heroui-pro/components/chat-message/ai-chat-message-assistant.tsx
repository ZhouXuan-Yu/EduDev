'use client';

import React from 'react';
import { Copy, GitBranch, RotateCcw, Sparkles } from 'lucide-react';
import { ChatMessage } from '../chat-message';
import { ChatTool, ChatToolGroup } from '../chat-tool';
import type { ToolPartState } from '../chat-tool';
import { Markdown } from '../markdown';
import { EnhancedChainOfThought } from '../chain-of-thought/enhanced-chain-of-thought';
import type { ThoughtStep } from '../chain-of-thought/enhanced-chain-of-thought';

export interface AiToolRunSummary {
  toolName: string;
  state: ToolPartState;
  argsText?: string;
  output?: Record<string, unknown>;
}

interface AiChatMessageAssistantProps {
  message: {
    id: string;
    role: 'assistant';
    content: string;
    metadata?: {
      thoughtSteps?: ThoughtStep[];
      toolRuns?: AiToolRunSummary[];
      agentRunId?: string;
      ok?: boolean;
      model?: string;
      errorMessage?: string;
    };
  };
  avatar?: React.ReactNode;
  children?: React.ReactNode;
  mutationRunning?: boolean;
  onRetry?: () => void;
  onBranch?: () => void;
  onRegenerate?: () => void;
}

export const AiChatMessageAssistant: React.FC<AiChatMessageAssistantProps> = ({
  message,
  avatar,
  children,
  mutationRunning = false,
  onRetry,
  onBranch,
  onRegenerate,
}) => {
  const {
    content,
    metadata = {},
  } = message;

  const {
    thoughtSteps = [],
    toolRuns = [],
    agentRunId,
    ok = true,
    model,
    errorMessage,
  } = metadata;

  const hasThoughtSteps = thoughtSteps.length > 0;
  const hasToolRuns = toolRuns.length > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // clipboard 在非安全上下文可能不可用，静默失败
    }
  };

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
            defaultExpanded={false}
            steps={thoughtSteps}
            title="思考过程"
            subtitle={`${thoughtSteps.length} 个步骤`}
          />
        )}

        {/* 回答内容 */}
        <ChatMessage.Content>
          <Markdown>{content}</Markdown>
        </ChatMessage.Content>

        {/* 错误提示 */}
        {!ok && errorMessage && (
          <div className="ai-assistant-error" role="alert">
            <strong>生成过程中遇到问题</strong>
            <p>{errorMessage}</p>
          </div>
        )}

        {/* 工具调用轨迹 */}
        {hasToolRuns && (
          <ChatToolGroup defaultExpanded={false}>
            <ChatToolGroup.Trigger>
              {toolRuns.length} 次工具调用
            </ChatToolGroup.Trigger>
            <ChatToolGroup.Content>
              {toolRuns.map((tool, index) => (
                <ChatTool
                  key={`${tool.toolName}-${index}`}
                  toolName={tool.toolName}
                  state={tool.state}
                  argsText={tool.argsText}
                  output={tool.output}
                  triggerPrefix=""
                />
              ))}
            </ChatToolGroup.Content>
          </ChatToolGroup>
        )}

        {/* 消息操作 */}
        {(agentRunId || hasToolRuns) && (
          <ChatMessage.Actions>
            <ChatMessage.Action aria-label="复制回答" tooltip="复制回答" onPress={() => void handleCopy()}>
              <Copy className="size-4" />
            </ChatMessage.Action>
            {!ok && onRetry ? (
              <ChatMessage.Action aria-label="重试本轮" tooltip="重试本轮" isDisabled={mutationRunning} onPress={onRetry}>
                <RotateCcw className="size-4" />
              </ChatMessage.Action>
            ) : null}
            {agentRunId && onRegenerate ? (
              <ChatMessage.Action aria-label="重新生成" tooltip="重新生成" isDisabled={mutationRunning} onPress={onRegenerate}>
                <Sparkles className="size-4" />
              </ChatMessage.Action>
            ) : null}
            {agentRunId && onBranch ? (
              <ChatMessage.Action aria-label="创建分支" tooltip="从本轮创建分支" isDisabled={mutationRunning} onPress={onBranch}>
                <GitBranch className="size-4" />
              </ChatMessage.Action>
            ) : null}
          </ChatMessage.Actions>
        )}

        {/* 消息元信息与扩展内容 */}
        {model ? (
          <div className="ai-assistant-meta">
            <span>{model}</span>
          </div>
        ) : null}
        {children}
      </ChatMessage.Body>
    </ChatMessage.Assistant>
  );
};
