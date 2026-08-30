# EVAL: DeepTutor native tool-call host boundary

## Capability evals

1. 上游 `AgentLoop` 能从原生 provider `tool_calls` 解析出工具名与 JSON 参数。
2. DeepTutor `dispatch_tool_calls()` 只执行显式注册的 `_HostProxyTool`，不直接读 Omni SQLite 或学生文件。
3. sidecar 发出 `xiazhi.host_tool.request.v1`，Electron main 返回 schema 合法的 blocked/succeeded result。
4. blocked result 会回到 AgentLoop，产生可审计的 observation，并继续到 result/done 终态。
5. `event_sink` 等 dispatcher 内部 kwargs 不会跨进程序列化；未知参数被边界清洗。

## Regression evals

1. 非法 JSON、超大帧、未知 capability、重复 turn、取消幂等仍 fail-closed。
2. 每个 turn 的 sidecar sequence 连续，SQLite 宿主 sequence 仍连续。
3. `<think>`/`<thinking>` 和 secret-like 文本不进入公开事件或 SQLite detail。
4. 显式 HostToolProxy request/result smoke、普通 chat dry-run、DeepSolve dry-run 仍通过。

## Mastery managed-write evals

1. `mastery_assess` only accepts concept/design; procedure/memory must use quiz/grade. Assess returns a bounded pending mutation and only a teacher-confirmed `save_mastery_state` may write explicit `mastery_attempt` evidence.
2. `mastery_build` validates module/point names, counts, and types atomically; one malformed node blocks the whole pending mutation and no database write occurs before confirmation.
3. `mastery_build` replace/append persists versioned `ai_mastery_paths` only after confirmation; append remaps IDs and the path is readable through the main-process preload.
4. `mastery_quiz -> ask_user -> mastery_grade` keeps expectedAnswer out of checkpoint/events; duplicate grade and answer mismatch are blocked.

## ModelProxy security evals

1. sidecar model request 不包含 API Key、Authorization header 或 secret-like 字符串。
2. Electron main 缺少 provider credential 时返回 blocked/failed，不产生 succeeded done。
3. provider error/timeout 进入 failed run，错误 detail bounded，SQLite evidence 不包含凭证。

## Success metrics

- Capability: 5/5，连续 3 次运行全部通过（pass@3 >= 0.90，pass^3 = 1.00）。
- Regression: 4/4，连续 3 次运行全部通过（pass^3 = 1.00）。
- ModelProxy security: 3/3，协议 round-trip 与缺凭证 fail-closed 通过；live provider 未执行。
- Release boundary: fake parity 通过不等于真实模型或真实业务工具生产可用；两者必须单独建立 live evidence。

## Commands

```powershell
cd D:\WorkProject\EduProject\apps\desktop
npm run test:deeptutor-capability-evals
npm run test:deeptutor-bridge
npm run test:deeptutor-host-proxy
npm run test:deeptutor-agent-tool-call
node scripts/electron-smoke.mjs
```

## 48-case capability eval baseline (2026-08-11)

`npm run test:deeptutor-capability-evals` passed 48/48: control-plane 12/12, context-governance 10/10, education-loop 8/8, practice-loop 6/6, mastery-boundary 6/6, reply-contract 6/6. This is a deterministic local contract and adversarial gate; it does not claim live DeepSeek, cross-process recovery, latency SLO, or external teacher-sample acceptance.
