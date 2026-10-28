# Component source map

Repository root:

```text
D:\WorkProject\HeroUIPro\herouipro-v3-latest
```

Patterns:

```text
Source:  packages/ui-pro/src/components/<kebab>/
Demo:    packages/example/src/demos/<Pascal>.tsx
Catalog: packages/example/src/catalog.ts
Local:   apps/desktop/src/renderer/heroui-pro/components/<kebab>/
Demo UI: https://herouipro-v3.shunqwang.workers.dev/#<Component>
```

## Full-page template

| Template | Source | Use |
|---|---|---|
| Chat agent page | `packages/template-chat` | Complete sidebar + navbar + conversation + composer + search + New/Library/Explore routes |

See `template-chat.md` for the standalone-copy recipe and parity protocol.

## First-class components

| Component | Source directory | Demo | Local vendored | Notes |
|---|---|---|---|---|
| ChatSource | `chat-source` | `ChatSource.tsx` | yes | Includes `ChatSources` group and `ChatSource.*` parts |
| ChatSources | `chat-source` | `ChatSource.tsx` | yes | Same directory; use `ChatSources.*` for disclosure grouping |
| ChatAttachment | `chat-attachment` | `ChatAttachment.tsx` | yes | Includes `ChatAttachmentInput`, `ChatAttachmentGroup` |
| ChatAttachmentInput | `chat-attachment` | `ChatAttachment.tsx` | yes | Compound part; not a top-level MCP name |
| ChatAttachmentGroup | `chat-attachment` | `ChatAttachment.tsx` | yes | Compound part |
| PromptInput | `prompt-input` | `PromptInput.tsx` | yes | Includes queue/token subcomponents |
| ChatMessage | `chat-message` | `ChatMessage.tsx` | yes |  |
| ChatMessageActions | `chat-message-actions` | `ChatMessageActions.tsx` | no | Vendor first if needed |
| ChatConversation | `chat-conversation` | `ChatConversation.tsx` | yes |  |
| ChatListView | `chat-list-view` | `ChatListView.tsx` | yes |  |
| ChatLoader | `chat-loader` | `ChatLoader.tsx` | no | Vendor first if needed |
| ChatTool | `chat-tool` | `ChatTool.tsx` | yes |  |
| ChainOfThought | `chain-of-thought` | `ChainOfThought.tsx` | yes |  |
| Markdown | `markdown` | `Markdown.tsx` | yes |  |
| PromptSuggestion | `prompt-suggestion` | `PromptSuggestion.tsx` | yes |  |
| FileTree | `file-tree` | `FileTree.tsx` | yes |  |
| CodeBlock | `code-block` | — | yes | Check catalog/demo references |
| HoverCard | `hover-card` | — | yes | Dependency of ChatSource preview |
| Sheet | `sheet` | — | yes |  |
| Sidebar | `sidebar` | — | yes |  |
| AppLayout | `app-layout` | — | yes |  |
| ListView | `list-view` | `ChatListView.tsx` | yes |  |
| EmptyState | `empty-state` | — | yes |  |
| Resizable | `resizable` | — | yes |  |

## Catalog card convention

A card such as:

```text
ChatSource
AI & Messaging
Source: src/components/chat-source
@components/chat-source
```

maps to:

```text
kebab:  chat-source
Pascal: ChatSource
source: packages/ui-pro/src/components/chat-source
demo:   packages/example/src/demos/ChatSource.tsx
local:  apps/desktop/src/renderer/heroui-pro/components/chat-source
route:  #ChatSource
```

The `@components/...` import in the card belongs to the example app. In EduProject use the local relative path.

## Components not yet vendored

For a source directory that has no local counterpart, do not use it until the component and its dependency closure are copied or imported. Check:

- `index.ts` exports
- `*.styles.ts` BEM classes
- dependencies such as `hover-card`, `icons`, `Disclosure`, `CloseButton`
- compiled CSS presence in `heroui-pro.min.css`
- current demo usage

## Current local gaps

This list changes as components are added; verify with the paths above rather than trusting the snapshot.

- `chat-message-actions` — not vendored
- `chat-loader` — not vendored
- charts (`area-chart`, `bar-chart`, etc.) — not vendored
- most form and navigation components — not vendored
