# 11 — Skill System

## 1. 三层归属

- Personal：默认创建位置，教师个人私有，AI 可自动创建、验证、发布纯说明型 Skill。
- Team：每位教师最多加入一个团队；个人分享产生独立副本；团队管理员审批后发布；团队维护者按角色修改。
- Official：官方审核、发布、撤回和维护，适用于符合条件的用户。

## 2. Skill 与 Tool 区分

Skill 是操作知识/工作流程，不凭空创造执行能力。Skill 通过稳定 Capability ID 声明依赖。Tool/Provider 才执行操作。Skill 不得包含可绕过宿主权限的指令。

## 3. 自动创建生命周期

发现可复用流程（用户明确要求、重复工作流或经验证的稳定方法）→ Draft → 结构检查 → 内容检查 → Capability 依赖检查 → 隐私检查 → 权限声明检查 → 沙箱/模拟测试 → 回归测试 → Personal Publish。

不应每次单次任务都创建 Skill。不得把学生个人信息、教师私有资料正文、凭据或秘密写入 Skill。

## 4. 三层治理

个人发布自动化仅限纯说明型且通过验证；团队发布需管理员审批；官方发布需许可证、来源、安全、兼容性和跨场景测试。分享是独立副本/来源链，不共享可变文件。

## 5. 版本

Semantic Versioning + 不可变内容哈希。版本发布后不覆盖；升级生成新版本；当前激活版本与已发布版本分开；支持回滚和撤回。运行中任务固定其 Skill Version Snapshot。

## 6. 外部 Skill

外部 Skill 是不可信输入。检查来源、许可证、隐藏指令、外链、脚本、依赖和 Capability 需求。纯说明型 Skill 可以在隔离解析和验证后使用；脚本/可执行内容必须走 Extension/代码执行安全流程，不得由现有只读 Skill Runtime 偷偷执行。

## 7. 与当前源码迁移

优先复用 `managed-skills.ts`、`managed-skill-runtime.ts`、`skill-catalog-state.ts`、`native-skill-epoch.ts` 的路径校验、哈希、版本目录、revision/CAS 和活动任务锁。先审计真实表结构，再做最小迁移；不要复制 Skill 正文到 Capability Registry。

## 8. 验收

个人 Skill 自动创建发布；团队分享需管理员审批；官方发布有审核；不可变版本；回滚有效；依赖缺失可识别；Skill 不得扩大权限；敏感数据不会进入包；运行任务使用稳定版本。
