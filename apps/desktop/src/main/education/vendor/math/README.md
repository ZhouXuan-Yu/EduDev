# Fixed local mathematical dependencies

These are unmodified pure Python wheels from official PyPI, not a second Agent.
Versions and SHA256 are locked in source-manifest.json and independently in
math-worker.py. The worker retains Python `-I -S -B` and adds only these fixed
wheel paths after checking their hashes. It neither installs nor downloads at
runtime and cannot fall back to developer site-packages.

- SymPy 1.14.0: https://pypi.org/project/sympy/1.14.0/
- mpmath 1.3.0: https://pypi.org/project/mpmath/1.3.0/
- Combined compressed wheel bytes: 6,835,551.
- Both principal licenses are BSD-3-Clause. The complete SymPy LICENSE also
  includes upstream notices and MIT terms for included third-party content.
  Preserve the full files here and inside the wheels when distributing.

The regular Electron build copies the fixed wheels, complete licenses and
manifest with math-worker.py. The adapter consumes a bounded JSON AST and
checks submitted formal arithmetic, never completeness of question conditions.
An unknown result remains unsupported. Natural language, general LaTeX parsing,
geometric reasoning and unit reasoning are outside this adapter.

Python availability in a packaged Windows installation remains a separate
delivery gate. Development-machine and frozen Electron checks do not establish
that gate. Remove only the math branch/assets to exit this integration; preserve
all existing reading, learning and question workers and persisted teacher data.
