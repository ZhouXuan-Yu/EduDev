# Frozen education adapters

Fixed dispatcher for the existing reading, learning, question and math adapters.
It accepts only one of four host-owned selectors, disables network access and
exits when its parent dies. Protocol validation stays in the existing adapters.

Build: Python 3.12.14, PyInstaller 6.22.3, Windows x64, onedir.
Build with `OMNI_EDU_BUILD_PYTHON=<approved interpreter> npm run build:education-runtime`
from apps/desktop. Users do not install Python. Runtime files and build-input
hashes are recorded in src/main/education/runtime-manifest.json; packaging
rejects missing, changed or stale assets. No runtime model/package downloads.

Sources and notices:

- Python: https://docs.python.org/3.12/license.html — original notice in licenses/.
- PyInstaller bootloader: https://pyinstaller.org/en/v6.22.3/license.html — GPL
  with the distribution exception; original COPYING in licenses/.
- DeepTutor algorithms: Apache-2.0, fixed revision
  f07029cfcf2c8dfccdb671cdfc343db8334f5741. Each bundled adapter directory
  retains its original LICENSE and source-manifest.json.
- SymPy 1.14.0 and mpmath 1.3.0: fixed wheel hashes and original notices in
  the bundled education/vendor/math directory. Their algorithms are not changed.

NumPy, Pillow, SciPy and matplotlib are excluded from this symbolic/pure-code
runtime; OCR retains its existing separate locked runtime and model notices.
This is a build artifact specification, not Windows installation acceptance.
