# Terra background independent supplement

Candidate HEAD 5938c31bec9e978fbe82ca3e30a0c92807b0b9c5 plus Phase7 WIP; production out unchanged during runs. Fixture is background BrowserWindow, isVisible asserted false by startWorkbenchFixture. Synthetic owned data in this root; loopback only. Main SHA256 4CE0F33CC20B4C0B1951D17E22617566912C8758AD5240C0DE03AF2F7BA5863C (full out/source fingerprint not independently established).

The independent scenario results are in terra-background-report.json, terra-cold-report.json, terra-skill.png, terra-approval.txt, terra-approval-after.json and terra-cold-approval.png. Initial seed plus test 7 loopback model calls, zero paid, no captured renderer errors; cold 0 model calls and no errors. UI entry Settings > Capability Center > Manage Skills: personal, team, official labels found; version 1.0.0/2.0.0 and provenance present; pending team version 2.0.0 approved through UI and approval status read back. UI version activation changed active version to 1.0.0 and persisted through cold launch. UI approval inbox modern approval succeeded; matching ID state approved in original summary and after cold start. These tests do not establish changed scope/provider invalidation, cross-user access, immutable old version, running-task binding or official review.

Original fixed UI criteria assessment (PASS only within stated specific evidence; full original acceptance is not granted):

| ID | Result | Independent evidence and limit |
| --- | --- | --- |
| UI-01 | PARTIAL | Screenshot 46r34m/workbench-1366x768.png shows total 5 and filtered 4; implementation automated U01 compared summary. Independent full multi-state SQLite comparison not completed. |
| UI-02 | PARTIAL | Automated U01 filtered complete; independently inspected snapshot only. |
| UI-03 | PARTIAL | Snapshot has pending approval, no remaining direct steps, uncertain result reasons. Coverage of all blocked/completed wording and teacher comprehension incomplete. |
| UI-04 | PARTIAL | implementation U03 asserted one new Run same Task via double click; independent replay/stale result not completed. |
| UI-05 | PARTIAL | terra-approval.txt exposes purpose, resource, classification, expiry, rejection consequences for synthetic modern request; other types and full scope coverage not completed. |
| UI-06 | PARTIAL | Independent approval + cold PASS and implementation rejection + cold PASS. Changed scope/provider invalidation and alternative behavior remain. |
| UI-07 | NOT_TESTED | no secret sentinel leakage assertion. |
| UI-08 | FAIL | Capability center screenshot exposes full task hash and requirement version in ordinary view; approval first screen exposes raw tool and JSON plus component path/version; skill screenshot shows SHA256 and untranslated teacher. Technical details are not fully progressive. |
| UI-09 | PARTIAL | implementation screenshot demonstrates uninstalled/isolated/expired/need task check/unavailable candidates, not all five cases. |
| UI-10 | PARTIAL | capability screenshot shows version, source, risk, details disclosure; coverage across all actual providers not complete. |
| UI-11 | PARTIAL | candidate screenshot explicitly shows uninstalled, isolated/expired; no changed-schema/revocation exercise. |
| UI-12 | PASS scoped | Independent skill select contains personal/team/official; not a broader access-control claim. |
| UI-13 | PASS scoped | Independent pending team review shows status, admin approved UI and governance readback, persists after cold. Other roles and official approval not covered. |
| UI-14 | PARTIAL | Independent two versions, provenance and activation to earlier version persist after cold. Running task version binding and immutability remain unverified. |

W1–W3 / A1–A2 / C1–C2 / S1–S2 remain PARTIAL or NOT_TESTED in full. Window mouse drag/maximize/restore and native bounds NOT_TESTED because user stopped Computer Use with physical Escape; no subsequent native window input. Real reasoning delta and streaming progress, generation interaction/cancel/switch, keyboard and all error states incomplete. Existing implementation-agent 9/9 report in 46r34m is supplemental, not independent full page acceptance. Overall REJECTED for UI-08 and incomplete evidence, not phase acceptance.
