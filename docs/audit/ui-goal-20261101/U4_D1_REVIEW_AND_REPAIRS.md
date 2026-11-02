# D1 独立审查与修复

## 生产 P2 · 旧绑定任务续接后丢失绑定（已关闭）

初版仅拒绝新请求显式携带绑定与续接参数混用；原绑定任务可通过resumeTask、typed continueTask、纯文本“继续”变成无绑定Active，重新读取latest。此为源码可达时序，未声称实际导错B。

修复从目标任务权威原用户消息metadata读取；存在绑定（即使损坏）均要求返回原确认卷重新准备。host在任务恢复/Active/command/run写入前统一拒绝，coordinator执行入口再守卫；普通任务续接及旧无绑定hash保留。冻结16生产文件聚合73c42e9a…，独立Astra复核关闭P2；44项新边界、369适用旧回归及TSC记录哈希一致，模块仅加载不计通过。构建/实际桌面由父另记。

## QA P2 · 把默认目录label当作必弹选择器（已关闭）

初QA runner在规格按钮上等待chooser；正式新会话存在默认workspace label，按钮可合法跳过选择器，因此会超时，取消也不保证出现paper-output-error。独立Astra在actual前发现，未实际执行、0本轮模型请求；前一QA有限接受据此收窄。

仅修QA：用现有paper-output-choose显式取消/选择；取消核对原页、草稿、授权与副作用不变；成功选择核对OWN持久路径，再点规格按钮。不改变生产默认目录语义，不弱化目标/身份/文件校验。新冻结与实际结果随后补录。

新QA冻结b5756878… / 44cfb91b… / db8f6a21…，离线11通过；独立Astra关闭P2后执行首次actual。正式Electron mOHpzM8项、双启动12图exit0，真实教师DOCX原审批/独立XML及source读回成功，竞争在model前拒绝且保留绑定；原报告保留。此结果限定于73c42e9a源码/outbf73fd95，不改写成后续构建。

## 实际截图 P2 · 正确拦截却给出错误原因（已关闭）

父查看竞争1366截图：原A已被B替代，但宿主将确切快照失效映射command_conflict，界面提示“这条发送记录与消息内容不一致，请重新发送。”安全拦截成立，原因和恢复指导却不准确，容易诱发反复重试。

仅将绑定快照失效分类为明确专码，提示返回组卷重新核对；真正command hash冲突保留原码，工具后期失效也清晰说明，不放宽安装/current/来源权限。已有正常实际文件不重新付费生成。修后在mOHpzM的data/profile副本复用原A/B及绑定草稿，做单次0模型拒绝补验，原失败提示、源码和文件证据分别保留。

修复冻结fce09d00…，51项及TSC通过；Astra复核真实hash冲突优先、权限错误保留、后期只读原卷核实，无新增P1/P2。正常合并main37ba4c5为ccf5435后，最终build/TSC/245及host10、HTML3+3、PPT9通过。新out260c029f…实际kWaJSj4/4、双启动6图、单Enter零重试，明确提示回组卷，完整草稿保留；模型/命令/消息/授权/产物/源数据不变，旧normal文件hash及来源不变。Astra独立核验最终截图、SQLite、全src/out与原证据目录指纹后关闭该P2，仅限定本片。见[最终清单](U4_D1_MAIN_INTEGRATION_RESULT.json)，不改写旧actual1。
