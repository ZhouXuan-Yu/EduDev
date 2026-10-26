# 分支盘点、主线交付与定向清理

日期：2026-10-26。用户授权检查全部分支：无问题的整合main，大改动交其判断。盘点后用户明确删除GitButler分支与orch-t1-paper，保留知识库工作树；再次确认只清理GitButler分支，保留D盘目录及全部未提交文件。

## 实际完成

- 初始检查8个本地分支、7个远端分支（11个不同分支名），及7个工作树；fetch覆盖origin全部heads。未把未提交工作当成分支已合并内容。
- 已验收UI来源与10月24日297项快照一致；形成main提交 `ce98bd16ab261424a04eb48321a159937c00cc80`，实际推送origin/main成功。Git记录291个变更文件，差异包含源码、文档、CSSOM及截图证据；仅换行/stat表现的vendor条目未产生实质修改。
- 其余普通分支的已提交内容均已包含在main；没有为了“合并数量”制造无内容merge。
- GitButler workspace只有一个相对main独有的合成提交，tree与旧master相同，无新增代码；未将其作为业务功能合入。
- 用户指定的本地gitbutler/workspace已删除；远端gitbutler/workspace和ZhouXuan-Yu/orch-t1-paper已用一次atomic push删除。后续ls-remote核对已不存在。
- 知识库分支codex/knowledge-base-delivery及其工作树保留；160个未提交文件未纳入本轮main。
- D盘主仓库保留，HEAD仍为e4763a1，改为detached以安全移除占用分支；619个未提交文件哈希、暂存补丁、未暂存补丁及porcelain状态前后一致。未把D目录同步为main或覆盖其文件。
- Orca工作树的两个未提交试运行文档保留；分支本身没有main之外的新提交。未删除其他分支或目录。

## 分支结论

| 分支/工作树 | 盘点时的情况 | 处理 |
| --- | --- | --- |
| main / origin/main | 已验收UI尚未提交 | ce98bd1提交并成功推送；本审计记录另作收尾提交 |
| codex/chat-ui-ux00 | 已提交内容为main祖先 | 已包含，无需重复合并 |
| master、origin/master、yn-branch-1、小智教育智能体 | 已提交内容为main祖先 | 保留引用，无新增可合内容 |
| 三个Orca分支 | 均停在d3e2dec；两个工作树各有1份未提交试运行文档 | 已提交内容已包含，未提交文档原位保留 |
| codex/knowledge-base-delivery | 提交为main祖先，但工作树另有160个未提交文件 | 按用户要求保留，不擅自打包提交 |
| gitbutler/workspace | 合成标记提交、无新增代码；D盘另有619个未提交文件 | 仅删除本地和远端分支引用，保留主仓库、原HEAD和所有文件 |
| origin/ZhouXuan-Yu/orch-t1-paper | 46个独有提交，174个文件，21处文件冲突 | 用户决定删除；已备份后删除远端引用，未合并冲突旧代码 |

## orch-t1-paper究竟改了什么

比较其分叉点到85304bc，而非假定当前main缺少这些能力。该分支的大部分记录是2026年9–10月的auto-sync；其46个独有提交不能直接视作当前主线的46项新功能。

| 方向 | 主要改动 |
| --- | --- |
| OCR与隐私 | 本地OCR客户端/Worker、错题图片识别；云OCR需教师明确同意上传原图，未知置信度标记待复核。1b67fd5是明确命名的privacy修复 |
| 资料与检索 | 解析、OCR、embedding Python模块，NDJSON Worker封装，资料导入/资源面板、向量索引及检索测试 |
| 智能组卷与题库 | PaperWorkspace、候选/蓝图/题库搜索测试，以及较大db.ts与contracts变更 |
| AI执行协议 | ai-harness工具注册/错误分类、DeepSeek调用及主进程/preload接入 |
| 前端 | App、错题、资料/向量面板、成果库，以及另一批HeroUI聊天/输入/上下文组件组合 |
| 工程与文档 | 多套smoke/验收脚本，启动及权限文档；同时大幅删除或改写多份旧产品/架构规划 |

174个文件中，**72个是.tmp测试打包文件，占新增684,678行**；其余102个项目文件新增14,539行、删除8,565行。不能把总新增699,217行当作有效业务代码。

合并预检有21个冲突文件，涵盖db.ts、main/index.ts、preload/index.ts、App.tsx、contracts.ts、mistake-ocr.ts、package.json、测试及协作状态文档。未进入真实merge状态，也未用ours/theirs覆盖任一侧。用户选择删除该分支后，这21处不做冲突合并。完整路径/提交列表见paper-change-scope.json。

## 备份与恢复

备份目录：`D:\WorkProject\EduProject\.git\codex-backups\branch-cleanup-20261026-a5eda520`。

- orch-t1-paper.bundle：2,022,903字节，包含分支相对main的独有对象；git bundle verify通过。
- gitbutler-workspace.bundle：643字节，合成提交备份；git bundle verify通过。
- 同目录保留原SHA、619文件哈希清单及D盘暂存/未暂存patch；这些本地备份不上传仓库。

需要恢复组卷分支时，可在保有当前main对象的仓库执行：

```powershell
git fetch "D:\WorkProject\EduProject\.git\codex-backups\branch-cleanup-20261026-a5eda520\orch-t1-paper.bundle" refs/remotes/origin/ZhouXuan-Yu/orch-t1-paper:refs/heads/codex/recovered-orch-t1-paper
```

以上仅为恢复说明，本轮没有创建恢复分支或把已删除内容重新合入。

## 验证与边界

- 本轮重新运行build（含tsc）、renderer217＋样式8、UI合同25，均退出0。
- 生成工具类CSS仅修正文件末尾多余空行并同步生成器trimEnd；语义/原厂源码不变，样式8与合同25再次通过。
- 暂存后检查首次发现此前未追踪CSS的EOF空行；本地首提交在推送前已修正并amend。最终git diff origin/main..main --check通过。
- npm audit仍为20个已知告警（low5/moderate5/high9/critical1）；无新依赖，未在版本整合中擅自升级。
- 10月24日真实provider31项、正式导航42项与旧路径207项是当日证据，本轮未重新发provider请求或重跑整套Electron业务验收。UI源与验收快照的实质内容一致。
- GitButler未配置当前关联工作树；其技能reference注明linked-worktree本地提交用Git，本轮未初始化或修改GitButler应用配置。
- 远端默认分支仍为master；本轮按用户指令交付main，未改仓库默认分支设置。

主线交付不等同整体UI及Master目标完成；后续继续处理成果工作台、复杂内页与首段准备延迟。
