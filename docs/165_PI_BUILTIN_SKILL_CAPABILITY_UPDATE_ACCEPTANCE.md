# 165 内建技能与真实工具对齐验收

日期：2026-10-04；合同 [164](164_PI_BUILTIN_SKILL_CAPABILITY_UPDATE_CONTRACT.md)。本轮切片通过 A/有限 C，完整目标仍 active / NOT_ACCEPTED。三元题组暂停，无子 Agent、commit、push。

## 1. 实际改动

- 内建技能 v2 使用当前注册的联网、浏览器、文本与 Office 工具。查证要求实际搜索/读取官网正文并区分网页发布时间、落款与实施日期；办公要求真实草稿、目录检查、教师确认及文件回执。
- 冻结 v1 历史定义。复用原 Hana 不可变技能目录、Pi parser、SQLite CAS、原技能 authority epoch；旧目录不重写，关闭状态及教师包保持。初始化 CAS 失败重读获胜者，捕获前后核原文件，损坏/未知版本失败关闭。
- 原无 managed source 的 SDK 兼容 adapter 保持 v1；正式宿主始终使用 managed source/v2。v1 指令身份不随新说明漂移。旧 JSONL 仅追加，新技能上下文不混入已隔离旧指令/摘要。
- 修正原办公协调器错误回执：格式不合法且尚未提出审阅，与实际教师拒绝分开。表格空栏必须补齐单元格；网页只作正文引用，不冒充本地文件版本来源。未提出审阅的格式错误可以修正参数，实际拒绝/停止/冲突仍不能同轮自动重放写入。
- 无新表/IPC/依赖/权限、第二 agent loop 或预算。原 Pi 自动压缩保持。

## 2. 同构建证据与门禁

最终 `apps/desktop/test-results/xiaozhi-agent/pi-skill-capability-build4`：323 文件，SHA256 `a5b2c8e939a50555fb2c01a63241d85a7dc888d1ab586812335e6ba7b90d8c96`，renderer `index-DDPZxs9s.js`。

| 证据 | 结果 | 实际位置/边界 |
| --- | --- | --- |
| 构建/TypeScript | exit 0 | `pi-skill-capability-build4.log`；有既有 chunk 体积/动态静态混用提示 |
| 技能升级 A | 10 / exit 0 | `pi-skill-capability-migration-2Y1X8s/report.json`：真实 SQLite/文件，v1 独立历史 SHA、CAS、失败恢复、捕获时变更、旧 native 身份 |
| 已有技能目录 A | 25 / exit 0 | `pi-skills-management-state-fa8wpt/report.json`，当前技能版本管理；最终补充未改其路径/格式 |
| 已有技能 authority A | 22 / exit 0 | `pi-skill-authority-W5vDGa/report.json`，原 Pi/Hana 读/撤销/缓存/旧 native；后续错误文案不改此实现 |
| 旧 SDK 兼容 A | 14 / exit 0 | `pi-skills-boundary-Pvthr5/report.json`，合成 stream，不冒充真实模型 |
| 办公协调器 A | 9 / exit 0 | `pi-office-coordinator-P3ZdpV/report.json`：新增短行/URL source 在审阅前拒绝、零 wait/ledger/file；原审批、停止等保持 |
| 最终自然 C | 9 / exit 0 | `pi-skill-capability-KmkppR/after-report.json`；同 owned 旧 profile/data 升级，真实 DeepSeek、当前网络 |
| renderer | 79 / exit 0 | `pi-skill-capability-renderer-final.log` |
| 同 build4 桌面 smoke | 207/207、ok=true、exit 0 | `pi-skill-capability-main.log`；该原烟测的模拟 provider 不等于真实模型，真实模型仅上述 C |
| DOCX 独立只读回读 | exit 0 | `pi-skill-capability-KmkppR/word-readback.json`，实际 ZIP/OOXML，不等于 WPS/分页视觉验收 |
| git diff --check | exit 0 | LF/CRLF 提示，不提交 |

