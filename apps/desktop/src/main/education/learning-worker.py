"""Bounded DTO adapter for pinned DeepTutor algorithms; no model, I/O store or loop."""
import ast
import copy
from dataclasses import asdict, dataclass, field
from enum import Enum
import hashlib
import json
import math
from pathlib import Path
import sys
import time
import types
from typing import Any, Literal

SCHEMA = "xiaozhi.education.learning.v1"
MAX_INPUT = 8 * 1024 * 1024
MAX_RECORDS = 20000
MAX_POINTS = 128
TYPES = {"memory", "concept", "procedure", "design"}


class ModelDTO:
    def model_copy(self, *, deep=False):
        return copy.deepcopy(self) if deep else copy.copy(self)


def dto_field(*, default_factory):
    return field(default_factory=default_factory)


def load_source():
    root = Path(__file__).resolve().parent / "vendor" / "deeptutor-learning"
    manifest = json.loads((root / "source-manifest.json").read_text(encoding="utf-8"))
    if manifest["revision"] != "f07029cfcf2c8dfccdb671cdfc343db8334f5741":
        raise RuntimeError("revision")
    sources = {}
    for entry in manifest["files"]:
        if entry["destination"] not in {"mastery.py", "scheduler.py", "grading.py", "models.py", "policy.py", "LICENSE"}:
            raise RuntimeError("manifest")
        source = (root / entry["destination"]).read_bytes()
        if hashlib.sha256(source).hexdigest() != entry["sha256"]:
            raise RuntimeError("source")
        sources[entry["destination"]] = source
    for name in ("deeptutor", "deeptutor.learning"):
        module = types.ModuleType(name)
        module.__path__ = [str(root)]
        sys.modules[name] = module
    models = types.ModuleType("deeptutor.learning.models")
    models.__dict__.update(Enum=Enum, time=time, Any=Any, Literal=Literal, ModelDTO=ModelDTO, Field=dto_field, dataclass=dataclass, LearningProgress=types.SimpleNamespace)
    sys.modules[models.__name__] = models
    # Mechanical field/enum projection only. Validation is deliberately owned
    # by the strict host protocol; no Pydantic validators are impersonated.
    nodes = [ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0)]
    found = set()
    for node in ast.parse(sources["models.py"]).body:
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.target.id in {"_KNOWLEDGE_TYPE_LEGACY", "_ERROR_TYPE_LEGACY"}:
            nodes.append(node)
        if isinstance(node, ast.ClassDef) and node.name in manifest["modelProjection"]:
            found.add(node.name)
            if node.name not in {"KnowledgeType", "ErrorType"}:
                node.bases = [ast.Name(id="ModelDTO", ctx=ast.Load())]
                node.body = [item for item in node.body if isinstance(item, ast.AnnAssign)]
                node.decorator_list = [ast.Call(func=ast.Name(id="dataclass", ctx=ast.Load()), args=[], keywords=[ast.keyword(arg="kw_only", value=ast.Constant(value=True))])]
            nodes.append(node)
    if found != set(manifest["modelProjection"]):
        raise RuntimeError("dto")
    exec(compile(ast.fix_missing_locations(ast.Module(body=nodes, type_ignores=[])), str(root / "models.py"), "exec"), models.__dict__)
    for short in ("mastery", "scheduler", "grading"):
        module = types.ModuleType("deeptutor.learning." + short)
        sys.modules[module.__name__] = module
        exec(compile(sources[short + ".py"], str(root / (short + ".py")), "exec"), module.__dict__)
    policy = types.ModuleType("deeptutor.learning.policy")
    policy.__dict__.update(KnowledgeType=models.KnowledgeType)
    nodes = [ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0)]
    found = set()
    for node in ast.parse(sources["policy.py"]).body:
        name = node.name if isinstance(node, ast.FunctionDef) else node.target.id if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) else node.targets[0].id if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name) else ""
        if name in manifest["policyProjection"]:
            found.add(name)
            nodes.append(node)
    if found != set(manifest["policyProjection"]):
        raise RuntimeError("policy")
    policy.__dict__["time"] = time
    exec(compile(ast.fix_missing_locations(ast.Module(body=nodes, type_ignores=[])), str(root / "policy.py"), "exec"), policy.__dict__)
    return models, sys.modules["deeptutor.learning.mastery"], sys.modules["deeptutor.learning.scheduler"], sys.modules["deeptutor.learning.grading"], policy


def keys(value, required):
    if not isinstance(value, dict) or set(value) != set(required):
        raise ValueError("shape")


def number(value, minimum, maximum):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not minimum <= value <= maximum:
        raise ValueError("number")


