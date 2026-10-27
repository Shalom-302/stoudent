"""Milestone engine: grading what the student did at the bench.

A TP is practice. What earns the marks is the manipulation - setting the
sampling rate above Nyquist, pushing the harmonic count until the square wave
appears, dropping the cut-off below the third harmonic. Questions stay, but only
to check that the student can *read* the instrument.

A milestone latches: reaching the state once is the achievement, and moving the
knob back does not take it away. The checks run on every bench autosave, so the
student is graded on the path, not on wherever they happened to stop.

The comparison language is deliberately tiny and declarative - no expression
evaluation, so a rule authored in the seed data can never become an execution
path.
"""
from __future__ import annotations

from typing import Any

# Floats coming back from a slider never land exactly on a round number.
RELATIVE_TOLERANCE = 0.02


def _as_float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _resolve(side: Any, parameters: dict) -> Any:
    """Resolve one side of a comparison.

    A side is either a literal (``{"value": 10000}``), another parameter
    (``{"param": "frequency"}``), optionally scaled (``"factor": 2``), or a
    bare literal for convenience.
    """
    if isinstance(side, dict):
        if 'value' in side:
            return side['value']
        if 'param' in side:
            raw = parameters.get(side['param'])
            number = _as_float(raw)
            if number is None:
                return raw
            factor = _as_float(side.get('factor', 1)) or 1.0
            offset = _as_float(side.get('offset', 0)) or 0.0
            return number * factor + offset
        return None
    return side


def _compare(left: Any, op: str, right: Any) -> bool:
    left_n = _as_float(left)
    right_n = _as_float(right)

    if op in ('==', 'eq'):
        if left_n is not None and right_n is not None:
            tolerance = max(abs(right_n) * RELATIVE_TOLERANCE, 1e-9)
            return abs(left_n - right_n) <= tolerance
        return str(left) == str(right)

    if op in ('!=', 'ne'):
        return not _compare(left, '==', right)

    if op == 'in':
        return str(left) in [str(v) for v in (right or [])]

    if left_n is None or right_n is None:
        return False

    match op:
        case '>':
            return left_n > right_n
        case '>=':
            return left_n >= right_n
        case '<':
            return left_n < right_n
        case '<=':
            return left_n <= right_n
        case _:
            return False


def check_passes(check: dict, parameters: dict) -> bool:
    """Evaluate one milestone condition against the current bench state."""
    if not isinstance(check, dict):
        return False

    # `all` / `any` let a milestone need two knobs at once without an
    # expression language.
    if 'all' in check:
        return all(check_passes(sub, parameters) for sub in check['all'])
    if 'any' in check:
        return any(check_passes(sub, parameters) for sub in check['any'])

    left_key = check.get('left')
    if not left_key:
        return False
    left = parameters.get(left_key)
    if left is None:
        return False

    return _compare(left, str(check.get('op', '==')), _resolve(check.get('right'), parameters))


def milestone_rules(validation_rules: list) -> list[dict]:
    return [rule for rule in (validation_rules or []) if rule.get('type') == 'milestone']


def question_rules(validation_rules: list) -> list[dict]:
    return [
        rule
        for rule in (validation_rules or [])
        if rule.get('type') not in ('milestone', 'parameter')
    ]


def evaluate(validation_rules: list, parameters: dict, achieved: list | None) -> list[str]:
    """Return the achieved milestone ids after folding in the current state.

    Latching happens here: ids already in ``achieved`` stay, whatever the knobs
    say now.
    """
    reached = {str(item) for item in (achieved or [])}
    for rule in milestone_rules(validation_rules):
        rule_id = str(rule.get('id', ''))
        if not rule_id or rule_id in reached:
            continue
        if check_passes(rule.get('check', {}), parameters or {}):
            reached.add(rule_id)
    # Keep the authored order so the checklist never reshuffles under the
    # student's eyes.
    ordered = [str(r.get('id', '')) for r in milestone_rules(validation_rules)]
    return [rule_id for rule_id in ordered if rule_id in reached]


def public_milestones(validation_rules: list, achieved: list | None) -> list[dict]:
    """Checklist for the UI: what to do, what is done. Never the thresholds."""
    reached = {str(item) for item in (achieved or [])}
    return [
        {
            'id': str(rule.get('id', '')),
            'label': rule.get('label', ''),
            'points': int(rule.get('points', 1)),
            'done': str(rule.get('id', '')) in reached,
        }
        for rule in milestone_rules(validation_rules)
    ]


def score_milestones(validation_rules: list, achieved: list | None) -> tuple[int, int]:
    """``(points earned, points available)`` for the manipulation part."""
    reached = {str(item) for item in (achieved or [])}
    earned = 0
    total = 0
    for rule in milestone_rules(validation_rules):
        points = int(rule.get('points', 1))
        total += points
        if str(rule.get('id', '')) in reached:
            earned += points
    return earned, total
