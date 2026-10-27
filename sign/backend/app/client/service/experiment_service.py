"""Running and grading an experiment.

Grading is server-side by construction: ``validation_rules`` never leaves the
backend, and the score, the XP and the badges are all recomputed here from the
submitted answers rather than trusted from the client.
"""
from __future__ import annotations

import unicodedata

from backend.app.client.schema.lab import SaveExperimentStateParam, SubmitExperimentParam
from backend.app.client.service.achievement_service import achievement_service
from backend.app.client.service.gamification import level_detail, level_from_xp
from backend.app.client.service.milestones import (
    evaluate as evaluate_milestones,
    public_milestones,
    question_rules,
    score_milestones,
)
from backend.app.client.service.student_service import student_service
from backend.common.enums import ExperimentStatusType
from backend.common.exception import errors
from backend.crud.crud_lab import experiment_dao
from backend.crud.crud_student_experiment import student_experiment_dao
from backend.database.db_postgres import async_db_session
from backend.utils.timezone import timezone

# Default pass mark, overridable per experiment via
# ``initial_parameters['pass_score']``.
DEFAULT_PASS_SCORE = 70


def _normalize(value: str) -> str:
    """Case- and accent-insensitive comparison for free-text answers.

    Students type "repliement" or "Repliement" or "réplîement"; none of those
    should cost a point.
    """
    text = unicodedata.normalize('NFKD', str(value).strip().lower())
    return ''.join(c for c in text if not unicodedata.combining(c))


