# A04 permission button/menu: finite manual review

2026-11-04. Read-only input: D:\WorkProject\EduProject-sidebar\apps\desktop\test-results\ui-final-cssom-svHHgG

结论：受审关键状态和属性未见意外全局污染。官方交互变量链可复核；既有菜单 padding 为明确批准的本地配置。原报告仍为 PARTIAL，46 literal resolved / 262 unresolved；不将其改为整项 A04 PASS。

完整 raw 与截图各 28 个均核对原报告 SHA；排除 8 个 native 首页按钮样本后，审阅 20 个 HeroUI 样本。20 个 selected computed/computedAgain 稳定；1366/1920 对应 10 组值一致。120 个直接官方 button/menu/dropdown 匹配规则，以选择器和每条 authored declaration 对照本地 @heroui/styles 3.2.2（只正规化空白和属性值引号），并非由颜色相等猜来源。

证据 JSON 保存每个样本的完整直接匹配声明、原始 JSON pointer、computed custom properties、最近继承 token 的声明候选、官方文件位置、CDP 生成文件 range 和 layerTree。range 为 CDP 零基；下列文本位置为一基。这不是 source map，也不是完整 cascade engine。

| 子项 | winner / 变量链 | 实际结果 |
|---|---|---|
| 权限按钮 normal | components .button background-color:var(--button-bg)，ghost --button-bg:transparent | transparent |
| 权限按钮文字 | components .button color:var(--button-fg) → ghost var(--default-foreground) → --eclipse | oklch(.2103 .0059 285.89) |
| 权限按钮 hover | components .button:hover/[data-hovered=true] → --button-bg-hover → ghost --default | oklch(.94 .001 286.375) |
| 权限按钮 pressed | components active/[data-pressed=true] → --button-bg-pressed → ghost --default；sm pressed scale(.98) 胜过基础 .97 | 灰色，matrix(.98,0,0,.98,0,0) |
| 权限按钮/菜单独立键盘 focus | components 官方 focus-visible:not(:focus)/[data-focus-visible=true] ring box-shadow | 蓝色 ring 4px，背景 offset 2px |
| 权限按钮圆角 | components .button calc(var(--radius)*3)，theme.theme.base --radius:.5rem | 四角 24px |
| 菜单圆角 | components .menu-item calc(var(--radius)*2) | 四角 16px |
| 菜单 normal | 无目标 authored 背景，使用 initial transparent；文字继承 app body color:var(--foreground) → 官方 --eclipse | transparent，官方深色 token |
| 菜单 hover | components .menu-item:hover/[data-hovered=true] background:var(--default) | 官方灰色；同时有 native focus/focusVisible |
| 菜单 pressed | components active/pressed transform:scale(.98)；背景由同时 hover 的官方 --default 规则给出 | matrix(.98,0,0,.98,0,0)，官方灰色 |
| 菜单 write-policy disabled | components .menu-item[data-disabled=true] → --disabled-opacity/.cursor-disabled | opacity .5；cursor not-allowed；pointer-events none |
| HeroUI send disabled | components .button:disabled/[aria-disabled=true] 同上 | .5/not-allowed/none；仅共享规则旁证 |
| 菜单 padding | unlayered .pi-permission-menu [data-slot=menu-item] | block 8px / inline 10px，批准的既有 compat |

theme token 来源为官方 :root,.light,.default,[data-theme=light],[data-theme=default]，CDP layers=theme/theme/base。代表权限按钮最近 token 位于 inherited[3]，菜单 inherited[1]；各样本位置单独保存在 evidence.json。

focus 链：--tw-ring-color → --focus → --accent = oklch(62.04% .195 253.83)；--tw-ring-offset-width → --ring-offset-width=2px；offset-color → --background=oklch(97.02% 0 0)。ring 公式 calc(2px + 2px)=4px。其他阴影项为透明零尺寸。已经查看留存按钮及菜单 focus PNG，均能看见对应蓝圈。

outline-style:none 为官方规则；normal outline-width 3px 或 UA focus outline-color 并不表示有画出的 outline，不能当污染。菜单 hover/pressed 的 native focus/focusVisible=true 不代表官方 ring 选择器匹配：官方使用 :focus-visible:not(:focus) 或 data-focus-visible=true。对应 raw 未包含 ring 匹配规则，shadow:none；独立键盘 focus raw 则包含并画出 ring。不存在已证的 app shadow 覆盖。

关键原始位置：

