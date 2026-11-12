# 本轮执行授权

2026-11-12 用户明确要求按GOAL_XIAOZHI_HARNESS.md连续执行全部阶段，离开期间不参与日常审核，不等待逐阶段批准。Phase0先只读审计，由独立Agent审核Gate后自动继续。此要求覆盖原Goal第14节及Gate0中的人工等待流程，固定架构决策继续遵循H01至H31。

用户2026-11-12最新Goal采用Phase0至Phase8。Phase7执行页面与独立页面验收，Phase8执行全系统回归、性能、安全、最终独立验收与Git交付。此更新覆盖先前Phase0至7的编号上限，实际需求与固定验收条目沿用。

总控协调。源码审计和实施采用GPT-6.1 Sol High。页面验收和独立最终验收采用GPT-6.1 Terra High。生产写入串行，其他线程UI和知识库工作树受保护。

冻结基线为d50ef330，实施工作树D:/WorkProject/EduProject-harness，分支codex/xiaozhi-harness-20261112。日常D盘工作区由其他UI线程使用，源码审计以冻结提交收束，后续按阶段正常整合，保留协作改动。

先前PTY/后台任务WIP保留于D:/WorkProject/EduProject-agent-stream-tools。快照位于本机TEMP/xiaozhi-harness-pre-goal-wip，未提交源码及失败类型检查单独记录，禁止作已验收生产能力。符合本Goal范围时按依赖阶段复用，不另开平行Task或Permission体系。

用户已允许本轮最多200次DeepSeek真实请求，仅合成资料和公开网页。截至Goal启动为0。调用账本须持久记录请求尝试，预算覆盖失败/重试/不确定结果，达到预算不自行追加。

Git沿根AGENTS的持续授权逐阶段提交、刷新整合并正常推送main，禁止强推、发布安装包或上传真实教师资料。任何阶段与最终完成定义均须真实证据，P0/P1未达标不能写完成。明确外部阻塞时先做不依赖项目，禁止空转。
