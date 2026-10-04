# P04-B3b2 原生记忆上下文隔离基础验收

日期：2026-10-03；M10/M01。交付合同docs/70，用户Codex过程/组件设计docs/67。

**已交付并验证原生分支/授权读取/派生索引过滤基础；正式工具、可见隔离回执和真实DeepSeek记忆引用未接通。B3b2、B3b、P04均不勾完成。** 当前正式页面仍显示modelAccess=unavailable。

## 1. 当前源码交付

- `native-memory-epoch.ts`封装Pi0.80.3公开SessionManager API；run/taint/isolation私有marker只保存authority、安全leaf和main run IDs，不保存第二份记忆原文。首次交付前记录安全位置；授权摘要改变时原生branch，再append使新leaf持久。
- 不用branchWithSummary，不重写JSONL，保留原字节前缀与全部entries。toolResult、由其派生的模型文字/后续用户上下文/compaction均在旧分支；安全前缀保持。重复恢复不重复隔离，多次隔离累积排除main run IDs。
- 检查未知版本、字段白名单、祖先关系与匹配run marker；新run不能将未配对call/result上下文作为安全位置。超过4096排除run身份失败，不静默截断。
- `memory-scope.ts`新增仅main可用authority/readSelected：现有SQLite真源，scope/version/源hash冻结；前后重验，读取/脱敏过程中变更拒绝。只读取显式选择的必要脱敏文本，引用label也脱敏；L3保留真实surface-only来源，不能生成不存在的event refs。
- `compaction-context.ts`新增main排除run参数；派生计划/来源标题/审批文字先过滤再有界投影，原SQLite事实及真实文件效果不删除。默认空排除参数保持既有行为。
- 当前production-host/pi-session尚未调用新模块，SDK默认工具集/prompt未改变；后续必须贯通所有准入点后才切正式modelAccess。

## 2. 复用来源与必要适配

- 原生分支机制直接使用已安装exact Pi0.80.3（MIT），未改node_modules或另建history/模型循环。
- 本机包`dist/core/session-manager.js` SHA256 `b02dea6a07bf2704bdf0d6da64580d8b966347a8405488b866c3f3c424f8c60c`；d.ts `fc085188ad710a955b58acceef5dcf009644bb3d3274ea12be12a45b2781f1cd`。hash只证明本机读到的源码，不代替实际运行。
- 核对`D:\WorkProject\开源\openhanako\lib\memory\memory-search.ts`：Hana以标签/全文搜索和factVisibleInConversationScope过滤频道，cross_channel可由模型参数指定。小智既有教师选中版本是main授权，不能原样复制成模型可扩大范围的接口。因此复用Pi原生branch和本项目事实/脱敏，以私有授权marker适配；不伪称Hana代码已提供教育撤销隔离。
- 本轮没有新增vendor或依赖，没有新许可证、原生二进制、Windows服务；原Pro界面和docs/67设计基准保持，不把基础测试冒称同款视觉。

## 3. 实际测试与证据

命令工作目录：`D:\WorkProject\EduProject\apps\desktop`。证据在`test-results/xiaozhi-agent`，均隔离临时目录。

| 命令 | 结果 | 最新证据 |
|---|---|---|
| `npm run test:xiaozhi-pi-memory-epoch` | TypeScript通过、15/15，success=true、exit0 | pi-memory-epoch-final.log；pi-memory-epoch-svbfqC/report.json |
| `npm run build` | exit0 | pi-memory-epoch-build.log |
| `npm run test:renderer-components` | 79/79，exit0 | pi-memory-epoch-renderer.log |
| `node scripts/xiaozhi-agent/pi-memory-scope-state-smoke.mjs test-results/xiaozhi-agent/pi-control-ui-2AWPBO/data/app.db` | 10/10，success=true、exit0 | pi-memory-epoch-state.log；pi-memory-scope-state-5tkjU2/report.json |
| `npm run test:smoke` | 最新build通过，ok=true、207/207、exit0 | pi-memory-epoch-smoke.log |
| 仓库根 `git diff --check` | exit0，既有CRLF转换提示 | pi-memory-epoch-diff-check.log |