- .button — composer-permission-1366-normal-cdp.json /matched/matchedCSSRules/9; heroui-pro-WPeDvs3H.css:2:66813; layer components
- .button--ghost, .button--outline — composer-permission-1366-normal-cdp.json /matched/matchedCSSRules/15; heroui-pro-WPeDvs3H.css:2:71027; layer components
- .button:hover, .button[data-hovered="true"] — composer-permission-1366-hover-cdp.json /matched/matchedCSSRules/16; heroui-pro-WPeDvs3H.css:2:69414; layer components
- .button:active, .button[data-pressed="true"] — composer-permission-1366-pressed-cdp.json /matched/matchedCSSRules/16; heroui-pro-WPeDvs3H.css:2:69289; layer components
- .button--sm:active, .button--sm[data-pressed="true"] — composer-permission-1366-pressed-cdp.json /matched/matchedCSSRules/17; heroui-pro-WPeDvs3H.css:2:70249; layer components
- .button:focus-visible:not(:focus), .button[data-focus-visible="true"] — composer-permission-1366-focus-cdp.json /matched/matchedCSSRules/17; heroui-pro-WPeDvs3H.css:2:68551; layer components
- .menu-item — permission-item-1366-normal-cdp.json /matched/matchedCSSRules/5; heroui-pro-WPeDvs3H.css:2:96694; layer components
- .menu-item:hover, .menu-item[data-hovered="true"] — permission-item-1366-hover-cdp.json /matched/matchedCSSRules/9; heroui-pro-WPeDvs3H.css:2:99044; layer components
- .menu-item:focus-visible:not(:focus), .menu-item[data-focus-visible="true"] — permission-item-1366-focus-cdp.json /matched/matchedCSSRules/9; heroui-pro-WPeDvs3H.css:2:98385; layer components
- .menu-item:active, .menu-item[data-pressed="true"] — permission-item-1366-pressed-cdp.json /matched/matchedCSSRules/9; heroui-pro-WPeDvs3H.css:2:98955; layer components
- .menu-item[data-disabled="true"] — permission-write-policy-1366-disabled-cdp.json /matched/matchedCSSRules/8; heroui-pro-WPeDvs3H.css:2:100850; layer components
- .button:disabled, .button[aria-disabled="true"] — composer-send-1366-disabled-cdp.json /matched/matchedCSSRules/19; heroui-pro-WPeDvs3H.css:2:69118; layer components
- .pi-permission-menu [data-slot="menu-item"], .pi-command-menu [data-slot="menu-item"] — permission-item-1366-normal-cdp.json /matched/matchedCSSRules/8; index-xjWaGgQ_.css:626:43; layer unlayered

全局 CSS 交叉核对：实际冻结 index-xjWaGgQ_.css 中旧 :root #111827/--accent:#002fa7（4320）、button（4344）、disabled opacity .62（4346）、权限橙色文字（1583）均在 @scope (:root:not([data-edu-modern])) 的 HeroUI 排除边界内。main.tsx 设置 data-edu-modern。这些规则没有出现在上述目标的直接匹配规则中。domain button（2833）/disabled（2846）在 .edu-domain 到 [data-slot]/.button 等边界的 scope 内，也没有匹配这些目标。

权限按钮直接 app 匹配为零；菜单唯一直接 app 匹配是许可的 compat padding。菜单文字确实有 app body color:var(--foreground) 的继承一步（冻结 4314），但变量是官方 token；不能笼统说所有颜色声明都来自官方。compat 来源 src/renderer/heroui-pro/components/prompt-input/prompt-input.compat.css 约 67–71；冻结规则 625，声明 626–628。正常 unlayered author 声明高于 components layer，故 padding 的本地获胜有明确原因。

本地 official dist SHA 为 4d7cc0ccc2b0ac66df4d38a60ffdfbdcce14f30a449cc4cf7f63299e90e27059，与 heroui-oss-source.json 对应；vendor SHA b614566361d0c79a595efa54d8b92bbc3903b32cb514768d6219c9d5627e5e4d。二者仅 CRLF/LF 差异，正规化后全文相同。没有改 vendor。

有限关闭建议：permission picker/menu 已采样交互的 CSS 归因子项，可用本报告人工签收为“未见意外污染，批准 compat padding 例外”。权限按钮自身 disabled 缺样本，保持 NOT_RUN；send disabled 不能替代。没有证明其他组件/深色/forced-colors/新 build；不把 native 首页按钮算 HeroUI。原 262 unresolved 原样保留。

pressed 边界：picker data-pressed=true 但 native active=false；原 runner seam 记录真实 held mouse、无 forcePseudoState/注入属性。menu pressed native active=true。只按实际匹配分支和状态报告，不伪称 picker 原生 active 已测。

命令：one-off PowerShell here-string | node（读取既有 raw/CSS，写独立报告），最终 exit 0。先前只读提取曾因可选 inherited.inlineStyle 未判空退出 1，无文件写入，已改为可选读取；这是审阅器解析问题，不是产品失败。

写集仅本新目录 review.md / evidence.json；没有生产/QA、Git、Electron、browser launch、network 或 model 操作。读取的是冻结 6x14MH 证据，不代表后续构建验收。
