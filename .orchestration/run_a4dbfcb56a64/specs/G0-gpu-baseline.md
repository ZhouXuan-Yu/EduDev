# Role
Platform worker G0 — GPU capability baseline. No business code changes.

# Target
- Create an isolated venv at `C:\Users\ZhouXuan\AppData\Local\OmniEdu\venvs\gpu` (absolute, outside repo/worktrees).
- Do not modify `D:\Anaconda`.
- Worktree: current.

# Change
1. Create venv with `D:\Anaconda\python.exe -m venv <path>`.
2. Install CUDA 12.8+ compatible PyTorch GPU wheel for RTX 5060 Laptop (Blackwell sm_120). Verify:
   - `torch.__version__`, `torch.version.cuda`, `torch.cuda.is_available()`, device name, capability.
3. Install `onnxruntime-gpu` version supporting Blackwell + CUDA 12.8. Verify `CUDAExecutionProvider`. If not possible, record exact blocker and CPU fallback.
4. Install `rapidocr`, `sentence-transformers`, `lancedb`, `pillow` compatible versions in the venv.
5. Run GPU smoke:
   - RapidOCR on a generated Chinese sample (reuse the `python/ocr-smoke.py` approach; do not modify the original).
   - sentence-transformers encode a Chinese sentence; record device + latency.
   - Record VRAM usage.
6. Verify CPU fallback: force CPU provider / no CUDA; ensure existing `python/ocr-smoke.py` still works with the venv.
7. Write `.orchestration/run_a4dbfcb56a64/g0-gpu-baseline.md` with exact commands, package versions, benchmark table (CPU vs GPU), VRAM, rollback instructions, and `OMNI_EDU_PYTHON` usage.

# Constraints
- No global pip installs; no changes to `D:\Anaconda`.
- No business code, package.json, lockfile, DB, or migration changes.
- Do not commit business files; the report is allowed.
- Time bound: if a single step exceeds ~30 minutes or needs reboot/manual driver install, stop and report blocker.
- 8GB VRAM: run GPU benchmarks serially; do not run multiple GPU jobs.
- Do not delete the venv on failure; document it.

# Ownership
- You own the venv path and `.orchestration/run_a4dbfcb56a64/g0-gpu-baseline.md`.
- Do not edit repo files.

# Observable acceptance
- Report exists.
- `torch.cuda.is_available()` result recorded; if false, exact blocker + fallback.
- `ort.get_available_providers()` recorded; if CUDA provider absent, exact blocker.
- RapidOCR and embedding smoke results recorded with latency.
- CPU fallback verified.
- `worker_done --files-modified .orchestration/run_a4dbfcb56a64/g0-gpu-baseline.md --report-path .orchestration/run_a4dbfcb56a64/g0-gpu-baseline.md --outcome succeeded|failed`.
