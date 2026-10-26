'use client';

import type { ComponentPropsWithRef } from 'react';
import React, { createContext, useContext, useMemo } from 'react';
import { cx } from 'tailwind-variants';
import { CloseButton } from '@heroui/react';
import { FileText } from 'lucide-react';
import {
  composeSlotClassName,
  composeTwRenderProps,
} from '../../utils/compose';
import { chatAttachmentVariants } from './chat-attachment.styles';
import './chat-attachment.compat.css';

export type ChatAttachmentMediaType =
  | 'audio'
  | 'document'
  | 'image'
  | 'unknown'
  | 'video';

export type ChatAttachmentFileKind =
  | 'archive'
  | 'audio'
  | 'code'
  | 'document'
  | 'image'
  | 'pdf'
  | 'spreadsheet'
  | 'unknown'
  | 'video';

export function inferChatAttachmentMediaType(
  mimeType?: string
): ChatAttachmentMediaType {
  if (!mimeType) return 'unknown';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('text/') || mimeType.startsWith('application/'))
    return 'document';
  return 'unknown';
}

export function inferChatAttachmentFileKind(
  mimeType?: string,
  name?: string
): ChatAttachmentFileKind {
  const type = (mimeType || '').toLowerCase();
  const extension = (name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
  if (type === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (/zip|tar|rar|7z|gzip/.test(type) || ['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return 'archive';
  if (/spreadsheet|excel/.test(type) || ['xls', 'xlsx', 'csv', 'ods'].includes(extension)) return 'spreadsheet';
  if (/javascript|typescript|json|xml|yaml|html|css/.test(type) || ['js', 'jsx', 'ts', 'tsx', 'json', 'xml', 'yaml', 'yml', 'html', 'css', 'py', 'go', 'rs', 'java', 'sql'].includes(extension)) return 'code';
  if (type.startsWith('text/') || /document|word|presentation|powerpoint/.test(type)) return 'document';
  return 'unknown';
}

export function formatChatAttachmentSize(bytes?: number): string {
  if (!Number.isFinite(bytes) || (bytes as number) < 0) return '';
  const value = bytes as number;
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

interface ChatAttachmentContextValue {
  fileKind: ChatAttachmentFileKind;
  mediaType: ChatAttachmentMediaType;
  mimeType?: string;
  name?: string;
  size?: number;
  slots: ReturnType<typeof chatAttachmentVariants>;
  src?: string;
}

const ChatAttachmentContext = createContext<ChatAttachmentContextValue>({
  fileKind: 'unknown',
  mediaType: 'unknown',
  slots: chatAttachmentVariants(),
});

const useChatAttachmentContext = () => useContext(ChatAttachmentContext);
const useSlots = () => {
  const { slots } = useChatAttachmentContext();
  const fallback = useMemo(() => chatAttachmentVariants(), []);
  return slots ?? fallback;
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ChatAttachmentRootProps extends ComponentPropsWithRef<'div'> {
  children?: React.ReactNode;
  mediaType?: ChatAttachmentMediaType;
  mimeType?: string;
  name?: string;
  size?: number;
  src?: string;
}

export type ChatAttachmentPreviewProps = {
  children?: React.ReactNode;
  className?: string;
};

export interface ChatAttachmentInfoProps extends ComponentPropsWithRef<'div'> {
  children?: React.ReactNode;
}

export interface ChatAttachmentNameProps extends ComponentPropsWithRef<'span'> {
  children?: React.ReactNode;
}

export interface ChatAttachmentSizeProps extends ComponentPropsWithRef<'span'> {
  children?: React.ReactNode;
}

export type ChatAttachmentRemoveProps = ComponentPropsWithRef<
  typeof CloseButton
>;

// ─── Components ───────────────────────────────────────────────────────────────

export const ChatAttachmentRoot = ({
  children,
  className,
  mediaType,
  mimeType,
  name,
  size,
  src,
  ...props
}: ChatAttachmentRootProps) => {
  const slots = useMemo(() => chatAttachmentVariants(), []);
  const resolvedMediaType = mediaType ?? inferChatAttachmentMediaType(mimeType);
  const fileKind = inferChatAttachmentFileKind(mimeType, name);
  const variant = resolvedMediaType === 'image' || resolvedMediaType === 'video' ? 'media' : 'file';

  return (
    <ChatAttachmentContext.Provider
      value={{ fileKind, mediaType: resolvedMediaType, mimeType, name, size, slots, src }}
    >
      <div
        className={composeSlotClassName(slots?.base, className)}
        data-slot="chat-attachment"
        data-variant={variant}
        {...props}
      >
        {children ?? (
          <>
            <ChatAttachmentPreview />
            <ChatAttachmentInfo />
          </>
        )}
      </div>
    </ChatAttachmentContext.Provider>
  );
};

export const ChatAttachmentPreview = ({
  children,
  className,
}: ChatAttachmentPreviewProps) => {
  const { mediaType, name, src } = useChatAttachmentContext();
  const slots = useSlots();

  if (children && React.isValidElement(children)) {
    return React.cloneElement(
      children as React.ReactElement<{ className?: string }>,
      {
        className: cx(
          composeSlotClassName(slots?.preview, className),
          (children as React.ReactElement<{ className?: string }>).props
            .className
        ),
        'data-slot': 'chat-attachment-preview',
      } as React.HTMLAttributes<HTMLElement>
    );
  }

  return (
    <div
      className={composeSlotClassName(slots?.preview, className)}
      data-slot="chat-attachment-preview"
    >
      {mediaType === 'image' && src ? (
        <img
          alt={name ?? 'Attachment'}
          className={composeSlotClassName(slots?.previewImage, undefined)}
          data-slot="chat-attachment-preview-image"
          src={src}
        />
      ) : mediaType === 'video' && src ? (
        <video
          className={composeSlotClassName(slots?.previewVideo, undefined)}
          data-slot="chat-attachment-preview-video"
          muted
          src={src}
        />
      ) : (
        <span
          className={composeSlotClassName(slots?.previewFallback, undefined)}
        >
          <ChatAttachmentIcon />
        </span>
      )}
    </div>
  );
};

export const ChatAttachmentIcon = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => {
  const slots = useSlots();
  return (
    <span
      className={composeSlotClassName(slots?.icon, className)}
      data-slot="chat-attachment-icon"
    >
      {children ?? <FileText className="size-4" />}
    </span>
  );
};

export const ChatAttachmentInfo = ({
  children,
  className,
  ...props
}: ChatAttachmentInfoProps) => {
  const slots = useSlots();
  return (
    <div
      className={composeSlotClassName(slots?.info, className)}
      data-slot="chat-attachment-info"
      {...props}
    >
      {children ?? (
        <>
          <ChatAttachmentName />
          <ChatAttachmentSize />
        </>
      )}
    </div>
  );
};

export const ChatAttachmentName = ({
  children,
  className,
  ...props
}: ChatAttachmentNameProps) => {
  const { name } = useChatAttachmentContext();
  const slots = useSlots();
  return (
    <span
      className={composeSlotClassName(slots?.name, className)}
      data-slot="chat-attachment-name"
      {...props}
    >
      {children ?? name}
    </span>
  );
};

export const ChatAttachmentSize = ({
  children,
  className,
  ...props
}: ChatAttachmentSizeProps) => {
  const { size } = useChatAttachmentContext();
  const slots = useSlots();
  const formatted = formatChatAttachmentSize(size);
  if (children == null && !formatted) return null;
  return (
    <span
      className={composeSlotClassName(slots?.size, className)}
      data-slot="chat-attachment-size"
      {...props}
    >
      {children ?? formatted}
    </span>
  );
};

export const ChatAttachmentRemove = ({
  children,
  className,
  ...props
}: ChatAttachmentRemoveProps) => {
  const slots = useSlots();
  return (
    <CloseButton
      className={composeTwRenderProps(className, slots?.remove())}
      data-slot="chat-attachment-remove"
      {...props}
    >
      {children}
    </CloseButton>
  );
};
