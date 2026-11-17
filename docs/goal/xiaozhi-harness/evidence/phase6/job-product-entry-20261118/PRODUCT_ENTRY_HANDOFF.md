# Job recovery normal Host entry follow-up

SOURCE_DONE. Runtime released.

Final targeted source 1ec5576c70f76863b61e0f77fb5ad7369fd9dff7c64db06adbd938d866f5c00d, 617 manifest sources. Two affected checks passed2/2 in one run, exit0, sourceDrift empty.

## Exact normal path

- Original Pi opened a live PTY and answered. Persisted ACK1 survived the narrow job_input committed-Effect trigger failure. The input Effect became unknown, database input/ACK remained1/1.
- Original Host terminal read(commandId) and duplicate write returned acknowledged sequence1. A fresh original-Scope command read AFTER_DUP=42. No command replay or added model request occurred.
- Before Teacher review, actual input Effect was unknown, Job running, original candidate present and canAccept true.
- Original Host reviewTask performed its full preview, then original beforeCompletion local Effect recheck, then closeTask. The exact input Effect became reconciled with job_input proof. Task became completed. Native cleanup was Job0/profileRemoved true/ACE0/ptyClosed true and active leases0.

The fixture no longer imports or directly calls EffectReconciler. Total model POSTs were 2 for initial tool request and answer, additional Teacher-operation model POSTs0.

## Command and report

Working directory D:/WorkProject/EduProject-harness/apps/desktop.

```powershell
D:/Node/node.exe scripts/xiaozhi-agent/phase6-job-recovery-parent.mjs --only J02,J03
```

C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-phase6-job-recovery-CfKkwa\report.json
Report SHA256 c6de6e84e6a1bd856c4eb9d758032e1b7596c65552e3381649834cf73e3426c6

## Frozen changed scripts

- D:\WorkProject\EduProject-harness\apps\desktop\scripts\xiaozhi-agent\phase6-job-recovery-parent.mjs
  SHA256 06c15531a4acca4467ab16d39426bd0d7c89715be742717da050902e9deb5665
- D:\WorkProject\EduProject-harness\apps\desktop\scripts\xiaozhi-agent\phase6-job-recovery-worker.ts
  SHA256 005b1b3482a0bdb84fb3b3d9c4e3b2ab7cd5b7707819014f90c6dada8599f8ee

## Preserved evidence

C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-phase6-job-recovery-7sHl0t\report.json
C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-phase6-job-recovery-leaf\HANDOFF-original-4pass.md
C:\Users\ZhouXuan\AppData\Local\Temp\xiaozhi-phase6-job-recovery-leaf\SOURCE_MANIFEST-original-4pass.json

Original four-subcheck success remains valid for its recorded source and explicit low-level reconciler seam. Its source snapshot and every prior failed report remain preserved. This follow-up closes the normal Teacher API path and changes the final two script hashes.

## Boundaries

- Actual synthetic-loopback Electron/Host/Pi path, no real provider or renderer UI click acceptance.
- Prior low-level reconciler/live-Job proof and initial four-subcheck report are preserved separately.
- This targeted follow-up uses normal Host Teacher APIs, local original beforeCompletion reconciliation and natural Task completion closing the Job.
- Physical ACK loss and parent-kill scenarios were not repeated after this narrow product-entry change.

Production changes belong to core. This leaf changed only its two named scripts and owned TEMP evidence. No build/out/native source/actual model/key/budget ledger/Git write.
Final syntax checks2/2 exit0. Exact fixture native PID inventory0 and Electron inventory0.
