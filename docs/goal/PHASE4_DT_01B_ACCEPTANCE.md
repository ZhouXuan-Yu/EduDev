# DT-01b 正文搜索与教师来源定位验收

日期：2026-10-05。限定实现层 A/C 接受；完整 Phase4/5、Golden E/F、日常安装和 Master Goal 尚未完成。合同：`PHASE4_DT_01B_CONTRACT.md`；顺序：`EDUCATION_BRANCH_TODOLIST.md`。

## 实际交付

- 唯一 Pi 下新增只读 `education_search_materials`，直接运行固定 DeepTutor f070 的原版 `search_units`。SQLite 一致快照、本地脱敏搜索，只有最多12个命中片段交给模型；20,000段/8MiB上限超出明确失败，不静默漏搜。exact/normalised/terms 保留原语义，terms 不作引文证明。
- 搜索、读取及引文核验的真实工具来源保存原文件版本、段落序位/ID与正文版本。教师在工具卡或右侧点击来源，经 typed IPC 重验后进入现有资料详情；目录分页不阻断定位，源或派生正文变化拒绝旧来源。
- 独立搜索能力 marker 兼容旧原生会话前缀，原引文能力身份不变。没有第二 Loop/Store、新表、依赖或任意路径权限。原页码未定位、教师尚未确认如实说明。

## 精确门禁与证据

证据根：`apps/desktop/test-results/goal/phase4-reading-search-20261005/`。所有测试使用 owned 隔离事实，不修改日常学生/资料。以下命令均在 `apps/desktop` 执行。

|命令|实际结果|证据|
|---|---|---|
|`npm run verify:deeptutor-reading`|exit0；3份原代码/许可证，共39,486字节固定SHA一致|source.log / source.exit|
|`npm run build`|exit0，含 typecheck；328文件|build3.log / build3.exit|
|`npm run test:education-capabilities`|exit0，18/18；实际原版worker、原生Pi与最小SQLite边界，未请求模型|boundary3.log；education-boundary-ZOLDsT/report.json|
|`npm run test:renderer-components`|exit0，133/133|components3.log / components3.exit|
|`node scripts/xiaozhi-agent/pi-office-document-boundary-smoke.mjs`|exit0，12/12相关资料/隐私回归|regression3.log；xiaozhi-agent/pi-office-boundary-KVejaV/report.json|
|`npm run test:education-journeys -- --scenario=DT-01b`|exit0，7/7，report.success=true，rendererErrors=[]；真实DeepSeek与正式Electron|journey4.log；education-journey-FeErHd/report.json|
|`npm run test:smoke`|**exit1，未通过**；学生保存后成功反馈等待超时|smoke.log / smoke.exit；脚本electron-smoke.mjs:1748|

最终实例指定已构建的不可变 `final-build4`，构建前后均为328文件 / SHA `4754b74eeeec9bc76719d8241dabde80618478d0a31206baaf1697b9faaf4600`；不是启动测试后继续覆盖 out。HEAD `90d67381a08db8ba040211921288b55c87de3f55`，Master SHA `dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302`。

## 真实教师路径与图审

通过原生文件选择入口先导入24段目标，再导入50份其他资料：共51份/74段，目标不在当前50条目录页。仅给关键词，模型通过实际工具取得提示中没有的随机证据编号，读取第23/24段并精确核验。教师点击来源定位第23段，冷启动后重复定位，继续阅读第24段。仅改变 owned 测试正文、保留源hash后，旧来源明确拒绝。

FeErHd 下9张PNG均已实际逐张查看：搜索结果与来源详情各浅/暗1366×768、1920×1080，共8张，另 stale-source.png。长文件名换行、定位与中文错误可读，控件可达。隐藏原生窗口静态截图对有限动画取终态；不宣称全Codex像素/动画/人工/日常验收。

## 失败保留与准确范围

1. FYe4Of：7项功能通过，图审发现来源长标题溢出；修 scoped CSS，不作为最终视觉接受。
2. DpVMvE：7项功能通过，但构建未结束就启动，前后 fingerprint 变化、success=false。实际是构建写入竞争，错误断言文案提到Python缓存不能作为缓存写入证据。修为等待构建进程结束后复制固定构建。
3. vTy6pV：7项功能通过，图审发现英文步骤及 found/mode 泄漏；修中文公开摘要提示，强化实际模型输出断言，未伪造或翻译模型回执。
4. FeErHd：最终7项及9图审接受；不把以上失败追认为连续稳定。
5. 初次边界运行遇到Node24参数属性 strip 不支持，改普通构造赋值，并将纯来源指纹函数从Electron文件宿主依赖中隔离，最终18项通过。
6. 全套历史隔离smoke等待 `student-lifecycle-feedback-success` 30秒超时，failureFeedback=[]，原因尚未确认。该次运行是build2，不是最终build3；不能声称207通过。学生域故障保留为DT-02入口门禁，不能用专项通过覆盖它。

## 下一步

DT-02：先核真实学生创建/保存反馈与读取链路，再冻结最小脱敏学生上下文、选定学生权限、真实错题/成绩/历史及重启的合同。随后DT-03策略、DT-04两周训练、DT-05题目/路径，再MA-01至MA-05。OpenMAIC仅完成固定源码审计，SDK、课堂生成和渲染仍OPEN。

本轮无提交/push、密钥/供应商、DNS/proxy/VPN、真实数据清空或Schema变更。完整 Goal 未完成。