class ExperimentService:
    # -- Grading primitives -------------------------------------------------

    @staticmethod
    def _grade_rule(rule: dict, answers: dict, parameters: dict) -> tuple[bool, str | None]:
        """Evaluate one validation rule against the submission."""
        kind = rule.get('type', 'mcq')
        rule_id = str(rule.get('id', ''))
        expected = rule.get('answer')

        if kind == 'parameter':
            # Checks the bench state rather than a typed answer: "set the
            # sampling rate above 10 kHz and observe".
            name = rule.get('parameter', '')
            value = parameters.get(name)
            if value is None:
                return False, rule.get('feedback_ko')
            try:
                value = float(value)
            except (TypeError, ValueError):
                return False, rule.get('feedback_ko')
            minimum = rule.get('min')
            maximum = rule.get('max')
            ok = True
            if minimum is not None:
                ok = ok and value >= float(minimum)
            if maximum is not None:
                ok = ok and value <= float(maximum)
            return ok, rule.get('feedback_ok') if ok else rule.get('feedback_ko')

        given = answers.get(rule_id)
        if given is None:
            return False, rule.get('feedback_ko')

        match kind:
            case 'numeric':
                try:
                    given_value = float(given)
                    expected_value = float(expected)
                except (TypeError, ValueError):
                    return False, rule.get('feedback_ko')
                # Relative tolerance, with an absolute floor so an expected 0
                # does not become impossible to hit.
                tolerance = float(rule.get('tolerance', 0.05))
                margin = max(abs(expected_value) * tolerance, float(rule.get('epsilon', 1e-9)))
                ok = abs(given_value - expected_value) <= margin
            case 'boolean':
                ok = bool(given) is bool(expected)
            case 'text':
                accepted = expected if isinstance(expected, list) else [expected]
                ok = _normalize(given) in {_normalize(a) for a in accepted}
            case 'multi':
                accepted = {str(a) for a in (expected or [])}
                ok = {str(g) for g in (given or [])} == accepted
            case _:  # mcq
                ok = str(given) == str(expected)

        return ok, rule.get('feedback_ok') if ok else rule.get('feedback_ko')

    @classmethod
    def _grade(
        cls,
        rules: list[dict],
        answers: dict,
        parameters: dict,
        achieved: list | None = None,
    ) -> tuple[int, list[dict], dict]:
        """Return ``(score out of 100, per-question results, breakdown)``.

        The manipulation carries most of the marks: a TP is practice, so the
        bench state the student actually reached is what is graded, and the
        questions only check that they can read the instrument.
        """
        results: list[dict] = []
        earned = 0
        total = 0

        # Questions (and any legacy `parameter` rule) still grade normally.
        for rule in rules:
            if rule.get('type') == 'milestone':
                continue
            points = int(rule.get('points', 1))
            total += points
            ok, feedback = cls._grade_rule(rule, answers, parameters)
            earned += points if ok else 0
            results.append(
                {
                    'question_id': str(rule.get('id', '')),
                    'correct': ok,
                    'points': points if ok else 0,
                    'max_points': points,
                    'feedback': feedback,
                }
            )

        manipulation, manipulation_total = score_milestones(rules, achieved)
        earned += manipulation
        total += manipulation_total

        score = int(round(100 * earned / total)) if total else 0
        breakdown = {
            'manipulation': manipulation,
            'manipulation_total': manipulation_total,
            'reading': earned - manipulation,
            'reading_total': total - manipulation_total,
        }
        return score, results, breakdown

    @staticmethod
    def _public_questions(rules: list[dict]) -> list[dict]:
        """Strip every rule down to what the browser is allowed to see."""
        questions = []
        for rule in question_rules(rules):
            questions.append(
                {
                    'id': str(rule.get('id', '')),
                    'type': rule.get('type', 'mcq'),
                    'question': rule.get('question', ''),
                    'options': rule.get('options', []),
                    'unit': rule.get('unit'),
                    'points': int(rule.get('points', 1)),
                }
            )
        return questions

    # -- Use cases ----------------------------------------------------------

    async def get_experiment(self, *, user_id: int, slug: str) -> dict:
        async with async_db_session.begin() as db:
            profile = await student_service.ensure_profile(db, user_id)
            experiment = await experiment_dao.get_by_slug(db, slug)
            if experiment is None:
                raise errors.NotFoundError(msg='Experiment not found')

            state = await student_experiment_dao.get(db, profile.id, experiment.id)
            return {
                'x_id': experiment.x_id,
                'slug': experiment.slug,
                'title': experiment.title,
                'description': experiment.description,
                'objective': experiment.objective,
                'difficulty': experiment.difficulty,
                'duration_minutes': experiment.duration_minutes,
                'xp_reward': experiment.xp_reward,
                'order': experiment.order,
                'instructions': experiment.instructions or [],
                # Available from the start, unlike `theory`: the student needs
                # the formula to practise, not as a reward for finishing.
                'guide': experiment.guide or None,
                # Theory is revealed only once the TP has been validated:
                # phenomenon -> manipulation -> visualisation -> maths.
                'theory': experiment.theory
                if state and state.status == ExperimentStatusType.completed.value
                else None,
                'initial_parameters': experiment.initial_parameters or {},
                'questions': self._public_questions(experiment.validation_rules or []),
                'milestones': public_milestones(
                    experiment.validation_rules or [],
                    state.milestones if state else [],
                ),
                'lab_slug': experiment.lab.slug,
                'status': state.status if state else ExperimentStatusType.not_started.value,
                'progress': state.progress if state else 0,
                'best_score': state.best_score if state else 0,
                'current_step': state.current_step if state else 0,
                'parameters': (state.parameters if state and state.parameters else None)
                or (experiment.initial_parameters or {}),
                'attempts': state.attempts if state else 0,
                'is_locked': False,
            }

    async def start(self, *, user_id: int, slug: str) -> dict:
        """Open (or resume) a TP - idempotent, never resets saved work."""
        async with async_db_session.begin() as db:
            profile = await student_service.ensure_profile(db, user_id)
            experiment = await experiment_dao.get_by_slug(db, slug)
            if experiment is None:
                raise errors.NotFoundError(msg='Experiment not found')

            state = await student_experiment_dao.get_or_create(db, profile.id, experiment.id)
            if state.status == ExperimentStatusType.not_started.value:
                state.status = ExperimentStatusType.in_progress.value
                state.started_at = timezone.now()
                state.parameters = experiment.initial_parameters or {}
                db.add(state)
                await db.flush()

            return {
                'x_id': state.x_id,
                'status': state.status,
                'current_step': state.current_step,
                'parameters': state.parameters or {},
                'attempts': state.attempts,
                'started_at': state.started_at,
            }

    async def save_state(
        self, *, user_id: int, slug: str, obj: SaveExperimentStateParam
    ) -> dict:
        """Autosave of the bench - this is what makes MyLab resumable."""
        async with async_db_session.begin() as db:
            profile = await student_service.ensure_profile(db, user_id)
            experiment = await experiment_dao.get_by_slug(db, slug)
            if experiment is None:
                raise errors.NotFoundError(msg='Experiment not found')

            state = await student_experiment_dao.get_or_create(db, profile.id, experiment.id)
            data = obj.model_dump(exclude_unset=True)
            if data.get('current_step') is not None:
                state.current_step = data['current_step']
            if data.get('parameters') is not None:
                state.parameters = data['parameters']
                # Grading follows the path, not the final knob position: each
                # autosave latches whatever the student has just achieved.
                state.milestones = evaluate_milestones(
                    experiment.validation_rules or [], state.parameters, state.milestones
                )
            if data.get('progress') is not None:
                state.progress = data['progress']
            if state.status == ExperimentStatusType.not_started.value:
                state.status = ExperimentStatusType.in_progress.value
                state.started_at = state.started_at or timezone.now()
            db.add(state)
            await db.flush()
            return {
                'x_id': state.x_id,
                'status': state.status,
                'current_step': state.current_step,
                'parameters': state.parameters or {},
                'progress': state.progress,
                'milestones': public_milestones(
                    experiment.validation_rules or [], state.milestones
                ),
            }

    async def submit(self, *, user_id: int, slug: str, obj: SubmitExperimentParam) -> dict:
        """Grade a submission, award XP once, and unlock any earned badge."""
        async with async_db_session.begin() as db:
            profile = await student_service.ensure_profile(db, user_id)
            experiment = await experiment_dao.get_by_slug(db, slug)
            if experiment is None:
                raise errors.NotFoundError(msg='Experiment not found')

            rules = experiment.validation_rules or []
            state = await student_experiment_dao.get_or_create(db, profile.id, experiment.id)

            # One last fold, so a manipulation done just before hitting
            # "valider" still counts.
            state.milestones = evaluate_milestones(
                rules, obj.parameters or state.parameters or {}, state.milestones
            )
            score, results, breakdown = self._grade(
                rules,
                obj.answers,
                obj.parameters or state.parameters or {},
                state.milestones,
            )
            pass_score = int(
                (experiment.initial_parameters or {}).get('pass_score', DEFAULT_PASS_SCORE)
            )
            passed = score >= pass_score

            previous_level = level_from_xp(profile.total_xp)
            previous_best = state.best_score

            state.attempts += 1
            state.answers = obj.answers
            if obj.parameters:
                state.parameters = obj.parameters
            state.score = score
            state.best_score = max(previous_best, score)

            # XP is paid on improvement only: replaying a TP to farm points is
            # not a learning loop, but improving a 70 into a 95 is.
            xp_gain = 0
            if passed:
                target_xp = int(round(experiment.xp_reward * state.best_score / 100))
                xp_gain = max(target_xp - state.xp_earned, 0)
                state.xp_earned += xp_gain
                state.status = ExperimentStatusType.completed.value
                state.progress = 100
                state.completed_at = state.completed_at or timezone.now()
            elif state.status != ExperimentStatusType.completed.value:
                state.status = ExperimentStatusType.in_progress.value

            db.add(state)
            if xp_gain:
                profile.total_xp += xp_gain
                db.add(profile)
            await db.flush()

            unlocked = await achievement_service.evaluate(db, profile)

            level = level_detail(profile.total_xp)
            profile.level_number = level['level_number']
            db.add(profile)
            await db.flush()

            return {
                'passed': passed,
                'score': score,
                'best_score': state.best_score,
                'xp_earned': xp_gain + sum(item['xp_reward'] for item in unlocked),
                'total_xp': profile.total_xp,
                'level_number': level['level_number'],
                'level_up': level['level_number'] > previous_level,
                'attempts': state.attempts,
                'status': state.status,
                'results': results,
                'milestones': public_milestones(rules, state.milestones),
                'breakdown': breakdown,
                'unlocked_achievements': unlocked,
                # The maths is the reward, handed over once the phenomenon has
                # been manipulated and validated.
                'theory': experiment.theory if passed else None,
            }

    async def get_progress(self, *, user_id: int, slug: str) -> dict:
        async with async_db_session.begin() as db:
            profile = await student_service.ensure_profile(db, user_id)
            experiment = await experiment_dao.get_by_slug(db, slug)
            if experiment is None:
                raise errors.NotFoundError(msg='Experiment not found')
            state = await student_experiment_dao.get(db, profile.id, experiment.id)
            if state is None:
                return {
                    'status': ExperimentStatusType.not_started.value,
                    'progress': 0,
                    'current_step': 0,
                    'score': 0,
                    'best_score': 0,
                    'attempts': 0,
                    'parameters': experiment.initial_parameters or {},
                    'milestones': public_milestones(experiment.validation_rules or [], []),
                }
            return {
                'status': state.status,
                'progress': state.progress,
                'current_step': state.current_step,
                'score': state.score,
                'best_score': state.best_score,
                'attempts': state.attempts,
                'parameters': state.parameters or {},
                'milestones': public_milestones(
                    experiment.validation_rules or [], state.milestones
                ),
                'started_at': state.started_at,
                'completed_at': state.completed_at,
            }


experiment_service = ExperimentService()
