#!/usr/bin/env python3
"""Validate delivery records, not the authenticity or quality of a running product.

Usage: python scripts/validate_delivery.py delivery.json [--criteria criteria.json]
Exit 0: a DONE record meets the declared structural and evidence requirements.
Exit 2: an honest, structurally valid NOT_STARTED / IN_PROGRESS / BLOCKED record.
Exit 1: malformed input, invalid evidence, or an unsupported claim of completion.

Only the two explicitly supplied JSON files and evidence files contained in the
report directory are read. No network, Git, application execution, or directory
scan is performed. Synthetic fixtures can verify this validator, never the UI.
"""

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path, PurePosixPath, PureWindowsPath


SHA40 = re.compile(r"^[0-9a-fA-F]{40}$")
SHA256 = re.compile(r"^[0-9a-fA-F]{64}$")
STATES = {"NOT_STARTED", "IN_PROGRESS", "DONE", "BLOCKED"}
CHECK_STATUSES = {"PASS", "FAIL", "BLOCKED", "NOT_RUN"}
LAYERS = {"electron", "component", "static", "readback", "git", "measurement"}
RUNTIME_LAYERS = {"electron", "readback", "measurement"}
VERIFICATION_ONLY_LAYERS = RUNTIME_LAYERS | {"component"}
EVIDENCE_PHASES = {"baseline", "iteration", "verification"}


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON object key: " + repr(key))
        result[key] = value
    return result


def read_json(path):
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle, object_pairs_hook=unique_object)


class RecordArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        self.print_usage(sys.stderr)
        self.exit(1, "INVALID: " + message + "\n")


