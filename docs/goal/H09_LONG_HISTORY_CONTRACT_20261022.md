# H09 长历史、增量加载与冷恢复交付合同

状态：`LIMITED_ACCEPTED`

日期：2026-10-22

关联：H09、H06 长历史上下文/数据库门禁、`docs/goal/H09_EVENT_UI_CONTRACT.md`

## 教师结果

辅导教师打开一个包含 1000 轮（用户与助手合计至少 2000 条消息）的既有会话时，应尽快看到最近对话，可以确认“还有较早记录”，按页加载更早消息，并在加载后留在刚才阅读的位置。切换会话和重启应用后只恢复最近一页；历史记录本身和当前未完成运行均不得被改写、重放或伪装成功。

## 当前真实能力与缺口

- `production-host.snapshot()` 当前通过 `getAiConversationSession()` 读取该会话全部消息，再从 `xiaozhi_event_runs` 读取全部 run 快照；`projection.hasMoreHistory` 在生产快照中始终为 `false`。
- `OfficeConversation` 已有“加载较早的消息”视觉入口和 `onLoadEarlier` 参数，但 `PiEducationWorkspace` 没有传入真实分页动作，用户无法展开更早记录。
- `event-projection.ts` 的 `MAX_TURNS/MAX_ITEMS` 不是当前 Pi 生产快照的分页实现，不能把它当成已经接通。
- 现有 `audit.mjs` 只构造 200 条 legacy 消息，验证的是整段历史渲染和 SQLite 读取，不足以证明 1000 轮、增量展开、阅读位置、切会话或冷恢复。
- 当前通用 `ChatConversation` 在非底部时不会主动滚到底部，但向列表头部插入内容仍需保留原 scrollHeight 差，否则阅读位置会跳动。

## 本轮纵向切片

1. 共享契约增加受验证的历史分页输入和页响应；分页游标只接受当前会话中真实存在的 run/message 身份。
2. SQLite 增加按游标向前读取完整轮次的有界查询，默认每页 40 轮，不读取整库消息；首次快照只装载最近一页。
3. Event journal 只装载当前页涉及的 run 快照；不得先读取该会话全部 `xiaozhi_event_runs` 再裁 UI。
4. main IPC、typed preload、renderer 接通“加载较早的消息”；加载失败保留现有消息、焦点和阅读位置，显示可重试状态。
5. 加载成功后向头部追加更早轮次，去重且保持时间顺序；同步更新 `hasMoreHistory` 和 journal cursor。
6. 真实 Electron 使用隔离 data/profile 和 1000 轮合成历史，核验首屏、展开、滚动、切会话、再次冷启；不调用模型或修改生产数据库。

## 数据与安全边界

- 分页只读取当前教师已打开会话，不跨会话、不扫描整库、不改变 DB schema、不删除历史。
- `before` 游标绑定 session 和 user message/run 身份；伪造、跨会话或不存在游标返回稳定错误，不返回其他会话内容。
- 最新页和较早页都属于历史事实；模型继续运行只能使用原有 Pi 会话状态，不因 UI 加载或冷启重放工具、审批或文件效果。
- 空会话、legacy 消息、活动运行和 journal 不可用仍走既有诚实状态；不把加载到的历史当作本轮完成证据。
- 不新增 agent loop、工具执行路径、网络依赖或第三方存储。

## 验收门禁

### 首失败必须保留

先在当前冻结构建和隔离 1000 轮数据上执行测试。若一次渲染全部轮次、没有可操作“加载较早的消息”或分页 API 不存在，保存失败报告、截图、构建 SHA 和脚本 SHA。

### 修复后同构建

1. 初始快照最多返回 40 轮，`hasMoreHistory=true`，最近一轮可见，较早轮次未进入 DOM；记录快照 IPC 耗时。
2. 点击“加载较早的消息”后增加 40 轮，旧轮次可见，无重复 turn/item，焦点仍可用；继续加载直到最早一轮，最终 `hasMoreHistory=false`。
3. 加载期间和失败时现有消息不消失；错误可读、可重试，不创建消息、run、工具或审批事实。
4. 用户离开底部后加载更早消息，视口阅读锚点偏移不超过 24px；不得突然跳到底部或页面最顶端。
5. 切换到另一会话再切回，初始仍为最近一页，没有旧页错误串入新会话。
6. 关闭并重新启动真实 Electron 后恢复最近一页与 `hasMoreHistory=true`；数据库消息数和关键字节保持不变，renderer error 为 0，冷启没有工具事件。
7. 390 窄屏、1366×768 和 1920×1080 下分页入口可达；键盘 Enter/Space 可触发，读屏名称为“加载较早的消息”。
8. `npm run build`、相关专项测试、`npm run test:renderer-components` 和 `git diff --check` 通过。构建通过不替代上述真实 Electron 路径。

## 本轮完成定义

production 首次快照与事件快照均不读取全部 1000 轮；工具入口从主进程到可见 UI 真实贯通；同构建两次真实 Electron 通过；原有历史、活动运行、切换和冷恢复一致；首失败与精确命令、构建/脚本 SHA 保存。任一项缺失，本片保持 `IMPLEMENTING`，H09 整体与 H10 不提升为完成。

## 明确不做

- 不改变 Pi 原生 transcript 的压缩算法。
- 不引入虚拟列表或新 UI 依赖，除非实测证明分页仍不满足可用性且单独冻结合同。
- 不新增聊天搜索、导出、全文索引、学校端或第二 Agent Loop。
- 不以 200 条、组件 fixture、SQLite 单查询或模型自评替代 1000 轮真实 Electron 验收。

## 验收结果（2026-10-22）

- 首失败`pi-long-history-ui-gf8seZ`：旧构建`8375c55...`返回1000轮且`hasMoreHistory=false`，无生产分页入口；报告保留。
- 最终构建`03e62d96c47353d512d7bc979a865fbdaf5058d1df03ea09c7991a3f69aed94f`/373。
- `pi-long-history-ui-so3ADg`与`pi-long-history-ui-fDnlQX`连续两次7/7通过：1000 run/2000消息、首屏40、连续25页到1000、0.25px阅读锚点、切换/二次冷启40、2000消息/1000 run、伪造游标拒绝、三尺寸入口、0 renderer错误和0工具重放。
- 同构建renderer240/240、教师快捷入口9/9、窄屏5视图/8键盘步骤、自然文件+Word14/14通过。
- daily网络副本`kLjoTg`真实搜索和两个正文通过，但`office_browser`因verified task-step准入失败未派发、无browserCapture；保留为H10 OPEN。

本片LIMITED_ACCEPTED；H09整体继续IMPLEMENTING，下一步按用户要求回教师主线，journal gap/reorder/reconnect、真人读屏和全部动态状态不由此关闭。

