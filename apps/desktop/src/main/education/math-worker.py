"""Fixed deterministic SymPy adapter. No strings are evaluated as expressions."""
import hashlib
import json
from pathlib import Path
import re
import sys

SCHEMA = "xiaozhi.education.math-check.v1"
SYSTEM_SCHEMA = "xiaozhi.education.math-check.v2"
EQUATION_SCHEMA = "xiaozhi.education.math-check.v3"
QUANTITY_SCHEMA = "xiaozhi.education.math-check.v4"
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


def verify_linear_system(request):
    fields(request, ['schemaVersion', 'requestId', 'kind', 'variables', 'equations', 'targets'])
    names, equations, targets = request['variables'], request['equations'], request['targets']
    if request['kind'] != 'linear_system' or not isinstance(names, list) or not 1 <= len(names) <= 4 or any(not isinstance(n, str) or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,15}', n) for n in names) or len(set(names)) != len(names):
        raise InvalidInput()
    if not isinstance(equations, list) or not 1 <= len(equations) <= 8 or not isinstance(targets, list) or not 1 <= len(targets) <= 4:
        raise InvalidInput()
    s = load_sympy()

    def rational(v):
        fields(v, ['numerator', 'denominator'])
        a, b = v['numerator'], v['denominator']
        if not isinstance(a, str) or not re.fullmatch(r'(?:0|-?[1-9]\d{0,8})', a) or not isinstance(b, str) or not re.fullmatch(r'[1-9]\d{0,5}', b):
            raise InvalidInput()
        return s.Rational(int(a), int(b))

    def quote(v):
        if not isinstance(v, str) or not v.strip() or len(v) > 400 or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', v):
            raise InvalidInput()

    rows, constants = [], []
    for e in equations:
        fields(e, ['coefficients', 'constant', 'sourceText'])
        quote(e['sourceText'])
        if not isinstance(e['coefficients'], list) or len(e['coefficients']) != len(names):
            raise InvalidInput()
        rows.append([rational(v) for v in e['coefficients']])
        constants.append(rational(e['constant']))
    expected = {}
    for t in targets:
        fields(t, ['variable', 'expected', 'answerText'])
        quote(t['answerText'])
        if not isinstance(t['variable'], str) or t['variable'] not in names or t['variable'] in expected:
            raise InvalidInput()
        expected[t['variable']] = rational(t['expected'])
    symbols = [s.Symbol(n, real=True) for n in names]
    # Reuse the pinned solver. Free unrelated variables do not make a target ambiguous.
    solutions = s.linsolve((s.Matrix(rows), s.Matrix(constants)), symbols)
    if solutions is s.EmptySet or solutions == s.EmptySet:
        return 'inconsistent'
    values = next(iter(solutions))
    target_values = [(values[names.index(n)], value) for n, value in expected.items()]
    if any(actual.free_symbols for actual, _ in target_values):
        return 'underdetermined'
    return 'unique_targets' if all(actual == value for actual, value in target_values) else 'answer_mismatch'


