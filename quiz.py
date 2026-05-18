import random
from db import get_all_words, record_attempt


def _weight(word: dict) -> float:
    # 미출제 단어: weight 1.0 (최우선)
    # 출제된 단어: 오답률 기반, Laplace smoothing으로 0 제거
    # (오답 횟수 + 1) / (출제 횟수 + 1)
    test = word["test_count"]
    correct = word["correct_count"]
    return (test - correct + 1) / (test + 1)


def pick_word() -> dict | None:
    words = get_all_words()
    if not words:
        return None
    weights = [_weight(w) for w in words]
    return random.choices(words, weights=weights, k=1)[0]


def submit_answer(word: str, correct: bool):
    record_attempt(word, correct)
