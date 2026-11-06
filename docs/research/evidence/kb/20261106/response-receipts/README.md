# AI原始响应留存与本机查看

## 本轮结果

完整读取的成功HTTP响应先保存原字节、Base64、SHA256和dispatch租约，再做JSON、finish_reason和题目schema校验。图片、PDF页和原生Word执行器共用接收入口。资料详情原AI批次内新增次级折叠查看，支持阶段、时间、字节、摘要、单元选择、空记录、读取错误与重试。正文以React文字呈现，非UTF8以Base64呈现。

复用现有SQLite writer、dispatch租约、provider有界读取、typed IPC/preload和DisclosureCard，无新依赖或本地服务。已整合协作者main至ecc82e6，冻结构建包含其进程计时修改。实现首提交ab27201，后续补齐原生Word共用入口及兼容边界。

本片只完成独立转录的接收留存前置能力。独立最小字面转录协议、宿主派生题面/分区及本地重新解析尚待实现。完整Goal保持ACTIVE，KB-A01～A10仍OPEN。上一轮自然两个批次仍失败，旧自然12题仍待核、完整文档0、正式配答0，保留原记录。

## 已执行验收

命令均在仓库的apps/desktop执行，最终命令均已结束。

| 命令 | 结果 | 证据 |
| --- | --- | --- |
| `npm run build` | PASS，含typecheck | build.log |
| `npm run test:renderer-components` | PASS 246/246 | components.log |
| `node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs` | PASS 220组，基线210+新增10组 | page.log |
| `node --experimental-transform-types scripts/education/kb-native-batch-boundaries.mjs` | PASS 6项及4项来源骨架检查 | native.log |
| `node --experimental-transform-types scripts/education/kb-native-dispatch-boundaries.mjs` | PASS 3项原断言及新增接收记录断言 | native-dispatch.log |
| `node scripts/education/kb-response-receipt-journey.mjs` | 首轮脚本导航失败，已保留 | failure-ui-navigation.log、receipt-prior-1793959014029.json |
| `node scripts/education/kb-response-receipt-journey.mjs "$env:TEMP\omni-source-content-ui-PHDUNf"` | PASS 4组，复用原fixture，无重跑种子 | ui-resume.log、receipt-report.json |
| `node scripts/electron-smoke.mjs` | PASS 207/207，退出0 | electron.log |
| `npm audit --json` | 退出1，既有28项，8高12中8低0严重 | audit.json |
| `git diff --check` | PASS | 提交前再次执行 |

新增10组边界覆盖真实磁盘SQLite的新旧库、幂等迁移、旧租约迟到接收、内容冲突、冷读、跨单元、篡改、非UTF8、空body、BOM、1MiB、闭合输入/访问器拒绝、SQLite备份恢复、无效结果先存后拒绝、关闭留存开关、provider校验次序及存储失败传播。迟到记录更新只保存其预留原始证据，业务结果仍走原租约/来源门禁。

原生Word三项继续验证隐私拦截零发送、暂停前首稿保存、缺必要图保持待核。新增断言分别核对接收记录0条、1条和first/final两条。自定义complete端口仍接收原纯数据参数，只保存其返回内容为completion-content.v1，生产HTTP保存完整provider-envelope.v1。

## 实际Electron路径

种子沿原递归PNG导入、本地OCR/版面、三遍受控HTTP、AI归档与题本路径创建。receipt-seed.log和report.json保留种子3组结果。调用账本calls.json为三次受控响应，receipt-invalid-calls.json为一次无效响应。真实云调用0。

1. 从原资料页进入题目分区、AI批次，展开接收记录，可查看首次、来源、最后整理三份完整provider envelope。
2. 另建批次收到无效HTTP body，先落盘后invalid_response。题库事实不新增，含script的原文被转义展示，实际脚本未执行，未自动重发。
3. typed入口拒绝另一批次的responseId。仅在自有fixture故障注入修改body_sha，实际界面报错，恢复原摘要后点击重试读取成功。该故障在冷启快照前已恢复。
4. 1366×768、1920×1080分别截图。关闭后离线启动，原字节/题库快照不变，网络尝试0，renderer错误0。

receipt-warm-1366.png、receipt-warm-1920.png、receipt-cold-1366.png、receipt-cold-1920.png保留实际截图。报告分别记录读取检查及构建主入口摘要。未将受控provider或全局Electron回归当作自然识别、数学正确性或正式组卷验收。

## 保留的失败与修复

- failure-build.log保留最初可选selected分支的TypeScript错误，已用显式存在判断修正。
- failure-runtime-hook.log保留最初把函数回调传入自定义complete、破坏structuredClone调用方的失败。现保持原纯数据参数，仅在生产transport边界接回调。
- failure-native-legacy-fixture.log保留旧原生派发fixture缺teacher_resources等当前迁移表的失败。补齐fixture结构与统一DeepSeek账号，原三项业务断言保留。
- failure-ui-navigation.log和receipt-failure.png保留首轮脚本未进入资料题目分区的失败。补上当前导航后复用原fixture恢复，未重放已有请求。

## 存储、性能与回滚

新增material_ai_response_receipts为不可重建原始接收证据，随SQLite备份迁移。每个完整body上限1MiB，单批沿原400次调用限制，Base64约增加1/3存储。列表只读取所选单元的最多400条元数据，正文按需读取。SQLite备份测试证明该表原字节恢复，整产品异机迁移仍待验收。

较71ef6b4的冻结产物，最终未压缩main由4294355B增至4302587B，增加8232B。preload由40704B增至40801B，增加97B。renderer主入口由7904646B增至7910590B，增加5944B。变化包含协作者进程计时修改，未单独归因。frozen-build.json与frozen-after.json逐项一致，专项UI使用同一最终main摘要86cc1d7b665745fe64f9cb63cd4c04c432ddc4c41338c51f41a2a96bd1a5abfd。

未增加依赖。新增落盘成本、吞吐、峰值内存、实际40GiB、72h及整请求SLO本轮未测。

OMNI_EDU_AI_RESPONSE_RECEIPTS=0停止新请求的接收留存，保留表和读器。旧二进制降级未验。非2xx、中断及超限body未完整读取，只保留已准备记录。input_sha绑定单元输入快照，尚无完整请求证明，后续本地重新解析需补齐冻结请求与来源证据。

## 下一执行项

完成最小独立字面转录协议，宿主依据冻结裁图/版面派生题面和来源分区，图义与字面分开，未知印刷标签仍保留原文。随后验证自然题目完整性与答案配对，继续120题留出、200查询、三套组卷蓝图、真实10→40GiB/72h及普通Windows链式安装/换机。PDF仍作验收资料。
