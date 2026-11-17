# Phase5 Extension leaf handoff

Frozen on 2026-11-17 against HEAD 7a93b4baa38f15566c442c69c2d495113757a13b plus the concurrent core/UI WIP. Exact seven owned files and SHA256 values are in SOURCE_MANIFEST.json. No commit or main out build was performed by this leaf.

## Delivery

Five new main-domain files provide createExtensionService, the v1 manifest/view/session/context types, original Sql app_settings CAS metadata, strict bounded RPC, and independent original Extension Permission leases. Two owned scripts exercise the actual native service and the narrow RPC boundaries. Acquisition owns package bytes and returns the immutable PreparedStdioBinding. The leaf adds no AgentLoop, Task database, host IO authority or dependency.

## Stable integration API

Import createExtensionService and types from apps/desktop/src/main/xiaozhi-agent/extensions/service.ts. EXTENSION_HOOKS is also exported there.

Create with {sql, permissions, store, runtime, binding, timeoutMs?}. sql must be the existing serialized state Sql adapter. permissions is the original PermissionService, store its PermissionStore, runtime the original PermissionRuntimeManager. binding(manifest) returns Promise<PreparedStdioBinding> from main-reviewed acquisition state. timeoutMs defaults to 10000 and accepts 50 through 60000 milliseconds.

Manifest has exactly schemaVersion 1, extensionId, version, source, sourceHash, license, licenseHash, artifactId and hooks. source is the exact HTTPS source URL with no credentials or fragment. The binding source must equal its origin. Version must match the immutable binding version and artifactId. Node must be present among the verified package files through executable.packagePath. workspaceActions must be read-only. Repeated binding resolution must preserve the entire recipe identity. The original controlled service rehashes actual files and executable before projection and launch.

The reviewed Node recipe used by actual tests carries arguments --no-addons --preserve-symlinks --preserve-symlinks-main $PACKAGE/worker.cjs. Preserve-symlinks flags are necessary for entry resolution under the existing parent ACL boundaries. No host fallback was introduced.

Context is {owner:()=>PermissionOwner,signal,workspace,requirementsVersion:()=>number}. The dynamic owner is rechecked at original leases and every request. Original Task validation remains with PermissionService and the main owner.

Methods are view(extensionId), list(), install(manifest,revision,context), select(extensionId,version,revision,context), disable(extensionId,revision), revoke(extensionId,version,revision), open(extensionId,context), dispose(). select serves explicit enable/update/rollback by choosing a previously installed unrevoked version after a fresh isolated health check. install validates health and registers an inactive immutable version. A failed install leaves the selected version and revision intact. disable/revoke persist CAS state before closing all owned sessions. No process is started by list/view or service reconstruction.

open returns {manifest,invoke(hook,payload,signal?),logs(),close()}. context.transform returns bounded JSON, event.observe returns null acknowledgement. All guest results are untrusted input for the core adapter. The main adapter must select the permitted public context/event projection before invocation and validate its domain result before using it. Never pass raw native private reasoning or arbitrary host secrets.

## Guest protocol v1

NDJSON JSON-RPC 2.0 uses main-owned unique string IDs. extensions/health receives {schemaVersion:1} and must return exactly {schemaVersion:1,status:'ready',extensionId,version,sourceHash,hooks} matching the frozen manifest. extensions/hook receives {schemaVersion:1,hook,payload} and returns exactly {schemaVersion:1,hook,value}. event.observe value must be null. context.transform value is bounded JSON.

Guest notification extensions/log accepts exactly {schemaVersion:1,level,code}. level is info/warn/error and code is one of started, health_ready, hook_started, hook_completed, hook_failed or stopping. Raw text is rejected. The process-local log ring holds at most 64 records and never persists raw guest text.

RPC has 64KiB message limit, depth16/node4096 bounded JSON, arrays256, objects128, strings32768, four pending requests, 32 outgoing requests/second and 64 incoming messages/second. Original transport additionally limits NDJSON, total bytes, pipes, Job CPU/memory/processes and service lease. Unknown IDs, malformed/extra fields, raw logs, flooding, oversize and timeout close the process. Cancellation closes the entire extension session. Original Grant revoke and owner invalidation close idle sessions through the original lease monitor and helper cleanup.

