---
name: heroui-v3-replication
description: "Use this skill whenever the user asks to implement, port, update, review, or pixel-match a component from the herouipro-v3 imitation repository (Agile-Avocation/herouipro-v3) or its demo site https://herouipro-v3.shunqwang.workers.dev. Trigger it for ChatSource, ChatSources, ChatAttachment, ChatAttachmentInput, ChatAttachmentGroup, PromptInput, ChatMessage, ChatConversation, ChatTool, ChatListView, Markdown, ChainOfThought, FileTree, and any other HeroUI-style component card such as 'ChatSource — Source: src/components/chat-source'. Also use it when the user asks for 复刻、还原、100% 对照、视觉一致性、组件对齐, or when a component must be matched against a demo route like #ChatSource. The skill enforces source-first lookup, local vendored diffing, Electron integration rules, and reproducible visual/interaction evidence."
metadata:
  author: EduProject
  version: "1.0.0"
---

# HeroUI v3 Imitation Replication

## Mission

Replicate a component from the herouipro-v3 imitation repository into EduProject with the same **anatomy, props, BEM classes, states, interactions, and visual result** as the demo site — without inventing APIs, adding style overrides, or claiming parity without evidence.

This repository is an imitation of HeroUI, not the upstream package. Treat its own source and demo as authoritative for this project.

## Task input template

When the user gives a replication task, extract or request these fields:

```text
Component:        ChatSource
Demo route:       #ChatSource
Source/card:      src/components/chat-source
Target:           which EduProject screen/file
Data:             fields and source of truth
Interactions:     link opening, preview, expand, remove, etc.
Constraints:      privacy, Electron host, no style overrides
Acceptance:       viewports, states, tests, evidence
```

If only a component card is provided, resolve the source/demo/local paths yourself and ask only for the target screen, data mapping, and business constraints that cannot be inferred from the repo.

## Source hierarchy

Read in this order and stop guessing when a higher source answers the question:

1. **Latest imitation repo**
   `https://github.com/Agile-Avocation/herouipro-v3.git`
   Local clone: `D:\WorkProject\HeroUIPro\herouipro-v3-latest`
   Source: `packages/ui-pro/src/components/<kebab>/`
   Demos: `packages/example/src/demos/<Pascal>.tsx`
2. **Demo site**
   `https://herouipro-v3.shunqwang.workers.dev/#<Component>`
   Use it for visual states, interaction, spacing, responsive behavior, and example combinations.
3. **Local vendored component**
   `apps/desktop/src/renderer/heroui-pro/components/<kebab>/`
   This is the implementation EduProject actually renders.
4. **MCP / skills**
   `heroui-react-pro` and `heroui-pro-design-taste` provide current conventions and docs. MCP is useful for API cross-checks and CSS, but it does not expose Pro/component-library source. Never use `get_component_source_code` for these components.

Do **not** use `D:\WorkProject\HeroUIPro\herouipro-v3` as current source. It is the old `@ag-ui/pro@1.0.0-beta.7` snapshot.

For a **complete agent/chat page**, the component demo site is not the right baseline. Use the full template:

```text
packages/template-chat
```

It contains the sidebar, navbar, conversation, composer, search dialog, and the
New Chat / Library / Explore routes. See `references/template-chat.md` for the
standalone-copy recipe, parity commands, and the Turbopack/remote-asset pitfalls
found during the first full-page replication.

## Before touching code

1. Refresh the latest repo without destroying local work:

```bash
git -C "D:/WorkProject/HeroUIPro/herouipro-v3-latest" fetch --all --prune
git -C "D:/WorkProject/HeroUIPro/herouipro-v3-latest" pull --ff-only
git -C "D:/WorkProject/HeroUIPro/herouipro-v3-latest" log -1 --format="%H %ad %s" --date=iso
```

If the pull fails because the worktree is dirty, stop and inspect. Do not reset or overwrite it.

2. Resolve the component card to real paths:

```bash
node ".claude/skills/heroui-v3-replication/scripts/locate-component.mjs" ChatSource
```

The script prints the source directory, demo file, local vendored directory, exports, and demo function names. Read `references/source-map.md` if the name is ambiguous.

3. Read the component in this order:

- `index.ts` — public exports, dot-notation assembly, type exports
- main component `.tsx` — root props and default behavior
- related subcomponent files — `chat-sources.tsx`, `chat-attachment-input.tsx`, etc.
- `*.styles.ts` — slot names and BEM class mapping
- demo file — real combinations and data shapes
- `packages/example/src/catalog.ts` — catalog metadata and import alias
- current BEM CSS — `apps/desktop/src/renderer/heroui-pro/heroui-pro.min.css` or the repo's CSS source

4. Build a contract table before editing:

```text
Component:
Source commit:
Root props:
Subcomponents:
Default behavior:
Data attributes / data-slot:
BEM classes:
Dependencies (HoverCard, Disclosure, icons):
Local vendored files:
Known local differences:
Target EduProject file:
```

Do not edit until this table is complete.

## Local vendored diff

Compare the current source with the local vendored copy:

```bash
diff -rq "D:/WorkProject/HeroUIPro/herouipro-v3-latest/packages/ui-pro/src/components/<kebab>" \
  "apps/desktop/src/renderer/heroui-pro/components/<kebab>"

diff -u "D:/WorkProject/HeroUIPro/herouipro-v3-latest/packages/ui-pro/src/components/<kebab>/<file>.tsx" \
  "apps/desktop/src/renderer/heroui-pro/components/<kebab>/<file>.tsx"
```

