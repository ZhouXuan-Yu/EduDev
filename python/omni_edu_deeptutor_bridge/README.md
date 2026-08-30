# Omni-Edu DeepTutor Bridge (DT-0)

This package is the DT-0 sidecar boundary for Omni-Edu. The bridge does not
read SQLite, student files, API keys, or attachments. Its chat/solve/mastery
dry-runs execute the vendored DeepTutor v1.5.11 AgentLoop/Capability code with
a deterministic fake model. The host boundary supports both an explicit
request/result smoke and a native `tool_calls` parity fixture; real model
credentials and production business-tool registration remain a later step.

The vendored source and license evidence are under `python/vendor/`. The
default runtime never depends on `D:\WorkProject\DeepTutor`; set
`DEEPTUTOR_SOURCE_ROOT` only for an explicit source-comparison run.

Run it from the repository root:

```powershell
python -m omni_edu_deeptutor_bridge
```

Install the current bridge runtime dependencies first:

```powershell
python -m pip install -r python/requirements-deeptutor.txt
```

The process accepts one UTF-8 JSON object per line on stdin and emits JSON
objects on stdout. The host must complete `handshake` before `start_turn` and
must treat every event as untrusted until its schema, sequence, turn and
capability scope have been checked. `THINKING` events are reduced to a public
trace marker and are never forwarded as raw hidden reasoning.
