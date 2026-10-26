import {
  ChatAttachmentIcon,
  ChatAttachmentInfo,
  ChatAttachmentName,
  ChatAttachmentPreview,
  ChatAttachmentRemove,
  ChatAttachmentRoot,
  ChatAttachmentSize,
} from './chat-attachment';
export {
  formatChatAttachmentSize,
  inferChatAttachmentFileKind,
  inferChatAttachmentMediaType,
} from './chat-attachment';
import { ChatAttachmentGroupRoot } from './chat-attachment-group';
import {
  ChatAttachmentInputDropzone,
  ChatAttachmentInputRoot,
  ChatAttachmentInputTrigger,
} from './chat-attachment-input';
export type {
  ChatAttachmentGroupVariants,
  ChatAttachmentVariants,
} from './chat-attachment.styles';
export {
  chatAttachmentGroupVariants,
  chatAttachmentVariants,
} from './chat-attachment.styles';

const ChatAttachment = Object.assign(ChatAttachmentRoot, {
  Icon: ChatAttachmentIcon,
  Info: ChatAttachmentInfo,
  Name: ChatAttachmentName,
  Preview: ChatAttachmentPreview,
  Remove: ChatAttachmentRemove,
  Root: ChatAttachmentRoot,
  Size: ChatAttachmentSize,
});

const ChatAttachmentGroup = Object.assign(ChatAttachmentGroupRoot, {
  Root: ChatAttachmentGroupRoot,
});

const ChatAttachmentInput = Object.assign(ChatAttachmentInputRoot, {
  Dropzone: ChatAttachmentInputDropzone,
  Root: ChatAttachmentInputRoot,
  Trigger: ChatAttachmentInputTrigger,
});

export {
  ChatAttachment,
  ChatAttachmentGroup,
  ChatAttachmentGroupRoot,
  ChatAttachmentIcon,
  ChatAttachmentInfo,
  ChatAttachmentInput,
  ChatAttachmentInputDropzone,
  ChatAttachmentInputRoot,
  ChatAttachmentInputTrigger,
  ChatAttachmentName,
  ChatAttachmentPreview,
  ChatAttachmentRemove,
  ChatAttachmentRoot,
  ChatAttachmentSize,
};

export type {
  ChatAttachmentFileKind,
  ChatAttachmentInfoProps,
  ChatAttachmentMediaType,
  ChatAttachmentNameProps,
  ChatAttachmentPreviewProps,
  ChatAttachmentRootProps as ChatAttachmentProps,
  ChatAttachmentRemoveProps,
  ChatAttachmentRootProps,
  ChatAttachmentSizeProps,
} from './chat-attachment';
export type {
  ChatAttachmentGroupRootProps as ChatAttachmentGroupProps,
  ChatAttachmentGroupRootProps,
} from './chat-attachment-group';
export type {
  ChatAttachmentInputDropzoneProps,
  ChatAttachmentInputProps,
  ChatAttachmentInputTriggerProps,
} from './chat-attachment-input';
