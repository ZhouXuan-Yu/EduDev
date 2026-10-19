'use client';

import React from 'react';
import { ChainOfThought } from './index';

export interface ThoughtStep {
  label: string;
  detail: string;
}

interface EnhancedChainOfThoughtProps {
  defaultExpanded?: boolean;
  isStreaming?: boolean;
  steps: ThoughtStep[];
  title?: string;
  subtitle?: string;
}

export const EnhancedChainOfThought: React.FC<EnhancedChainOfThoughtProps> = ({
  defaultExpanded = true,
  isStreaming = false,
  steps,
  title = '思考过程',
  subtitle,
}) => {
  if (!steps || steps.length === 0) {
    return null;
  }

  return (
    <ChainOfThought defaultExpanded={defaultExpanded} isStreaming={isStreaming}>
      <ChainOfThought.Trigger>
        {subtitle ? `${title} · ${subtitle}` : `${title} · ${steps.length} 步`}
      </ChainOfThought.Trigger>
      <ChainOfThought.Content>
        <ChainOfThought.Steps>
          {steps.map((step, index) => (
            <ChainOfThought.Step key={`${step.label}-${index}`} label={step.label}>
              {step.detail}
            </ChainOfThought.Step>
          ))}
        </ChainOfThought.Steps>
      </ChainOfThought.Content>
    </ChainOfThought>
  );
};