class Validator:
    def __init__(self, report_path):
        self.base = report_path.parent.resolve()
        self.errors = []

    def error(self, location, message):
        self.errors.append(location + ": " + message)

    def object(self, value, location):
        if not isinstance(value, dict):
            self.error(location, "must be an object")
            return {}
        return value

    def array(self, value, location):
        if not isinstance(value, list):
            self.error(location, "must be an array")
            return []
        return value

    def string(self, value, location, nonempty=False):
        if not isinstance(value, str):
            self.error(location, "must be a string")
            return ""
        if nonempty and not value.strip():
            self.error(location, "must not be empty")
        return value

    def choice(self, value, choices, location):
        if not isinstance(value, str) or value not in choices:
            self.error(location, "must be one of " + ", ".join(sorted(choices)))
            return ""
        return value

    def sha(self, value, location, required=False):
        text = self.string(value, location)
        if (required or text) and not SHA40.fullmatch(text):
            self.error(location, "must be a complete 40-character hexadecimal SHA")
        return text.lower()

    def strings(self, value, location):
        items = self.array(value, location)
        result = []
        seen = set()
        for index, item in enumerate(items):
            text = self.string(item, location + "[" + str(index) + "]", True)
            if text in seen:
                self.error(location, "duplicate value " + repr(text))
            seen.add(text)
            result.append(text)
        return result

    def indexed(self, value, location):
        result = {}
        for index, item in enumerate(self.array(value, location)):
            label = location + "[" + str(index) + "]"
            obj = self.object(item, label)
            identifier = self.string(obj.get("id"), label + ".id", True)
            if identifier in result:
                self.error(location, "duplicate id " + repr(identifier))
            else:
                result[identifier] = obj
        return result

    def validate_evidence_file(self, evidence, location):
        relative = self.string(evidence.get("path"), location + ".path", True)
        expected_hash = self.string(evidence.get("sha256"), location + ".sha256")
        if not SHA256.fullmatch(expected_hash):
            self.error(location + ".sha256", "must be a complete SHA-256 digest")
        if not relative or "\x00" in relative:
            if "\x00" in relative:
                self.error(location + ".path", "NUL bytes are forbidden")
            return
        portable = relative.replace("\\", "/")
        posix = PurePosixPath(portable)
        windows = PureWindowsPath(relative)
        if posix.is_absolute() or windows.drive or windows.root or ".." in posix.parts:
            self.error(location + ".path", "must stay relative to the report directory; parent traversal is forbidden")
            return
        try:
            resolved = (self.base / Path(*posix.parts)).resolve(strict=True)
            try:
                resolved.relative_to(self.base)
            except ValueError:
                self.error(location + ".path", "symlink or path escapes the report directory")
                return
            if not resolved.is_file():
                self.error(location + ".path", "must name an existing regular file")
                return
            digest = hashlib.sha256()
            with resolved.open("rb") as handle:
                for block in iter(lambda: handle.read(1024 * 1024), b""):
                    digest.update(block)
            if SHA256.fullmatch(expected_hash) and digest.hexdigest() != expected_hash.lower():
                self.error(location + ".sha256", "does not match the evidence file")
        except (OSError, RuntimeError, ValueError) as exc:
            self.error(location + ".path", "cannot read evidence: " + str(exc))

    def validate(self, raw_report, raw_criteria):
        report = self.object(raw_report, "report")
        spec = self.object(raw_criteria, "criteria")
        package_id = self.string(spec.get("package_id"), "criteria.package_id", True)
        if self.string(report.get("package_id"), "report.package_id", True) != package_id:
            self.error("report.package_id", "does not match criteria.package_id")
        if type(report.get("schema_version")) is not int or report.get("schema_version") != 1:
            self.error("report.schema_version", "must be integer 1")
        state = self.choice(report.get("state"), STATES, "report.state")
        done = state == "DONE"
        baseline = self.sha(report.get("baseline_sha"), "report.baseline_sha", done)
        verified = self.sha(report.get("verified_sha"), "report.verified_sha", done)
        delivered = self.sha(report.get("delivered_sha"), "report.delivered_sha", done)

        criteria = self.indexed(spec.get("criteria"), "criteria.criteria")
        if not criteria:
            self.error("criteria.criteria", "at least one criterion is required")
        required = set()
        needed_layers = {}
        for identifier, item in criteria.items():
            location = "criterion[" + identifier + "]"
            self.string(item.get("title"), location + ".title", True)
            if type(item.get("required")) is not bool:
                self.error(location + ".required", "must be a boolean")
            elif item["required"]:
                required.add(identifier)
            layers = self.strings(item.get("required_layers"), location + ".required_layers")
            for layer in layers:
                self.choice(layer, LAYERS, location + ".required_layers")
            needed_layers[identifier] = set(layers)

        runtime = self.object(report.get("runtime"), "report.runtime")
        kind = self.string(runtime.get("kind"), "report.runtime.kind")
        runtime_sha = self.sha(runtime.get("source_sha"), "report.runtime.source_sha", done)
        fingerprint = self.string(runtime.get("build_fingerprint"), "report.runtime.build_fingerprint", done)
        self.string(runtime.get("launch_path"), "report.runtime.launch_path", done)
        platform = self.string(runtime.get("platform"), "report.runtime.platform")
        if done:
            if kind != "electron" or platform != "win32":
                self.error("report.runtime", "DONE requires kind='electron' and platform='win32'")
            if runtime_sha != verified:
                self.error("report.runtime.source_sha", "must equal verified_sha for DONE")

        evidence = self.indexed(report.get("evidence"), "report.evidence")
        evidence_layers = {}
        evidence_phases = {}
        for identifier, item in evidence.items():
            location = "evidence[" + identifier + "]"
            layer = self.choice(item.get("layer"), LAYERS, location + ".layer")
            evidence_layers[identifier] = layer
            phase = self.choice(item.get("phase", "verification"), EVIDENCE_PHASES, location + ".phase")
            evidence_phases[identifier] = phase
            source = self.sha(item.get("source_sha"), location + ".source_sha", done)
            build = self.string(item.get("build_fingerprint"), location + ".build_fingerprint")
            evidence_note = self.string(item.get("note"), location + ".note")
            self.validate_evidence_file(item, location)
            if done and layer in RUNTIME_LAYERS:
                if not build.strip():
                    self.error(location + ".build_fingerprint", "runtime evidence requires its own nonempty build fingerprint")
                if phase == "verification":
                    if source != verified:
                        self.error(location + ".source_sha", "verification runtime evidence must bind to verified_sha")
                    if build != fingerprint:
                        self.error(location + ".build_fingerprint", "verification runtime evidence must match the verified runtime fingerprint")
                elif phase == "baseline" and source != baseline:
                    self.error(location + ".source_sha", "baseline runtime evidence must bind to baseline_sha")
                # Iteration evidence retains its own valid SHA and fingerprint;
                # it is deliberately excluded from final PASS layer coverage.
            if done and layer == "component" and phase == "verification" and source != verified and not evidence_note.strip():
                self.error(location + ".note", "reused component verification from another SHA requires an explanation")

        checks = self.indexed(report.get("checks"), "report.checks")
        unknown = set(checks) - set(criteria)
        missing = set(criteria) - set(checks)
        for identifier in sorted(unknown):
            self.error("report.checks", "unknown criterion id " + repr(identifier))
        for identifier in sorted(missing):
            self.error("report.checks", "missing criterion id " + repr(identifier))
        check_statuses = {}
        for identifier, item in checks.items():
            location = "check[" + identifier + "]"
            status = self.choice(item.get("status"), CHECK_STATUSES, location + ".status")
            check_statuses[identifier] = status
            ids = self.strings(item.get("evidence_ids"), location + ".evidence_ids")
            self.string(item.get("note"), location + ".note")
            for eid in ids:
                if eid not in evidence:
                    self.error(location + ".evidence_ids", "unknown evidence id " + repr(eid))
            if status == "PASS":
                if not ids:
                    self.error(location, "PASS requires at least one evidence reference")
                eligible_ids = [
                    eid for eid in ids
                    if eid in evidence_layers and (
                        evidence_layers[eid] not in VERIFICATION_ONLY_LAYERS
                        or evidence_phases.get(eid) == "verification"
                    )
                ]
                if ids and not eligible_ids:
                    self.error(location, "historical runtime/component evidence alone cannot substantiate PASS")
                actual_layers = {evidence_layers[eid] for eid in eligible_ids}
                absent = needed_layers.get(identifier, set()) - actual_layers
                if absent:
                    self.error(location, "PASS is missing required evidence layers: " + ", ".join(sorted(absent)))
            if done and identifier in required and status != "PASS":
                self.error(location, "all required criteria must PASS for DONE")

        defects = self.indexed(report.get("defects"), "report.defects")
        for identifier, item in defects.items():
            location = "defect[" + identifier + "]"
            scope = item.get("in_scope")
            if type(scope) is not bool:
                self.error(location + ".in_scope", "must be a boolean")
            severity = self.choice(item.get("severity"), {"S0", "S1", "S2", "S3"}, location + ".severity")
            status = self.choice(item.get("status"), {"OPEN", "CLOSED", "DEFERRED"}, location + ".status")
            ids = self.strings(item.get("acceptance_ids"), location + ".acceptance_ids")
            for aid in ids:
                if aid not in criteria:
                    self.error(location + ".acceptance_ids", "unknown criterion id " + repr(aid))
            if done and scope is True and severity in {"S0", "S1", "S2"} and status != "CLOSED":
                self.error(location, "in-scope S0/S1/S2 defects must be CLOSED for DONE")

        blockers = self.indexed(report.get("blockers"), "report.blockers")
        for identifier, item in blockers.items():
            location = "blocker[" + identifier + "]"
            ids = self.strings(item.get("acceptance_ids"), location + ".acceptance_ids")
            for aid in ids:
                if aid not in criteria:
                    self.error(location + ".acceptance_ids", "unknown criterion id " + repr(aid))
            self.string(item.get("reason"), location + ".reason", True)
            self.string(item.get("unblock_condition"), location + ".unblock_condition", True)
        if done and blockers:
            self.error("report.blockers", "DONE cannot contain blockers")

        teacher = self.object(report.get("teacher_review"), "report.teacher_review")
        self.choice(teacher.get("status"), {"NOT_RUN", "PASS", "FAIL"}, "report.teacher_review.status")
        self.string(teacher.get("notes"), "report.teacher_review.notes")

        delivery = self.object(report.get("delivery"), "report.delivery")
        integration = self.choice(delivery.get("main_integration"), {"PASS", "BLOCKED", "NOT_RUN"}, "report.delivery.main_integration")
        remote = self.choice(delivery.get("remote_contains_commit"), {"PASS", "BLOCKED", "NOT_RUN"}, "report.delivery.remote_contains_commit")
        delta = self.choice(delivery.get("final_delta"), {"none", "evidence_only", "code"}, "report.delivery.final_delta")
        note = self.string(delivery.get("note"), "report.delivery.note")
        if done:
            if integration != "PASS" or remote != "PASS":
                self.error("report.delivery", "DONE requires main integration and remote commit checks to PASS")
            if delta == "none" and delivered != verified:
                self.error("report.delivery.final_delta", "'none' requires delivered_sha == verified_sha")
            if delta == "evidence_only" and not note.strip():
                self.error("report.delivery.note", "evidence_only requires an explanation of the post-verification delta")
            if delta == "code":
                self.error("report.delivery.final_delta", "code changes after verification require re-verification before DONE")
        if state == "BLOCKED":
            if not blockers:
                self.error("report.blockers", "BLOCKED requires a specific blocker and an unblock condition")
            unfinished_checks = any(status != "PASS" for status in check_statuses.values())
            unfinished_delivery = integration != "PASS" or remote != "PASS"
            if not unfinished_checks and not unfinished_delivery:
                self.error("report.state", "BLOCKED must identify an unfinished acceptance or delivery item")
        return state, teacher.get("status"), baseline