构建/专项与冒烟通过`exit $LASTEXITCODE`传播结果。native最终15项含最后L3 payload适配；之前build和renderer已经通过，最终主smoke重新build最新源码。

### 原生实例15项的验证范围

1. 实际SessionManager追加taint→toolResult→派生回复→appendCompaction；taint只登记一次且仍是祖先。
2. authority变更用branch恢复首次读取前的安全上下文，原文/派生/摘要排除，后续main run身份被标记。
3. 原entries和JSONL字节前缀不变，未追加branch_summary携回旧文。
4. SessionManager.open真实重开文件保持干净分支/排除身份，恢复不重复。
5. 第二次读取在toolResult落盘前模拟停止点，重开后撤销仍隔离，前次排除身份保留。
6. 请求检查拒绝不同/非法authority。
7. 仅修改选择、未实际读取记忆，不丢普通对话上下文。
8. 非祖先/丢失安全位置/未来marker拒绝。
9. 未配对toolCall上下文不能选作新run安全边界。
10. 仅选中当前事实构建必要payload，正文与引用label脱敏，不含原ID/private hash/原document字段。
11. 脱敏过程中改源，最终返回前重验失败。
12. 停用拒绝，关闭返回空，取消无payload交付。
13. enabled但未选任何条目，不读取可用的全局事实。
14. L3真实surface-only来源分类，refs为空，正文脱敏。
15. protectedContext排除派生plan/title/approval文本，安全记录保留，原事实不变。

这些是**真实原生SessionManager/JSONL与确定性合成消息**，不是provider生成的工具/摘要，也不是正式Electron用户路径。主来源读写adapter边界使用受控fixtures；旧DB副本10项另证明增量数据兼容。不能将15项包装成教育记忆云端引用成功。

## 4. 保留失败与教训

- 初次`pi-memory-epoch-native.log`在第3项失败，报告`pi-memory-epoch-NE0c8E`。原生appendCompaction的内存entry带undefined details/fromHook，JSON序列化后字段自然省略，重开entry比较不能按未序列化对象做deepEqual。以JSON规范化比较持久语义，并独立验证原文件字节前缀不变；没有放松文本/entry身份/分支断言。
- 修订后`pi-memory-epoch-native-reviewed.log`13/13；补L3真实来源与未选择全局拒绝后最终15/15，早期报告保留。
- 图谱当前EduProject ready；Hana图谱搜索不足，回退精确本地源码。index_status参数使用project，不是project_name；错误调用没有索引覆盖行为。

## 5. 下一步第一动作：正式纵向接入

沿本合同直接实施，不再换基座或重复泛方案：

1. main冻结authority、run身份；pi-session组装验证原legacy/controls快照后升级独立记忆工具/prompt版本，调用epoch恢复，再用排除run重建protectedContext；原SDK绑定/模型/目录保持。
2. 注册仅本会话的记忆读取工具，不能接受模型指定session/run/任意memory ID或修改教师active事实；首次必要文本交付前记taint。
3. 普通/摘要stream前、每个工具前后、摘要提交前后都check。失效停止所有新请求；等待教师输入/审批时也收敛。运行中明确关闭清空先取消并等待终态，再CAS授权；迟到工具不得返回旧正文。
4. shared错误/公开隔离回执/来源别名/modelAccess、typed preload与正式页面同步；说明旧引用后的模型上下文隔离，原公开历史可查，后续任务可能需要重述。
5. 正式Electron+真实DeepSeek自然调用/引用/压缩/编辑停用/撤销/重启/跨会话/旧JSONL实例和必要门禁通过，才标B3b2/B3b/P04完成。

P05 Skills、按docs/67的P06同款页面与设置、P07办公联网、P08实际无VPN与安装仍在完整目标内。无提交/push、真实教师库改写或系统DNS/代理/VPN变更。
