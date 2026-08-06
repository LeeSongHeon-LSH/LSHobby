from collections import Counter
from datetime import date, timedelta

import db
import quiz


def compute_streak(dates: list[str], today: date | None = None) -> int:
    """연속 학습일. 마지막 학습이 오늘 또는 어제인 연속 기록만 인정."""
    if today is None:
        today = date.today()
    if not dates:
        return 0
    latest = date.fromisoformat(dates[0])
    if (today - latest).days > 1:
        return 0
    streak = 1
    prev = latest
    for ds in dates[1:]:
        d = date.fromisoformat(ds)
        if (prev - d).days == 1:
            streak += 1
            prev = d
        else:
            break
    return streak


def get_stats() -> dict:
    words = db.get_all_words()
    boxes = Counter(w["box"] for w in words)
    today = date.today()

    daily_map = db.get_daily_attempts(14)
    daily = []
    for i in range(13, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        e = daily_map.get(d)
        daily.append({
            "date": d,
            "total": e["total"] if e else 0,
            "correct": e["correct"] if e else 0,
        })

    return {
        "word_count": len(words),
        "new_count": sum(1 for w in words if w["test_count"] == 0),
        "due_count": quiz.due_count(),
        "test_total": sum(w["test_count"] for w in words),
        "correct_total": sum(w["correct_count"] for w in words),
        "streak": compute_streak(db.get_attempt_dates(), today),
        "today_total": daily[-1]["total"],
        "daily": daily,
        "boxes": {str(i): boxes.get(i, 0) for i in range(6)},
    }
