# Phase6 planning policy leaf

2026-11-18。SOURCE_DONE / LEAF_FROZEN。仅新增tasks/planning-policy.ts及phase6-planning-policy-smoke.mjs，精确SHA见SOURCE_MANIFEST.json。

## 稳定接口

```ts
evaluateTaskPlanning(facts: PlanningFacts): PlanningDecision
```

PlanningFacts、PlanningDecision、PlanningLevel、PlanningFacet、PlanningCheck、PlanningReason均由同一新文件导出。输入为main核验后的计数、longRunning、requestedLevel及六facet检查。输出为level、reasons与preflight，checks为完整Record<PlanningFacet,PlanningCheck>。

Level3触发条件依次为longRunning、unresolvedCapabilities>0、selectedProviders>1、requestedLevel3。Level2依次为stepCount>1、dependencyEdges>0、requiredCapabilities>1、requestedLevel2。其余Level1。低requestedLevel保留较高事实层级。

reasons只列所选层实际触发码，固定顺序且最多4条。

- L3为long_running、unresolved_capabilities、multiple_providers、requested_level_3。
- L2为multiple_steps、dependency_edges、multiple_required_capabilities、requested_level_2。
- L1固定simple_task。

checks固定顺序capabilities、dependencies、permissions、risk、artifacts、recovery。缺失默认unknown及空references，已有主源state/references原值深克隆保留。仅Level3要求六项全ready，否则blocked并按固定顺序列出所有blocked/unknown facet。Level1/2整体ready及空blockers，checks仍保存主源blocked/unknown。原Permission Engine独立提供执行授权。

## 输入界限

五个count全部为0至Number.MAX_SAFE_INTEGER安全整数，沿原Task/Registry natural语义，不增加低规模阈值。longRunning必须boolean，requestedLevel为1/2/3。严格检查root、preflight和check对象的known own keys，普通或null-prototype数据对象可用，accessor和symbol字段拒绝。

每facet最多128条reference，每条trim后非空、原长最多2048字符，禁止U+0000–001F控制字符。数量沿Registry list128，长度沿原EffectProof reference2048。reference数组必须稠密、保持原顺序，克隆时保留内容。没有额外要求ready必须提供非空reference。optional undefined视为缺失。失败统一抛Error('invalid_input')。

## 精确测试

```powershell
cd D:/WorkProject/EduProject-harness/apps/desktop
D:/Node/node.exe scripts/xiaozhi-agent/phase6-planning-policy-smoke.mjs
```

首轮固定12/12通过，报告C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase6-planning-policy-bb9Y6c/report.json，SHA256 fa5f465d643195ee7d705eb0d76d6b82426fab4402f045f6731c4646f2c9f4e3。

覆盖三层独立触发与组合原因、requested不能降级、六facet缺项/unknown/blocked、Level3全ready、Level1/2短路径且保存源检查、最大计数/128×2048 reference边界、非法字段/数值/boolean/level/state/refs/原型/symbol/稀疏数组、深冻结输入、输出克隆、字段插入顺序确定性及getter未执行。strict TypeScript noEmit为diagnostics0，git diff --check为exit0。

生产源SHA256 f94925a490a58b07f92f09f3caba539c37518c3d6e2a5cc4e4c77cca6d25a00d。

专项SHA256 05f53a164a4c98da58eddd5a0264bde35623c8563dc1894da9056e8107c32532。

## core接入与验证边界

core从原Task、Registry及原权限/成果/恢复事实派生PlanningFacts，调用纯函数，并沿原Task checkpoint保存level/reasons/preflight。持久化、旧数据兼容、复杂任务实际阻断与Host/Pi用户路径由core接入验证，当前这些集成边界为NOT_RUN。

该源无import、IO、全局可变状态或授权操作。模型/key访问0。root持有Git整合，回滚范围为本leaf两个新增文件及其core调用接线，保留本报告。原ConPTY5/state2文件保持冻结。
