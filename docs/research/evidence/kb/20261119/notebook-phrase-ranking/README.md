# 题本把完整题干优先排到首屏

自然资料冷读显示，粘贴一段已存题干时，旧题仍在结果里，却被只匹配拆分关键词的较新题挤到首屏以外。题本与 Pi 共用召回条件，题本在分页前只按收藏、使用与更新时间排序。

将 Pi 既有关键词覆盖排序抽为共享函数，并让题干字段的完整字面短语优先。两条入口继续先应用硬筛选和来源权限，再排序分页。题本保留收藏、使用时间及题目 ID 作为同等相关结果的排序依据，空查询仍按原浏览顺序。Pi 对明确指定知识点的优先级保持。词面、下标、单位等按原值查询，分析或答案里的完整词句不会获得题干优先级。没有新增依赖、迁移、索引重建、IPC 或模型调用。

| 指标 | 原构建 | 最终构建 |
| --- | ---: | ---: |
| 同一自然题排名 | 1,518 | 1 |
| 匹配数 | 1,577 | 1,577 |
| 热查询 P50，30 次，含 IPC | 87.8ms | 131.2ms |
| 热查询 P95，30 次，含 IPC | 127.3ms | 153.5ms |

以上为同一个自然库、同一段题干的实测。新增排序有可测成本，不能据此证明 10GB 或多查询的性能指标。按 KB-A05、KB-A08 继续独立留出和压力验收。两页之间没有重复结果。最终构建已从题本首屏进入该题并打开两张原图，原题字段摘要和模型调用数与操作前一致。该题的真实答案冲突和来源待核状态保留。

最终 build 通过。独立 IPC 定向验证 7 项，覆盖题干原句、较新的收藏、只出现在解析的原句、学科、分类、短词、分页和空查询。原检索边界 17 项和题号范围 9 项通过。最初尝试复用较旧的独立 Node 环境脚本，它在启动时因 Electron 依赖的动态 require 失败，该轮改用实际 Electron IPC 验证并保留原失败日志。npm audit 29 项既有告警，8 项 high，0 critical。

验证命令从 `apps/desktop` 执行 `npm run build`。把 `EDU_NOTEBOOK_TEST_DATA` 指向本机专用自然测试库目录，执行 `node scripts/education/kb-notebook-phrase-ranking.mjs out`。以已留存原构建目录替换 out 并加 `--baseline` 可重现修复前结果。原边界运行 `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-retrieval-boundaries.mjs`，题号范围将脚本换为 `kb-retrieval-number-scope.mjs`。日志摘要与测试程序身份见 summary.json，修改清单见 MANIFEST.json。

回滚只需还原题本和 Pi 词面排序代码。SQLite 题目、原资产和索引格式无需回退。自然材料图文整理、答案与组卷闭环、约 10GB 和安装迁移验收继续。
