import random
from datetime import date, datetime, timedelta, timezone

from db import (
    count_words_first_attempted_on,
    get_all_words,
    get_word,
    record_attempt,
    set_srs,
)

# Leitner 박스: 정답 시 승급, 오답 시 0으로 리셋
# 박스 n에서 정답 → 박스 n+1, 다음 복습까지의 간격(일)
BOX_INTERVALS = {1: 1, 2: 2, 3: 4, 4: 8, 5: 16}
MAX_BOX = 5

# 하루에 새로 출제하는 미학습 단어 수 한도 (시드 218개가 한꺼번에 밀려오지 않게)
DAILY_NEW_LIMIT = 20

# 어려운 단어: 충분히 출제됐는데 정답률이 낮은 단어
HARD_MIN_TESTS = 4
HARD_MAX_ACCURACY = 0.6


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_due(word: dict) -> bool:
    # due_at이 없으면 미학습이거나 오답으로 리셋된 단어 → 즉시 출제 대상
    due = word["due_at"]
    return due is None or datetime.fromisoformat(due) <= _now()


def _is_new(word: dict) -> bool:
    return word["test_count"] == 0


def _due_pool(words: list[dict]) -> list[dict]:
    """오늘 출제 대상: 복습 단어 전부 + 새 단어는 하루 한도까지만.

    새 단어는 id 순서(시드의 교육적 배열 순)로 채우고, 오늘 처음 출제된
    단어 수만큼 한도에서 차감한다. 오답으로 리셋된 단어(test_count > 0,
    due_at None)는 새 단어가 아니라 복습이므로 한도와 무관하게 포함.
    """
    reviews = [w for w in words if not _is_new(w) and _is_due(w)]
    quota = DAILY_NEW_LIMIT - count_words_first_attempted_on(date.today().isoformat())
    new = sorted((w for w in words if _is_new(w)), key=lambda w: w["id"])
    return reviews + new[: max(0, quota)]


def _weight(word: dict) -> float:
    # 미출제 단어: weight 1.0 (최우선)
    # 출제된 단어: 오답률 기반, Laplace smoothing으로 0 제거
    # (오답 횟수 + 1) / (출제 횟수 + 1)
    test = word["test_count"]
    correct = word["correct_count"]
    return (test - correct + 1) / (test + 1)


def due_count() -> int:
    return len(_due_pool(get_all_words()))


def is_hard(word: dict) -> bool:
    if word["test_count"] < HARD_MIN_TESTS:
        return False
    return word["correct_count"] / word["test_count"] < HARD_MAX_ACCURACY


def hard_count() -> int:
    return sum(1 for w in get_all_words() if is_hard(w))


def pick_word(hard_only: bool = False) -> dict | None:
    words = get_all_words()
    if hard_only:
        # 집중 연습: due와 무관하게 어려운 단어 전체에서 출제
        pool = [w for w in words if is_hard(w)]
        if not pool:
            return None
        weights = [_weight(w) for w in pool]
        picked = dict(random.choices(pool, weights=weights, k=1)[0])
        picked["due"] = True
        return picked
    if not words:
        return None
    due = _due_pool(words)
    # 복습 예정 단어가 있으면 그중에서, 없으면 전체에서 자유 연습
    pool = due if due else words
    weights = [_weight(w) for w in pool]
    picked = dict(random.choices(pool, weights=weights, k=1)[0])
    picked["due"] = bool(due)
    return picked


def submit_answer(word: str, correct: bool):
    record_attempt(word, correct)
    w = get_word(word)
    if w is None:
        return
    if correct:
        box = min(w["box"] + 1, MAX_BOX)
        due_at = (_now() + timedelta(days=BOX_INTERVALS[box])).isoformat()
    else:
        box = 0
        due_at = None
    set_srs(word, box, due_at)