def verify_equation(request):
    """Keep original division/radical guards before SymPy can cancel expressions."""
    fields(request, ['schemaVersion', 'requestId', 'kind', 'left', 'right', 'domain', 'roots'])
    if request['kind'] != 'equation' or request['domain'] not in ('real', 'positive', 'nonnegative') or not isinstance(request['roots'], list) or len(request['roots']) > 4:
        raise InvalidInput()
    s = load_sympy()
    x = s.Symbol('x', real=True)
    nodes, radicals = 0, 0
    guards = []

    def build(value, depth=0, variable=True):
        nonlocal nodes, radicals
        nodes += 1
        if nodes > 128 or depth > 12 or not isinstance(value, dict):
            raise InvalidInput()
        op = value.get('op')
        if op == 'number':
            fields(value, ['op', 'numerator', 'denominator'])
            a, b = value['numerator'], value['denominator']
            if not isinstance(a, str) or not re.fullmatch(r'(?:0|-?[1-9]\d{0,8})', a) or not isinstance(b, str) or not re.fullmatch(r'[1-9]\d{0,5}', b):
                raise InvalidInput()
            return s.Rational(int(a), int(b)), 0, 0
        if op == 'variable':
            fields(value, ['op'])
            if not variable:
                raise InvalidInput()
            return x, 1, 0
        fields(value, ['op', 'args'])
        args = value['args']
        if op not in ('add', 'subtract', 'multiply', 'divide', 'power', 'sqrt') or not isinstance(args, list) or len(args) != (1 if op == 'sqrt' else 2):
            raise InvalidInput()
        if op == 'power':
            power = args[1]
            fields(power, ['op', 'numerator', 'denominator'])
            if power['op'] != 'number' or power['denominator'] != '1' or not isinstance(power['numerator'], str) or not re.fullmatch(r'-?[0-8]', power['numerator']):
                raise InvalidInput()
        children = [build(a, depth + 1, variable) for a in args]
        values = [a[0] for a in children]
        a, b = children[0][1:]
        if op in ('add', 'subtract'):
            c, d = children[1][1:]
            numerator, denominator = max(a + d, c + b), b + d
        elif op in ('multiply', 'divide'):
            c, d = children[1][1:]
            numerator, denominator = (a + c, b + d) if op == 'multiply' else (a + d, b + c)
        elif op == 'power':
            power = int(values[1])
            numerator, denominator = (a * power, b * power) if power >= 0 else (b * -power, a * -power)
        else:
            numerator, denominator = a, b
            if a or b:
                radicals += 1
                if radicals > 2:
                    raise OutsideScope()
        if max(numerator, denominator) > 4:
            raise OutsideScope()
        if op == 'divide' or op == 'power' and values[1] < 0:
            guards.append((values[1] if op == 'divide' else values[0], 'nonzero'))
        if op == 'sqrt':
            guards.append((values[0], 'nonnegative'))
        if op == 'add':
            result = values[0] + values[1]
        elif op == 'subtract':
            result = values[0] - values[1]
        elif op == 'multiply':
            result = values[0] * values[1]
        elif op == 'divide':
            result = values[0] / values[1] if values[1] != 0 else s.Integer(0)
        elif op == 'power':
            result = s.Integer(0) if values[0] == 0 and values[1] < 0 else values[0] ** values[1]
        else:
            result = s.sqrt(values[0])
        if any(abs(int(a)).bit_length() > 4096 for a in result.atoms(s.Integer)):
            raise OutsideScope()
        return result, numerator, denominator

    left, right = build(request['left'])[0], build(request['right'])[0]
    # Candidate expressions have no variables; their guards must not restrict x.
    equation_guards = guards[:]
    roots = [build(root, variable=False)[0] for root in request['roots']]
    for expression, relation in guards[len(equation_guards):]:
        if relation == 'nonzero' and expression.is_zero is not False or relation == 'nonnegative' and expression.is_nonnegative is not True:
            raise OutsideScope()
    if any(root.is_real is not True or root.is_finite is not True for root in roots):
        raise OutsideScope()
    allowed = {'real': s.S.Reals, 'positive': s.Interval.open(0, s.oo), 'nonnegative': s.Interval(0, s.oo)}[request['domain']]
    restrictions, seen = [], set()
    try:
        for expression, relation in equation_guards:
            key = (s.srepr(expression), relation)
            if key in seen:
                continue
            seen.add(key)
            restrictions.append(s.sstr(expression) + (' != 0' if relation == 'nonzero' else ' >= 0'))
            if len(restrictions) > 32:
                raise OutsideScope()
            if relation == 'nonzero':
                zeros = s.solveset(s.Eq(expression, 0, evaluate=False), x, domain=s.S.Reals)
                if zeros.has(s.ConditionSet):
                    raise OutsideScope()
                allowed = allowed - zeros
            else:
                condition = s.Ge(expression, 0)
                permitted = s.S.Reals if condition is s.true else s.S.EmptySet if condition is s.false else s.solve_univariate_inequality(condition, x, relational=False, domain=s.S.Reals)
                allowed = allowed.intersect(permitted)
        solutions = s.solveset(s.Eq(left, right, evaluate=False), x, domain=allowed)
        if solutions.has(s.ConditionSet):
            raise OutsideScope()
        candidates = []
        for root in roots:
            admissible = allowed.contains(root)
            if admissible not in (s.true, s.false):
                raise OutsideScope()
            satisfies = s.simplify(left.subs(x, root) - right.subs(x, root)).is_zero if admissible is s.true else False
            if satisfies is None:
                raise OutsideScope()
            candidates.append({'value': s.sstr(root), 'admissible': bool(admissible), 'satisfies': bool(satisfies)})
        if solutions is not s.S.EmptySet and not isinstance(solutions, s.FiniteSet):
            return {'state': 'unsupported', 'solutionStatus': 'non_finite', 'restrictions': restrictions, 'solutions': [], 'candidates': candidates}
        if len(solutions) > 4:
            raise OutsideScope()
        # Recheck solver answers in the retained domain and original sides.
        for root in solutions:
            if allowed.contains(root) is not s.true or s.simplify(left.subs(x, root) - right.subs(x, root)).is_zero is not True:
                raise OutsideScope()
        matched = s.FiniteSet(*roots) == solutions
        return {'state': 'matched' if matched else 'mismatch', 'solutionStatus': 'finite', 'restrictions': restrictions, 'solutions': [s.sstr(root) for root in s.ordered(solutions)], 'candidates': candidates}
    except (NotImplementedError, ValueError, TypeError):
        raise OutsideScope()


