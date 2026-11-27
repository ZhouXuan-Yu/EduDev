# V3.1 Phase 0 现场审计

2026-11-26，执行者为当前模型；唯一工作树`D:/WorkProject/EduProject-ui-ux-r1-20261125`，复用`codex/ui-ux-r1-20261125`。本轮起点、实际远端main均为`d16b0af4b95a8aea3050848546209f51e94abca5`，不是包内静态观察f420db0。

## 基线与保护

- 完整工程包位于用户提供的D盘路径；92份文本/CSV/JSON已按相对目录冻结到contract，逐文件SHA在PHASE0.json，不覆盖原包或任何AGENTS/Master。全部90 AC和36 LG建立NOT_RUN矩阵。旧R1局部通过不自动转入V3。
- 34个工作树只读盘点保存在PHASE0.json。D盘主目录为detached7ee410d，存在协作者文档/生成物/启动脚本改动；未清理或写入。任务树4个既有生成物与6个vendor行尾差异保留，禁止混入本轮提交。
- 实际运行的小智仍是上一轮已推送的正式Pi隔离构建，main/preload/renderer指纹df5c2e85，src7f6f84b3，独立虚构数据；不能把新模块单测称为新设置页面已上线。
- Electron43.8.3；Node24.12.0；固定npm11.21.3；HeroUI^3.2.2/lucide现有锁版本。具体lock SHA、scripts和版本见PHASE0.json。未发现根.github/workflows，不能声称CI已运行。之前audit0仅是之前锁文件的真实记录。

## 已确认的真实调用链及缺口

1. App.tsx:2878通过activeView=settings渲染PiSettingsWorkspace，占用主工作区；没有独立设置BrowserWindow。REQ-17=MISSING。
2. main/index.ts:304的settingsSender和xiaozhi-agent/ipc.ts:100的fromMain均绑定主窗mainFrame。该guard同时保护非设置业务，绝不能改成允许任意settings sender访问所有channel。
3. PiSettingsWorkspace:105从本窗localStorage选会话。独立窗口必须改用主进程可信scope/epoch，不能原样继承该偏好作为授权。
4. 主preload为全量omniEdu；没有独立设置preload。REQ-18=DEFECT/新窗口必要前置缺口。
5. 十类设置均实际存在，含PiTeacherMemorySettings、PiL2MemorySettings、PiHistoryMemorySettings；应复用。设置的传递import还包含归档OfficeConversation等读视图，其依赖带入终端、文件预览等方法。静态依赖列表是过宽候选清单，**不能直接生成权限白名单**。
6. WorkbenchProvider当前使用React内存状态，没有跨窗storage事件订阅。新窗口中的偏好保存不能只显示本地成功；需沿原持久化接口同步并实测。
7. main已有desktop-ipc-lifetime，包含关机排空与BackupPublicationBarrier。新窗口IPC必须纳入原生命周期；不能绕过drain或快照互斥。
8. 原模型配置已提供commit/history/undo/stageCredential及schema验证；权限与备份有原宿主服务。不得另外创建store或移除旧入口。

## 用户澄清后的协作方式

用户答复：“有ai负责改动部分，你不是git分支吗？改动完合并到一起就行”。据此继续隔离分支，不再要求例行确认。当前模型仅承担新窗口/IPC适配及UI集成；其他业务owner的实现不重写；不冒称其他AI已签字。共享文件只在本任务树修改，整合前按新main真实diff解决冲突并复验。90项及MG-01未过前禁止推送本轮到main。

## Phase 1 首个实施合同

- W2-A，REQ-17/18；AC-053/075/076/078/085的生命周期与文档隔离子条件。
- 新增独立settings-window/controller.ts和专项测试；不先改App/Pi/配置/数据库，不向index.ts堆业务代码。
- 窗口必须top-level/nonmodal/sandbox，无parent/always-on-top；creating单例，安全文档和首帧均到达才显示；失败/超时/关闭释放实例并可重试；main focus/blur/hide/minimize/closed清理弱化状态；workArea采用Electron DIP。
- 配置读写、10类迁移、可信scope、最小preload、同步及完整Pi连续性为W2-C/D/E后续工作，当前不宣称通过。
- 回滚仅revert本分支新增文件/适配；保留旧设置路由和原配置/数据。不能通过回退整个主线替代。

## 新门禁与旧问题去向

V3.1覆盖旧执行优先级和每轮提前合并安排。SET-P0先行，其后W3–W9，完整90 AC＋36 LG＋MG/FG门禁保留；原生125%、双屏拔除、物理IME、冷长帧及真实业务质量仍需有效环境和证据，不默认通过。原26 REQ分类、90/36矩阵与全部失败均保留。此文不是DONE或MG-01放行。

技术依据：[Electron安全](https://www.electronjs.org/docs/latest/tutorial/security)、[BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window)。正式实现继续核对已安装Electron类型及真实运行结果。
