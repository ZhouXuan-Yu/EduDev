# Personal memory candidate worker

The local worker uses LangMem 0.0.30 at commit `4beb9c36a40953f09357e5b2dd62ecc726f22d13` under the MIT license. It calls the stateless `create_memory_manager` interface. Python runtime versions and build dependencies are pinned in the two requirements files.

The Windows x64 bundle is an onedir build using CPython 3.12.12 and PyInstaller 6.22.3. The bundle includes the CPython license and the dependency metadata and license files collected from the installed distributions. PyInstaller's bundling exception applies. [PyInstaller license](https://pyinstaller.org/en/stable/license.html)

Create a dedicated Windows x64 CPython 3.12.12 virtual environment. Install `python/requirements-personal-memory.txt` and `python/omni_edu_personal_memory/requirements-build.txt`, run `pip check`, and set `OMNI_EDU_R2_BUILD_PYTHON` to its absolute interpreter path. From `apps/desktop`, run `node scripts/release/build-personal-memory-runtime.mjs`. Review and verify the generated manifest and bundle before using the bundle in `pack:win`. Release preparation and post-pack validation check the reviewed hashes.

The installed app runs the verified worker from its own resources. It requires no teacher-side Python installation or runtime dependency download. Processing requires the teacher's existing DeepSeek configuration and the applicable memory and source permissions.
