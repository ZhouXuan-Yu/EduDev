# 左侧导航栏折叠与底部设置

范围：2026-10-31 用户指定的最小侧栏重构。从 `origin/main ef55c53` 创建 `codex/sidebar-navigation-20261031`，开发目录 `D:\WorkProject\EduProject-sidebar`。D盘日常目录的3处Anatomy文档改动保持独立；其他工作树不切分支、不覆盖文件。

## 审查与实现

原 `EduNavigation.tsx` 的分组按钮点击后直接跳转组内第一个页面，没有折叠状态。设置属于中间滚动列表中的“系统”分组；底部另有 `.edu-local-note` 提示。已有正式侧栏为应用自有组件，不是原厂 Pro Sidebar；已安装库中的披露实现未用于此处。故采用小型应用自有 disclosure，而不改变原厂组件的配置与 CSS。

- 保留 `PAGE_CONTRACTS` 的15个页面元数据、既有 `navigation.navigate({view})`、设置路由、图标和 `disabled` 守卫。分组配置仅列工作/资料/教学/学生，并从原元数据派生条目。
- 标题只展开/收起，不再导航；原生 `button` 支持 Enter/Space、焦点和 `aria-expanded/aria-controls`。折叠后 `inert/aria-hidden` 移除不可见子项的键盘与无障碍访问。
- 多组独立展开，默认全展开。复用已有本地 UI 偏好模式：`xiaozhi.ui.navigation.v1`，schema=1，仅保存4个boolean，不扩充业务/权限状态或覆盖 `xiaozhi.ui.v1`。
- 切换页面或使用历史导航自动展开目标分组；目标进入导航视口后停止自动滚动，手动折叠不会反复抢回滚动。减少动画模式同样执行目标可见性检查。
- Flex列：品牌不缩小，中间nav `min-height:0;flex:1;overflow-y:auto`，footer `flex:none`。侧栏外层 `overflow:hidden`，仅nav滚动。底部留16px边距，无绝对定位。
- 180ms的grid行高与Chevron旋转动画；`prefers-reduced-motion:reduce`取消过渡。折叠结束高度0，没有隐藏项残留空白。
- 原有浅色、圆角和选中配色保留。普通Hover、按下、键盘Focus及当前页高亮可区分。删除专用本机保存提示及CSS；不改SQLite、资料路径、IPC或持久化业务。

## 文件与职责

| 文件（仓库相对路径） | 目的 |
| --- | --- |
| `apps/desktop/src/renderer/ui-system/EduNavigation.tsx` | 配置驱动的四组导航、目标可见性、底部设置 |
| `apps/desktop/src/renderer/ui-system/NavigationGroup.tsx` | 独立折叠组件、ARIA、原生键盘语义 |
| `apps/desktop/src/renderer/ui-system/navigation-preferences.ts` | 版本化本地UI偏好、容错、路由自动展开 |
| `apps/desktop/src/renderer/ui-system/navigation.css` | 独立自有样式、三段布局、180ms与减少动画 |
| `apps/desktop/src/renderer/ui-system/layout.css` | 移出原侧栏样式并删除本机提示样式；其他布局保留 |
| `apps/desktop/package.json` | 注册 `test:sidebar-navigation` |
| `apps/desktop/scripts/sidebar-navigation-ui.mjs` | 独立profile/数据根的正式Electron交互、15页、导入/SQLite/冷启、双尺寸及状态截图 |
| `apps/desktop/scripts/product-navigation.mjs` | 测试按真实目的页定位，替代把分组标题当链接 |
| `apps/desktop/scripts/daily-entry-smoke.mjs` | 检查4个折叠组与底部设置，保留学生保存/冷启等原断言；补齐新工作树test-results父目录 |
| 其余既有导航测试脚本 | 仅迁移旧 `product-nav-*` 选择器到真实导航项；动态空间定位复用helper。设置保存期间仍断言全部18个nav按钮禁用，另由专项检查底部禁用 |
| 根四份协作文档、本目录报告与截图 | 记录可核验实现、已知门禁失败和回退边界 |

完整文件清单随 `evidence.json` 的 `changedFiles` 保存。测试脚本的选择器迁移不等于其全部业务路径本轮均已运行；付费AI、安装包和40GB资料测试未执行。

## 验证与证据

最终精确结果见 [evidence.json](evidence.json)，包括构建指纹、CSS视口、computed styles、测试命令与已知失败。截图均来自正式Electron页面和隔离合成资料，不是静态样张；教师视觉接受仍由用户确认。

- [1366展开](expanded-1366.png) / [1366收起](collapsed-1366.png)
- [1920展开](expanded-1920.png) / [1920收起](collapsed-1920.png)
- [Hover](settings-hover.png) / [Focus](settings-focus.png) / [当前页](settings-active.png)

1366×768下nav可视570px、内容656px，内部滚动；1920×1080下内容可完整展示。footer滚动前后位置不变，底部留白至少16px，无文档横向/纵向溢出。

## 遗留与回退

1. `test:ui-contracts` 在既有PromptInput指纹失败：`prompt-input/index.ts`预期671d52…、当前1459eb…。其余4个PromptInput文件也与旧记录不符；不是换行差异。当前主线于effc6c0已有输入附件/权限/命令菜单变更，本轮未改vendor或放宽指纹断言。
2. `production-bootstrap-ui.mjs` 在第一次导航前的等待断言失败：实际记录 `aiConversations:list,xiaozhi:enabled,xiaozhi:enabled`，预期全部只有enabled。没有渲染异常；本轮未改启动、IPC、数据或运行时逻辑，不删除该断言掩盖问题。
3. npm audit已有45项（8高/29中/8低/0严重），exit1。无新增依赖或自动升级。仓库未配置lint脚本/ESLint配置；执行TypeScript构建和所有修改脚本的Node语法检查，不声称Lint通过。
4. 未测整应用P95/流式性能。本轮只增加4组UI状态、小型CSS过渡和本地偏好写入；不加入模型请求、轮询、数据库或网络依赖，不把构建通过当作产品全量验收。

回退可独立revert侧栏提交（不重置/清理协作者目录）；新增localStorage键可保留，旧版本忽略它。资料和数据库无迁移，不删除真实数据。不要对合成测试资料或截图宣称真实教师任务验收。