def analyse(request, modules):
    keys(request, {"schemaVersion", "requestId", "operation", "now", "desiredRetention", "points"})
    moment, desired, points = request["now"], request["desiredRetention"], request["points"]
    number(moment, 0, 4102444800)
    number(desired, .7, .99)
    if not isinstance(points, list) or len(points) > MAX_POINTS:
        raise ValueError("points")
    models, mastery, schedulers, _, policy = modules
    scheduler = schedulers.SpacedRepetitionScheduler(desired_retention=desired)
    scheduler.DEBUG_MODE = False
    progress = types.SimpleNamespace(repetition_states={}, knowledge_types={}, learning_evidence=[], error_records=[], qualitative_mastery={}, mastery_levels={}, learner_mastery_overrides=set(), quiz_attempts=[], review_queue=[])
    seen, count, results = set(), 0, []
    for point in points:
        keys(point, {"id", "type", "outcomes"})
        identity, kind, outcomes = point["id"], point["type"], point["outcomes"]
        if not isinstance(identity, str) or len(identity) != 67 or not identity.startswith("kp_") or any(char not in "0123456789abcdef" for char in identity[3:]) or identity in seen:
            raise ValueError("identity")
        seen.add(identity)
        if not isinstance(kind, str) or kind not in TYPES or not isinstance(outcomes, list):
            raise ValueError("outcomes")
        count += len(outcomes)
        if count > MAX_RECORDS:
            raise ValueError("count")
        previous, history = 0, []
        for index, outcome in enumerate(outcomes):
            keys(outcome, {"result", "timestamp", "qualitative", "teacherConfirmed"})
            number(outcome["timestamp"], previous, moment)
            previous = outcome["timestamp"]
            if outcome["result"] not in {"correct", "incorrect", "partial"} or type(outcome["qualitative"]) is not bool or type(outcome["teacherConfirmed"]) is not bool:
                raise ValueError("result")
            event = models.LearningEvidence(evidence_id=str(index), knowledge_point_id=identity, timestamp=previous, source="import", assessment_type="qualitative" if outcome["qualitative"] else "quiz", result=outcome["result"])
            history.append(event)
            progress.quiz_attempts.append(types.SimpleNamespace(knowledge_point_id=identity))
            if outcome["qualitative"] and outcome["teacherConfirmed"]:
                progress.qualitative_mastery[identity] = outcome["result"] == "correct"
        progress.learning_evidence.extend(history)
        progress.mastery_levels[identity] = mastery.compute_mastery([event.result == "correct" for event in history])
        kind = models.KnowledgeType(kind)
        progress.knowledge_types[identity] = kind
        state = scheduler.replay(kind, history, now=moment, desired_retention=desired) if history else None
        if state is not None:
            progress.repetition_states[identity] = state
            if history[-1].result != "correct":
                progress.error_records.append(types.SimpleNamespace(knowledge_point_id=identity, status="active"))
        kp = types.SimpleNamespace(id=identity, type=kind)
        results.append({"id":identity, "mastery":policy.display_mastery(progress, kp), "threshold":policy.gate_threshold(kind), "status":policy.objective_status(progress, kp), "recall":None, "risk":None, "due":False, "state":asdict(state) if state else None})
    progress.review_queue = scheduler.build_review_queue(progress, now=moment)
    tasks = {task.knowledge_point_id:task for task in progress.review_queue}
    for result in results:
        task = tasks.get(result["id"])
        if task:
            result.update(recall=scheduler.retrievability(task.state, now=moment), risk=task.forgetting_risk, due=task.due_at <= moment, state=asdict(task.state))
    return {"points":results, "dueOrder":[task.knowledge_point_id for task in policy.due_reviews(progress, now=moment)]}


def grade(request, modules):
    keys(request, {"schemaVersion", "requestId", "operation", "userAnswer", "expectedAnswer", "questionType"})
    user, expected, kind = request["userAnswer"], request["expectedAnswer"], request["questionType"]
    if not isinstance(user, str) or len(user) > 8000 or not isinstance(expected, str) or not 1 <= len(expected.strip()) <= 8000 or kind not in {"choice", "short", "open"}:
        raise ValueError("answers")
    grading = modules[3]
    correct = grading.grade_answer(user, expected, kind)
    return {"isCorrect":correct, "errorType":None if correct else grading.classify_error(user).value}


def unique_pairs(pairs):
    result = {}
    for name, value in pairs:
        if name in result:
            raise ValueError("duplicate")
        result[name] = value
    return result


def main():
    request_id = ""
    try:
        raw = sys.stdin.buffer.read(MAX_INPUT + 1)
        if len(raw) > MAX_INPUT:
            raise ValueError("bounded")
        request = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_pairs)
        if not isinstance(request, dict) or request.get("schemaVersion") != SCHEMA or not isinstance(request.get("requestId"), str) or not 1 <= len(request["requestId"]) <= 80:
            raise ValueError("request")
        request_id = request["requestId"]
        modules = load_source()
        operation = request.get("operation")
        result = analyse(request, modules) if operation == "analyse" else grade(request, modules) if operation == "grade" else None
        if result is None:
            raise ValueError("operation")
        result = {"schemaVersion":SCHEMA, "requestId":request_id, "ok":True, **result}
        text = json.dumps(result, ensure_ascii=False, allow_nan=False)
        if len(text.encode("utf-8")) > 256 * 1024:
            raise ValueError("bounded")
    except (ValueError, TypeError, UnicodeError):
        text = json.dumps({"schemaVersion":SCHEMA, "requestId":request_id, "ok":False, "error":"invalid_input"})
    except Exception:
        text = json.dumps({"schemaVersion":SCHEMA, "requestId":request_id, "ok":False, "error":"unavailable"})
    sys.stdout.write(text)
    sys.stdout.flush()


if __name__ == "__main__":
    main()
