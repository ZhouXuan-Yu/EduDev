# 08 实机验收手册

## 1. 真实运行与数据

优先在用户 Windows 开发机运行实际 Electron。先按启动.md 找到正式入口，记录源码根、完整 SHA、构建产物指纹、PID / 窗口与启动命令；不得误验 test-results 旧 renderer 或离线原型。

建立独立验收数据目录，使用虚构教师 / 学生、可公开测试资料、长中文文件名、带图片公式的题目和正常文件。不得扫描未授权目录或清空正式资料库。测试夹具可用于错误 / 慢响应边界，但标为 component / fixture，不能冒充真实业务闭环。

截图、日志不得暴露密钥、学生姓名、完整隐私路径或无关会话。脱敏不得遮住验收需要的标题、状态和动作；优先使用专用数据。

## 2. 页面和窗口

以 templates/PAGE_INVENTORY.csv 核对当前 18 页，逐页通过真实导航进入，记录实际入口。每页至少覆盖正常数据（可写测试数据）与适用空态；关键控件另覆长内容、加载、错误和禁用。

全页在 1366×768、1920×1080 的目标窗口下验收；800×768 做全页可操作检查，密集页面和弹层补截关键位置。DPI 至少检查 Windows 125% / 150% 的代表页面：设置、我的任务、组卷、学生编辑和输入面板。记录 native 窗口、实际 innerWidth/innerHeight、DPR、系统和应用缩放；不将图片像素当 CSS 尺寸。

标题、保存 / 确认、关闭和返回可达；没有非预期整页横向滚动或遮挡。题目 / 文件内容可有明确专用滚动，不要求把图文文件压缩得不可读。

## 3. 核心教师场景

| 场景 | 操作 | 必须观察 |
| --- | --- | --- |
| J01 定位与返回 | 问小智输入未发送草稿 → 我的任务 → 原任务 → 返回问小智 | 当前导航 / 页名清楚，回到同一会话，草稿与位置不串台 |
| J02 设置 | 打开设置 → 改教学偏好 → 保存 → 离开重进；再制造一次保存失败 | 范围 / 生效 / 保存真实，失败保留输入，关闭设置不终止任务 |
| J03 待处理 | 同一任务产生两个需老师处理事项 → 切换 / 收起 / 恢复 → 处理 | 一个面板、已填内容保留、不抢焦点、提交沿宿主且对话留痕 |
| J04 抽题 | 在问小智按学科 / 章节 / 题型等实际字段提出条件 → 打开实际题目结果 → 进入题本检查 | 结果符合条件、来源可查看、修改 / 返回仍是同一结果；无题不暗放宽 |
| J05 组卷 | 提出组卷要求 → 实际选题 / 题篮 → 修改一道题或顺序 / 分值 → 预览 → 实际导出 → 返回 | 同一题组、关键约束保留、确认语义正确、文件确实可打开、草稿 / 版本符合原契约 |
| J06 PPT | 提出生成配套 PPT → 查看真实产物 → 已有预览 / 编辑入口 → 修改 / 保存 → 返回 | 是真实 PPT 成果，文件可打开，支持的编辑反映到回读；没有编辑能力须写明依赖缺口 |
| J07 资料与学生 | 筛选资料→详情→返回；学生 A 未保存编辑→切 B；让旧请求晚到 | 过滤 / 位置恢复，不丢输入，旧数据不覆盖新对象，不越权 |
| J08 异常与停止 | 读取失败 / 保存失败 / 取消任务 / 部分成功各选真实适用代表 | 不显示假成功或假空态，保留已有内容，提供真实可行下一步 |

J04–J06 可以由一次真实任务产生多个成果以减少重复调用，但每条必须有独立可定位的证据。不因本轮 UI 任务重建不存在的底座能力；缺失导致相应必选 BLOCKED。

## 4. 交互状态

