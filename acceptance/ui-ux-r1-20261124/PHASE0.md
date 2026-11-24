# Phase 0 冻结记录（2026-11-25）

本轮唯一执行入口为原包 `contract/01_EXECUTION_GOAL.md`。用户授权覆盖旧UI-FINAL每阶段两轮上限；原28项全部保留，不改Master、不接管其他AI领域工作。正常修复须推进具体缺陷或新证据。

源码从刷新后的 origin/main `700143faca7051baca892b50cf5081ff297ec9bb` 建立独立分支 `codex/ui-ux-r1-20261125`，目录 `D:/WorkProject/EduProject-ui-ux-r1-20261125`。没有回退到历史截图分支。D盘原目录停留在独立的detached提交且有其他人的未提交内容，逐文件哈希及所有工作树见 `evidence/phase0-git.json`。数据库、记忆、Harness等工作树保留，不操作其窗口或进程。

独立 `npm ci` 完成1178包；独立安装Electron43.8.3。锁文件SHA256为 `f9008ffaef15bfa8bd6cf4e6b1fd647951e6e1970cffd15bb8957f131249e5f8`。HeroUI OSS及styles均3.2.2、React19.2.8，沿原Pro CSS和本地组件；不升级依赖。DesignUIstandard技能是Vue/Element Plus公司项目规范，不覆盖本React项目。

基线 `npm run build` 通过（含类型检查），`npm run test:renderer-components` 261/261。日志见logs。构建同步生成的Pi包和manifest单列，非人工vendor修改，不纳入UI提交。原构建脚本自动生成内容的字节/行尾差异须在提交前核对。

真实生产Electron由本树 `apps/desktop/out/main/index.js` 启动，原typed preload、SQLite/文件主进程保持。独立空profile，虚构学生由界面创建；网络在主进程加载前禁止。本地页面基线不冒充模型/工具生成验收。基线PID62860、file URL、源码树与out指纹、57幅页面/设置截图、三种CSS viewport和DPR见 `evidence/baseline-pages-5Sg42U/report.json`。该窗口已由脚本正常关闭；最终会另启动验收构建。

当前记录覆盖18页面合同及现有设置子页/入口，页面表只表示基线盘点，不表示有数据、错误和恢复均通过。首轮无pageerror，无顶层横向溢出；部分截图处于加载态，不能当作稳定空态。后续按实际状态补证。

已复现D01：设置根布局迁移后不含旧`.pi-settings-workspace`，Hana结构组件依赖的间距变量只定义在旧类。CSSOM `--space-24/40`为空，截图段落贴合。最小修复是在应用自有设置结构范围补齐布局变量，避免重新启用旧类中的广泛控件覆盖。D02当前分类与hover共用背景；只调整应用导航类。D03当前会话不存在时选择最新会话；只取消UI fallback，不更改宿主授权。D04任务原生select/summary及层次混杂；用已安装HeroUI组合替换，保留原查询、身份和合法动作。

本轮范围：应用布局/页头/状态、现有页面内精简、设置真实范围和保存反馈、任务摘要、原生小控件与键盘状态、对象返回连续性、18页尺寸/状态、原对话保护回归及三条真实业务链路。写入范围限renderer所属局部模块、必要测试及本专项证据。数据表、迁移、typed IPC、Pi/Harness、权限/记忆算法不修改。API、枚举、scope、保存及失败语义见CONFIG_CONTRACT，尚未实测的内容明确标记。

不实施未确认的新导航架构、教学工作台新首页、六类固定设置；不重写OfficeComposer/工具栏/弹层/消息队列/PiComposerPendingPanel，不增UI库，不改vendor、不堆全局styles.css或!important。旧A01–36全映射，本轮保护/受影响项重新验证，未涉及业务保持原状态。

执行顺序沿P1→P2→P3→P4→P5；可独立部分先做。真实模型/Office/缩放等依赖缺失须留实际检查、尝试和恢复入口。模型结果不能由fixture、静态题或代理生成代替。全部必选通过才DONE；仍有外部必要依赖时完成独立工作后BLOCKED。回滚以本轮独立提交的git revert供审查，不重置其他工作树和用户数据。