命令均在 `D:\WorkProject\EduProject\apps\desktop`：

```powershell
npm run build -- --outDir test-results/xiaozhi-agent/pi-skill-capability-build4
node scripts/xiaozhi-agent/pi-skill-capability-migration-smoke.mjs test-results/xiaozhi-agent/pi-skill-capability-n1RGWT/before-report.json
node scripts/xiaozhi-agent/pi-skills-management-state-smoke.mjs
node scripts/xiaozhi-agent/pi-skill-authority-smoke.mjs
node scripts/xiaozhi-agent/pi-skills-boundary-smoke.mjs
node scripts/xiaozhi-agent/pi-office-artifact-coordinator-smoke.mjs
$env:OMNI_EDU_TEST_BUILD_ROOT='test-results/xiaozhi-agent/pi-skill-capability-build4'
node scripts/xiaozhi-agent/pi-skill-capability-ui-smoke.mjs after test-results/xiaozhi-agent/pi-skill-capability-KmkppR
& scripts/xiaozhi-agent/read-skill-word.ps1 -CaseDirectory test-results/xiaozhi-agent/pi-skill-capability-KmkppR
npm run test:renderer-components
node scripts/electron-smoke.mjs
```

以上 C 命令是已执行记录；脚本拒绝覆盖首次报告，复测需要 `before` 新建 owned case，使用冻结旧构建，然后让 `after` 指向该新 case。A 的最终2Y1X8s已执行；源码记录固定快照，测试目录不进入源归档。

## 3. 正式页面实际结果

`before` 使用冻结旧构建 SHA `0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981`；是升级前观察，5项检查不代表旧 Word 正向通过。

最终 KmkppR：

1. 旧会话原 catalog/目录/JSONL SHA 保留；v1→v2，原关闭的题目分析仍关闭。启动零工具重放。教师包字节/元数据保持由独立 A 实测，本 C 未假装导入自建包。
2. 原选择器/预览显示当前联网及文档生成说明；输入为说明书 NET-01 原文，UI 技能选择由原 Pi `/skill` 展开。
3. 原生真实结果包含 `office_web_search`、`office_web_fetch` 成功，读取教育部通知；答案分别为2022年3月25日落款、2022年4月21日网页发布、2022年秋季学期实施。未靠旧回答冒充联网。
4. 原技能 epoch 给出公开隔离记录，原 Pi active context 不包含旧“未注册联网/没有正式”说明，原 native 文件前缀保留；公开历史继续可见。
5. FILE-04 原文生成 `4周教研计划.docx`。四周实际目标/任务/负责人空栏先审阅后确认，保存前文件不存在，保存后 SQLite `document_artifacts` 与真实文件 SHA/大小一致。
6. 1366×768 / 1920×1080 确认/拒绝按钮可达；实际查看1366截图。不是与 Codex 同 DPI 全页像素比较。
7. 冷重启 catalog/原 native 字节/公开轮次/文件 SHA保持，启动没有工具重放。发送后输入清空。

独立 DOCX 回读：SHA `f5e9f230aece8f2193cecbfd2fad8c453ba2baeec6bdf77f32a32f33149e9d1b`，48段、1表、4个周负责人空单元格，48项审阅文字对应实际 OOXML。可编辑 DOCX 文件已交付；本轮没有再用 WPS 编辑或检查 A4 分页，161的 WPS 证据属于此前另一产物。

## 4. 首次失败与修复轨迹

