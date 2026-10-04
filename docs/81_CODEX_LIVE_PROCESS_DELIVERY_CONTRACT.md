# P06：截图校准与真实过程交付合同

日期2026-10-03；M10/M01。接docs/67、80，保留完整Codex外观/交互/模型设置目标和P07/P08。用户参考原图保持原字节；本轮先D1实测基线与P06a真实过程，不以子项通过称完整视觉完成。

## 1. 教师结果与实际缺口

现有Pi SDK已经公开分段text与实际tool事件交错，正式typed snapshot/renderer和真实provider贯通。当前commentary一律变灰、每个工具不可展开、压缩成功仍大段卡、没有实际轮次耗时，右栏和总体壳与图仍有差距。先让过程区接近R1：深灰公开说明与细灰动作交错、连续实际工具组可展开、每项状态/耗时/真实来源可查、失败不默认隐藏、上下文整理细行；最终回复保留之前段落。

## 2. 本轮修改范围与真源

- 先保留当前Electron双视口基线和DPR/zoom/字体/窗口/DOM测量JSON，参考R1/R2的尺寸/hash及区域坐标表。原图没有DPR/zoom，候选换算只作假设；不得宣称已证同DPI或≤2px。一比一剩余差距明确保留。
- shared Xiaozhi事件/Office投影增量可选时长字段；真实Pi tool start/end用main单调时钟测完成耗时，usage真实activeMs+waitingMs投影轮次时长。不从模型文字、计时动画或客户端收到时间伪造实际耗时；旧缺字段显示未知或省略。
- existing main Pi subscribe→已持久事件→typed preload/snapshot→OfficeConversation贯通，无新IPC/SQLite表。纯展示分组只合并连续tool项，不跨公开assistant/计划/压缩/控制事实、不隐藏失败。call IDs和每条source保留。
- 复用现成HeroUI Pro ChatTool/Disclosure、ChainOfThought、ChatConversation、ChatMessage/StreamMarkdown原slots和已移植编译CSS；HeroUI MCP再核官方docs，Pro源码使用既有本地闭包，不新增手写交互组件库。Finesse固定product/ai-console的真实状态/展开证据/停止可达规则，用户截图优先。
- tool详情使用main已经投影的真实来源、状态与实际时长；不将任意原始tool args/output、SDK reasoning或凭证带入renderer。缩略图/文件面板按对应事实接入，尚无真实可公开image事件的部分保持D3/P07依赖，不能补假缩略图。

## 3. 兼容与恢复

版本化投影v1增加可选字段、旧数据无字段仍可回读；旧入口在新实例通过前保留。事件序号/身份/数据库真源和模型权限不变，无新依赖/迁移/源覆盖。UI失败可回退此次独立过程组件/CSS，不改变SDK历史或教育事实；停止/提问/审批始终真实可达。

## 4. 完成定义与门禁

1. 真实Electron基线记录、参考区域表与未知DPI边界落文件，保留before/after；独立D1测量完成不等于全部D1同DPI验收。
2. meaningful投影/分组契约覆盖实际顺序、并行call ID/重复end/失败/未知时长/旧v1；不以实现镜像测试代替实例。
3. 实际DeepSeek自然教育请求产生公开说明→真实教育工具→后续正文；对照native公开text/main事件/UI逐项身份/顺序，展开真实来源与时长，重启/双视口、失败/停止/提问路径，输入清空和历史阅读保留。
4. build、renderer-components、模块专项和固定out Electron smoke、git diff --check；精确通过/失败/未验证边界写下一验收文档与四协作文档。不在UI重启期间重建out。

## 5. 下一顺序

P06a过程实际通过后P06b窄轨/侧栏/标题/阅读列/输入/资料卡及真正文件面板，P06c国内模型选择和设置/偏好/Skills统一入口；按docs/67 D1–D7不断测差距。P07办公联网/实际产物，P08实际无VPN安装、新旧数据与最终八组实例；总目标active，三元题组暂停，无提交/推送/真实教师资料或系统网络修改。
