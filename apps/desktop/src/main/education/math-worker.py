"""Fixed deterministic SymPy adapter. No strings are evaluated as expressions."""
import hashlib
import json
from pathlib import Path
import re
import sys

SCHEMA = "xiaozhi.education.math-check.v1"
WHEELS = {
    "sympy-1.14.0-py3-none-any.whl": "e091cc3e99d2141a0ba2847328f5479b05d94a6635cb96148ccb3f34671bd8f5",
    "mpmath-1.3.0-py3-none-any.whl": "a0b2b9fe80bbcd81a6647ff13108738cfb482d481d826cc0e02f5b35e5c88d2c",
}


class InvalidInput(Exception):
    pass


class OutsideScope(Exception):
    pass


def fields(value, keys):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise InvalidInput()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise InvalidInput()
        result[key] = value
    return result


def load_sympy():
    vendor = Path(__file__).resolve().parent / "vendor" / "math"
    for name, digest in WHEELS.items():
        wheel = vendor / name
        if hashlib.sha256(wheel.read_bytes()).hexdigest() != digest:
            raise RuntimeError("dependency_unavailable")
        sys.path.insert(0, str(wheel))
    import sympy
    import mpmath
    if sympy.__version__ != "1.14.0" or mpmath.__version__ != "1.3.0":
        raise RuntimeError("dependency_unavailable")
    return sympy


def verify(request, s=None):
    kind = request.get("kind")
    fields(request, ["schemaVersion", "requestId", "kind", "left", "right"] +
           (["domain", "roots"] if kind == "polynomial" else []))
    if kind not in ("expression", "identity", "polynomial"):
        raise InvalidInput()
    s = s if s is not None else load_sympy()
    x = s.Symbol("x", real=True)
    nodes = 0
    degrees = {}

    def expression(value, depth=0, variable=False):
        nonlocal nodes
        nodes += 1
        if nodes > 128 or depth > 12 or not isinstance(value, dict):
            raise InvalidInput()
        op = value.get("op")
        if op == "number":
            fields(value, ["op", "numerator", "denominator"])
            a, b = value["numerator"], value["denominator"]
            if not isinstance(a, str) or not re.fullmatch(r"(?:0|-?[1-9]\d{0,8})", a) or not isinstance(b, str) or not re.fullmatch(r"[1-9]\d{0,5}", b):
                raise InvalidInput()
            degrees[id(value)] = 0
            return s.Rational(int(a), int(b))
        if op == "variable":
            fields(value, ["op"])
            if not variable:
                raise InvalidInput()
            degrees[id(value)] = 1
            return x
        fields(value, ["op", "args"])
        args = value["args"]
        if op not in ("add", "subtract", "multiply", "divide", "power", "sqrt") or not isinstance(args, list) or len(args) != (1 if op == "sqrt" else 2):
            raise InvalidInput()
        if op == "power":
            power = args[1]
            fields(power, ["op", "numerator", "denominator"])
            if power["op"] != "number" or power["denominator"] != "1" or not isinstance(power["numerator"], str) or not re.fullmatch(r"-?[0-8]", power["numerator"]):
                raise InvalidInput()
        values = [expression(a, depth + 1, variable) for a in args]
        child_degrees = [degrees[id(a)] for a in args]
        # Conservative admission before SymPy expands powers/products or builds Poly.
        if op in ("add", "subtract"):
            degree = max(child_degrees)
        elif op == "multiply":
            degree = sum(child_degrees)
        elif op == "divide":
            if child_degrees[1]:
                raise OutsideScope()
            degree = child_degrees[0]
        elif op == "power":
            if child_degrees[0] and values[1] < 0:
                raise OutsideScope()
            degree = child_degrees[0] * max(0, int(values[1]))
        else:
            if child_degrees[0]:
                raise OutsideScope()
            degree = 0
        if degree > 4:
            raise OutsideScope()
        degrees[id(value)] = degree
        if op == "add":
            result = values[0] + values[1]
        elif op == "subtract":
            result = values[0] - values[1]
        elif op == "multiply":
            result = values[0] * values[1]
        elif op == "divide":
            if values[1] == 0 or values[1].free_symbols:
                raise OutsideScope()
            result = values[0] / values[1]
        elif op == "power":
            if values[0].free_symbols and values[1] < 0:
                raise OutsideScope()
            result = values[0] ** values[1]
        else:
            if values[0].free_symbols or values[0].is_nonnegative is not True:
                raise OutsideScope()
            result = s.sqrt(values[0])
        # Bound intermediate integer growth before any later nested power.
        if any(abs(int(a)).bit_length() > 4096 for a in result.atoms(s.Integer)):
            raise OutsideScope()
        if result.has(s.zoo, s.oo, -s.oo, s.nan) or result.is_finite is False:
            raise OutsideScope()
        return result

    left = expression(request["left"], variable=kind != "expression")
    right = expression(request["right"], variable=kind != "expression")
    if kind == "identity":
        # Equal root sets do not prove an identity (e.g. x and 2*x).
        # Degree admission and rational/constant-denominator restrictions above
        # apply before Poly construction, just as in the existing root checker.
        try:
            return bool(s.Poly(left - right, x, domain=s.QQ).is_zero)
        except (s.PolynomialError, s.CoercionFailed):
            raise OutsideScope()
    if kind == "expression":
        if left.is_real is not True or right.is_real is not True:
            raise OutsideScope()
        zero = s.simplify(left - right).is_zero
        if zero is None:
            raise OutsideScope()
        return zero
    domain, roots = request["domain"], request["roots"]
    if domain not in ("real", "positive", "nonnegative") or not isinstance(roots, list) or len(roots) > 4:
        raise InvalidInput()
    actual = [expression(r) for r in roots]
    if any(r.is_real is not True or r.is_finite is not True for r in actual):
        raise OutsideScope()
    try:
        polynomial = s.Poly(left - right, x, domain=s.QQ)
    except (s.PolynomialError, s.CoercionFailed):
        raise OutsideScope()
    if not 1 <= polynomial.degree() <= 4:
        raise OutsideScope()
    expected = list(s.FiniteSet(*polynomial.real_roots()))
    if domain != "real":
        attribute = "is_positive" if domain == "positive" else "is_nonnegative"
        statuses = [getattr(r, attribute) for r in expected]
        if any(status is None for status in statuses):
            raise OutsideScope()
        expected = [r for r, status in zip(expected, statuses) if status]
    actual = list(s.FiniteSet(*actual))
    if len(actual) != len(expected):
        return False
    for root in expected:
        matches = [s.simplify(root - answer).is_zero for answer in actual]
        if True in matches:
            continue
        if None in matches:
            raise OutsideScope()
        return False
    return True


