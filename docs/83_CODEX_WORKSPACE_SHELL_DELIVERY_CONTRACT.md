# P06b：Codex 工作区框架与文件面板合同

日期2026-10-03；M10/M01。承接docs/67/82，完整目标保持。上一轮为进展：已完成真实过程和测量基线，未完成整体视觉。本合同先锁定现成组件闭包和纵向顺序，再修改页面。

## 1. 教师可见结果与当前缺口

现有AiConversationSidebar已有本地会话/文件夹/重命名/归档/拖动事实，PiEducationWorkspace已有typed snapshot/实时过程、知识/目录只读工具、复制审批、预算/记忆/Skills管理。当前布局无窄图标轨，标题/侧栏密度不同，右检查栏常驻大量文本，文件preview/tree尚无正式Pi用户路径；不能称R2结构一致。

目标：浅青窄轨、近白会话树、白工作区圆角、简洁标题、居中阅读/输入、右侧紧凑本会话资料卡。详尽模型/用量/预算/记忆通过真实展开入口保留；文件工作面板是另一模式，沿实际授权文件提供tabs/tree/preview，开关和拖宽真实，聊天阅读不中断。

## 2. 现成方案与修改范围

- HeroUI MCP已查app-layout/sidebar/file-tree/tabs文档及实际本地Pro源。选原AppLayout/Sidebar/Resizable/Sheet完整依赖闭包，而非新增自写侧栏开关/拖动算法；已有ChatListView继续绑定教育会话真实操作。后续文件面板复用原FileTree和现有OSS Tabs。
- 新Pro源码闭包放已有renderer/heroui-pro，登记source/output SHA、字节、版本和既有许可边界；既有被适配的文件不覆盖。CSS使用现有编译Pro闭包并实测对应class，必要样式限小智作用域。Finesse固定product/AI-console原则与R1/R2原图继续作为依据，不换泛用模板。
- AppLayout依赖react-resizable-panels；拟锁定4.11.2（与本地源开发版本对应），安装前核npm官方metadata。MIT、纯React/JS及类型，无native addon/后台服务；实际包解压大小记录于验收，不将其当安装包体积。Pro许可不改称MIT或Codex同源。
- B1先贯通实际壳、原Sidebar容器、header/rail/紧凑资料卡和现有控制详情。Sidebar开关和资料卡开关沿原组件；展示偏好可存renderer独立xiaozhi.ui.v1，只有boolean/布局宽度，没有凭证/文件授权/业务事实。B1不新建表/IPC，不改变Pi/模型权限或审批。
- B2接真正文件面板：先共享版本化公开文件契约，复用main授权目录/有界只读/来源版本与路径guard，typed preload → FileTree/Tabs/preview → 实例。必须证明路径、学生原图留本地和本地预览边界，不以模型文本/renderer路径自授予权限；不得将B1紧凑资料卡算文件panel完成。
- 修改PiEducationWorkspace只抽本轮壳/资料卡领域，AiConversationSidebar增加可选Codex变体且旧入口保留，OfficeComposer/过程逻辑保持。禁止把新文件业务塞App.tsx/db.ts，原侧栏操作/停止/提问/审批不丢失。

## 3. 兼容与回退

现有教育SQLite/本地文件/native历史继续真源；不删原入口/源文件或业务数据。UI prefs schema1严格读白名单，损坏/未知回默认，不改变工作目录或模型；布局回退只移除此组件包装/作用域CSS，原业务契约保持。旧非Pi页面按原AiConversationSidebar变体运行。B2另核权限、失败/取消/版本并发，验收后才切默认预览入口。

## 4. 完成定义与门禁

1. 来源闭包hash/安装metadata/编译CSS可核，AppLayout/Sidebar实际DOM使用原slots，按钮真实动作，未接能力不伪造可用。
2. 从当前正式页面操作新对话/文件夹/搜索/切换/重命名/归档/拖动，已有Pi发送清空、流、工具组、技能管理、预算、记忆、compact、停止、审批仍可达；详细信息可展开且不丢失。
3. Sidebar/资料卡开关、阅读与输入布局、双视口1366×768/1920×1080、长中文标题、键盘、重启偏好回读；测量before/after，参考DPI未知仍不声称≤2px或一比一。
4. B2真实授权文件tree/tab/preview开关/拖宽/来源版本/不存在与拒绝路径/重启用户路径及实际readback通过才勾完整文件panel。
5. npm run build、npm run test:renderer-components、本轮正式Electron实例/真实DeepSeek必要兼容、固定out主smoke和git diff --check；记录通过/失败/未验证，四根文档与台账同步。

## 5. 当前执行顺序

B1完整源码闭包 → 正式壳/紧凑资料卡/真实侧栏操作 → 双视口/重启/真实过程兼容；B2共享文件契约与受控宿主 → typed IPC → 原FileTree/Tabs/preview → 真文件实例；随后P06c模型设置、P07办公联网/产物、P08实际无VPN安装/最终八组实例。完整P06b和总目标在全部证据之前保持未完成。三元题组暂停，未经授权不提交/push/发布/系统网络改动。
