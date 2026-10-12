"""Validate this audit's artifacts. Does not build or run the application."""
import datetime
import hashlib
import json
import re
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def read_json(name):
    return json.loads((HERE / name).read_text(encoding="utf-8-sig"))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


required = [
    "README.md", "SCOPE.md", "A_CURRENT_ARCHITECTURE.md", "B_FINDINGS.md",
    "C_SOURCE_REUSE.md", "D_TARGET_HARNESS.md", "E_EVENT_UI.md", "F_NEXT_GOALS.md",
    "EVIDENCE.md", "REQUIREMENTS_CHECK.md", "evidence.json", "source-index.json",
    "mu-index.json", "source-drift.json", "doc-updates.json", "hero-ui-query.json",
    "validate-audit-docs.py",
]
missing = [name for name in required if not (HERE / name).is_file()]
evidence = read_json("evidence.json")
symbol_issues, drift = [], []
for record in evidence["records"]:
    source = Path(record["file"])
    if not source.is_file():
        symbol_issues.append(record["id"] + " missing file")
        continue
    lines = source.read_text(encoding="utf-8-sig").splitlines()
    line = record["line"]
    if not 1 <= line <= len(lines) or record["symbolOrLiteral"] not in lines[line - 1]:
        symbol_issues.append(record["id"] + " symbol/line mismatch")
    current = digest(source)
    if current != record["sha256"]:
        drift.append({"id": record["id"], "file": record["file"],
                      "before": record["sha256"], "current": current})

local_links = 0
broken, fences, secrets, whitespace = [], [], [], []
for document in HERE.glob("*.md"):
    text = document.read_text(encoding="utf-8-sig")
    if len(re.findall(r"^```", text, re.M)) % 2:
        fences.append(document.name)
    if re.search(r"\bsk-[A-Za-z0-9]{16,}", text):
        secrets.append(document.name)
    for number, line in enumerate(text.splitlines(), 1):
        if line.rstrip() != line:
            whitespace.append(f"{document.name}:{number}")
    for match in re.finditer(r"\[[^\]]+\]\((?:<([^>]+)>|([^\s)]+))\)", text):
        target = match.group(1) or match.group(2)
        if target.startswith(("https://", "http://", "#", "mailto:")):
            continue
        target = re.sub(r":\d+$", "", target).split("#")[0]
        destination = Path(target) if re.match(r"^[A-Za-z]:[/\\]", target) else document.parent / target
        local_links += 1
        if not destination.is_file():
            broken.append({"file": document.name, "target": target})

goals = (HERE / "F_NEXT_GOALS.md").read_text(encoding="utf-8")
sections = re.split(r"^## H(\d{2})[^\n]*\n", goals, flags=re.M)
goal_issues = []
for index in range(1, len(sections), 2):
    number, body = sections[index:index + 2]
    for field in ["目标/必要性", "文件/模块", "步骤", "依赖/风险", "自动/实例验收", "DoD", "回滚"]:
        if "**" + field + "**" not in body:
            goal_issues.append("H" + number + " " + field)

updates = read_json("doc-updates.json")
state_issues = []
for update in updates["updated"]:
    text = (ROOT / update["file"]).read_text(encoding="utf-8-sig")
    for marker in ["start", "end"]:
        if text.count(f"<!-- harness-audit-20261012:{marker} -->") != 1:
            state_issues.append(update["file"] + " " + marker)

diff = subprocess.run(["git", "diff", "--check"], cwd=ROOT, capture_output=True,
                      encoding="utf-8", errors="replace", check=False)
diff_output = diff.stdout + diff.stderr
(HERE / "diff-check.txt").write_text(diff_output, encoding="utf-8")
master_after = digest(ROOT / "docs/goal/XIAOZHI_CODEX_GOAL.md")
checks = {
    "requiredArtifacts": len(required), "missingArtifacts": missing,
    "sourceRecords": len(evidence["records"]), "sourceSymbolIssues": symbol_issues,
    "sourceHashDrift": drift, "localLinks": local_links, "brokenLocalLinks": broken,
    "unclosedCodeFences": fences, "secretPatternFiles": secrets,
    "auditMarkdownTrailingWhitespace": whitespace, "goalSections": (len(sections) - 1) // 2,
    "missingGoalFields": goal_issues, "stateDocuments": len(updates["updated"]),
    "stateMarkerIssues": state_issues, "masterBefore": updates["masterBeforeDocUpdates"],
    "masterAfter": master_after,
}
passed = not any([missing, symbol_issues, drift, broken, fences, secrets, whitespace,
                  goal_issues, state_issues]) and checks["goalSections"] == 10
passed = passed and checks["masterBefore"] == master_after and diff.returncode == 0
report = {
    "schemaVersion": 1, "capturedAt": datetime.datetime.now().astimezone().isoformat(),
    "scope": "documentation/source-reference validation only; zero application functional cases run",
    "command": "python docs/audit/harness-2026-10-12/validate-audit-docs.py",
    "checks": checks,
    "applicationTests": {"executed": 0, "networkImageFailuresClosed": False,
                         "referenceRepositoriesExecuted": False, "dailyElectronRestarted": False,
                         "providerRequests": 0},
    "gitDiffCheck": {"pending": False, "command": "git diff --check",
                     "exitCode": diff.returncode, "outputLines": len(diff_output.splitlines()),
                     "log": "diff-check.txt",
                     "scope": "tracked workspace diff; untracked audit Markdown checked separately"},
    "passed": passed,
}
(HERE / "validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                                     encoding="utf-8")
print(json.dumps({"passed": passed, "sourceRecords": checks["sourceRecords"],
                  "localLinks": local_links, "goalSections": checks["goalSections"],
                  "sourceHashDrift": drift, "gitDiffExit": diff.returncode}, ensure_ascii=False))
raise SystemExit(0 if passed else 1)
