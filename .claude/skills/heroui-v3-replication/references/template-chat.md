# Full-page template replication: template-chat

Use this reference when the target is a complete agent/chat page, not a single
component demo.

## Reference

```text
Source: D:/WorkProject/HeroUIPro/herouipro-v3-latest/packages/template-chat
Repo:   https://github.com/Agile-Avocation/herouipro-v3.git
Commit: eabeaa784ee44f16f50845028ac04f345e9f97c7
```

The demo site is a component browser; `template-chat` is the full agent page:
sidebar + navbar + conversation + composer + search dialog + New Chat / Library /
Explore routes.

## What template-chat contains

```text
src/app/(app)/layout.tsx          AppLayout + ChatShell
src/app/(app)/[chatId]/page.tsx   dynamic thread
src/app/(app)/new/page.tsx        new-chat landing
src/app/(app)/library/page.tsx    library
src/app/(app)/explore/page.tsx    explore
src/components/chat-shell.tsx     AppLayout + Navbar + Sidebar
src/components/chat-sidebar.tsx   thread/nav sidebar
src/components/chat-navbar.tsx    title/search/share
src/components/chat-composer.tsx  PromptInput + model select + attachments
src/components/thread-message.tsx ChatMessage + Markdown + ChainOfThought + ChatTool + ChatSources
src/data/chat.ts                  threads, nav, models, prompts
src/data/showcase-thread.ts       the default showcase thread
```

Components are imported from `@agile-avocation/ui-pro` and `@heroui/react`;
there are no custom wrappers around the Pro components.

## Standalone copy recipe

The safest setup is a sibling package inside the monorepo, because Turbopack
rejects a `node_modules` junction that points outside the project root.

```bash
cd D:/WorkProject/HeroUIPro/herouipro-v3-latest
cp -r packages/template-chat packages/agent-demo
rm -rf packages/agent-demo/.next packages/agent-demo/node_modules
```

Keep the original relative paths (`../ui-pro/dev-src-aliases.mjs`,
`../../../ui-pro/src/css/index.css`, `../../tsconfig.base.json`). Do not copy the
app to an external folder while relying on a node_modules junction; Turbopack
will fail with:

```text
Symlink [project]/node_modules is invalid, it points out of the filesystem root
```

If the app must live outside the monorepo, install its dependencies normally and
do not use a junction. A webpack fallback can work, but verify that barrel exports
such as `TextShimmer` still resolve; a relative webpack alias can silently drop
them.

## Required config tweaks

```ts
// next.config.ts
allowedDevOrigins: ['127.0.0.1', 'localhost'],
```

Use `http://localhost:3005` for Playwright; `127.0.0.1` without this setting can
return 403 for `_next/static` chunks and break HMR.

## Local assets

The template references remote CDN images. Download them once:

```bash
mkdir -p public
curl -fL -o public/egg.webp \
  https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/images/egg.webp
curl -fL -o public/blue-light.jpg \
  https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue-light.jpg
```

Replace data URLs with `/egg.webp` and `/blue-light.jpg`. For the reference
template, map the remote URLs to the same local files in the parity script so
both sides use identical pixels.

## Parity protocol

Run both servers:

```bash
# reference
cd D:/WorkProject/HeroUIPro/herouipro-v3-latest
node .yarn/releases/yarn-4.13.0.cjs workspace @agile-avocation/template-chat dev

# copy (port 3005)
cd D:/WorkProject/HeroUIPro/herouipro-v3-latest/packages/agent-demo
node ../../node_modules/next/dist/bin/next dev --port 3005
```

Then run:

```bash
node scripts/parity-check.mjs
node scripts/interaction-check.mjs
```

The parity script compares:

- exact `data-slot` counts
- body text
- message/source/prompt counts
- computed styles of key containers
- screenshots at 1366x768, 1440x1000, 1920x1080
- top and bottom scroll positions

Successful result observed:

```text
all six screenshot pairs: changed_channels 0, bbox None
DOM/slot/text/style deltas: 0
interaction results: equal
```

Interactions covered: source hover preview, ChatSources disclosure, ChatToolGroup,
ChainOfThought, search dialog, New Chat composer, Library, Explore.

## Pixel-diff gotchas

- The `Thinking...` shimmer and loader dots animate; freeze with
  `page.emulateMedia({ reducedMotion: 'reduce' })` and
  `page.screenshot({ animations: 'disabled' })`.
- Remote avatars can load on one side and fall back on the other; route both
  sides to local files before comparing.
- The Next dev indicator differs between dev and production; compare dev to dev
  for the 1:1 reference, and separately check the production build.
- A search dialog that remains in the DOM after Escape can make a naive
  `getByRole('dialog')` check misleading; compare both sides, not just one.

## Production

```bash
node ../../node_modules/next/dist/bin/next build
node ../../node_modules/next/dist/bin/next start --port 3006
```

Expected routes: `/pro-ai-showcase`, `/new`, `/library`, `/explore` all return
200; only the template's missing `favicon.ico` produces a 404.
