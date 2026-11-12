# Word卷首信息归属修复

## 本轮交付合同

目标M02/M03/M05。教师导入标准教辅试卷后，标题、日期、科目、评分说明和考生注意进入资料上下文，卷首编号说明被本地跳过；实际公共解题条件和未知图文保留来源。新带图题沿后台OCR、两遍DeepSeek及原题本处理，提高可用自动稿覆盖。

当前148份Word共4541处候选，来源无疑点95，3994处带shared_context、2460处带ambiguous_number。130份存在公共前置信息，105份含考生注意。旧v3按整段判定，未识别的标题会把日期等一并复制到各题；编号考试说明还占用了原文位置。

本轮采用独立word-question-preamble.v4策略，旧v3、v2及历史摘要继续使用原规则。原始块、锚点和题目位置标识保留，已识别卷首说明使用本地非题结果，现有Word分页增加实际题数与非题反馈，目录AI沿原幂等队列跳过说明，直接AI选择说明时返回明确原因。必要共享条件继续出现在对应原题中。

修改范围为Word共享类型、归属索引/卷首分类、仓库升级检查与局部索引、native上下文及原答案冲突检查、目录调度的本地非题处理、原Word/目录前端反馈及定向测试。SQLite业务表沿用原结构，新增当前策略待升级索引。升级前比较原文实际题目的位置和原块身份，位置变化保留word_plan_changed，原已付费输入及教师事实按历史读取。

完成条件为当前真实资料后台升级、说明零模型调用、真正公共条件无丢失、历史来源及原件/题目事实核对一致、取消/重启/并发/坏来源/旧版兼容测试通过，并至少完成一份新的未付费实际带图题OCR与两次真实DeepSeek自动归档。运行受影响专项、build、组件及实际入口验证，记录新旧覆盖、性能、失败及回滚，整合推送main。完整KB-A01至A10继续保留。

回滚使用匹配应用版本和已保留来源历史；当前原件、业务题目及模型回执作为核对基线。未知正文、图表、公式和答案可信度声明保持可定位待核。

## 实际结果

本轮功能16dde17，整合协作者主线4d6139a为a57b4a8，最终范围边界补丁613099f。后续边界补丁限制说明范围在第一题型章节之前，保留无考生注意标记以及章节之后的真实编号题。完整Goal保持ACTIVE，本切片自然自动定稿条件仍待完成。

当前148份Word均已通过原目录后台升级为word-question-preamble.v4，739份历史表示保留。全部4541个原文位置稳定，315处识别为卷首说明，实际题目4226处。来源无疑点候选95→133。126处题间图片归属不确定进入明确待核。该计数衡量来源规则，实际题目正确率及最终可用率继续待验收。315为当前来源索引中的说明数量，本轮实际原目录尚无non_question_preamble完成记录，不能写成315处任务已经跳过。

实际原页面已验证说明选择直接拒绝，新增批次0、模型调用0，显示25道实际题目并排除说明按钮。相邻题浮图警告在原Word按题页面显示。两尺寸下一页按钮可达。

新题question_9341a8cb-68d5-4a03-8b37-5b81b9165c68按原界面提交，来源第12处、印刷第9题。真实本地OCR与两次DeepSeek响应已保存，两遍答案均B、图表描述及题面一致，最终ai_needs_review，唯一疑点ai_mismatch。离线对照证明仅analysis措辞变化，第二遍去掉了开头的t=0时，当前严格signature仍将其判为不一致。这是下一项真实缺陷。本轮没有完成该题自动定稿，也未将其加入正式组卷。模型把标题高三归为高中仍待修复。

221行原资料、1312行正文分块、原3120条题目记录的全行SHA均保持，148份原表示摘要全部可读。当前3126条题目记录。22项unknown中有本轮新增1项，未知请求保留原记录，未重发。精确传输失败原因仍需诊断。原始资料、题图和完整模型回执保存在本地测试根。

## 工程与真实入口证据

最终定向126项覆盖Word归属、SQLite历史、目录调度、原件变化、暂停、并发游标、create后游标落盘前的恢复、来源警告和原答案冲突。命令均在apps/desktop执行，9份脚本明细见targeted-results.json。

```powershell
node --experimental-transform-types scripts/education/kb-word-preamble.mjs
node --experimental-transform-types scripts/education/kb-folder-word-upgrade.mjs
node --experimental-transform-types scripts/education/kb-word-background-upgrade.mjs
node --experimental-transform-types scripts/education/kb-word-question-boundaries.mjs
node --experimental-transform-types scripts/education/kb-word-booklet-boundaries.mjs
node --experimental-transform-types scripts/education/kb-native-dispatch-boundaries.mjs
node --experimental-transform-types scripts/education/kb-native-ledger-boundaries.mjs
node --experimental-transform-types scripts/education/kb-folder-ai-boundaries.mjs
node --experimental-transform-types scripts/education/kb-word-proof-repository.mjs
npm run build
npm run test:renderer-components
```

整合构建与246组件通过。整合实际冷启动验证具体非题错误贯通IPC、零新增批次、新题及历史自动题原图SHA读回和两个视口。最终入口及整树摘要以preamble-integrated-cold.json为准。

综合legacy断言207/207完成，但该次冻结e6affd26f92e、整树44dbd9bf的脚本在临时测试目录清理时EPERM，进程exit1，综合命令保留FAIL。首次可变out运行在构建期间变化，排除其完整版本证明。没有用这些结果覆盖最终未验证范围。

## 性能和依赖

相同148份已解析文档单次对照，旧策略完整索引与摘要368.65ms，新策略354.94ms，兼容比较288.24ms。仅本次小库CPU处理测量，峰值内存、约10GB与后台长期性能尚未验证。未新增生产依赖或业务表，新增局部升级索引idx_material_word_preamble_v4。npm生产依赖audit仍22项，8低、6中、8高。

## 失败记录和恢复

首次启动控制器早于冻结完成，实际加载上一轮入口，已通过原界面暂停并关闭，该次排除本轮功能验收。首次TS构建缺少WordBlock判别收窄，已修正。首次实际非题操作只显示通用错误，修复IPC错误白名单后冷启动出现具体原因。新增浮图边界测试起初把手工题号放在图像之后，修正为真实题号起始的有效结构后通过。

合并后首次组件测试发生Vite 60000ms transport timeout，构建结束后顺序重试246通过。一次重复暂停检查在已暂停状态等待按钮超时，最终真实状态为目录及folder AI暂停，应用关闭。全部失败日志保持归档。

回滚须使用匹配来源策略的应用和已保留历史摘要，原始资料、题目事实及付费回执保持。下一优先修复解析措辞变化导致的ai_mismatch假阳性，保留题面、选项、数值、原答案和图表实质冲突门禁，再推进公共条件归属和浮图真实定位。完整召回、安装迁移及约10GB继续OPEN。

最终代码613099f冻结main be6ac2258cd6、整树226c9228，原资料及新旧题图冷启动验证通过。测试应用关闭，目录归档及folder AI暂停。原资料图片、完整OCR与付费响应均保留在本地，Git证据只包含摘要和工程日志。
