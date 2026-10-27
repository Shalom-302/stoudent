"""Lab 07 - Laplace: transfer functions, poles/zeros, system responses."""
from __future__ import annotations

import numpy as np
import sympy as sp
from scipy import signal as sps

from backend.services._numeric import to_list

# A single shared symbol keeps every expression in the same algebra.
S = sp.Symbol('s')
T = sp.Symbol('t', positive=True)

# Only these names are exposed to ``sympify``. Parsing a student-supplied
# expression with the default namespace would let arbitrary attribute access
# through, so the allow-list is the security boundary, not a convenience.
_ALLOWED = {
    's': S,
    't': T,
    'exp': sp.exp,
    'sin': sp.sin,
    'cos': sp.cos,
    'sqrt': sp.sqrt,
    'log': sp.log,
    'pi': sp.pi,
    'E': sp.E,
    'Abs': sp.Abs,
}

MAX_EXPRESSION_LENGTH = 200


class LaplaceService:
    """Symbolic layer built on SymPy, numeric responses via SciPy.

    Symbolic work answers "why", numeric work answers "what does it look
    like" - the fiche technique asks for both on the same screen.
    """

    @staticmethod
    def parse(expression: str) -> sp.Expr:
        """Parse a transfer function safely.

        Rejecting long inputs and unknown symbols up front is what keeps a
        student-facing endpoint from becoming an expression-evaluation
        sandbox escape.
        """
        if not expression or len(expression) > MAX_EXPRESSION_LENGTH:
            raise ValueError('Expression is empty or too long.')
        if '__' in expression or 'lambda' in expression:
            raise ValueError('Expression contains forbidden tokens.')
        parsed = sp.sympify(expression, locals=_ALLOWED, rational=True)
        unknown = parsed.free_symbols - {S, T}
        if unknown:
            raise ValueError(f'Unknown symbols: {", ".join(str(u) for u in unknown)}')
        return parsed

    @staticmethod
    def rc_transfer_function(resistance: float, capacitance: float) -> sp.Expr:
        """H(s) = 1 / (RCs + 1) - the worked example from section 4.4."""
        return 1 / (sp.Rational(str(resistance)) * sp.Rational(str(capacitance)) * S + 1)

    def poles_zeros(self, expression: sp.Expr) -> dict:
        """Poles, zeros and gain of a rational transfer function."""
        num, den = sp.fraction(sp.cancel(sp.together(expression)))
        num_poly = sp.Poly(sp.expand(num), S)
        den_poly = sp.Poly(sp.expand(den), S)
        num_coeffs = [float(c) for c in num_poly.all_coeffs()]
        den_coeffs = [float(c) for c in den_poly.all_coeffs()]
        zeros = np.roots(num_coeffs) if len(num_coeffs) > 1 else np.array([])
        poles = np.roots(den_coeffs) if len(den_coeffs) > 1 else np.array([])
        stable = bool(poles.size == 0 or np.all(np.real(poles) < 0))
        return {
            'numerator': num_coeffs,
            'denominator': den_coeffs,
            'zeros': [{'re': round(float(z.real), 6), 'im': round(float(z.imag), 6)} for z in zeros],
            'poles': [{'re': round(float(p.real), 6), 'im': round(float(p.imag), 6)} for p in poles],
            'is_stable': stable,
            'stability_note': (
                'All poles lie in the left half-plane: the system is stable.'
                if stable
                else 'At least one pole has a non-negative real part: the system is unstable.'
            ),
        }

    @staticmethod
    def responses(num: list[float], den: list[float], duration: float, points: int = 1024) -> dict:
        """Step and impulse responses, plus the Bode magnitude/phase."""
        system = sps.TransferFunction(num, den)
        t = np.linspace(0, duration, points)
        _, step = sps.step(system, T=t)
        _, impulse = sps.impulse(system, T=t)
        w, mag, phase = sps.bode(system, n=points)
        return {
            'step': {'t': to_list(t, decimals=9), 'y': to_list(step)},
            'impulse': {'t': to_list(t, decimals=9), 'y': to_list(impulse)},
            'bode': {
                # SciPy returns rad/s; students read Hz on the instrument.
                'frequencies': to_list(np.asarray(w) / (2 * np.pi), decimals=4),
                'gain_db': to_list(mag, decimals=3),
                'phase_deg': to_list(phase, decimals=3),
            },
        }

    def inverse_transform(self, expression: sp.Expr) -> str:
        """Symbolic inverse Laplace, rendered as LaTeX for the theory panel."""
        try:
            result = sp.inverse_laplace_transform(expression, S, T)
            return sp.latex(sp.simplify(result))
        except Exception:  # noqa: BLE001 - SymPy raises many unrelated types
            return ''

    def analyze(
        self,
        expression: str | None = None,
        resistance: float = 1000.0,
        capacitance: float = 1e-6,
        duration: float | None = None,
        with_inverse: bool = True,
    ) -> dict:
        """Full Laplace study of a transfer function."""
        if expression:
            h = self.parse(expression)
        else:
            h = self.rc_transfer_function(resistance, capacitance)

        pz = self.poles_zeros(h)
        if duration is None:
            # Five time constants of the slowest pole covers the transient.
            slowest = min((abs(p['re']) for p in pz['poles'] if p['re']), default=1.0)
            duration = 5.0 / slowest if slowest else 1.0

        result = {
            'expression': str(h),
            'latex': sp.latex(h),
            **pz,
            **self.responses(pz['numerator'], pz['denominator'], duration),
            'duration': duration,
        }
        if with_inverse:
            result['inverse_latex'] = self.inverse_transform(h)
        return result


laplace_service = LaplaceService()
