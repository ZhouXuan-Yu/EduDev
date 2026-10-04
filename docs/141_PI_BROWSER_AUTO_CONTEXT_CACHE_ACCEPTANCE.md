# 小智浏览器、Pi最新自动上下文与DeepSeek缓存验收

日期：2026-10-04。合同140，M01/M10。用户本轮要求优先；附件发送138→139已完成，不回到旧D2-C未接入口的检查点。整体Codex体验目标仍active，三元题组暂停。

## 1. 实际交付

- 正式Pi工具新增 `office_browser`，支持导航、页面DOM快照/引用、点击、输入、选择、按键、滚动、等待、标签页、可见窗口、关闭和本地截图。真实Electron WebContentsView，原Pi执行scope/once/取消链；未接Codex CLI，未另建agent loop。
- Hana v0.450.0原SNAPSHOT_SCRIPT提取，保留DOM/ref/group/truncation；必要适配仅删除输入框值及值作为标签的回退。浏览器等待源码原样复制。Apache2、来源、SHA、AST复用脚本和verify保留。公网连接逐请求检查、DNS结果和实际连接IP一致；隔离session、无Node/preload/业务IPC，跨会话引用和旧页面引用拒绝。动作沿现有ask_teacher/typed回答；拒绝无效果，停止无迟到动作。截图仅本地，不能称模型已看图。
- Pi ai/agent-core/coding-agent/tui四包精确锁定1.0.2。使用新ModelRuntime+InMemoryCredentialStore，不读取全局auth/models；resource discovery关闭，只有宿主明确选定的教育资源和native extension。Hana原stream guard通过vendor外streamFn→streamFunction属性适配保留原body；版本正常化显式传1.0.2。
- 使用Pi1.0.2原canonical projection、prepareCompaction/compact/appendCompaction及原自动工具后检查。完整请求预检作为额外保护，发生在native canonical request projection之前；保留当前任务、来源版本、教师拒绝和已授权记忆，失败终止，未提交摘要不成为历史。未保留旧Hana midrun agent-loop覆盖。最新摘要请求原生缓存写入策略保留，另明确关闭cache warming，避免额外周期性请求。
- 正式入口取消模型次数、工具次数、累计token、总运行和教师等待配额，隐藏原预算卡。真实用量schema2记录limitsEnforced=false，兼容旧schema1/settings；真实取消、网络/单次工具超时、模型上下文/单回复输出能力仍有效。未删除旧配置、JSONL、批准/拒绝或业务事实。
- 复用Hana450完整cache-prefix-contract模块，模型/提示词/工具安全指纹写native metadata，原文不入公开报告。变化的本会话事实移至用户任务后，不改静态system/tool前缀。Pi1的system.sections/toolsAdded纳入指纹与完整请求估计。显示实际输入缓存比例，未知不当零，累计用量不当当前窗口。

## 2. 验收证据（全部已确认进程退出）

命令均在`D:\WorkProject\EduProject\apps\desktop`运行，结果保存在ignored test-results；报告不归档profile/DB/密钥/原生私有记录。

