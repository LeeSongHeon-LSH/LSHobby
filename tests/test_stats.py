from datetime import date, timedelta

import db
import stats
from db import Gender
from stats import compute_streak

TODAY = date(2026, 8, 6)


def days_ago(n):
    return (TODAY - timedelta(days=n)).isoformat()


class TestComputeStreak:
    def test_no_attempts(self):
        assert compute_streak([], TODAY) == 0

    def test_only_today(self):
        assert compute_streak([days_ago(0)], TODAY) == 1

    def test_consecutive_days_ending_today(self):
        assert compute_streak([days_ago(0), days_ago(1), days_ago(2)], TODAY) == 3

    def test_ending_yesterday_still_counts(self):
        # 오늘 아직 학습 안 했어도 어제까지의 스트릭은 유지
        assert compute_streak([days_ago(1), days_ago(2)], TODAY) == 2

    def test_broken_two_days_ago(self):
        assert compute_streak([days_ago(2), days_ago(3)], TODAY) == 0

    def test_gap_stops_count(self):
        assert compute_streak([days_ago(0), days_ago(1), days_ago(3)], TODAY) == 2


class TestAttemptLog:
    def test_record_attempt_logs_row(self):
        db.add_word("casa", Gender.FEMININE, "집")
        db.record_attempt("casa", True)
        db.record_attempt("casa", False)
        dates = db.get_attempt_dates()
        assert dates == [date.today().isoformat()]
        daily = db.get_daily_attempts(14)
        assert daily[dates[0]] == {"total": 2, "correct": 1}


class TestGetStats:
    def test_empty_db(self):
        s = stats.get_stats()
        assert s["word_count"] == 0
        assert s["streak"] == 0
        assert s["today_total"] == 0
        assert len(s["daily"]) == 14
        assert s["boxes"] == {str(i): 0 for i in range(6)}

    def test_counts_after_attempts(self):
        db.add_word("casa", Gender.FEMININE, "집")
        db.add_word("libro", Gender.MASCULINE, "책")
        import quiz
        quiz.submit_answer("casa", True)
        s = stats.get_stats()
        assert s["word_count"] == 2
        assert s["test_total"] == 1
        assert s["correct_total"] == 1
        assert s["streak"] == 1
        assert s["today_total"] == 1
        assert s["daily"][-1]["date"] == date.today().isoformat()
        assert s["daily"][-1]["total"] == 1
        # casa는 정답으로 box 1 승급, libro는 box 0
        assert s["boxes"]["0"] == 1
        assert s["boxes"]["1"] == 1


class TestExportCsv:
    def test_export_contains_words(self):
        from fastapi.testclient import TestClient
        import main

        db.add_word("casa", Gender.FEMININE, "집")
        client = TestClient(main.app)
        res = client.get("/api/export.csv")
        assert res.status_code == 200
        assert res.headers["content-disposition"].startswith("attachment")
        lines = res.text.strip().splitlines()
        assert lines[0] == "word,gender,meaning,test_count,correct_count,box,due_at"
        assert lines[1].startswith("casa,f,집,0,0,0")
