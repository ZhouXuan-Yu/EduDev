# Hana 独立工具实现复用

来源为两个互补本地快照：`D:/WorkProject/开源/openhanako`（package 0.449.0）与 `D:/WorkProject/开源/openhanako-0.449.0`（shared 文件）。前者不是 Git checkout，且缺少 shared；后者并非完整运行仓库。没有伪造 commit，逐文件原始/复用 SHA-256 见 source-manifest.json。Apache-2.0，许可证位于仓库 third_party/openhanako/LICENSE。

直接复制文件 ResourceIO、路径身份、文件元信息、HTML reader、搜索限流器；用 TypeScript AST 提取原 AnySearch wire 函数与依赖。搜索限流器的错误类型在适配器中复用，队列尚未接入任务取消，不声称已交付限流排队能力。

适配差异：增加来源及 @ts-nocheck header，保持上游隐式类型；相对 import 去 .ts 以符合本项目 Electron build。复制非 overwrite 分支增加 COPYFILE_EXCL，避免检查后目标出现时被覆盖。AnySearch 注入 bounded fetch/任务 signal、固定 zh-CN/1–10 结果，取消全局配置、自动 provider fallback、Pi 和 BrowserManager 依赖。小智 adapter/shared 文件保持 strict typecheck；上游 header 不是对 adapter 的类型豁免。

没有复制 Hana Agent/Pi 主循环。小智主循环仍为官方 Codex app-server，工具定义经 dynamicTools 提供，调用结果为 xiaozhi.office.tool.v1。网页与文件仅为不可信资料；审批、参数、工作范围、排除目录、取消及输出边界由宿主负责。

联网默认使用系统 DNS；仅显式 dnsMode=cloudflare 时查询 1.1.1.1 的 DNS-over-HTTPS。每次连接固定已校验公网地址，逐跳重新验证。当前机器系统 DNS 返回 198.18.* 虚拟地址，默认模式拒绝；专项显式选择公开 DNS，未修改系统或代理设置。

Node 源码专项使用 register-source loader；正式 Electron 按 electron-vite 构建，不带测试 loader。新工具尚未接入生产 Host/IPC/SQLite/UI；内存 callId 去重不能替代持久提交日志。共享文件对恶意外部进程的竞态不构成 OS 沙箱保证。
