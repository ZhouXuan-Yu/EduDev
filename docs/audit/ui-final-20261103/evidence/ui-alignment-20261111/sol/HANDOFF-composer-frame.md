# 新批准的应用输入区外框修复

用户已单独批准恢复应用自有输入区外框与工具栏布局。本项沿用paper R2计数，独立记录新增授权。生产写集仅apps/desktop/src/renderer/ui-system/chat.css，现已冻结。

根提供的R2after身份为source 23dd7f、build 0607f3a4，已有官方build、246组件、9隔离检查通过。上述证据保留原身份，本次新增外框授权需由根生成相应构建并验证运行时快照。

## 来源与范围

从未导入的ui-system/workbench-pages.css提取以下两组既有声明，加入已加载chat.css并限定.edu-chat祖先。实际OfficeComposer包含应用自有div.wb-input-frame和div.wb-composer-tools。

| 精确selector | 本次授权的声明 |
| --- | --- |
| .edu-chat .wb-input-frame | border 1px solid #e3e5eb，border-radius 16px |
| .edu-chat .wb-input-frame:focus-within | border-color #91a5c9 |
| .edu-chat .wb-composer-tools | display flex，flex-wrap wrap，align-items center，gap 4px 8px，padding 6px 8px |
| .edu-chat .wb-composer-tools > :last-child | margin-left auto |

共4条规则、9条声明，与原文件属性和值逐项一致。现有CSS加载入口保持原路径，本次插入块只含上表声明。

## Manifest与保护快照边界

composer-frame-manifest.json保存单文件前后SHA、原声明来源SHA、四条规则、21份其余owned文件hash和OfficeComposer/OfficeComposerState/PromptInput目录内采样源码hash。static-check-current.json为当前22份owned文件的全量清单，static-check-repair2.json仍记录此前R2冻结。

本次chat.css前SHA为 `5d8bbd02b543bc5fd59b5a1322cd277e1c920234f0460c46548a72be8bca4a78`，后SHA为 `099d47031cac7ce14b138921634bb78da98a207717855135479e1cf94e1ffbe0`。

保护快照对上表列出的应用节点属性采用本次授权边界。输入外框的四边宽度/样式/颜色、四角圆角以及focus-within颜色属于授权差异。工具栏的flex排布、换行、对齐、row/column gap、容器padding和最后一项margin-left属于授权差异。外框新增边框会改变可用内宽，工具栏布局会改变控件矩形及菜单锚点位置，这些几何变化需关联对应布局声明核对。

官方控件的font-family/font-size/line-height、内部padding/颜色/圆角/状态、菜单内容/配置/交互继续使用原保护比较。需将变化追到实际获胜声明与应用owner，源码hash只用于源码身份核对。字号和官方内部样式的比较仍需Terra运行时computed取样。

## 静态检查

- 插入块删除后与授权前chat.css逐字节相同，PASS。
- 其余21份owned源码与采样保护源码前后hash一致，PASS。
- PostCSS解析与四条规则的原声明逐项相等检查，exit0，4/4规则、9/9声明。
- node test-results/ui-alignment-20261111/sol/static-check.mjs，exit0，22份owned源码解析、CSS模块引用及hash通过。
- git diff --check -- src/renderer/ui-system/chat.css，exit0。

## 实际复验待收取

根构建后由Terra检查空首页及已有消息页，三个目标视口下的外框、真实focus-within与工具栏换行/最后一项右对齐，以及附件、IME、发送/停止、审批/技能/命令/模型菜单、Escape焦点与草稿恢复。原业务断言继续适用，实际菜单锚点与获胜CSS来源需绑定新构建快照。本轮尚无新的GUI或computed结果。

回滚仅移除上述注释和四条插入规则，可用composer-frame-manifest.json的beforeSha256复核chat.css恢复到授权前状态。