| case / 构建 | 首次结果 | 判定 |
| --- | --- | --- |
| n1RGWT before / 旧 | 查证成功；办公没有有效审阅产物 | 旧技能仍会调用网络，不能把静态矛盾当联网原故障唯一根因。原 Word 拟不存在子目录，不能当教师已拒绝 |
| n1RGWT after / build1 SHA3ad15b… | 4项后 `assert(table)` 失败 | 测试误强求表格，实际分周正文已满足目标/任务/空栏；保留原报告/截图，修测试，不改用户原文 |
| 132ZIf after / build2 SHA853e8e… | 9项通过 | 中间构建；之后补捕获时源变更防护，不能代替最终构建 |
| MYmfJo after / build3 SHA48c3c3… | 4项后 Word 无有效审阅 | 真正失败：第二次 Office 调用表格末行4格/5列，被宿主拒绝；通用未确认回执使模型误称已审阅。报告中“did not call”是测试错误描述，native证明实际调用后失败，不改原失败 |
| KmkppR after / build4 SHAa5b2c8… | 9项通过 | 最终补严格行列/source说明和审阅前错误分类；独立 DOCX/门禁通过 |

此前四个 before 和两个 after 失败全部保留，不改旧报告。只有最终构建一次正向 C，不称同环境连续3次通过。排查时猜路径/PowerShell First 非数字/只读 SQL 参数缺失等命令失败也保留在执行记录，不当 provider 故障。

## 5. 复用、命中率与运行边界

- [Pi1.0.2官方 Skills 文档](https://github.com/earendil-works/pi/blob/v1.0.2/packages/coding-agent/docs/skills.md)：按需读取与显式命令；本轮沿已接原加载器/展开，不新增加载循环。
- 原 Hana449 `session-skill-snapshot.ts` SHA `da0328be63dfcf7637e3bb0cde84637f7d56fec36d76a7f048eb1355172d0a7d`、`skill-file-identity.ts` SHA `6933c99325b6778b7efe8fdf0010fe57a039166b31b50630d794435f9c790948` 均核对现有 manifest。官方 GitHub文件抓取失败不算远程源码验证；依据本地原源/manifest/实际代码。
- 已调用 HeroUI MCP Modal/Switch/Button 当前文档。现有 Hana SkillRow/Badge/原 HeroUI 组件继续接数据，无新 UI/vendor源码复制；Pro source接口不提供该源码。Finesse沿固定本地设计参考，不假称有Finesse MCP。
- 最终新阶段8个实际 native usage：命中23%、86.92%、79.13%、89.86%、97.79%、98.79%、98.52%、98.84%，原Pi input已扣 cacheRead/cacheWrite。安全指标在 `safe-usage.json`；不能当固定命中率/费用为零/压缩会保留旧授权。没有修改稳定请求、压缩逻辑或累计预算。
- 最终源码SHA：current skills `c13b1cd00cc4af48dbbf64b11599994f9183d30e1b7b0ebc8255769ce83dabb9`；冻结v1 `d526d3c2ec85006aad32e981c1d517eeaf5615db0e8781bdbcd1eeeb29eab674`；manager `332de487baefa98233720f84ddfc4d3a696137cb43376b2b5b131a1eb89e6d4c`；coordinator `206698fe9c560fe0a05799e1009311654404c0b9a15d20bac3f6dd282282917f`；C script `c2c1589bcbf155c88f7fc26d59dd20668fed35b62ddf9d6afb3c0413e88e7c64`。

日常 PID63652 / handle10292696 / RespondingTrue 和原 `out`323/SHA0dd7…保持。仅构建隔离build1–4；未关闭用户窗口、更新日常二进制、修改日常凭证或注入测试。**源码已修不等于当前日常窗口已经运行新版本。** 内建v2 catalog升级后旧二进制降级可能拒绝，不能宣称双向回滚；正式迁移需先确认备份与版本。

## 6. 下轮唯一继续位置

四根→67§1/2/5/8/9→35→本165。继续全 D1–D7 教师入口/现有模型与权限设置的可见路径，以及最终八组同构建验收与 P08 安装/备份恢复准备；先冻结下轮合同。缺Codex Skills/模型/权限参考截图继续独立等待，不宣称一比一完成。

原 NET-USER-001/IMG-USER-001、日常相同输入/配置人工确认、真实无VPN、安装包验收均未关闭。本轮联网关闭/技能停止的新版 C 未新增，原 A 边界证据不升级为 C。用户必须按说明书提供同配置人工复测才能关闭原问题。
