# 00Hhv6 A04 finite manual review

2026-11-04. 结论：本次受审 HeroUI 状态和关键属性未见意外 legacy/global 获胜。既有菜单 compat padding 是明确保留的本地覆盖，不把它误报为官方样式。

输入：`D:\WorkProject\EduProject-sidebar\apps\desktop\test-results\ui-final-cssom-LymTiS`。冻结 source `e0ccbadd10256c2a68c67045f392f4d83612649d5b4e84f6cf315718c9e1a74d`；build `0e9a2be27bfe3c0d93e1592c5a6fc0abb434af24904996e723106dfe00c4e6b3`。

原报告 captureComplete=true、integrityVerified=true、errors=[]，28 raw 与28 PNG的SHA全部复核一致；模型账本前后相等。原报告仍是 PARTIAL/success=false，46 resolved / 262 unresolved，本人工审查不改写原报告、不宣称完整 A04 PASS。

排除8个 native 首页按钮后，对20个 HeroUI样本逐项复核（1366/1920各10个）：permission Button及menu-item normal/hover/focus/pressed，send及write-policy disabled。computed与computedAgain稳定；10组跨宽度关键值和变量值一致。120个组件直接匹配规则，以完整选择器和有序 authored declarations重新比对旧 source-match记录，核实官方源SHA未变，并再次在当前本地官方CSS对应选择器块中核实声明，不以颜色相等推测来源。

官方 dist与vendor仅原始换行字节不同，文本一致；当前冻结heroui-pro-WPeDvs3H.css与旧6x14MH官方bundle字节一致。生成文件、CDP JSON pointer/range、layers、声明及官方位置收录evidence.json；这些是生成位置而非source map。

| 样本（两宽度一致） | background | radius | shadow | opacity / cursor / transform |
|---|---|---|---|---|
| composer-permission-normal | rgba(0, 0, 0, 0) | 24px | none | 1 / pointer / matrix(1, 0, 0, 1, 0, 0) |
| composer-permission-hover | oklch(0.94 0.001 286.375) | 24px | none | 1 / pointer / matrix(1, 0, 0, 1, 0, 0) |
| composer-permission-focus | rgba(0, 0, 0, 0) | 24px | official 4px ring + 2px offset | 1 / pointer / matrix(1, 0, 0, 1, 0, 0) |
| composer-permission-pressed | oklch(0.94 0.001 286.375) | 24px | none | 1 / pointer / matrix(0.98, 0, 0, 0.98, 0, 0) |
| permission-item-normal | rgba(0, 0, 0, 0) | 16px | none | 1 / pointer / none |
| permission-item-hover | oklch(0.94 0.001 286.375) | 16px | none | 1 / pointer / none |
| permission-item-focus | rgba(0, 0, 0, 0) | 16px | official 4px ring + 2px offset | 1 / pointer / none |
| permission-item-pressed | oklch(0.94 0.001 286.375) | 16px | none | 1 / pointer / matrix(0.98, 0, 0, 0.98, 0, 0) |
| composer-send-disabled | oklch(0.6204 0.195 253.83) | 24px | none | 0.5 / not-allowed / matrix(1, 0, 0, 1, 0, 0) |
| permission-write-policy-disabled | rgba(0, 0, 0, 0) | 16px | none | 0.5 / not-allowed / none |

变量与级联复核：

- Button normal background-color:var(--button-bg)来自components .button；ghost将--button-bg设为transparent。hover/pressed分别使用--button-bg-hover/--button-bg-pressed→--default。文字--button-fg→--default-foreground→--eclipse，computed为oklch(.2103 .0059 285.89)。
- Button圆角calc(var(--radius)*3)=24px；menu圆角*2=16px；--radius=.5rem来自theme/theme/base官方root/light/default规则。最近继承token候选在新raw重新提取并比对声明集。
- 独立键盘focus匹配官方focus-visible:not(:focus)或data-focus-visible分支，--tw-ring-color→--focus→--accent；offset宽2px、ring总宽4px，背景offset token为--background。已查看1366 Button focus与1920 menu focus PNG，蓝圈可见。
- Button sm pressed transform .98覆盖基础.97；menu pressed同为.98。Button原生active=false但data-pressed=true，按实际分支记账。
- disabled官方规则使用--disabled-opacity=.5、--cursor-disabled=not-allowed、pointer-events:none。权限按钮自身disabled仍NOT_RUN。
- menu normal背景initial transparent，文字可由app body color:var(--foreground)继承，但token仍是官方值；不宣称每个颜色声明都来自vendor。
- outline-style:none意味着没有绘制outline，UA残留outline-width/color不是污染。menu hover/pressed的native focusVisible不等于官方ring选择器匹配；独立keyboard-focus才有ring。

Layer顺序重新与raw核对：匿名/React Aria层、properties、theme（theme/base及components）、base、components、utilities、unlayered。直接app文件规则仅index-CY9nyxZf.css中的`.pi-permission-menu [data-slot="menu-item"], .pi-command-menu [data-slot="menu-item"]`，padding-block8px/padding-inline10px，unlayered正常高于components，是批准保留的compat。另有React Aria注入touch-action规则，不涉及本次颜色/圆角/阴影/disabled属性。

冻结app CSS旧root深色/#002fa7声明位于现代root排除scope（约4419行起）；main.tsx:10设置data-edu-modern。旧generic button/disabled及domain规则均未成为这20个HeroUI目标的直接匹配规则；没有意外legacy获胜证据。这里证明有限样本，不外推全部消费者。

限制：

- Original report remains PARTIAL, success=false, 46 resolved/262 unresolved; no complete cascade engine or source-map claim.
- Eight native home-paper samples excluded from HeroUI acceptance.
- Permission picker disabled itself not captured; send disabled is only a shared official button-rule witness.
- Light theme at 1366/1920 only; no dark/forced-colors/other pages or builds.
- Picker pressed uses captured data-pressed=true with native active=false; menu pressed has active=true.
- Menus can report native focusVisible during hover/pressed without matching official keyboard ring branch; this is not shadow pollution.
- Only two saved focus PNGs visually inspected in this review; all 28 PNG hashes verified.
- No new application/model/network launch; snapshots are retained evidence, not independently recaptured states.

写集仅本新目录review.md/evidence.json；未修改src/scripts、旧证据、Git或产品数据，未运行Electron/Chromium/模型。有限归因子项可签收，原262 unresolved保持不变。
