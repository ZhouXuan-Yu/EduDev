# P06c 模型选择与正式设置交付合同

日期2026-10-03；M10/M01。继docs/87–88；docs/67 R1/R2、35完整目标不变。先A→B→C，各步分别实测，不能只交付A就勾完整P06c。

## 1. 当前证据与教师可见结果

正式Pi OfficeComposer只有当前模型且无onModelChange。snapshot使用binding.model；start仍读取全局默认模型，因此全局模型修改可能令旧会话configuration。旧App设置硬编码DeepSeek/GLM选项、密钥保存app_settings明文JSON、save IPC无主frame gate，正式Pi仅DeepSeek。模型能力已有官方固定/v1/models、10秒/64KiB/32项缓存，可复用，不能另造列表或能力。

当前实际只用DeepSeek：官方文档及实际GET模型目录核验。旧别名不能代表新canonical模型；菜单显示实际请求ID和官方可核验能力，不伪装GPT/Claude角色、未知推理档位或1M开关。用户提供密钥继续从ignored .env.local默认读取，不回显、不写日志/产物。

完整结果：可选择当前模型/默认模型、真实配置与重启回读、同会话安全切换并保留历史，设置页面采用Hana现成布局/原HeroUI组件，含模型、权限、本地资料、Skills、显示偏好及归档入口。AI执行/文件权限仍由main和教师确认控制。

## 2. 实现顺序与范围

### A 正式配置与模型目录（本轮先做）

- shared/xiaozhi-settings.v1：version/CAS、固定DeepSeek、masked状态/默认模型、官方models目录/失败与空状态；typed IPC；正式小智设置入口与真实默认选择。
- 独立main settings service/state/API。app_settings新增version1命名空间存结构化配置，密钥safeStorage加密blob；主frame验证、输入白名单、全局run/chooser/技能管理/配置互斥。已有env和旧DeepSeek配置作为兼容fallback，旧记录不销毁；正式新增/更新密钥不得明文保存。加密不可用时拒绝新Key，不降级成明文。
- 官方目录读取/缓存复用原model-capabilities服务，必要投影，不上传教师资料；显式刷新显示网络错误与缓存过期。默认模型变化只影响未绑定新会话，已有binding继续自身model，避免静默切模型/破坏原JSONL。A不把“新会话默认”冒充已有会话切换。
- 新空会话picker的独立模型选择与持久偏好必须核当前活动会话/version/全局锁；已有history切换归B。不伪造可用的高/低档位。

### B 保留历史的同会话模型切换（A后继续，必须完成）

核Pi0.80.3原生AgentSession.setModel/SessionManager.appendModelChange及Hana switching实现，先冻结具体持久intent/CAS/崩溃恢复合同。不得绕过固定identity、安全memory/skills epochs或自写第二模型循环；历史/审批/实际文件不重放。真实两官方模型调用、来回切换、重启/中断验证，UI只在实际切换提交后改变选择。

### C 设置布局与完整集成（A/B后继续，必须完成）

Hana SettingsModalShell依赖全局store/window-surface/server，直接整包搬入会引入第二宿主；选其纯SettingsPrimitives/CSS与现有Hana SkillRow管理，HeroUI MCP已核Modal/ListView/Dropdown/Switch/TextField，复用已装OSS3.2.2/原Pro闭包。按记录源码版本/许可/hash接typed数据，合理必要adapter允许，不能称Codex官方同源。设置导航、搜索、权限/目录说明与实际入口、Skills管理、真实显示偏好、归档恢复和失败/忙碌/空态要在正式页面可操作；原旧入口在验收前保留。

## 3. 数据/兼容/安全

SQLite app_settings为配置真源；本地cache可重建。新命名空间version/CAS未知拒绝，不破坏旧表/教育数据。密码输入仅教师明确保存时进入main，renderer仅masked/configured，发送清空；API/key不能进入模型历史、localStorage、debug报告。safeStorage encrypt/decrypt留main，严禁明文fallback。已有旧明文仅兼容读取，本轮正式保存转加密；旧通用入口之后受同gate和规范治理，不能让它绕过正式配置锁。

外部请求只官方固定DeepSeek endpoint，不支持renderer传URL/headers；目录超时/大小/异常schema/移除模型不静默兜底到已撤回模型。模型声明与本地output预算分别显示；学生原图/原资料不上云、不放宽原工具/文件/教师确认规则。

本轮无新依赖；safeStorage属于既有Electron。来源代码复制保留Apache-2.0许可，安装体积记录源码字节而非猜installer增量。

## 4. 完成门禁

A的必要故障恢复补充：有效配置中的密钥无法解密时，模型执行拒绝，不使用env/旧Key静默替换。公开历史与模型选择不依赖解密；设置页显示明确故障，并允许教师重新输入Key、实际验证后加密替换。未知配置schema仍拒绝读取/覆盖。原始数据与native历史不变。

每步 main/SQLite或文件→typed preload→UI→真实操作→readback/重启；实际DeepSeek官方目录及聊天、失败/拒绝、CAS/忙碌/归档/未知版本、旧配置兼容、新Key加密且报告/HTML无明文、另renderer拒绝、1366×768/1920×1080可达。隔离owned数据/profile，不修改真实教师库/系统网络。

最低 npm run build、npm run test:renderer-components、本步边界+真实模型/UI实例、关键路径固定最终out主smoke207、来源hash、git diff --check与新文件空白。精确命令/通过/失败/skipped/限制写后续验收及四根文档。完整P06c仅A/B/C同时证据满足才勾；完整目标/P06精准视觉、P07办公/P08无VPN安装保持active。
