# Local Extension package leaf handoff

Current source is frozen at the three hashes in SOURCE_MANIFEST.json against HEAD7a93b4baa38f15566c442c69c2d495113757a13b with concurrent core changes. Only extensions/package-manager.ts, extensions/package-worker.ts and phase5-extension-package-smoke.mjs were added. Earlier Extension/resource source files were not edited by this leaf. Core owns the local-source compatibility changes in existing validation/service and Permission dependency validation.

## Final frozen result

The current final command is node scripts/xiaozhi-agent/phase5-extension-package-smoke.mjs from apps/desktop. It exited0 with18/18 PASS, failed0, skipped0, paid0. Final evidence is C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-extension-package-sO3nK8/evidence/report.json. The original12 cases and6 exact module formats ran together. All22 actual package-native terminal receipts reported Job children0/profileRemoved true/owned ACE0. The original PermissionEngine active count ended0. Aggregate case time was69.84s. This is a fixed functional suite measurement, with no earlier package-manager performance baseline.

The six actual isolated formats are CommonJS .js without package.json, ESM .mjs, CommonJS .cjs, ESM .js without package.json, .js with its original payload package.json type commonjs, and .js with its original payload package.json type module. Each passed install health, explicit selection health, a live contextTransform hook and observeEvent acknowledgement.

The earlier parent package.json type module constraint caused a real AppContainer health failure for ordinary CommonJS .js. The original candidate three-file snapshot is C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-extension-package-format-f6fa8d78f3b04c44a1311b71e246e1ce/ORIGINAL_MANIFEST.json. The precise format regression was added first, and baseline report C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-extension-package-yJMFbo/evidence/report.json retains9 passes followed by extension_guest_error on that CJS.js. The generated parent metadata is now the neutral {private:true}. The bootstrap remains extension-worker.mjs, and payload package.json bytes retain their original semantics. The parent metadata hash is included in newly calculated artifactId, so its generated-byte identity is explicit. Original package sourceHash still represents the source tree/directory fingerprint. Existing records retain their stored immutable bindings and file hashes.

Final source hashes are in SOURCE_MANIFEST.json. Emitted extension-worker.mjs SHA256 is2650bf52ff0c6baed18291dd03f83892c2e25e303ccf7060336017aaee929917. Generated neutral parent package.json SHA256 isadcf03784d4a1d8e2d50e0e5c6375a7065a127c17519715f22e891ec24a5a4f0. Each artifact's extension-config.json, payload, Node and license hashes are saved in final report.packageBindings alongside the exact manifest and packageHash. Actual prepared helper SHA256 is831632f0aade6c776a6c3f58c5807fe947f3014d53fb60c3f5d3334fa49bd85a.

The final concentrated noEmit run found three core-owned extensions/host.ts Mutation narrowing errors at91/92. The package leaf had no diagnostic. Core was notified to resolve its glue before the unified build. Earlier final package noEmit was exit0 before that concurrent Host change. No overall build/typecheck acceptance is inferred from the leaf18 PASS.

Runtime was explicitly released to core after this final18 run. No package source edit or resource/native process remains active in this leaf. Production host/shared/Pi/UI/Task-Journal-effect acceptance continues with core and Gate5.
## Stable API

Import createExtensionPackageManager, ExtensionPackageRecord and ExtensionPackageContext from apps/desktop/src/main/xiaozhi-agent/extensions/package-manager.ts.

Create with {sql,permissions,root,fetcher,localNode?:()=>string|undefined}. sql is the original serialized Sql, permissions the existing PermissionService, root an app-owned package root, fetcher the existing bounded PublicFetch. prepareManagedNode from acquisition/node-runtime.ts is reused directly with the fixed official NODE_RECIPE. There is no second Node installer or remote package lookup.

Methods are importCandidate(mainPickedAbsoluteDirectory,{signal?}?), prepare(artifactId,context), binding(manifest), list() and verifyProcess(processScope). list returns ExtensionPackageRecord[]. prepare context is the existing ExtensionContext plus optional recordAuthority(reference,grantRefs). The callback runs after original authorization and before preparation I/O, allowing the core Tool/Journal boundary to record actual authority. Main-picked package import is static local acquisition and remains wrapped by core's actual picker/Tool authorization.

The record stores schemaVersion1, artifactId, revision, manifest, entry, provenance, original content file hashes, phase, bounded attempt metadata, immutable binding intent and a fixed error code. The original Sql app_settings namespace is xiaozhi.extension.package.v1.*. Its transaction/CAS and hash protect metadata, while original Task/Journal/effect remain core truth.

## Local package contract

The selected directory contains edudev.extension.json, LICENSE and a declared .mjs/.cjs/.js entry. The JSON has exactly schemaVersion1, extensionId, version, entry, hooks and license. For example, a package may declare context.transform and event.observe, implemented as exported contextTransform(payload) and observeEvent(payload). No lifecycle scripts execute during import. Missing hook exports fail isolated health.

Static import enforces4096 nodes,2048 files, depth16,32MiB per source file,128MiB total, exact safe relative paths and no symlinks/junctions/hardlinks. Empty/relative/UNC picker paths reject. Metadata is bounded64KiB and actual LICENSE512KiB. The complete original tree is asynchronously hashed. SourceHash binds local_import, the picked directory's real object fingerprint and the exact file identities. Already hashed bytes are copied through opened handles into exclusive owned quarantine, with before/after named/handle identity checks and digest equality. The original selected directory identity is checked again after copying. A/B replacement therefore fails instead of mixing a validated source with new entry bytes.

