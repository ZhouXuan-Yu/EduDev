# Phase4 首个 DeepTutor 能力切片验收

日期：2026-10-05。状态：DT-01a **限定实现 A/C 接受**；完整 Phase3/4/5、Golden E/F、Goal、发布与人工 NOT_ACCEPTED。Goal ACTIVE。用户本轮要求优先两个能力支线，顺序见 `EDUCATION_BRANCH_TODOLIST.md`。

## 真实交付

`EducationCapabilityProvider` → `education_verify_material_quote` → 原 MaterialRepository / 教育脱敏 → 一次性 Python stdlib worker → 未修改的 DeepTutor reading `locate_quote` → Pi execution-once / 已有 typed 聊天入口 → 公开中文核验状态和结果 → SQLite/native JSONL → 冷恢复。

原 upstream f07029cfcf2c8dfccdb671cdfc343db8334f5741 的 search.py/models.py/Apache LICENSE 逐字复用，3文件39,486字节，固定 source-manifest；旧1.5.11 vendor及本地旧DeepTutor工作树未改。无新 npm/pip 依赖、Schema、第二 Loop/Store/模型宿主。主进程指定Python，worker不继承凭据，协议输入64KiB/正文12000字符/引文2000字符、输出2KiB、单工具5秒/4并行槽是工具隔离边界，不是运行预算。只有子进程真正close/error才释放槽。Windows安装包带运行时与打包执行仍Phase7 OPEN。

参数只允许资源ID/段落offset/正文读取回执的保存版本/quote；拒绝路径、学生库、SQL和额外字段。核验前后校验资源版本/状态及实际段落内容，防止重解析后交付旧证据。含个人信息段落/已知姓名或联系信息引文拒绝；必要脱敏文本只在本地worker匹配。结果区分 exact / normalised / 未找到；normalised会忽略部分标点及空白格式，不保证语义或公式等价。上游中文换行与无空格句子并非总等价，没有擅改算法。只证明指定已收录脱敏段落，不代表整份文件、原页码、教师确认或答案正确。

独立 `xiaozhi.education.deeptutor-reading.v1` marker附加到原native历史，不重写旧创建身份/前缀。未知版本、工具替换或能力缺失拒绝继续。恢复/取消不增加权限。

## 精确命令与最终证据

工作目录：`D:/WorkProject/EduProject/apps/desktop`。

|命令|结果|证据|
|---|---|---|
|`npm run build`|实际exit0（最终education-build3），含tsc与默认out生成、固定Python资产复制|goal/phase3-daily-entry-20261005/education-build3.log/.exit|
|`npm run verify:deeptutor-reading`|实际exit0，原3 Git blob及manifest一致|source-manifest.json / closeout指纹|
|`npm run test:education-capabilities`|最终11/11、exit0|test-results/education-boundary-WXm4el/report.json；education-boundary3.log/.exit|
|`node scripts/xiaozhi-agent/pi-office-document-boundary-smoke.mjs`|原相关12/12、exit0|test-results/xiaozhi-agent/pi-office-boundary-3t66Zp/report.json；education-material-regression.log/.exit|
|`npm run test:renderer-components`|133/133、exit0；本轮无新renderer业务代码|education-components.log/.exit|
|`node scripts/education/golden-teacher-journeys.mjs --scenario=DT-01a`|最终4/4、success=true、exit0，rendererErrors=[]|test-results/education-journey-LIumb0/report.json / readback.json；education-ui6.log/.exit|
|`git diff --check`|最终收口实际exit0，仅LF/CRLF提示|phase4-capabilities-20261005/diff-check.log/.exit|

正式场景从真实页面native文件选择开始：保存文件→SQLite正文ready→用户消息（不含随机正文证据编号）→DeepSeek实际查找/读正文→两次原DeepTutor匹配→持久最终回答。Native工具回执分别found=true/exact和found=false/null，版本与真实文件hash一致，teacherConfirmed/originalPageLocated均false。两次实际隔离正式Electron启动，核userData/sessionData与main已加载模块，无legacy-test-runtime；native窗口isVisible=false。冷启动恢复同一会话、公开结果与原工具回执，没有重发请求。没有测用户日常资料或无VPN。

最终5张图已逐张查看：浅暗1366×768/1920×1080结果四图及cold-result.png。核验结果、公开工具过程、引用边界、来源和输入控件可读/可达；较短视口正文在历史容器滚动，不当作截断。只有本切片静态图审，不表示整体Codex像素一致或动画验收。隐藏Windows测试窗口的有限CSS动画由显式snapshot策略推进到真实结束样式，保留无限spinner；不改变产品动画/数据/工具。策略记录在report.visuals.transitions，调用前实际核native hidden状态，不能只信document.visibilityState。

## 失败与仍开放的门禁

- 正式首4份报告 f5CKvE/xYCqcP/c94IsN/UHsh3T 对应目录全部保留。前三或四个功能场景通过，图审等待失败；未追认为全套通过/连续稳定。隐藏窗口CSS animation.currentTime=0，Chromium可能report visibilityState=visible。纠正截图的finite动画终态处理，修正后Mnx9AM通过，随后固定源码无字节码写入的最终LIumb0也通过；build前后SHA相同。
- 原 `npm run test:smoke` 最新全套 **exit1**：legacy题本使用记录先SQLite提交、React文本仍“还没有使用记录”；前一次还有脱敏预览异步断言。已将两个断言改为等待真实DOM回执，尚未在此文本改动后全套重跑，**旧207门禁OPEN**。不继续将旧模拟业务专项当当前目标；这不是新版DeepTutor/Golden F证据，也不能写207通过。原12项相关工具回归已实际通过。
- Phase3完整39项shell验收仍OPEN；备课本仅独立8场景本地通过，16图未全部审阅，不能把整个Phase3记DONE。
- DeepTutor学生事实/掌握度/评分/训练、OpenMAIC SDK/互动课、Golden A–G、安装/无VPN/许可安全/全UI人工均OPEN。

下一：DT-01b。先复用同一原版search_units并比较已有检索接口，支持全资料正文查询、真实locator/version回执和教师来源定位；随后学生事实→掌握度/复习→两周计划，再OpenMAIC DSL→generation→renderer→课堂编辑→Golden E/F。

## 同轮日常版本统一（独立范围）

新版以前只在隔离test-results构建，日常out与7月dist残留导致入口分叉。现在npm start先build成功再开当前out，根启动小智.cmd统一入口；release编译去除继承dev URL，单实例按构建revision聚焦/重启，owned隔离验收窗口默认隐藏。旧dist移至test-results/goal/phase3-daily-entry-20261005/retired-dist，原删除命令被自动审查拒绝后采用可恢复归档，没有强删用户事实。默认out本轮有意更新，不能沿用“未改变daily out”。此前日常入口5/5（daily-entry-JLhUHZ）、组件133/133、两图审范围记录保持。实际日常更新启动与最终指纹见收口receipt（npm start实际exit0；曾见单一可见主窗口PID62816，后续最终重启另记）；不会把daily窗口打开当成用户完整AI验收。