def verify_quantity(request):
    """Use the pinned SI registry; retain units separately even when a value is zero."""
    fields(request, ['schemaVersion', 'requestId', 'kind', 'expression', 'targetUnit', 'expected'])
    if request['kind'] != 'quantity':
        raise InvalidInput()
    s = load_sympy()
    from sympy.physics import units as u
    from sympy.physics.units.systems.si import SI
    from sympy.physics.units.util import convert_to
    from sympy.physics.units.prefixes import PREFIXES
    registry = {
        '1': s.Integer(1), 'm': u.meter, 'km': u.kilometer, 'dm': u.decimeter,
        'cm': u.centimeter, 'mm': u.millimeter, 'um': u.micrometer, 'nm': u.nanometer,
        'kg': u.kilogram, 'g': u.gram, 'mg': u.milligram, 't': u.tonne,
        's': u.second, 'ms': u.millisecond, 'min': u.minute, 'h': u.hour,
        'L': u.liter, 'mL': u.milliliter, 'N': u.newton, 'kN': 1000*u.newton,
        'Pa': u.pascal, 'kPa': 1000*u.pascal, 'MPa': 1000000*u.pascal,
        'J': u.joule, 'kJ': 1000*u.joule, 'W': u.watt, 'kW': 1000*u.watt,
        'Hz': u.hertz, 'A': u.ampere, 'mA': u.ampere/1000, 'uA': u.ampere/1000000,
        'V': u.volt, 'mV': u.volt/1000, 'kV': 1000*u.volt,
        'ohm': u.ohm, 'kohm': 1000*u.ohm, 'Mohm': 1000000*u.ohm,
        'C': u.coulomb, 'S': u.siemens, 'K': u.kelvin, 'mol': u.mole, 'cd': u.candela,
    }
    prefixable = {'m', 'g', 's', 'L', 'N', 'Pa', 'J', 'W', 'Hz', 'A', 'V', 'ohm', 'C', 'S', 'K', 'mol', 'cd'}
    prefixes = {('u' if symbol == 'mu' else symbol): prefix.scale_factor for symbol, prefix in PREFIXES.items()}

    class QuantityIssue(Exception):
        def __init__(self, state, reason, detail):
            self.state, self.reason, self.detail = state, reason, detail

    def rational(value):
        fields(value, ['numerator', 'denominator'])
        a, b = value['numerator'], value['denominator']
        if not isinstance(a, str) or not re.fullmatch(r'(?:0|-?[1-9]\d{0,8})', a) or not isinstance(b, str) or not re.fullmatch(r'[1-9]\d{0,5}', b):
            raise InvalidInput()
        return s.Rational(int(a), int(b))

    def unit(text):
        if not isinstance(text, str) or len(text) > 128:
            raise InvalidInput()
        parts = re.split(r'([*/])', text)
        if len(parts) > 23:
            raise InvalidInput()
        result = s.Integer(1)
        for index in range(0, len(parts), 2):
            match = re.fullmatch(r'(1|[A-Za-z]+)(?:\^(-?[1-4]))?', parts[index])
            if not match:
                raise InvalidInput()
            name, exponent = match.groups()
            resolved = registry.get(name)
            if resolved is None:
                for prefix in sorted(prefixes, key=len, reverse=True):
                    base = name[len(prefix):]
                    if name.startswith(prefix) and base in prefixable:
                        resolved = prefixes[prefix]*registry[base]
                        break
            if resolved is None:
                raise QuantityIssue('unsupported', 'unsupported_unit', 'Unsupported unit: '+name)
            factor = resolved ** int(exponent or 1)
            result = result / factor if index and parts[index-1] == '/' else result * factor
        return result

    def dimensions(value):
        result = SI.get_dimension_system().get_dimensional_dependencies(SI.get_dimensional_expr(value))
        if any(abs(power) > 32 or s.denom(power) > 16 for power in result.values()):
            raise OutsideScope()
        return result

    def scale(source, target):
        value = s.simplify(convert_to(source, target)/target)
        if value.is_number is not True or value.is_real is not True or value.is_finite is not True:
            raise OutsideScope()
        return value

    nodes = 0
    def expression(value, depth=0):
        nonlocal nodes
        nodes += 1
        if nodes > 128 or depth > 12 or not isinstance(value, dict):
            raise InvalidInput()
        op = value.get('op')
        if op == 'quantity':
            fields(value, ['op', 'value', 'unit'])
            result, result_unit = rational(value['value']), unit(value['unit'])
        else:
            fields(value, ['op', 'args', 'exponent'] if op == 'power' else ['op', 'args'])
            if op not in ('add', 'subtract', 'multiply', 'divide', 'power', 'sqrt') or not isinstance(value['args'], list) or len(value['args']) != (1 if op in ('power', 'sqrt') else 2):
                raise InvalidInput()
            if op == 'power' and (type(value['exponent']) is not int or abs(value['exponent']) > 4):
                raise InvalidInput()
            children = [expression(child, depth+1) for child in value['args']]
            a, a_unit = children[0]
            if op in ('add', 'subtract', 'multiply', 'divide'):
                b, b_unit = children[1]
            if op in ('add', 'subtract'):
                if dimensions(a_unit) != dimensions(b_unit):
                    raise QuantityIssue('dimension_mismatch', 'incompatible_addition', 'Cannot add/subtract '+s.sstr(a_unit)+' and '+s.sstr(b_unit))
                result, result_unit = a + (1 if op == 'add' else -1)*b*scale(b_unit, a_unit), a_unit
            elif op == 'multiply':
                result, result_unit = a*b, a_unit*b_unit
            elif op == 'divide':
                if b.is_zero is not False:
                    raise QuantityIssue('unsupported', 'undefined', 'Division by zero or an undetermined denominator')
                result, result_unit = a/b, a_unit/b_unit
            elif op == 'power':
                power = value['exponent']
                if power <= 0 and a.is_zero is not False:
                    raise QuantityIssue('unsupported', 'undefined', 'Zero to a nonpositive power is undefined here')
                result, result_unit = a**power, a_unit**power
            else:
                if a.is_nonnegative is not True:
                    raise QuantityIssue('unsupported', 'undefined', 'Real square root requires a nonnegative value')
                result, result_unit = s.sqrt(a), s.sqrt(a_unit)
        result = s.simplify(result)
        if result.is_real is not True or result.is_finite is not True or any(abs(int(atom)).bit_length() > 4096 for atom in result.atoms(s.Integer)):
            raise OutsideScope()
        dimensions(result_unit)
        return result, result_unit

    base = {'targetUnit': request['targetUnit'], 'actual': None}
    try:
        target = unit(request['targetUnit'])
        expected = None if request['expected'] is None else rational(request['expected'])
        value, source = expression(request['expression'])
        if dimensions(source) != dimensions(target):
            raise QuantityIssue('dimension_mismatch', 'incompatible_target', 'Cannot convert '+s.sstr(source)+' to '+request['targetUnit'])
        factor = scale(source, target)
        actual = s.simplify(value*factor)
        if actual.is_real is not True or actual.is_finite is not True or any(abs(int(atom)).bit_length() > 4096 for atom in actual.atoms(s.Integer)):
            raise OutsideScope()
        equal = None if expected is None else s.simplify(actual-expected).is_zero
        if expected is not None and equal is None:
            raise OutsideScope()
        dims = dimensions(target)
        text = ', '.join(sorted(s.sstr(dim.name)+'^'+s.sstr(power) for dim, power in dims.items())) or 'dimensionless'
        return {**base, 'state': 'calculated' if expected is None else 'matched' if equal else 'mismatch', 'reason': None,
                'actual': {'exact': s.sstr(actual), 'decimal': s.sstr(s.N(actual, 12)), 'unit': request['targetUnit'], 'dimensions': text, 'scaleFactor': s.sstr(factor)}, 'detail': 'SI conversion and dimensions checked; question modeling not verified'}
    except QuantityIssue as error:
        return {**base, 'state': error.state, 'reason': error.reason, 'detail': error.detail}
    except (OutsideScope, NotImplementedError, ValueError, TypeError):
        return {**base, 'state': 'unsupported', 'reason': 'outside_scope', 'detail': 'Quantity expression outside supported scope'}


