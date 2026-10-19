'use client';

import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from 'tailwind-variants';

// ─── Dots ─────────────────────────────────────────────────────────────────────

export interface ChatLoaderDotsProps extends ComponentPropsWithRef<'div'> {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const ChatLoaderDots = ({
  className,
  label,
  size = 'md',
  ...props
}: ChatLoaderDotsProps) => {
  const sizeClass =
    size === 'sm' ? 'chat-loader__dots--sm' : size === 'lg' ? 'chat-loader__dots--lg' : '';

  return (
    <div
      aria-label={label ?? 'Loading'}
      className={cx(`chat-loader__dots ${sizeClass}`.trim(), className)}
      data-slot="chat-loader-dots"
      role="status"
      {...props}
    >
      <span className="chat-loader__dot" />
      <span className="chat-loader__dot" />
      <span className="chat-loader__dot" />
    </div>
  );
};

// ─── Pulse ────────────────────────────────────────────────────────────────────

export interface ChatLoaderPulseProps extends ComponentPropsWithRef<'div'> {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const ChatLoaderPulse = ({
  className,
  label,
  size = 'md',
  ...props
}: ChatLoaderPulseProps) => {
  const sizeClass =
    size === 'sm' ? 'chat-loader__pulse--sm' : size === 'lg' ? 'chat-loader__pulse--lg' : '';

  return (
    <div
      aria-label={label ?? 'Loading'}
      className={cx(`chat-loader__pulse ${sizeClass}`.trim(), className)}
      data-slot="chat-loader-pulse"
      role="status"
      {...props}
    />
  );
};

// ─── Spinner ──────────────────────────────────────────────────────────────────

export interface ChatLoaderSpinnerProps extends ComponentPropsWithRef<'div'> {
  label?: string;
}

const ChatLoaderSpinner = ({
  className,
  label,
  ...props
}: ChatLoaderSpinnerProps) => {
  return (
    <div
      aria-label={label ?? 'Loading'}
      className={cx('chat-loader__spinner', className)}
      data-slot="chat-loader-spinner"
      role="status"
      {...props}
    >
      <ChatLoaderDots size="md" />
    </div>
  );
};

// ─── Skeleton primitives ──────────────────────────────────────────────────────

export interface ChatLoaderSkeletonAvatarProps extends ComponentPropsWithRef<'div'> {
  size?: 'sm' | 'md' | 'lg';
}

const ChatLoaderSkeletonAvatar = ({
  className,
  size = 'md',
  ...props
}: ChatLoaderSkeletonAvatarProps) => {
  const sizeClass =
    size === 'sm'
      ? 'chat-loader__skeleton-avatar--sm'
      : size === 'lg'
        ? 'chat-loader__skeleton-avatar--lg'
        : '';

  return (
    <div
      aria-hidden={true}
      className={cx(`chat-loader__skeleton-avatar ${sizeClass}`.trim(), className)}
      data-slot="chat-loader-skeleton-avatar"
      {...props}
    />
  );
};

export interface ChatLoaderSkeletonBlockProps extends ComponentPropsWithRef<'div'> {
  children?: ReactNode;
}

const ChatLoaderSkeletonBlock = ({
  children,
  className,
  ...props
}: ChatLoaderSkeletonBlockProps) => {
  return (
    <div
      className={cx('chat-loader__skeleton-block', className)}
      data-slot="chat-loader-skeleton-block"
      {...props}
    >
      {children}
    </div>
  );
};

export interface ChatLoaderSkeletonLineProps extends ComponentPropsWithRef<'div'> {
  size?: 'sm' | 'md' | 'lg';
}

const ChatLoaderSkeletonLine = ({
  className,
  size = 'md',
  ...props
}: ChatLoaderSkeletonLineProps) => {
  const sizeClass =
    size === 'sm'
      ? 'chat-loader__skeleton-line--sm'
      : size === 'lg'
        ? 'chat-loader__skeleton-line--lg'
        : '';

  return (
    <div
      aria-hidden={true}
      className={cx(`chat-loader__skeleton-line ${sizeClass}`.trim(), className)}
      data-slot="chat-loader-skeleton-line"
      {...props}
    />
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export interface ChatLoaderSkeletonProps extends ComponentPropsWithRef<'div'> {
  label?: string;
  lineCount?: number;
}

const ChatLoaderSkeleton = ({
  className,
  label,
  lineCount = 3,
  ...props
}: ChatLoaderSkeletonProps) => {
  return (
    <div
      aria-label={label ?? 'Loading response'}
      className={cx('chat-loader__skeleton', className)}
      data-slot="chat-loader-skeleton"
      role="status"
      {...props}
    >
      <ChatLoaderSkeletonAvatar />
      <ChatLoaderSkeletonBlock>
        {Array.from({ length: lineCount }, (_, index) => (
          <ChatLoaderSkeletonLine key={index} />
        ))}
      </ChatLoaderSkeletonBlock>
    </div>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────

export interface ChatLoaderRootProps extends ComponentPropsWithRef<'div'> {
  children: ReactNode;
}

const ChatLoaderRoot = ({ children, ...props }: ChatLoaderRootProps) => {
  return (
    <div data-slot="chat-loader" {...props}>
      {children}
    </div>
  );
};

const ChatLoader = Object.assign(ChatLoaderRoot, {
  Dots: ChatLoaderDots,
  Pulse: ChatLoaderPulse,
  Skeleton: ChatLoaderSkeleton,
  SkeletonAvatar: ChatLoaderSkeletonAvatar,
  SkeletonBlock: ChatLoaderSkeletonBlock,
  SkeletonLine: ChatLoaderSkeletonLine,
  Spinner: ChatLoaderSpinner,
});

export {
  ChatLoader,
  ChatLoaderDots,
  ChatLoaderPulse,
  ChatLoaderRoot,
  ChatLoaderSkeleton,
  ChatLoaderSkeletonAvatar,
  ChatLoaderSkeletonBlock,
  ChatLoaderSkeletonLine,
  ChatLoaderSpinner,
};