Classify every difference:

- **Formatting/type-only** — class order, missing type-only exports, whitespace. Do not rewrite the component for this.
- **EduProject adaptation** — host link handling, privacy, local data mapping. Preserve it.
- **Missing current behavior** — real API/anatomy/state difference. Apply the smallest patch, then test.

Never copy the entire current component over the local file without checking dependencies and app adaptations.

## Integration rules

- Import from the local vendored component, not the example alias:

```tsx
// Correct in EduProject
import { ChatSource, ChatSources } from '../../heroui-pro/components/chat-source';

// Wrong: this is the example app's alias
import { ChatSource } from '@components/chat-source';
```

- Preserve the component's anatomy and dot notation. Do not replace compound parts with custom markup.
- Do not add CSS overrides to make it “look closer.” If the BEM CSS is missing, fix the CSS import or utility availability instead of restyling the component.
- `data-testid` is allowed for tests; it must not change layout or styles.
- In Electron, do not let source links call `window.open` directly. Route URL opening through the host API already used by EduProject (for example `window.omniEdu.openXiaozhiWebSource`).
- Do not fetch remote favicons, avatars, or images unless the user explicitly approves it. Prefer the component's initial-letter fallback or local assets.
- Preserve accessibility: semantic anchors for URLs, `aria-label` on icon-only controls, keyboard focus, and `onPress` where the component expects it.

## Visual and interaction verification

“100%” means evidence, not resemblance.

For every replicated component:

1. Open the demo route, e.g. `#ChatSource`, and the EduProject target in the same viewport.
2. Test at least `1366x768` and `1920x1080`, with the same device scale factor.
3. Capture screenshots of the default, hover/focus, expanded, long-text, empty, and error/loading states that the component supports.
4. Assert DOM parity:

```js
// Example: ChatSource
await page.locator('[data-slot="chat-source"]').count();
await page.locator('[data-slot="chat-source-trigger"]').count();
await page.locator('[data-slot="chat-source-title"]').count();
await page.locator('[data-slot="chat-source-preview"]').count();
```

5. Extract computed styles and bounding boxes for the root, trigger, icon, title, and preview. Compare the values that affect layout and typography:

```js
const styles = await page.locator('[data-slot="chat-source"]').evaluate((el) => {
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    display: s.display,
    gap: s.gap,
    padding: s.padding,
    borderRadius: s.borderRadius,
    width: r.width,
    height: r.height,
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
  };
});
```

6. Exercise every interaction the component owns: link click routing, hover preview, disclosure expand/collapse, remove, drag/drop, keyboard focus, escape/outside close.
7. Check the console and page errors. An unstyled but “working” component is not parity.
8. Run the existing UI suite and add a focused regression test when the component has a user-visible contract.

If a true pixel diff tool is available, use it; otherwise use side-by-side screenshots plus DOM and computed-style assertions. Record exact commands, report paths, viewport sizes, and known gaps.

## Definition of done

A component is not done until all of these are true:

- [ ] Source commit and component paths recorded.
- [ ] Props, subcomponents, data attributes, and BEM classes match the current source.
- [ ] Local vendored diff is understood; every removed/added behavior is justified.
- [ ] No custom visual overrides were introduced.
- [ ] Import path and Electron host integration are correct.
- [ ] Default, hover/focus, expanded, long-text, and responsive states are checked.
- [ ] Screenshots and computed-style evidence exist at both viewports.
- [ ] Console has no new errors.
- [ ] A focused test exists for the user-visible contract.
- [ ] Unverified items are stated explicitly; no claim of “100%” without comparison.

## Common failure modes

- **Pro source via MCP** — MCP only returns OSS source; it returns `Component not found` for `chat-attachment`, `prompt-input`, etc. Use the repo.
- **Subcomponent names** — `ChatAttachmentInput`, `ChatAttachmentGroup`, `ChatSources` are not top-level MCP names. Read the parent component's `index.ts` and docs.
- **Old repository** — `herouipro-v3` is beta.7 and not current. Use `herouipro-v3-latest`.
- **Example alias** — `@components/...` only works in the example app. Use the EduProject relative path.
- **Missing utility class** — a class such as `hidden` can be present in source but absent from the compiled utility subset. Verify `getComputedStyle`, not source alone.
- **Remote assets** — demo favicon services are not automatically acceptable in a local-first education app.
- **CSS not loaded** — a component can render with correct DOM but no styles if its BEM CSS or dependencies are missing.

## Invocation

The project skill lives at:

```text
D:\WorkProject\EduProject\.claude\skills\heroui-v3-replication\SKILL.md
```

In a new Claude Code session opened at the EduProject root, invoke it with:

```text
/heroui-v3-replication
```

or ask:

```text
使用 heroui-v3-replication 技能，复刻 ChatSource。
```

If the current session was started before this skill was created, restart Claude Code or open a new session so the skill is discovered. Until then, follow this file manually.

## References

- `references/source-map.md` — component-to-source/demo/local mapping.
- `references/checklist.md` — per-component audit checklist.
- `references/chat-source.md` — first worked example, including current API, demo variants, and local diff.
- `references/template-chat.md` — full agent-page replication: source layout, standalone copy, parity protocol, and pitfalls.
- `references/visual-comparison.md` — demo-vs-Electron screenshot, DOM, computed-style, and state comparison protocol.
- `evals/evals.json` — starter test prompts for the user's later replication tasks.
