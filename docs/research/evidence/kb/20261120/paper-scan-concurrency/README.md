# 自动组卷与后台写入并行

旧版自动组卷先开启 SQLite `BEGIN IMMEDIATE`，再扫描分页候选、校验原件和准备蓝图。扫库期间一直占用唯一写连接，后台导入、索引或教师编辑即使操作其他记录也会等待。在 WAL 双连接复现里，独立导入进度写入直接返回 `database is locked`。

## 修复与修改文件

- `paper-repository.ts` 使用现有只读事务扫描并冻结候选。在短写事务中重新验证会话、执行请求、同请求幂等与替换前置状态，复核已选题的当前来源并原子发布。读写间被改版或隐藏的题会撤回发布，保留原待核卷。
- `db.ts` 与 `paper-sql.ts` 将既有原题可见性策略接入发布复核，继续沿用归档门槛、来源认证和生成题授权。无表迁移、无新增模型调用。
- `paper-boundaries.mjs` 用实际 WAL 连接验证并行写入、源题改版、选中题被隐藏、替换回滚和竞争请求幂等。
- `kb-choice-subtypes-electron.mjs --capacity` 使用已授权试导库隔离副本，增加三个完整蓝图的容量查询和缺额确认反例。

定向对照以第一次候选分页为测点。旧实现同时写入 0 次并报锁，新实现同时写入 1 次并提交；原输出仍为 20 题、100 分，同一请求复用相同 ID。这项对照衡量并发可用性。真实六题物理卷在隔离桌面构建的预览耗时约 1.39 秒，没有等价旧值可比较。

## 真实存量覆盖

原库只读复制，历史题与模型回执未变，新增真实模型调用 0，渲染错误 0。同一物理题库中，每个蓝图要求 `20 × 5 = 100` 分、只选真实原题，沿现有年级语义执行。扫描数为查询到的本学科、年级候选，未分类的历史草稿不在分母。

| 教师蓝图范围 | 扫描候选 | 选中且通过来源核验 | 缺额 |
| --- | ---: | ---: | ---: |
| 初中 | 2 | 2 | 18 |
| 高中 | 26 | 8 | 12 |
| 高三 | 17 | 7 | 13 |

三次查询均扫描完自身范围。另有 6 道实际选择题走正式导航、确认和冷启回读。三个缺额蓝图均保留原题、不给缺额补题、返回 `shortage` 并拒绝确认。这些数据直接说明仅凭现有符合门槛的题无法交付三套 20 题正式卷。

## 测试、边界与回滚

在 `apps/desktop` 运行。

| 测试 | 结果 |
| --- | --- |
| `node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/paper-legacy-source-only.mjs` | 25/25 |
| 同启动参数，`scripts/education/paper-basket-boundaries.mjs` | 45/45 |
| `npm run build -- --outDir test-results/build-kb-paper-scan` | 通过。主进程 SHA-256 `1dd06a3a9705a382f15f02115a1470d2de1b977447cdcdc8e86340cafe20b15d` |
| `npm run test:renderer-components` | 253/253 |
| `OMNI_EDU_TEST_BUILD_ROOT=test-results/build-kb-paper-scan node scripts/electron-smoke.mjs` | 207/207 |
| `OMNI_EDU_TEST_BUILD_ROOT=test-results/build-kb-paper-scan node scripts/education/kb-choice-subtypes-electron.mjs <试导库 data> --capacity` | 六题正式确认，三个不足蓝图核算与拒绝确认，独立冷启 |
| `npm audit --omit=dev --audit-level=high` | 20 项存量通告，5 项 high，0 项 critical。依赖无变化 |

本次修改针对自动蓝图扫描。题篮补额仍沿原事务，后续按实际候选扫描规模评估。三套正式卷、自然题质量、独立检索留出、约 10 GB 持续后台和换机迁移仍待验收。回滚采用普通 revert，保留数据库及已确认产物。