Provenance explicitly remains {kind:'local_import',pickedPath,directoryFingerprint,trust:'unknown'}, including after approval/preparation. Manifest source is edudev-local://extensions/<extensionId>, while Dependency Scope uses the exact internal namespace edudev-local://extensions through core's extensionDependencySource helper. This URI is never fetched and has no network/egress authority. Manifest publisher/remote-source claims are not accepted metadata fields and cannot promote trust.

prepare rejects nonempty workspaces. Core must create a fresh empty app-owned workspace and keep using that workspace when calling the original ExtensionService. It must pass only bounded public hook projections. Teacher directories must not be used as the guest workspace.

## Preparation and execution boundary

Before preparation I/O, the original Permission lease requests exact sourceHash Extension install/run, extension dependency identity/artifact hash, fixed Node dependency hash/version, final Node executable AppContainer process scope, empty workspace read scope, and official nodejs.org/raw.githubusercontent.com GET scopes when preparation is needed. The original lease checks revocation/current owner throughout. Unknown source/license requires those actual scoped approvals. Existing fullAccess cannot replace the independent Extension grant.

Preparation copies the immutable quarantine into payload/, writes main-owned worker/config/package.json bytes, and calls the shared prepareManagedNode. File digests are frozen in the resulting binding. Intent persists before atomic owned directory selection, then prepared metadata commits through CAS. Cancellation/failure closes the original lease and cleans the current exclusive stage. Quarantine and original registered Extension versions remain. Retry after cancellation rebuilds exact bytes. A concurrent manager cannot steal an active same-owner persisted attempt or mutate its revision. An expired/different-owner attempt can be replaced through CAS, and a recorded complete final directory can reconcile before final prepared status.

The generated bootstrap is trusted application code, but it imports the external module only inside actual AppContainer Node. It maps health/hook requests onto contextTransform/observeEvent. Guest console text is discarded, guest errors become fixed RPC codes, arbitrary host IO remains unsupported by the original Extension RPC and no secrets enter config/environment. The binding uses the original --no-addons --preserve-symlinks --preserve-symlinks-main flags and original controlled transport. Every binding/process verification rechecks exact prepared files. Extension version revocation is read from the original Extension state and blocks future binding.

## Core integration

1. Construct the package manager with original serialized state Sql, PermissionService, fetcher and managed extension root.
2. Configure the PermissionService verifyProcess seam to delegate to packageManager.verifyProcess for prepared Node bindings, while preserving existing process verification.
3. The main picker calls importCandidate only for its actual selected absolute directory, then projects the manifest, actual local provenance/license/hash and unknown status into the existing review UI.
4. Existing Tool/Task admission/effect wraps prepare. Pass real owner/generation/requirementsVersion/signal and recordAuthority. A permission_pending result uses existing approvals.
5. Construct the original createExtensionService with binding: manifest => packageManager.binding(manifest). After prepare returns prepared, call original service.install(manifest,actualRevision,context), then explicit select as desired.
6. Original open/invoke/close remain under the same Run and original Pi hook adapter. Use context.transform's returned data as untrusted input and validate the domain result. Guest event payloads contain only approved public projections.
7. Package metadata is main-private. UI projections should expose useful local provenance and state rather than arbitrary absolute package/runtime directories. Core continues to own shared/preload/IPC/UI and real Task/effect/Journal glue.

## Historical evidence before final format correction

Run from D:/WorkProject/EduProject-harness/apps/desktop.

    node scripts/xiaozhi-agent/phase5-extension-package-smoke.mjs

First actual run ntUrlI passed12/12 and exercised real package bootstrap import, both hooks, prepared drift rejection, idle Grant revoke and all Job/profile/ACE cleanup. Its report is C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase5-extension-package-ntUrlI/evidence/report.json.

After that run, final narrow checks added stable nonnullable list output, original picker-directory identity recheck, nonempty workspace rejection and empty picker-path rejection. The fixed12 suite includes those assertions. Two final-source attempts passed all8 static/authorization/cancel/retry/CAS checks but the original RuntimeManager.prepare encountered EPERM at its post-health fs.renameSync(stage,directory), before package native installation. Reports9E6oiP andNhbYxj are preserved at their owned TEMP evidence/report.json paths. Core received the exact original runtime.ts seam and is the owner of any production repair. The runtime window was released. The earlier success is not substituted for final-source native evidence.

Final-source node node_modules/typescript/bin/tsc --noEmit exited0. New-file git diff --no-index --check emitted no whitespace diagnostics, returning1 for the present content diff in this environment. Only standard CRLF conversion warnings appeared. No main out build or commit/push was performed by this leaf.

The fixture uses D:/Node/node.exe only after the shared helper verifies the fixed official SHA. NODE-LICENSE.txt is a previously acquired and hash-verified official143310-byte cache from the known Phase5 production fixture. Test fetches are served from that verified cache, require the exact official license URL, and never fetch internal local identities. No real network download, paid request or key read occurs.

## Remaining boundary and rollback

The final fixed18 check now passes after the core-owned runtime promotion retry and the package format correction. The historical runtime failures below remain preserved. Production picker/UI, main Tool/Task/Journal/effect integration, Pi public-context selection, app cold restart/asar/cross-machine and arbitrary third-party package compatibility remain integration/Gate5 work. Manager reconstruction and persisted SQLite readback were tested, while full app cold restart was not performed here.

Rollback stops invoking this package manager and the associated original Extension version. The additive metadata namespace and owned package evidence can remain for readback. No original teacher data or existing artifact needs removal. Earlier failed reports are retained.
