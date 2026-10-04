# P05-B2 原生技能撤销接入合同

日期2026-10-03；接docs/75。完整B2/B3及总目标保持，以下是B2的必要实施边界。

## 修改范围及完成定义

复用已验native-memory-epoch，将原生分支边界抽为memory/skills两个namespace共用的authority helper：记忆和技能独立TAINT/校验，RUN沿已有main身份。任一隔离收集两种ISOLATION的累计blocked IDs，防止另一类被剪枝后失去撤销索引。安全leaf必须是实际RUN前的祖先，不用branchWithSummary，不删旧JSONL/公开历史/已完成文件效果。

新增技能epoch与skills.v2私有snapshot。核严格固定内建skills.v1，旧A原生历史有消息时从首次main RUN前迁移污染边界；没有可证明RUN的历史拒绝，空历史不杜撰调用。未知/多余字段、off-branch未来marker及错误祖先关闭。authority改动隔离旧说明/tool/派生/摘要；已撤销IDs重启保持。能力未交付的范围不误标记记忆已读。

主进程管理基础提供经过完整hash验证的源bytes；managed runtime只复制必要UTF-8 md/txt/json/csv到会话私有模型资源目录，逐次经过既有脱敏callback，再Pi原生load与Hana会话来源指针。script/binary不暴露。原生命令从已脱敏文件展开，read受完整绝对路径白名单限制。各普通/摘要请求与工具前后检查目录authority和缓存文件，运行中500ms观察、失败黏性中断。explicit/steer/followUp在原生展开前检查；队列匹配只匹配实际Pi展开，不另写expander。

大规模生产接入顺序：先原生epoch/runtime及合成SDK证据，再host有效目录/全局锁/typed错误与隔离回执/绑定v4/旧v1数据，最后真实正式DeepSeek与B3管理UI。基础模块未注册生产时不能称B2已通过，既有v3绑定不提前升级。新依赖无。

## 验收

真实Pi0.80.3 SessionManager/SDK和append-only JSONL验证memory/skills双向多次撤销、工具与摘要隔离、RUN仅一次、保留安全前缀、旧字节/entries、重启、v1迁移、未知marker/非法边界、未匹配tool恢复，以及自定义native选择/read/必要脱敏/引用白名单/源变更/500ms停止。旧memory17与队列相关门禁按具体风险复验。build/renderer/diff为最低门禁，确定性SDKstream不是provider实例。

完整B2还需正式host目录冻结、全局任务/管理互斥、每次entry及恢复校验、v4新旧兼容/防降级、Chinese公开隔离及真实provider。下一B3管理页的启停/编辑/关闭必须使用这个有效目录与隔离，不能靠未来read返回空替代旧摘要撤销。P06原图D1–D7、P07办公联网/P08实际无VPN安装继续。