No host filesystem/network/process/secret/arbitrary IPC method is supported in this first hook contract. Guest-to-host requests receive JSON-RPC -32601 unsupported_host_method. This capability boundary is explicit in native tests. Future host RPC belongs behind separate narrowly typed main adapters and actual Permission scopes. There is no guest-selected IPC channel or ordinary Worker/spawn fallback. Secret values have no manifest/RPC/log/recovery field and no environment is injected by this leaf.

## Required core integration

Core owns production-host/shared/preload/IPC/UI, original Tool manifest and Task/Journal/effect governance. Wrap lifecycle calls through the existing admission/effect boundary. Call open only with the actual active Task/Run/generation, keep session ownership in that Run, and always close/dispose at terminal Task/app cleanup. Map existing Settings controls to view/list/install/select/disable/revoke and expose the real persisted revision. No new Task or Effect truth should be created for Extension.

Core should project unsupported hook/host capabilities explicitly. This leaf intentionally has no standalone Pi registration path. The native tests use the real service and original PermissionEngine/Sql/Job, while production host hook registration and UI acceptance remain integration work.

## Evidence and commands

Run from D:/WorkProject/EduProject-harness/apps/desktop.

- node scripts/xiaozhi-agent/phase5-extension-native-smoke.mjs passed 21/21, failed0, skipped0, paid0. Final report is C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-extension-4WTRx3/evidence/report.json. It contains exact source/script hashes, actual prepared helper hash d7a311eadcccbe2ec747df3b036bad9849a8058b9acb3ef64a4c9e8285d8dcda and all 20 real native receipts. Every receipt has Job children0, profileRemoved true, remainingOwnedAces0.
- node scripts/xiaozhi-agent/phase5-extension-protocol-smoke.mjs passed16/16, failed0, skipped0. Final report is C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-extension-protocol-dSa72q/report.json.
- node node_modules/typescript/bin/tsc --noEmit exited0 on the shared tree after final leaf source changes.
- Scoped git diff --check for the seven owned paths exited0. Full-tree git diff --check exited1 due to skills/private-context.ts:101 new blank line at EOF, owned by core. The owner was notified. CRLF conversion warnings were also emitted for unrelated WIP.

Final native checks took approximately 46.97s in aggregate. Resource policy used Job memory512MiB, CPU rate5000/10000, maxProcesses2, service lease120s, input/output4MiB each. There was no previous Extension service for a before/after latency baseline. UI stream latency and process peak memory were not measured in this leaf.

## Preserved failures

Early TEMP bundle initialization exposed bare ESM dependency lookup and Windows absolute path import issues, corrected through installed-package file URL resolution. Those initial directories remain. First runnable failure XPxshd rejected a dependency source containing a path because original Dependency Scope requires an origin. 4bxjOd showed Node entry realpath rejection before the original acquisition Node flags were applied. nyzOX4 passed14 native checks then exposed a pre-aborted request leaking the raw cancellation reason. The service now returns extension_cancelled and closes that session, with both final protocol and native evidence. All historical TEMP roots remain.

## Unverified boundaries and rollback

Product Pi hook assembly, full Task/Journal/effect tool entry, renderer controls, app cold restart, actual third-party public Extension package compatibility, secret consumption, signed/provenance policy, asar/cross-machine and complete Gate5 acceptance are owned by the integration/Gate5 work. The synthetic native package proves actual Node isolation and lifecycle behavior on this Windows machine. Secret/host IO hooks are explicitly unsupported in v1.

Rollback disables/disposing the service, then stops invoking its API from core. The additive app_settings namespace xiaozhi.extension.v1.* can remain for readback and future recovery. Existing artifact packages, Task/Journal/Permission facts and user data are not removed by this leaf.

Native fixture runtime was released to core immediately after the final21 run. All leaf sessions ended and all tested native cleanup receipts passed. No main out ownership remains with this leaf.
