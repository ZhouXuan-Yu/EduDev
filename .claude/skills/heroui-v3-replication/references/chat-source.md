# ChatSource worked example

This is the reference example for the first replication test.

## Source

Commit:

```text
eabeaa784ee44f16f50845028ac04f345e9f97c7
2026-10-17 15:36:07 +0800
```

Files:

```text
packages/ui-pro/src/components/chat-source/chat-source.tsx
packages/ui-pro/src/components/chat-source/chat-sources.tsx
packages/ui-pro/src/components/chat-source/chat-source.styles.ts
packages/ui-pro/src/components/chat-source/index.ts
```

Demo:

```text
packages/example/src/demos/ChatSource.tsx
https://herouipro-v3.shunqwang.workers.dev/#ChatSource
```

Local vendored:

```text
apps/desktop/src/renderer/heroui-pro/components/chat-source/
```

## Public API

```tsx
import { ChatSource, ChatSources } from '../../heroui-pro/components/chat-source';
```

### ChatSource props

| Prop | Type | Default | Behavior |
|---|---|---|---|
| `sourceType` | `'url' \| 'document'` | `href ? 'url' : 'document'` | URL chip vs document chip |
| `href` | `string` | — | URL source; also enables preview |
| `title` | `string` | — | Display title; URL falls back to domain |
| `description` | `string` | — | Preview description; also enables preview |
| `faviconUrl` | `string` | — | 14×14 favicon image |
| `enablePreview` | `boolean` | `Boolean(description \|\| title)` for URL with href | Force or disable hover preview |

### Compound parts

```tsx
ChatSource.Trigger
ChatSource.Icon
ChatSource.Title
ChatSource.Preview
ChatSource.DocumentIcon
```

### ChatSources group

```tsx
<ChatSources defaultExpanded={false}>
  <ChatSources.Trigger>3 sources</ChatSources.Trigger>
  <ChatSources.Content>
    <ChatSources.List>
      <ChatSource ... />
    </ChatSources.List>
  </ChatSources.Content>
</ChatSources>
```

`ChatSources` is built on HeroUI `Disclosure`; `Trigger` renders a heading trigger and an indicator; `Content` wraps `Disclosure.Body`.

## Behavior from source

- `extractSourceDomain` returns `new URL(href).hostname` without `www.`; on failure it returns the last path segment.
- URL preview is enabled only when `sourceType === 'url'`, `href` exists, and `enablePreview` resolves true.
- Preview wrapper uses `HoverCard openDelay={150} closeDelay={0}`.
- URL trigger renders an `<a target="_blank" rel="noopener noreferrer">`; document trigger renders a `<span>`.
- Default URL content is `ChatSource.Icon + ChatSource.Title`; default document content is `ChatSource.DocumentIcon + ChatSource.Title`.
- `ChatSource.Icon` order: custom child → favicon image → initial-letter fallback.
- `ChatSource.Preview` uses `HoverCard.Content`, `offset={8}`, `placement="top"`; custom children replace the default preview card.
- Preview default card contains domain/icon header, optional title, optional description, all inside the source link.

## Demo variants

`packages/example/src/demos/ChatSource.tsx` exports:

- `Default` — single URL source with favicon and description.
- `Document` — `sourceType="document"` with a document title.
- `Grouped` — `ChatSources` disclosure with mixed URL and document sources.
- `Composable` — custom `ChatSource.Trigger` and `ChatSource.Preview` children.
- `StackedFavicons` — custom stacked favicon trigger inside `ChatSources`.

Use these variants as the parity matrix.

## Local diff

Current source vs `apps/desktop/src/renderer/heroui-pro/components/chat-source/`:

- `chat-source.tsx`: only class order differs:
  - source: `text-foreground text-sm truncate`
  - local: `text-foreground truncate text-sm`
  This is visually equivalent.
- `index.ts`: local version lacks the two type-only exports:
  - `ChatSource` type
  - `ChatSources` type
  This does not affect runtime.
- `chat-sources.tsx` and `chat-source.styles.ts` are identical.

Conclusion: ChatSource is already functionally current in EduProject; do not rewrite it just to remove the tiny diff. Add type exports only if a consumer needs them.

## EduProject integration

Existing usage:

```text
OfficeToolProcess.tsx — WebSource uses ChatSource with enablePreview={false}
PiLearningHistory.tsx — ChatSources disclosure
PiWorkspaceContext.tsx — ChatSources disclosure for more sources
```

For URL sources, keep the host boundary:

```tsx
<ChatSource href={source.url} title={source.title} enablePreview={false}>
  <ChatSource.Trigger
    data-testid="pi-web-source-open"
    onClick={(event) => {
      event.preventDefault();
      void window.omniEdu?.openXiaozhiWebSource({ sessionId, url: source.url });
    }}
  />
</ChatSource>
```

For document sources:

```tsx
<ChatSource sourceType="document" title={document.title} />
```

For grouped sources:

```tsx
<ChatSources defaultExpanded={false}>
  <ChatSources.Trigger>查看全部（{sources.length}）</ChatSources.Trigger>
  <ChatSources.Content>
    <ChatSources.List>
      {sources.map((source) => (
        <ChatSource key={source.id} {...toChatSourceProps(source)} />
      ))}
    </ChatSources.List>
  </ChatSources.Content>
</ChatSources>
```

## Privacy and host rules

- Do not copy the demo's Google favicon URL into EduProject by default.
- Prefer `ChatSource.Icon` fallback, a local favicon, or an approved host-provided asset.
- Do not let the anchor navigate the Electron window directly; intercept the click and use the host API.
- Do not expose raw internal URLs or private paths in source chips; only public source metadata.

## Parity checklist for ChatSource

- [ ] URL chip: icon, title, domain fallback, truncation.
- [ ] Document chip: document icon, title.
- [ ] Hover preview: delay, placement, header, title, description, arrow/clipping.
- [ ] Preview disabled: no HoverCard wrapper, no preview DOM.
- [ ] Custom trigger: custom icon/title work.
- [ ] Custom preview: custom children render.
- [ ] Grouped: disclosure default collapsed, trigger label, content list, indicator.
- [ ] Long title: ellipsis/truncate, no overflow.
- [ ] Keyboard: trigger focusable, Enter opens via host, Escape/outside closes preview.
- [ ] Responsive: 1366×768 and 1920×1080.
- [ ] Light/dark: colors and borders.
- [ ] Console: no errors.

## Verification commands

Use the EduProject Electron suite or a focused Playwright script:

```bash
npm --prefix apps/desktop exec playwright test <target-test>
```

If no focused test exists, create a one-off Electron smoke using the existing `scripts/xiaozhi-agent/*` pattern, then promote it to a regression test once the component contract is stable.
