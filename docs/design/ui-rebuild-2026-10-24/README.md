# 小智 UI 正式重建基线

用户已确认统一亮色、无玻璃、内容优先布局，并选择“过程正常展开，交接时整段收起”。正式替换在同一1c54工作树进行；实施合同取代此前待选择状态。最新结果、限制与Git状态见[交付记录](DELIVERY.md)。

- [已批准实施合同](IMPLEMENTATION_CONTRACT.md)
- [根因与旧CSSOM证据](ROOT_CAUSES.md)
- [统一UI约束](UI_CONSTRAINTS.md)
- [原厂组件与配置政策](COMPONENT_POLICY.md)
- [迁移与协作main整合](MIGRATION_AND_MERGE.md)
- [来源与调研](SOURCES.md)
- [15页独立约束](pages/)

正式页面使用ui-system/EduShell、EduNavigation和page-contracts.ts，业务入口仍经过原有typed preload。资料库、教学文件使用真实数据表格，设置及聊天有独立布局文件。历史styles.css仅保留legacy-test入口；领域兼容层临时提供结构几何，不导入旧主题。其它复杂内页保留既有业务结构，不能将共用外壳替换宣称为所有领域工作流已重做。

正式过程命名AgentProcess：公开说明与真实工具正常展开，显式answer事件使整段收起，然后正文增量绘制；原始provider reasoning仅主动详情可见。官方Agent Trace Streaming多块演示保留在开发审阅页，不冒充正式产品组合。模型等待不伪装成思考内容。

开发审阅入口仍为apps/desktop的npm run ui:review；样张无业务IPC和模型请求。真实试用必须从当前out/main/index.js启动，并核对隔离数据根及构建身份。每张双尺寸证据核实际CSS viewport，设备像素尺寸单独记录。

不变边界：本地优先、教师确认、资料权限、来源谱系、Pi唯一编排与真实SDK事件。无新依赖、DDL、业务IPC、模型循环或vendor样式修改。
