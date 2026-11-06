# M04 大库全文检索统计优化

## 结果与教师路径

复用 SQLite FTS5、原资源过滤、writer、后台 pump 与原界面。两个 v1 派生表保存逐资源片段/隐私数量、FTS 行数及回填游标，增量触发器覆盖新增、删除、隐私和归属变化。原事实与统计处于同一事务。新旧库按每次最多 20 份资源回填，未就绪资源在同一个查询快照中直接精确计数，命中仍经过原权限与来源认证。

实际资料页选择两级目录，导入 64 份生成 Markdown，后台解析并索引，关键词查找、打开原文、typed 来源读取、1366×768/1920×1080 及冷启动一致通过。最终界面流程 3 项、renderer 错误 0、网络尝试 0、云调用 0。SQLite 只读核对覆盖统计与 FTS 数，原文件摘要不变。

初次运行有一份资料38.md 被 hana-anydoc-0.1.2 标为 parse_failed，现场使用教师“重新收录”后恢复至 64 份。失败根因尚未确认，自动导入可靠性仍有缺口。原运行还遗漏新版“检索正文”折叠入口，随后脚本已适配并使用唯一命中控件，保留 failure-journey.json/log、manual-recovery.json 和早期成功记录。最终 journey.json/log 复用既有目录与数据库，完成检索及重启，未重新导入来覆盖原失败。

## 性能范围

| 磁盘数据集 | 原路径热查询 P95 | 优化热查询 P95 | 比较方式 |
|---|---|---|---|
| 100,000 片段，约 67.7 MB SQLite | 85.20 ms | 1.25 ms | 同库各连续 20 次 |
| 1,000,000 片段，约 688 MB SQLite | 1456.22 ms | 2.87 ms | 同库各连续 20 次 |
| 同一百万片段数据库 | 1410.79 ms | 17.40 ms | 原路径与优化路径交替各 20 次，主要比较 |

计时对象是实际 MaterialFullTextSearch.candidates，包含 FTS 命中、覆盖范围、索引状态和未解析统计，resolveOffsets=false。每次断言命中 ID、覆盖数量、隐私排除数量与索引数量相同。数据由 SQL 构造且重复度较高，批量预填 FTS，不能代表真实文件导入吞吐、中文语义 Recall、embedding/reranker、IPC、整请求延迟或 40GiB。fields coldMs/coldSqlMs 表示本进程首次查询，创建数据后的 OS 缓存仍在，不能解读为操作系统冷缓存。

首次未回填的百万片段查询约 650 ms，一次完整回填约 670 ms，其中初始 FTS 行数需要一次全表 COUNT。生产回填按资源预算推进，单资源及初始化 COUNT 的耗时未设硬时限。交替报告 rssBytes=115597312 是结束快照，峰值内存尚未测量。索引写入增加几次轻量 SQL，实际导入吞吐影响仍待量化。

## 验证与命令

命令均在 apps/desktop 执行。各命令最终已结束，生产构建在专项流程和共享回归前后摘要一致。

```powershell
npm run build
npm run test:renderer-components
node --experimental-transform-types scripts/education/kb-search-statistics-boundaries.mjs
node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs
node --experimental-transform-types scripts/education/kb-retrieval-boundaries.mjs
node scripts/education/kb-search-statistics-journey.mjs
node scripts/education/kb-search-statistics-journey.mjs "$env:TEMP\omni-search-statistics-ui-bKzepd"
node scripts/electron-smoke.mjs
npm audit --json
```

| 检查 | 结果 | 证据 |
|---|---|---|
| build/typecheck | PASS | build.log |
| 组件状态 | 246/246 PASS | components.log |
| 新统计边界 | 6 PASS | boundaries.log |
| 页归档与恢复基套 | 204 PASS | page.log |
| 检索事务与代际基套 | 17 PASS | retrieval.log，向量端口受控 |
| 实际目录/检索/冷启 | 3 PASS，初次解析失败经重试恢复 | journey.json 与原失败记录 |
| 同一冻结构建共享 Electron | 207/207 PASS | electron.log、frozen-after.json |
| audit | 28，8高/12中/8低/0严重 | audit.json，退出1，依赖未改 |

生成磁盘基线在改动生产实现前运行，根目录以各 JSON 为准。原始脚本当时没有配对选项，目前脚本可通过 kill switch 在同库再次对照。

```powershell
node --experimental-transform-types scripts/education/kb-full-text-scale.mjs 100000 "$env:TEMP\kb-full-text-100k-before.json"
node --experimental-transform-types scripts/education/kb-full-text-scale.mjs 1000000 "$env:TEMP\kb-full-text-1m-before.json"
node --experimental-transform-types scripts/education/kb-full-text-scale.mjs 100000 "$env:TEMP\kb-full-text-100k-after.json" "$env:TEMP\omni-full-text-scale-SGVhC9"
node --experimental-transform-types scripts/education/kb-full-text-scale.mjs 1000000 "$env:TEMP\kb-full-text-1m-after.json" "$env:TEMP\omni-full-text-scale-bPFzfO"
node --experimental-transform-types scripts/education/kb-full-text-scale.mjs 1000000 "$env:TEMP\kb-full-text-1m-paired.json" "$env:TEMP\omni-full-text-scale-bPFzfO" --paired
```

## 文件、兼容与回滚

- material-search-statistics.ts 新增派生统计迁移、精确回填和共用 FTS 写入。
- material-full-text.ts 接入统计与既有后台 writer，原片段/AI 还原正文的 FTS 写入统一维护计数。material-ai-text-index.ts 复用同一操作。
- 三个新脚本分别验证事务边界、规模查询与实际 Electron 用户路径。新增依赖、IPC、服务与云调用均为 0。
- 旧数据库、新数据库、部分回填、写入/归属/隐私变更、删除、事务回滚、独立 WAL 读者、资源过滤、正负 FTS rowid、重启与重建均与原 COUNT 独立比较。
- 设置 OMNI_EDU_MATERIAL_COVERAGE_STATS=0 并重启可恢复原计数读取，保留表、触发器、FTS 写入维护及原件。旧二进制降级尚未验证。
- 相对 8925b0e，main 未压缩构建增加 5885 B，preload 与 renderer 不变。build-performance.json 保存前后摘要，frozen-after.json 保存最终只读复核。

## 尚未完成

完整 Goal 保持 ACTIVE，KB-A01～A10 保持 OPEN。旧自然 12 题仍待核。自然题文档与图文归属、OCR/DeepSeek 真实质量、答案冲突、120 题留出、200 查询、三套正式蓝图、真实 40GiB/72h、普通 Windows 链式安装与数据迁移继续按执行索引推进。本轮先移除了与整库片段规模线性增长的两处查询统计开销。