| 命令 / 范围 | 最终结果 |
| --- | --- |
| `node scripts/xiaozhi-agent/pi-browser-native-smoke.mjs` | ALHufX：15项，exit0。真实DOM/ref、跨会话、拒绝/确认、旧引用、输入/选择、私网/凭证URL、背景POST、截图、标签页、取消、代理407/403、example.com实际HTTPS、教育部国内站点真实DOM；修复keep-alive重复绑定socket监听后无原警告 |
| `node scripts/xiaozhi-agent/pi-browser-ui-smoke.mjs` | 2ZyInP：11项，exit0。正式聊天实际DeepSeek/Pi→browser DOM/来源/回复、右侧打开真实窗口、无预算卡、1366/1920、teacher拒绝/同意、密码不入native、schema2、停止和实际重启零重放；交互页为owned主进程协议夹具，不冒充第三方实际写入 |
| `node --experimental-strip-types scripts/xiaozhi-agent/pi-102-auto-live-smoke.mjs` | tPD1Dj：8项，exit0。真实官方API、四次实际自动摘要、目标/拒绝/full SHA保留、私有摘要不入公开事件、五轮前缀相同、冷恢复、两次实读工具循环中途压缩且无重复、真实摘要响应后停止不commit、响应后准入失败closed且有实际usage |
| `node scripts/xiaozhi-agent/pi-102-auto-ui-smoke.mjs test-results/xiaozhi-agent/pi-browser-ui-uY2Gak/data` | v9InTC：6项，exit0。明确复制Pi0.80.3已完成测试DB/native，正式旧会话继续/自动摘要/验收码年级恢复/两尺寸/冷重启；原测试DB SHA不变。98304提前阈值仅验收，官方1M能力未改 |
| `node scripts/xiaozhi-agent/deepseek-cache-live-smoke.mjs` | IcQ1L6：四次官方200，input3240；首次hit0，后三次hit3072/miss168，94.8148%。合成固定前缀、变化末尾任务，不代表所有生产任务固定94.8%或100% |
| `node --experimental-strip-types scripts/xiaozhi-agent/pi-unlimited-usage-smoke.mjs` | 4项，exit0：超过极小旧quota仍完成301模型/300工具计数及等待；schema2保存/恢复与schema1兼容 |
| `node --experimental-strip-types scripts/xiaozhi-agent/pi-memory-epoch-smoke.mjs` | 7SczUB：17项，exit0，native撤销/分支/取消/重启/脱敏/受保护事实 |
| `node --experimental-strip-types scripts/xiaozhi-agent/pi-skill-authority-smoke.mjs` | cqQNMx：22项，exit0，真实SDK显式技能/撤销隔离/观察器取消/重启/版本与缓存篡改 |
| `node --experimental-strip-types scripts/xiaozhi-agent/pi-history-model-switch-smoke.mjs` | QSbcmE：26项，exit0，真实SDK/SQLite/旧记录/来源与模型恢复，网络请求0 |
| `node --experimental-strip-types scripts/xiaozhi-agent/pi-auto-boundary-smoke.mjs` | Udn0ol：11项，exit0，native1.0.2真实parent链大工具结果切点，API目录/未知schema/失败truth |
| `node --experimental-strip-types scripts/xiaozhi-agent/pi-education-boundary-smoke.mjs` | bsN9A7：7项，exit0，默认工具拒绝、once/碰撞、真实宿主读写与错误；限额测试为旧兼容模式，正式入口仍不限额 |
| `node scripts/xiaozhi-agent/reuse-hana-browser.mjs --verify` / `reuse-hana-cache-prefix.mjs --verify` | 两项verify成功，原来源/适配与SHA一致 |
| `node scripts/xiaozhi-agent/pi-attachment-entry-source-smoke.mjs` | j6gst3：6项，exit0，原Pro五文件byte-identical、Pi1.0.2/Photon0.3.4/WASM版本许可；不是安装包解码验收 |
| `npm run test:renderer-components` | 79/79，exit0 |
| `npm run test:smoke` | 最终包含build，207/207、ok=true、exit0。构建renderer index-qTz60kcD |
| `git diff --check` | 无空白错误；LF/CRLF提示不当失败 |

实际查看了browser-1366、自动摘要auto-1920截图；报告另外保存两个native尺寸。局部可达与原Pro复用不是整个Codex像素一致验收。

## 3. 失败与修正记录

