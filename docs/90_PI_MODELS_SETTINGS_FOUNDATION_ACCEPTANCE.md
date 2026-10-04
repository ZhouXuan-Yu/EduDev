# P06c-A 正式模型设置与官方目录验收

日期：2026-10-03。合同docs/89；M10/M01。本轮只完成A；完整P06c的B/C和完整目标继续active。

## 1. 实际交付与来源

- shared `xiaozhi.settings.v1` → 独立model-settings-state/service/API → main主frame gate → typed preload → 正式PiModelSettings与OfficeComposer。无新依赖、表或迁移；配置真源是现有SQLite app_settings。
- `xiaozhi.provider.v1`保存schema1/revision/defaultModel/sealedKey，`xiaozhi.model.<sessionID>`保存空会话模型/schema1/revision。SQLite CAS拒绝陈旧覆盖。正式新Key以Electron safeStorage密文落盘，renderer只见configured/masked状态；密钥表单提交立即清空。
- 复用原固定 `https://api.deepseek.com/v1/models`、10秒、64KiB、32项、版本1/24小时目录缓存。官方移除ID替换缓存，不能让旧模型复活；显式刷新可见网络/认证/缓存过期。输入不允许provider URL/header或未知字段。
- 官方本次实际GET与实际聊天均验证 `deepseek-flash`（DeepSeek-V4.1-Flash）、`deepseek-v4-pro`（DeepSeek-V4-Pro）。目录两模型均声明context1048576/maxOutput393216，当前回复预算仍独立。文档说明见[DeepSeek官方首调用](https://api-docs.deepseek.com/)。没有伪造GPT/Claude角色、推理档位或可用图片工具。
- 默认模型仅影响未选择/未绑定的新会话。空会话可经真实菜单选择并持久化独立模型；已有binding优先，变更全局默认不会破坏原JSONL identity。绑定/有历史会话在A锁定菜单，**同会话原生切换仍须B**。
- 任务启动、配置、工作目录chooser、记忆/预算、Skills管理互斥；验证网络请求前同步保留宿主锁。关闭过程中不发布晚到配置。旧 `settings:*DeepSeek` 在正式Pi模式受同sender/加密服务/锁控制；拒绝切到GLM。Pi-disabled旧兼容路径保留，其旧存储不作为新正式配置真源。
- 旧env与旧DeepSeek配置兼容读取，不销毁用户既有记录。有效结构但Key无法解密时，run失败且不回退到其他Key；公开历史/模型projection仍可读，设置页可明确重新输入并加密替换。未知schema拒绝，不猜测迁移。
- HanaAgent0.449.0 Apache-2.0纯 `SettingsPrimitives.tsx` 与原CSS完整复制，保留LICENSE和source.json原/输出SHA256；2源码共13284字节，LICENSE10760字节。没有引入Hana第二服务器/store/模型循环。既有HeroUI OSS3.2.2 TextField/Input/Dropdown/Button和原Pro ListView接真实数据，CSS只在新页面作用域适配旧全局样式。不是Codex官方同源，也不是完整设置视觉完成证明。

## 2. 最终命令与实际证据

工作目录 `D:\WorkProject\EduProject\apps\desktop`；Windows、独立profile/owned合成数据，未改系统网络/教师库。最终build4 renderer asset `index-CaaHO90h.js`，后续不修改生产代码。

| 命令 | 最终结果与报告 |
| --- | --- |
| `npm run build` | exit0；p06c-build-final4.log |
| `npm run test:renderer-components` | 79/79；p06c-renderer-final2.log |
| `node scripts/xiaozhi-agent/pi-model-settings-boundary-smoke.mjs` | 18/18；ssrYSp；p06c-boundary-final2.log |
| `node scripts/xiaozhi-agent/pi-model-settings-host-lock-smoke.mjs` | 6/6；S8Whnm；p06c-host-final2.log |
| `node --import ./scripts/office-agent/register-source.mjs scripts/xiaozhi-agent/pi-auto-boundary-smoke.mjs` | 11/11；p06c-auto-boundary-final.log；确定性原能力/自动整理边界，不是真实provider |
| `node scripts/xiaozhi-agent/pi-model-settings-ui-smoke.mjs` | 18/18；F4JfSS；p06c-ui-final4.log；真实两模型、Windows safeStorage、重启与修复 |
| `node scripts/electron-smoke.mjs` | 最终build4：207/207、ok=true、exit0；p06c-smoke-final2.log |
| `node scripts/xiaozhi-agent/pi-native-chrome-ui-smoke.mjs` | 最终build4：21/21、exit0；BQfLXH；p06c-native-final2.log |
| `node scripts/xiaozhi-agent/reuse-workspace-components.mjs --verify` | 原Pro32/32、182153字节未改；p06c-pro-source.log |
| `node scripts/xiaozhi-agent/reuse-window-chrome.mjs --verify` | 复制窗口2文件及引用源hash通过；p06c-window-source.log |
| Hana源/复制/manifest三方SHA256比较 | 2源码+LICENSE均匹配；p06c-hana-source.json |
| `git diff --check` 与本轮新增文件空白检查 | 标准命令exit0；新增11文件trailingWhitespace=0；p06c-diff-final.log / p06c-new-whitespace.json |

UI实际实例包含：无环境凭证首次设置、两官方模型目录；入口/双窗口尺寸及发送控件；真实Key表单保存/立即清空/只投影masked、Windows实际decrypt验证；stale拒绝、无效key失败保留配置、无环境凭证重启；空会话独立选择；Flash和Pro实际完成；全局默认Pro时旧Flash继续实际调用；真实active配置busy/停止、副renderer拒绝、旧入口投影/GLM拒绝；owned副本破坏密文后公开历史保持、从页面重新验证加密修复。测试报告/HTML不含完整密钥。

双viewport实际BrowserWindow content设1366×768与1920×1080，model list无横溢出、名称不被旧28px图标列挤成竖排、保存可滚动达到。两个窗口modelTitle实际宽127.20px/高17.14px，恰为一行；不是任意固定宽度门禁。截图是当前实现证据；参考图DPR未知，不能声称整体像素一致。原字节图/报告已保存 `design/codex-2026-10-03/p06-models`，artifacts.json含SHA256/字节，未复制凭证或测试数据库。

## 3. 本轮修复与保留失败

- 首次build1发现当前TS lib无Object.hasOwn及runtime缺旧updatedAt类型：改显式hasOwnProperty和execute实际所需Pick，不扩大TS配置。
- 新Node边界脚本先static import导致源码扩展钩子晚注册，改注册后dynamic import。宿主锁脚本旧owned会话已绑定，chooser未进入；仅在owned副本移除该绑定，仍核原fixture hash不变。
- 首次真实UI xzJx4b定位器错用具名menu，实际HeroUI selection menuitemradio可见；改真实控件role，未删交互。EKAR4y15项、aIrwha/Uv0RT9 17项为中间证据，不冒充最终。
- 截图揭示旧styles.css `.list-view__item-content`全局grid 28px图标列覆盖，修新页面作用域display/padding/border并测名称完整一行。最终前一次gdVWRS测试用了任意150px宽度而自然名称约127px，改核实际flex、宽度>100和实测一行高度，仍检测真实竖排回归。失败报告保留。
- 有效密文无法解密原先也阻塞公开snapshot与Key表单，分离公开model与私有runtime，增加credentialError+显式替换路径；真实owned密文故障和恢复18项通过。原始业务/native历史不改。
- 一次擅加 `-c core.autocrlf=false` 的diff检查将既有CRLF当作尾空白，exit2；不按假告警重写既有脏文件。恢复仓库原规则的标准 `git diff --check` exit0，新增文本独立逐行尾空白0；错误检查日志保留。

## 4. 完成范围与下一第一动作

- [x] P06c-A：官方目录/正式新Key加密设置/新会话默认与独立选择、已有绑定保持、版本/锁/故障恢复、真实两模型/重启实例。
- [ ] P06c-B：四根→docs/67第1/2/5/8/9→35最新→本文；图查Pi0.80.3 `AgentSession.setModel` / `SessionManager.appendModelChange` 与Hana switching，冻结docs/91持久intent/CAS/恢复合同。注册模型、streamFn/nativecompact闭包和identity都须同步，不能只改binding字段或另起聊天。保留历史/审批/授权epochs，真实同一会话Flash↔Pro来回与崩溃/重启，无文件效果重放。
- [ ] P06c-C：完整设置导航/搜索、真实权限/目录/Skills、显示偏好、原归档/备份等教师入口整合与失败状态；旧入口在新完整入口验收前保留。Hana/Pro复用只证明来源，精准视觉须D1–D7实际对照。
- [ ] 完整P06/D1–D7/P07 Office-PDF联网图片产物/P08实际无VPN安装与最终八组。三元题组暂停，唯一Pi/Hana循环、教育scope/本地真源/必要脱敏/教师确认保持。

无提交/推送、真实教师库或系统网络修改；总目标active，不能由A通过推导B/C或完整交付。
