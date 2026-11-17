# Phase5 MCP Secret UI increment

## Contract and result

PASS for the bounded component implementation. The existing MCP service panel now configures, replaces and clears credentials through the released typed setXiaozhiMcpCredential API. Server status, configured state and catalog revision come from returned catalogs. The configured-state compatibility choice uses credentialConfigured when supplied, otherwise an existing credentialReference indicates configured, and absent fields show an unknown state. Reference identifiers remain outside visible metadata.

The password is a local controlled input with autocomplete off. Successful accepted mutations clear its draft. Session changes remount the credential component and clear the original add-form secret. Session and request-generation fencing suppresses stale refresh, action result, notice, draft clearing and busy completion. Typed CAS and secure-storage failures retain the local correction draft and display the existing mapped error.

Non-readOnly tools can now be selected. Tool names, schema hashes and trust payloads retain their existing contract. The hint describes the service claim. The explanatory text states external-operation governance, current-task permission checks and a single attempt per call.

## Actual commands and evidence

Working directory D:/WorkProject/EduProject-harness/apps/desktop.

- node scripts/xiaozhi-agent/phase5-acquisition-renderer-smoke.mjs --mcp-secret-only
- Before implementation exit 1 with 0/6. Original report C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-phase5-acquisition-renderer-XHW9sg\report.json is preserved as before-report.json and before.log.
- node scripts/xiaozhi-agent/phase5-acquisition-renderer-smoke.mjs
- After implementation exit 0 with 20/20. Original report C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-phase5-acquisition-renderer-O3S7hG\report.json is preserved as after-report.json and after.log.
- git diff --check -- followed by the seven paths in freeze.json returned 0. Git emitted its existing PiEnvironmentSettings LF-to-CRLF warning. Exact output is in diff-check.log.

The concentrated suite contains the previous 14 acquisition, polling, busy, environment and prepare-ordering checks plus six credential/effect regression groups. The six groups cover password/input payload, replacement and clear with returned unverified/trust state, CAS/storage errors, original running/in-flight locks, old-session/unmount responses, and non-readOnly tool selection with exact names/schema/revision.

The previous six-file candidate is retained by previous-freeze.json and the original evidence at C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-prepare-ordering-e58db43f729e4fe39eebb6bead7a1bc6. Its ordering 0/2 failure and 14/14 repair remain separate historical evidence. PiMcpSettings-before.tsx and component-test-before.mjs preserve this increment's starting files.

## Changed files and controls

This increment changes PiMcpSettings.tsx, adds neighboring PiMcpCredential.tsx and expands the dedicated phase5-acquisition-renderer-smoke.mjs. The seven-file freeze also records the other four unchanged UI delivery files. Source snapshots and complete SHA256 values are in freeze.json. No dependencies were added.

- pi-mcp-credential-<serverId> is the password input.
- pi-mcp-credential-status-<serverId> shows configured, unconfigured or unknown.
- pi-mcp-credential-save-<serverId> configures or replaces.
- pi-mcp-credential-clear-<serverId> clears.
- Existing pi-mcp-tool-<serverId>-<toolName>, pi-mcp-trust-<serverId>, pi-mcp-notice and connection controls retain their IDs.

## Verification boundary

NOT_RUN for full-source TypeScript checking, build, Electron UI, actual safeStorage, IPC transport, persisted catalog readback, real MCP/network/model/provider paths, keyboard and viewport behavior, and performance before/after. The component suite uses actual React/HeroUI components in JSDOM with a deferred synthetic typed bridge and fake credential. This increment supplies component evidence. Core owns the final global typecheck/build and root coordinates real UI and fresh Gate5 acceptance.

The UI mutation success path relies on main's released response that marks the server unverified and revokes prior trust. The component accepts those returned facts. The main implementation remains responsible for CAS, busy checks, secure storage and execution permissions.

## Rollback

For this increment restore PiMcpSettings-before.tsx and component-test-before.mjs into their two original paths and remove only this increment's PiMcpCredential.tsx. Keep the earlier acquisition delivery and unrelated collaborator changes. No schema or data migration was introduced by this renderer increment.