使用鼠标和键盘验证至少一个 Select、一个 Disclosure、一个菜单、一个确认 Modal 及已有右栏。Tab / Shift+Tab、Enter、Escape、焦点归还按组件模式；IME Enter 不误发。只对模态陷入焦点，不能把并排非模态右栏也锁成陷阱。

检查 hover / selected / pressed / focus / disabled / expanded / error 中适用状态。隐藏指示符、删掉 label、禁用焦点轮廓均不能通过。

## 5. 工程命令

以下命令在编制时确实存在，执行前核对当前 package.json。cwd 为实际 apps/desktop。

~~~powershell
npm run build
npm run test:renderer-components
npm run test:ui-contracts
npm run test:ui-style-isolation
npm run test:sidebar-navigation
npm run test:xiaozhi-pi-settings-workspace-ui
npm run test:xiaozhi-narrow-interface
npm run test:xiaozhi-dpi-interface
~~~

test:sidebar-navigation 与 test:workbench-ui 在已核实快照指向同一脚本，若执行时仍相同只运行一次，报告映射。增加相关组件 / 字段逻辑验证；关键用户路径变更按根合同运行 npm run test:smoke。typecheck 已包含在当前 build 中，lint 只运行实际存在且适用的命令。仓库根运行 git diff --check。

每条记录 cwd、命令、退出码、通过 / 失败 / skipped、耗时和日志文件。不能把“存在脚本”写成“已运行”。既有失败给 before / after；影响本轮必选项则阻塞，不能当历史遗留自动豁免。

## 6. 体感与性能

同机同数据观察并记录打开页、菜单 / 折叠、题目选择、长对话滚动和流式输入前后差异。局部 UI 反馈以现有状态立即出现为目标，不等网络 / 模型完成才显示点击已接受。

新增专项测量：对三个轻量操作（切换设置分类、开关已有详情、选择题目）各做 10 次暖运行，记录输入到首次可见反馈。9/10 次不超过 200ms，且无一次超过 500ms；这是假定正常验收机、前台窗口的本项目验收目标，不是外部标准或模型响应承诺。记录原始样本和设备；不要捏造 P95 改进。计时可用性能标记或带时间的录像，不能凭肉眼补数字。

流式回复期间能输入 / 滚动，无本轮新增持续阻塞、重复监听 / 请求、布局反复跳动。原有模型时延和后台计算问题分开记录；超出 UI 修复范围时注明依赖。

## 7. 证据组织

实际 acceptance/ui-ux-r1-20261124 下使用 delivery.json、FINAL_REPORT.md、records/ 和 evidence/。证据文件名包含 UIR1 编号、页面、尺寸、状态、before / after；录像说明起止动作。每项写清楚证据证明什么，避免一张截图充当全部流程。

delivery.json 的 evidence 使用相对报告目录的安全路径，记录 SHA-256、代码 SHA、构建指纹、证据层（electron / component / static / readback / git / measurement）。组件或 fixture 证据不能代替要求 electron / readback 的项。

每份证据另标 phase：baseline（本轮修改前）、iteration（修复过程）、verification（最终验证，省略时默认此值）。保留首次失败与 before 证据，不为了通过校验删除它们。baseline 的运行证据绑定 baseline_sha 与当时构建；iteration 绑定实际当时代码 / 构建；verification 的运行证据绑定 verified_sha 与最终构建。PASS 所需 electron / readback / measurement / component 层只由 verification 证据满足，历史与迭代证据可一起引用但不冒充最终通过。

最终代码已经提交后进行验收最方便绑定身份。证据文档后续提交导致最终 commit 不同，必须给仅文档 / 证据差异证明；运行代码改变则重新构建和受影响复验。

## 8. 报告校验

从本包目录运行：

~~~powershell
python scripts/validate_delivery.py D:/WorkProject/EduProject/acceptance/ui-ux-r1-20261124/delivery.json
~~~

退出 0 仅说明报告满足 DONE 结构 / 引用条件；退出 2 是诚实未完成；退出 1 是格式、证据引用或冒充完成等错误。脚本不代替视觉审查、运行测试或教师试用。
