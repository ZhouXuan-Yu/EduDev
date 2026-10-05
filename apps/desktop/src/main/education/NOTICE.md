# DeepTutor Reading capability

## DeepTutor question format capability

Pinned `THIRD_PARTY_NOTICES.md` was reviewed: its CSSwitch OAuth, Hermes partner registration and thinking-orbs frontend notices concern separate modules not copied or executed by this format projection. The three quiz helpers contain none of those implementations. Retain upstream Apache LICENSE with the original pipeline blob; no additional third-party runtime from those notices is introduced.

`vendor/deeptutor-question/pipeline.py` and Apache-2.0 LICENSE are unmodified Git blobs from HKUDS/DeepTutor revision f07029cfcf2c8dfccdb671cdfc343db8334f5741. `scripts/education/reuse-deeptutor-question.mjs --verify` checks exact bytes and manifest. `question-worker.py` AST projects only the original QuestionType enum, three quiz constants and the parse/normalize/issues method bodies into an isolated class; original imports and agent methods never execute. Host-owned template uses SimpleNamespace; strict JSON injection rejects duplicate/nonfinite payloads. EduDev schema/resource/type gates remain outside original helpers. No additional npm/pip dependency, model, Store or AgentLoop; Python 3.11+ stdlib. Format validity does not prove correct educational content or teacher confirmation. Packaged Python distribution remains a release gate.

Original source: HKUDS/DeepTutor, Apache-2.0, revision f07029cfcf2c8dfccdb671cdfc343db8334f5741 (1.6.13 audit baseline).

`vendor/deeptutor-reading/search.py` and `models.py` are unmodified Git blobs. The original license is included. `source-manifest.json` records upstream paths, hashes and bytes; `npm run verify:deeptutor-reading` compares them against the pinned source objects. Upstream root: https://github.com/HKUDS/DeepTutor.

Adapter files: `reading-worker.py` supplies one-shot bounded quote/search JSON and isolated namespace loading; `reading-host.ts` supplies cancellation, process lifetime and main-owned Python selection; `capability-provider.ts` and `search-provider.ts` supply EduDev material version/privacy gates and Pi tools. `search_units` retains original global matching layers and ranking. EduDev supplies sanitized local units and maps locators to actual saved chunk IDs; these are collected paragraphs, not original pages. They do not import DeepTutor AgentLoop, API, Store, auth or model providers.

No additional pip/npm package is required. Copied upstream assets are 39,486 bytes including Apache license. Python 3.11+ stdlib is required; the development host reuses the existing main-controlled Python selection. Bundling the runtime, packaged execution and offline installer verification remain release tasks; a missing Python fails visibly without returning invented evidence.