def main():
    request_id = ""
    schema = SCHEMA
    step_states = None
    system_status = None
    try:
        raw = sys.stdin.buffer.read(16385)
        if len(raw) > 16384:
            raise InvalidInput()
        request = json.loads(raw, object_pairs_hook=unique_object,
                             parse_constant=lambda _: (_ for _ in ()).throw(InvalidInput()))
        if not isinstance(request, dict) or request.get("schemaVersion") not in (SCHEMA, SYSTEM_SCHEMA, EQUATION_SCHEMA, QUANTITY_SCHEMA):
            raise InvalidInput()
        schema = request['schemaVersion']
        if (schema == SYSTEM_SCHEMA) != (request.get('kind') == 'linear_system'):
            raise InvalidInput()
        if (schema == EQUATION_SCHEMA) != (request.get('kind') == 'equation'):
            raise InvalidInput()
        if (schema == QUANTITY_SCHEMA) != (request.get('kind') == 'quantity'):
            raise InvalidInput()
        request_id = request.get("requestId", "")
        if not isinstance(request_id, str) or not re.fullmatch(r"[a-f0-9-]{36}", request_id):
            raise InvalidInput()
        if schema == QUANTITY_SCHEMA:
            result = verify_quantity(request)
            result.update({'ok': True, 'conditionsVerified': False, 'engine': 'sympy-1.14.0'})
            print(json.dumps({'schemaVersion': schema, 'requestId': request_id, **result}, separators=(',', ':')))
            return
        if schema == EQUATION_SCHEMA:
            try:
                result = verify_equation(request)
            except OutsideScope:
                result = {'state': 'unsupported', 'solutionStatus': 'undetermined', 'restrictions': [], 'solutions': [], 'candidates': []}
            result.update({'ok': True, 'conditionsVerified': False, 'engine': 'sympy-1.14.0'})
            print(json.dumps({'schemaVersion': schema, 'requestId': request_id, **result}, separators=(',', ':')))
            return
        try:
            step_states = None
            if request.get('kind') == 'linear_system':
                system_status = verify_linear_system(request)
                matched = system_status == 'unique_targets'
            elif request.get('kind') == 'steps':
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
        if system_status is not None:
            result['systemStatus'] = system_status
    except InvalidInput:
        result = {"ok": False, "error": "invalid_input"}
    except Exception:
        result = {"ok": False, "error": "unavailable"}
    print(json.dumps({"schemaVersion": schema, "requestId": request_id, **result}, separators=(",", ":")))


if __name__ == "__main__":
    main()
