# 无标题题页自动配答：实现与证据

复用现有书册标题解析、页B-tree、不可变页回执、配答队列及题本/Pi读取，让没有重复打印试卷标题的后续题页自动关联独立答案册。只沿相同资源/版本/解析代次的连续前页回看，最多32页；两遍题号序列一致且顺增，新章节/试卷屏障、页间重号或回退、缺页/标题分歧/来源变化均停止继承。没有新增模型请求、表、IPC、依赖或服务。

新来源上下文使用xiaozhi.book-section-context.v1，保存在原journal evidence_json；写入事务及后续读取重开实际页回执。控制表增量增加section_policy水位，新库与旧库升级均可运行；一次后台派生索引重建唤醒旧held页，不篡改原AI响应、OCR或付费账本。新页晚到/改变也通过原队列唤醒有界后页。

## 真实结果及范围

- 新13项章节边界、原21项配答及7项结构化来源通过；新套件导入原21项，不加总为不同用例。冻结build、246组件通过。
- 原105ba61导入现场自动从missing_section变为应用已知答案，旧原图、OCR/AI回执与调用次数不变；题本展开实际答案/解析、来源标签、Pi原读取器与双尺寸/冷启通过。本轮新增2项，累计14项包含前轮12项。
- 全新三层目录从可见目录导入和批次授权开始，实际PDFium/RapidOCR/版面/裁图/SQLite/typed IPC/UI与冷启动9项通过，包含新章节处理；两道AI题均取得答案册角色。8条模型响应受控，云请求0，不是自然DeepSeek成绩。
- 同一最终冻结构建共享桌面回归207/207通过，命令exit0，所有本轮验证命令均已结束；完整日志已保留。

没有上传用户原书或使用真实provider；受控资料只证明软件链路和来源约束。配答不等于答案科学正确。本片不关闭KB-A01～A10，亦未重新生成前轮正式卷。完整120自然题、20+10真实网页题、200查询、三套正式成品、40GiB长稳及Windows安装/换机仍开放。

## 精确命令

工作目录为本工作树apps/desktop，各命令独立执行并记录终态：

```powershell
npm run build
npm run test:renderer-components
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-section-inheritance-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-document-boundaries.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-answer-lookup-benchmark.mjs
npm audit --omit=dev --json
```

旧现场的升级/冷读只恢复已归档数据，禁止网络请求，不重新导入或调用模型：

```powershell
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-document-journey.mjs --resume=C:\Users\ZhouXuan\AppData\Local\Temp\omni-folder-books-k4nSHM --figure-crops --continuation-figures --allow-build-change --section-inheritance
```

全新目录只运行一次；模型transport受控，其他处理为实际生产路径：

```powershell
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-document-journey.mjs --folder-pairs --figure-crops --continuation-figures --section-inheritance
node scripts/electron-smoke.mjs
```

最后一条复用test:smoke在build后的原入口，同一前置build已通过。所有UI运行使用源码内Playwright/Electron脚本，没有声称切换到Terra模型。首次三次UI检查因脚本查询/折叠/标签错误失败，原记录保留；按实际源码和截图修复脚本，没有修改产品文案或放宽来源验证。详见[批判复核](review.md)。仓库收尾运行git diff --check。

## 性能、限制与回滚

5000页/10万条合成元数据的热内存SQLite场景，100次32页范围查询中位0.189ms、P95 0.263ms，查询计划使用resource/version/page B-tree范围；不逐题扫描全书。原精确答案查询P95 0.046ms，日志中的更慢baseline是历史已替换的全批次JSON fence，不能算本片新优化。上述均不含图像回执读取、文件I/O、embedding、重排或检索。

实际新增题的typed Pi来源读取：旧现场108.7ms/应用冷启150.8ms，新导入109.4ms/应用冷启160.5ms，各仅一次且OS文件缓存未清，不能当P95或规模验收。新主进程4024618B，相对105ba61的4016612B增加8006B；preload38520B、renderer入口7757761B及其SHA不变。最坏每次来源校验重开32页回执，串行有界但会增加本地I/O；索引待处理时继承来源会暂时返回source_incomplete。并发入库/索引重建下的前台体验仍需A07/A08验证。

生产依赖audit exit1：29项（8高/13中/8低/0严重），无新依赖或锁文件变动。答案页自身无标题的索引传播、跨页规则候选关联及自然分类质量仍开放，见review。

同一新版本设置OMNI_EDU_BOOK_SECTION_INHERITANCE=0可停止新继承，既有上下文读器保留，原事实/原图/付费回执不删。旧二进制控制表裸VALUES不兼容新增列，直接二进制降级未演练；需先在备份副本验证兼容恢复。本目录仅生成的受控资料截图、报告和日志，不包含DB、profile、凭证或用户资料。局部Git属性保留采集字节及终端空白；manifest排除自身hash，源码/构建指纹对应本次Windows运行现场。
