# S4启动R1交付合同

## 目标与真实阻断

根已确认A11运行 ui-final-material-catalog-live-P4sHWb 在BOOTSTRAP_MAIN_IMPORT触发BOOTSTRAP_READY_DEADLINE，12项NOT_RUN。沿用原20s就绪门禁。现有探针显示jsdom依赖读取成本集中在main import阶段，native单实例锁约2.9ms。本切片只延后两个实际parser依赖入口。

## 唯一生产写集

- apps/desktop/src/main/office-agent/hana-tool-adapter.ts
- apps/desktop/src/main/xiaozhi-agent/checks/structure.ts

Hana移除web-reader静态import，增加同名async wrapper，在HTML分支实际调用时动态导入原vendor函数。createHanaOfficeTools及内部execute的业务AST逐字保留。

structure改为本文件缓存的按需同步JSDOM构造器，保留两个原new调用的参数、parser返回、错误映射及所有XML/HTML/ZIP安全校验。TXT/CSV等路径沿原实现。构造器成功获取后复用，加载失败保留原异常路径。

## 兼容、首用、取消与预算

- 共享协议、输入输出结构、版本、网络授权/SSRF、来源、取消、文件只读及原数据保持原实现。
- 冷进程分别验证首次Hana HTML、structure HTML和XML/SVG真实parser，保存模块导入、首次与再次调用耗时、实际引擎/内容及安全拒绝证据。进程模块缓存为空，OS文件缓存状态按未控制记录。
- Hana保持原30s执行预算与256调用上限，验证取消、超时和权限守卫。checks保持原15s utility预算，验证父进程取消/超时回收与迟到响应防护，原安全校验继续执行。
- 冷首次用时若超过原预算，保留失败与实测，给出限定安全改进建议。首用性能与启动性能分别记录。
- 运行既有office tools、copy cancel与delivery/checks相关专项。新增工件只位于本目录，冷测试用明确的owned目录及无外网测试输入。

## 验证与交接

保存原两文件AST/哈希基线，实施后比较Hana业务AST与structure原业务节点，检查延迟入口及源文件解析，生成 startup-R1-static.json，其中files为含path/sha256的两项数组。专项记录精确命令、通过数、退出码、冷首用与预算/取消边界。

本worker不运行全局build/tsc和GUI。根统一build，并执行全新20s就绪、三链与207 smoke，更新唯一RESULT。UI56源继续冻结。回滚仅恢复这两文件至本轮基线并由根统一重建，业务数据无需迁移。