- 浏览器native首轮ref测试把没有`[ref]`的段落当目标，次轮Node fetch无法直接读取407代理挑战；改为真实引用行、原http状态观测后native通过，未放宽产品边界。
- 正式UI首次加载失败后将Electron runtime改lazy import；第二轮发现历史异步读取的运行状态竞态，main一次重新取settled投影。停止测试误用“停止生成”，核原Pro实际aria-label“停止本轮”后通过。
- 缓存首试16输出上限/default thinking产生200空正文；明确官方thinking disabled/128测试输出后四次200有真实cache metrics，不能将空正文称网络失败。
- Pi1.0.2 compile暴露旧auth/stream/context接口；改新ModelRuntime/Transcript system metadata。未为了TS通过篡改vendor body或关闭类型检查。
- 原efsbuu旧大上下文UI沿65536早阈值失败context_limit，该历史样本不算最新版通过。新的98304明确测试阈值使用真实旧浏览器副本完成正式验收；真实生产官方能力1M未改。保留失败，未删除旧JSONL或假摘要。
- 技能测试旧“教研纪要”断言包含仍有效内置技能目录通用词；新版system消息现在在messages内。改为验证唯一已交付custom body sentinel被撤销、当前技能目录不含其name，22项通过。
- 最新prepareCompaction按parent链构造canonical path；旧无parent数组只剩最后一条，修正测试为真实JSONL父链后最新原切点通过，不恢复旧补丁。
- 国内网站多个HTTP keep-alive请求暴露同一socket重复挂监听；用WeakSet仅登记一次，最终15项通过。

## 4. 依赖、来源与边界

四Pi直依赖1.0.2，MIT，coding-agent npm包压缩7,467,472/展开22,716,526字节；本机coding-agent目录含嵌套依赖34,415,957字节，Photon0.3.4 Apache2/WASM 2,265,687字节。SDK新增chord/codemode/mcp等传递包，Node>=22.19；当前Node24和Electron实测可用，Windows打包与无VPN仍P08。install退出0，旧加载中的clipboard DLL清理EPERM未强删，保留现场；npm install审计5项尚未做独立修复，无提交。

主依据：

- [Hana450源码](https://github.com/liliMozi/openhanako/tree/v0.450.0)：浏览器快照、等待、cache-prefix直接复用；源码许可/SHA在vendor manifest。Hana450本身仍Pi0.80.3，不伪称Hana已升级。
- [Pi1.0.2](https://github.com/earendil-works/pi/releases/tag/v1.0.2)及[原生compaction](https://github.com/earendil-works/pi/blob/v1.0.2/packages/coding-agent/docs/compaction.md)：本轮实际锁定与执行。
- [DeepSeek官方缓存](https://api-docs.deepseek.com/guides/kv_cache/)与[thinking配置](https://api-docs.deepseek.com/guides/thinking_mode/)：自动缓存/完整持久前缀/按次命中与未命中，不以累计输入判断窗口。
- [OpenCode现有compaction源码](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/compaction.ts)：比较其独立摘要/序列化最近上下文方案；小智继续Pi原SDK规范，未复制另一agent运行器。相关GitHub issue只作失败线索，不能当已实现事实。检索到的DeepSeek harness translate路径404，未宣称复用该不可核源码。

浏览器工具不含文件上传/下载、任意evaluate、全局浏览器cookie或自动账号登录；页面写入仍教师确认。网页和模型输出都不是权限。截图仍本地，D3/D4前不显示“模型已查看图片”。真实教育部网站可读不等于VPN已关闭、任意国内网络或已部署。

## 5. 下一步

用户本轮浏览器/运行配额/最新版压缩/缓存切片已完成；整体目标保持active。唯一继续位置：四根→67§1/2/5/8/9→35→132/139/本报告，冻结D3合同并完成已发送附件按本会话ID的必要正文实读、学生图片本地OCR/教师校正脱敏、明确公开图片的Pi原视觉，再D4真实“已查看”回执；随后E、全D1–D7、未知官方Skills/设置参照、P08无VPN/Windows安装与最终八组。未经用户授权不子agent、commit/push或远端发布。

收尾已同步四根及26/28/35/67/140，git diff --check无错误。启动前无Electron进程；沿此前用户启动授权加载最新out/main/index.js/default真实profile，无测试data root/E2E/凭证维护。实际PID22052/Omni-Edu Agent/非零窗口handle/Responding=True，保留此用户窗口；窗口启动不是实际教师资料会话或无VPN验收。
