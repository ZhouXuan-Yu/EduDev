// Licensed local HeroUI Pro reference. Only import paths are relocated; example configuration is unchanged.
"use client";

import type {ReactNode} from "react";

import {useState} from "react";

import {ChainOfThought} from "../heroui-pro/components/chain-of-thought";

import {ChevronDown, FileText} from "../heroui-pro/components/icons";

function TraceSection({
  children,
  defaultOpen = true,
  icon,
  title,
}: {
  children?: ReactNode;
  defaultOpen?: boolean;
  icon?: ReactNode;
  title: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <ChainOfThought.Step
      label={
        <button
          aria-expanded={isOpen}
          className="hover:text-foreground inline-flex cursor-[var(--cursor-interactive)] items-center gap-2 text-left transition-colors"
          type="button"
          onClick={() => setIsOpen((value) => !value)}
        >
          <ChevronDown className={`size-3 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
          {icon ? <span>{icon}</span> : null}
          <span>{title}</span>
        </button>
      }
    >
      <div
        style={{transitionTimingFunction: "var(--ease-out-quad)"}}
        className={`grid transition-[grid-template-rows,opacity] duration-150 ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </ChainOfThought.Step>
  );
}

function TraceItem({
  children,
  defaultExpanded = true,
  isStreaming = false,
  title,
}: {
  children: ReactNode;
  defaultExpanded?: boolean;
  isStreaming?: boolean;
  title: ReactNode;
}) {
  return (
    <ChainOfThought defaultExpanded={defaultExpanded} isStreaming={isStreaming}>
      <ChainOfThought.Trigger>{title}</ChainOfThought.Trigger>
      <ChainOfThought.Content>
        <ChainOfThought.Steps className="gap-2">{children}</ChainOfThought.Steps>
      </ChainOfThought.Content>
    </ChainOfThought>
  );
}

function FileAction({children}: {children: ReactNode}) {
  return (
    <div className="text-muted flex items-center gap-2">
      <FileText className="size-3.5" />
      <span>{children}</span>
    </div>
  );
}

function AgentTraceContent({isStreaming = false}: {isStreaming?: boolean}) {
  return (
    <div className="flex w-[420px] flex-col gap-2">
      <TraceItem isStreaming={isStreaming} title="Thought for 2s">
        <ChainOfThought.Step>
          <p>
            The user wants a simple login page. This is a straightforward UI task - I should create
            a clean login form. Let me generate some design inspiration first to ensure it looks
            good, then build the page.
          </p>
        </ChainOfThought.Step>
      </TraceItem>

      <TraceItem isStreaming={isStreaming} title="Generated design">
        <ChainOfThought.Step>
          <img
            alt="Generated area chart design"
            className="border-default bg-surface w-full max-w-sm rounded-xl border"
            src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/docs/pro-related-components/light-areaChart.png"
          />
        </ChainOfThought.Step>
      </TraceItem>

      <TraceItem isStreaming={isStreaming} title="Explore • 2 Files">
        <TraceSection title="Read layout">
          <ChainOfThought.Steps className="gap-2">
            <ChainOfThought.Step>
              <FileAction>Read app/layout.tsx</FileAction>
            </ChainOfThought.Step>
          </ChainOfThought.Steps>
        </TraceSection>
        <TraceSection title="Read globals">
          <ChainOfThought.Steps className="gap-2">
            <ChainOfThought.Step>
              <FileAction>Read app/globals.css</FileAction>
            </ChainOfThought.Step>
          </ChainOfThought.Steps>
        </TraceSection>
      </TraceItem>

      <TraceItem isStreaming={isStreaming} title="Found UI components">
        <ChainOfThought.Step>
          <p>Now let me check the existing UI components available:</p>
        </ChainOfThought.Step>
        <ChainOfThought.Step>
          <p className="text-muted">Scanning 56 files</p>
        </ChainOfThought.Step>
      </TraceItem>

      <TraceItem isStreaming={isStreaming} title="Explore • 4 Files">
        <ChainOfThought.Step>
          <p>
            I have all the components I need. Let me read the button, input, card, and label
            components to understand their APIs:
          </p>
        </ChainOfThought.Step>
        <TraceSection title="Read button">
          <ChainOfThought.Steps className="gap-2">
            <ChainOfThought.Step>
              <FileAction>Read components/ui/button.tsx</FileAction>
            </ChainOfThought.Step>
          </ChainOfThought.Steps>
        </TraceSection>
        <TraceSection title="Read input">
          <ChainOfThought.Steps className="gap-2">
            <ChainOfThought.Step>
              <FileAction>Read components/ui/input.tsx</FileAction>
            </ChainOfThought.Step>
          </ChainOfThought.Steps>
        </TraceSection>
        <TraceSection title="Read card">
          <ChainOfThought.Steps className="gap-2">
            <ChainOfThought.Step>
              <FileAction>Read components/ui/card.tsx</FileAction>
            </ChainOfThought.Step>
          </ChainOfThought.Steps>
        </TraceSection>
        <TraceSection title="Read label">
          <ChainOfThought.Steps className="gap-2">
            <ChainOfThought.Step>
              <FileAction>Read components/ui/label.tsx</FileAction>
            </ChainOfThought.Step>
          </ChainOfThought.Steps>
        </TraceSection>
      </TraceItem>

      <TraceItem isStreaming={isStreaming} title="Updated layout">
        <ChainOfThought.Step>
          <p>
            Now I have all the information I need. Let me create a clean, simple login page using
            the existing design system components:
          </p>
        </ChainOfThought.Step>
        <TraceSection title="login-form.tsx">
          <ChainOfThought.Steps className="gap-2">
            <ChainOfThought.Step>
              <FileAction>Updated components/login-form.tsx</FileAction>
            </ChainOfThought.Step>
          </ChainOfThought.Steps>
        </TraceSection>
        <TraceSection title="layout.tsx">
          <ChainOfThought.Steps className="gap-2">
            <ChainOfThought.Step>
              <FileAction>Updated app/layout.tsx</FileAction>
            </ChainOfThought.Step>
          </ChainOfThought.Steps>
        </TraceSection>
      </TraceItem>
    </div>
  );
}

export function AgentTrace() {
  return <AgentTraceContent />;
}

export function AgentTraceStreaming() {
  return <AgentTraceContent isStreaming />;
}