def main(argv=None):
    parser = RecordArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("report", type=Path, help="path to delivery.json")
    parser.add_argument("--criteria", type=Path, default=Path(__file__).resolve().parent.parent / "acceptance" / "criteria.json")
    args = parser.parse_args(argv)
    try:
        report_path = args.report.resolve(strict=True)
        report = read_json(report_path)
        criteria = read_json(args.criteria)
    except (OSError, ValueError, RuntimeError) as exc:
        print("INVALID: cannot read valid input JSON: " + str(exc), file=sys.stderr)
        return 1
    validator = Validator(report_path)
    state, teacher, _ = validator.validate(report, criteria)
    if validator.errors:
        print("INVALID: delivery record does not meet validation requirements.", file=sys.stderr)
        for error in validator.errors:
            print("- " + error, file=sys.stderr)
        return 1
    if state != "DONE":
        print("INCOMPLETE: " + state + "; record is structurally valid, but the Goal is not complete.")
        return 2
    print("DONE_RECORD_VALID: declared criteria, evidence files, hashes, version bindings, and delivery fields are consistent.")
    print("This is NOT automatic proof that the UI, permissions, runtime, teacher experience, or stated Git results are genuine or correct.")
    print("Evidence content and real application behavior still require the acceptance procedure. Teacher review: " + str(teacher) + ".")
    return 0


if __name__ == "__main__":
    sys.exit(main())
