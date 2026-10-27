"""XP ladder and titles.

Kept deliberately small: the fiche technique asks for light gamification in the
MVP - no virtual currency, no global leaderboard. One curve, one title table.
"""
from __future__ import annotations

# XP needed to go from level n to level n+1. Linear growth keeps early
# progression fast (a first TP is worth ~150 XP) without making level 10 trivial.
XP_STEP = 250

TITLES: list[tuple[int, str]] = [
    (1, 'Débutant'),
    (3, 'Apprenti'),
    (5, 'Technicien'),
    (8, 'Ingénieur du signal'),
    (12, 'Expert'),
    (20, 'Maître du signal'),
]


def xp_threshold(level_number: int) -> int:
    """Cumulative XP required to *reach* ``level_number`` (level 1 = 0 XP)."""
    n = max(level_number, 1) - 1
    return XP_STEP * n * (n + 1) // 2


def level_from_xp(total_xp: int) -> int:
    """Highest level whose threshold is covered by ``total_xp``."""
    level = 1
    while xp_threshold(level + 1) <= max(total_xp, 0):
        level += 1
    return level


def title_for_level(level_number: int) -> str:
    title = TITLES[0][1]
    for threshold, name in TITLES:
        if level_number >= threshold:
            title = name
    return title


def level_detail(total_xp: int) -> dict:
    """Everything the progress bar needs, in one shot."""
    total_xp = max(total_xp, 0)
    level = level_from_xp(total_xp)
    floor = xp_threshold(level)
    ceiling = xp_threshold(level + 1)
    span = max(ceiling - floor, 1)
    into = total_xp - floor
    return {
        'level_number': level,
        'total_xp': total_xp,
        'xp_into_level': into,
        'xp_for_next_level': ceiling - total_xp,
        'progress_percent': int(round(100 * into / span)),
        'title': title_for_level(level),
    }
