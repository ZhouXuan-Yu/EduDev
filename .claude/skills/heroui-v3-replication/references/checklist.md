# Replication checklist

Use this for every component, not only ChatSource.

## A. Discovery

- [ ] Latest repo pulled; commit SHA recorded.
- [ ] Component card name normalized to kebab-case.
- [ ] Source directory found under `packages/ui-pro/src/components/`.
- [ ] Demo file found under `packages/example/src/demos/`.
- [ ] Demo route identified (`#<Component>`).
- [ ] Local vendored directory found or marked as missing.
- [ ] `index.ts` read for exports and dot-notation assembly.

## B. Contract

- [ ] Root props and defaults recorded.
- [ ] Every subcomponent recorded.
- [ ] `sourceType`, `enablePreview`, `href`, `title`, `description`, `faviconUrl`, etc. behavior recorded where applicable.
- [ ] `data-slot`, `data-variant`, `data-source-type`, and other state attributes recorded.
- [ ] BEM classes recorded from `*.styles.ts`.
- [ ] Dependency components recorded (`HoverCard`, `Disclosure`, icons, buttons).
- [ ] Demo data shapes and variants recorded.
- [ ] CSS source or compiled BEM location recorded.

## C. Local diff

- [ ] `diff -rq` run against local vendored directory.
- [ ] Each differing file classified as formatting/type-only, app adaptation, or missing behavior.
- [ ] Local adaptations preserved (host link handling, privacy, data mapping).
- [ ] Missing behavior patched minimally.
- [ ] No whole-file overwrite without dependency check.

## D. Integration

- [ ] Correct local import path used.
- [ ] No `@components/...` example alias.
- [ ] Correct target file identified.
- [ ] Data mapping typed and explicit.
- [ ] Electron external links routed through host API.
- [ ] Remote favicon/asset use approved; fallback available.
- [ ] `data-testid` added only where a test needs a stable hook.
- [ ] No custom visual CSS overriding the component.

## E. Visual parity

- [ ] Demo route and EduProject target open at `1366x768`.
- [ ] Both open at `1920x1080`.
- [ ] Same device scale factor.
- [ ] Default state screenshot.
- [ ] Hover state screenshot (if supported).
- [ ] Focus/keyboard state screenshot.
- [ ] Expanded/collapsed state screenshot (if supported).
- [ ] Long-title/overflow state checked.
- [ ] Empty/loading/error state checked (if supported).
- [ ] Root bounding box matches expected layout.
- [ ] Trigger, icon, title, preview computed styles checked.
- [ ] Spacing, typography, radius, border, background, shadow checked.
- [ ] Light and dark appearance checked if the app supports both.
- [ ] No console/page errors.

## F. Interaction

- [ ] URL trigger opens through the correct host action.
- [ ] Document trigger is non-link and does not open a blank window.
- [ ] Hover preview opens/closes with the expected delay.
- [ ] Preview placement does not clip.
- [ ] Disclosure expand/collapse works and indicator rotates.
- [ ] Keyboard navigation reaches the trigger.
- [ ] Escape/outside click behavior matches source.
- [ ] Remove/clear actions work where applicable.
- [ ] Drag/drop and paste work where applicable.

## G. Tests and evidence

- [ ] Focused Playwright or Electron test added/updated.
- [ ] Test asserts the user-visible contract, not implementation details only.
- [ ] Test runs against the real app, not a mock-only render.
- [ ] Report path and exact command recorded.
- [ ] Screenshots saved.
- [ ] Unverified items listed explicitly.
- [ ] No “100%” claim without comparison evidence.

## H. Handoff

- [ ] Files changed listed.
- [ ] Source commit listed.
- [ ] Known gaps listed.
- [ ] Local adaptations listed.
- [ ] Next component dependencies listed.