def main():
    request_id = ""
    step_states = None
    try:
        raw = sys.stdin.buffer.read(16385)
        if len(raw) > 16384:
            raise InvalidInput()
        request = json.loads(raw, object_pairs_hook=unique_object,
                             parse_constant=lambda _: (_ for _ in ()).throw(InvalidInput()))
        if not isinstance(request, dict) or request.get("schemaVersion") != SCHEMA:
            raise InvalidInput()
        request_id = request.get("requestId", "")
        if not isinstance(request_id, str) or not re.fullmatch(r"[a-f0-9-]{36}", request_id):
            raise InvalidInput()
        try:
            step_states = None
            if request.get('kind') == 'steps':
                fields(request, ['schemaVersion', 'requestId', 'kind', 'checks'])
                checks = request['checks']
                if not isinstance(checks, list) or not 2 <= len(checks) <= 6:
                    raise InvalidInput()
                s = load_sympy()
                step_states = []
                for check in checks:
                    if not isinstance(check, dict) or check.get('kind') not in ('expression', 'identity', 'polynomial') or 'schemaVersion' in check or 'requestId' in check:
                        raise InvalidInput()
                    try:
                        value = verify({'schemaVersion': SCHEMA, 'requestId': request_id, **check}, s)
                        step_states.append('matched' if value else 'mismatch')
                    except OutsideScope:
                        step_states.append('unsupported')
                state = 'mismatch' if 'mismatch' in step_states else 'unsupported' if 'unsupported' in step_states else 'matched'
                if state == 'unsupported':
                    # Keep per-step outcomes even when only some checks are supported.
                    reason = 'outside_supported_scope'
                else:
                    reason = 'calculation_match' if state == 'matched' else 'calculation_mismatch'
                matched = state == 'matched'
            else:
                matched = verify(request)
            if step_states is None:
                state = 'matched' if matched else 'mismatch'
                reason = 'calculation_match' if matched else 'calculation_mismatch'
        except OutsideScope:
            state, reason = "unsupported", "outside_supported_scope"
        result = {"ok": True, "state": state, "reason": reason,
                  "conditionsVerified": False, "engine": "sympy-1.14.0"}
        if step_states is not None:
            result['stepStates'] = step_states
    except InvalidInput:
        result = {"ok": False, "error": "invalid_input"}
    except Exception:
        result = {"ok": False, "error": "unavailable"}
    print(json.dumps({"schemaVersion": SCHEMA, "requestId": request_id, **result}, separators=(",", ":")))


if __name__ == "__main__":
    main()
