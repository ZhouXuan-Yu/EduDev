# 小智 UI 重建约束

本文件补充根约定。用户已否决此前UI；测试通过不能被写成视觉接受。当前入口为 `docs/design/ui-rebuild-2026-10-24/README.md`，从仓库根读取。

- 修改页面前读取对应 `pages/<view>.md` 及共享 `UI_CONSTRAINTS.md`、`COMPONENT_POLICY.md`。15个正式页面的合同源为 `ui-system/page-contracts.ts`；审阅器只重导出同一份元数据。未知页面先登记合同，不复制另一页样式后宣称完成。
- 用户本轮明确要求同一工作树统一和后续main合并，不维护第二套正式UI。审阅样张是dev-only证据，不能替代真实typed IPC/SQLite/文件闭环。
- 原厂OSS/Pro默认亮色与内部状态由原厂拥有。应用CSS不覆盖BEM/data-slot，不重绑原厂视觉变量，不使用全局!important；布局只写自有类。
- 用户已要求组件设计变化须经允许。沿用会话中已有的明确批准，不重复索要；未经批准的尺寸、variant、reduceMotion、style/className装饰不擅自加入。官方示例与产品编排差异必须明示。
- 不继续向历史styles.css或玻璃主题叠修补规则。每次迁移明确旧入口/规则退出条件，真实页面验收后删除旧展示层；业务数据、权限、审批与来源保留。
- 用户已确认统一亮色布局与“过程正常展开、交接时整段收起”的产品时序，见 IMPLEMENTATION_CONTRACT.md。不能把样张数据或本地演示计时说成provider执行，也不能把合同检查说成业务E2E。
- 相关门禁：`npm run test:ui-contracts`、build及实际修改领域的组件/Electron验证。原厂源和示例指纹变化必须说明原因；不可只更新指纹来消除失败。
