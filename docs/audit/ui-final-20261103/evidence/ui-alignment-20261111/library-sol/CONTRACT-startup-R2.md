# S4最后R2冻结合同

当前状态为SOURCE_FROZEN。根已明确“释放R2生产写集”，最小A三文件已实施并完成源AST、195项原真值表及barrel API检查。生产源码现已冻结，正式构建、worker闭包与fresh Electron验收交给根统一排程。原先WAITING_FOR_RELEASE阶段捕获的基线继续保留。

## 唯一候选生产写集

1. 新增 apps/desktop/src/shared/office-relative-path.ts。
2. 修改 apps/desktop/src/shared/xiaozhi-office-artifacts.ts。
3. 修改 apps/desktop/src/shared/xiaozhi-delivery-checks.ts。

将已有officeRelativePath完整移入无运行时依赖的leaf，原artifacts文件导入并重导出同一函数，delivery-checks直接导入leaf。所有其他业务AST、schema、barrel导出、调用结果和权限规则继续保持原实现。

## 固定验收

- 修改前保存两份既有文件原字节SHA、原路径函数AST、其他业务节点AST、barrel导出表及原函数真值表。修改后逐项比较，包含500/501字符、8/9层、控制字符、Windows设备名、私密目录、非字符串值等边界。
- leaf的唯一运行时内容为原函数，保留原AST，barrel原导出名及函数引用身份兼容。真实validOfficeProposal和validDeliveryCheckInput消费者继续使用原导入路径验证。
- 根正式build/tsc/sourceguard后，静态遍历inspection-worker.js的本地import/export闭包，必须实际退出DSL、paper/classroom业务及原相关materials/OCR/attachments块。闭包检查失败按未达到R2目标记录。
- fresh Electron第一项仍为原冷XML，原15s预算；原HTML、Hana reader、取消、utility timeout沿既有有界QA。Hana原30s消费者与正式main-thread工具路径继续由根原三链验收。
- A11维持20s就绪，207 smoke及完整性按原门禁执行。cold进程与OS缓存条件分别记录，首项冷XML原FAIL及全部历史失败继续保留。

## 轮次与停止边界

这是S4最后R2，次数沿原记录。本轮实施一次，按本合同验证。若仍FAIL，如实保存证据并移交根结项判断；后续状态不通过更名或追加第三轮延长。

根维护唯一RESULT。回滚恢复两份原barrel/source及移除本轮新leaf后统一重建，业务数据无需迁移。

## 已准备的QA命令

目录为 D:/WorkProject/EduProject/apps/desktop。

```powershell
node test-results/ui-alignment-20261111/library-sol/startup-R2-qa.mjs --capture
```

此命令只读取当前生产源码并在library-sol写入修改前QA基线，已存在基线时拒绝覆盖。生产释放并实施后再执行下列命令。

```powershell
node test-results/ui-alignment-20261111/library-sol/startup-R2-qa.mjs --verify-source
node test-results/ui-alignment-20261111/library-sol/startup-R2-qa.mjs --verify-api
node test-results/ui-alignment-20261111/library-sol/startup-R2-qa.mjs --verify-build 'D:/WorkProject/EduProject/apps/desktop/test-results/ui-alignment-20261111/after-startup-R2-out'
```

最后一项使用根实际指定的R2正式buildRoot。源/API/闭包分别报告结果，闭包与Electron首次解析均通过后再由根判定产品验收。

现有startup-R1-electron-run.mjs在根排程后对该R2正式build先运行xml，再顺序运行html、hana-reader、reader-cancel、utility-timeout，保持原15/30s。当前准备阶段只做CLI基线捕获和脚本语法检查。
