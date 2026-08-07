import pytest
import db
import quiz
from db import Gender
from quiz import _weight


class TestWeight:
    def _word(self, test_count, correct_count):
        return {"test_count": test_count, "correct_count": correct_count}

    def test_untested_has_max_weight(self):
        assert _weight(self._word(0, 0)) == 1.0

    def test_all_correct_has_min_weight(self):
        assert _weight(self._word(10, 10)) == pytest.approx(1 / 11)

    def test_all_wrong_has_full_weight(self):
        assert _weight(self._word(10, 0)) == pytest.approx(11 / 11)

    def test_partial_accuracy(self):
        # test=10, correct=5 → (5+1)/(10+1) = 6/11
        assert _weight(self._word(10, 5)) == pytest.approx(6 / 11)

    def test_lower_accuracy_gives_higher_weight(self):
        assert _weight(self._word(10, 2)) > _weight(self._word(10, 8))

    def test_weight_always_positive(self):
        assert _weight(self._word(100, 100)) > 0

    def test_weight_monotone_as_correct_increases(self):
        weights = [_weight(self._word(10, c)) for c in range(11)]
        assert weights == sorted(weights, reverse=True)


class TestPickWord:
    def test_empty_db_returns_none(self):
        assert quiz.pick_word() is None

    def test_returns_word_from_db(self):
        db.add_word("casa", Gender.FEMININE, "집")
        picked = quiz.pick_word()
        assert picked is not None
        assert picked["word"] == "casa"

    def test_none_gender_words_included(self):
        # 동사(none) 포함 전체 단어가 퀴즈 대상
        db.add_word("hablar", Gender.NONE, "말하다")
        db.add_word("comer", Gender.NONE, "먹다")
        picked = quiz.pick_word()
        assert picked is not None
        assert picked["word"] in {"hablar", "comer"}

    def test_only_none_gender_words_still_returns_word(self):
        db.add_word("hablar", Gender.NONE, "말하다")
        assert quiz.pick_word() is not None

    def test_none_gender_mixed_with_gendered_all_pickable(self):
        db.add_word("ser", Gender.NONE, "~이다")
        db.add_word("libro", Gender.MASCULINE, "책")
        picked_words = {quiz.pick_word()["word"] for _ in range(60)}
        # 충분한 샘플에서 양쪽 모두 등장해야 함
        assert "ser" in picked_words
        assert "libro" in picked_words

    def test_picked_word_exists_in_db(self):
        db.add_word("casa", Gender.FEMININE, "집")
        db.add_word("libro", Gender.MASCULINE, "책")
        picked = quiz.pick_word()
        all_words = {w["word"] for w in db.get_all_words()}
        assert picked["word"] in all_words

    def test_picked_word_has_meaning(self):
        db.add_word("casa", Gender.FEMININE, "집")
        picked = quiz.pick_word()
        assert picked["meaning"] == "집"

    def test_low_accuracy_word_picked_more(self):
        db.add_word("easy", Gender.MASCULINE, "쉬운")
        db.add_word("hard", Gender.FEMININE, "어려운")
        for _ in range(10):
            db.record_attempt("easy", correct=True)
        for _ in range(10):
            db.record_attempt("hard", correct=False)

        counts = {"easy": 0, "hard": 0}
        for _ in range(200):
            counts[quiz.pick_word()["word"]] += 1

        assert counts["hard"] > counts["easy"]


class TestSubmitAnswer:
    def test_correct_increments_both_counts(self):
        db.add_word("casa", Gender.FEMININE, "집")
        quiz.submit_answer("casa", correct=True)
        word = db.get_word("casa")
        assert word["test_count"] == 1
        assert word["correct_count"] == 1

    def test_wrong_increments_only_test_count(self):
        db.add_word("casa", Gender.FEMININE, "집")
        quiz.submit_answer("casa", correct=False)
        word = db.get_word("casa")
        assert word["test_count"] == 1
        assert word["correct_count"] == 0

    def test_multiple_submissions_accumulate(self):
        db.add_word("casa", Gender.FEMININE, "집")
        quiz.submit_answer("casa", correct=True)
        quiz.submit_answer("casa", correct=False)
        quiz.submit_answer("casa", correct=True)
        word = db.get_word("casa")
        assert word["test_count"] == 3
        assert word["correct_count"] == 2

    def test_submit_works_for_none_gender_word(self):
        db.add_word("hablar", Gender.NONE, "말하다")
        quiz.submit_answer("hablar", correct=True)
        word = db.get_word("hablar")
        assert word["test_count"] == 1
        assert word["correct_count"] == 1


class TestSRS:
    def test_new_word_is_due(self):
        db.add_word("casa", Gender.FEMININE, "집")
        assert quiz._is_due(db.get_word("casa"))

    def test_correct_promotes_box_and_schedules_future_review(self):
        db.add_word("casa", Gender.FEMININE, "집")
        quiz.submit_answer("casa", correct=True)
        word = db.get_word("casa")
        assert word["box"] == 1
        assert not quiz._is_due(word)

    def test_wrong_resets_box_and_makes_due(self):
        db.add_word("casa", Gender.FEMININE, "집")
        quiz.submit_answer("casa", correct=True)
        quiz.submit_answer("casa", correct=False)
        word = db.get_word("casa")
        assert word["box"] == 0
        assert quiz._is_due(word)

    def test_box_caps_at_max(self):
        db.add_word("casa", Gender.FEMININE, "집")
        for _ in range(10):
            quiz.submit_answer("casa", correct=True)
        assert db.get_word("casa")["box"] == quiz.MAX_BOX

    def test_intervals_grow_with_box(self):
        from datetime import datetime

        db.add_word("casa", Gender.FEMININE, "집")
        dues = []
        for _ in range(3):
            quiz.submit_answer("casa", correct=True)
            dues.append(datetime.fromisoformat(db.get_word("casa")["due_at"]))
        assert dues[0] < dues[1] < dues[2]

    def test_due_words_picked_before_scheduled_ones(self):
        db.add_word("scheduled", Gender.MASCULINE, "예정된")
        db.add_word("due", Gender.FEMININE, "복습")
        quiz.submit_answer("scheduled", correct=True)  # 미래로 예약됨
        for _ in range(30):
            assert quiz.pick_word()["word"] == "due"

    def test_pick_marks_due_flag(self):
        db.add_word("casa", Gender.FEMININE, "집")
        assert quiz.pick_word()["due"] is True

    def test_no_due_words_falls_back_to_practice(self):
        db.add_word("casa", Gender.FEMININE, "집")
        quiz.submit_answer("casa", correct=True)
        picked = quiz.pick_word()
        assert picked["word"] == "casa"
        assert picked["due"] is False

    def test_due_count(self):
        db.add_word("casa", Gender.FEMININE, "집")
        db.add_word("libro", Gender.MASCULINE, "책")
        assert quiz.due_count() == 2
        quiz.submit_answer("casa", correct=True)
        assert quiz.due_count() == 1


class TestDailyNewLimit:
    def _add_many(self, n):
        for i in range(n):
            db.add_word(f"palabra{i:03d}", Gender.NONE, f"뜻{i}")

    def test_due_count_capped_at_limit(self):
        self._add_many(25)
        assert quiz.due_count() == quiz.DAILY_NEW_LIMIT

    def test_under_limit_all_due(self):
        self._add_many(5)
        assert quiz.due_count() == 5

    def test_picks_only_first_n_by_insertion_order(self):
        self._add_many(30)
        first20 = {f"palabra{i:03d}" for i in range(20)}
        picked = {quiz.pick_word()["word"] for _ in range(80)}
        assert picked <= first20

    def test_studied_new_words_consume_quota(self):
        # 오늘 새 단어 20개를 맞히면 새 단어는 더 나오지 않음
        self._add_many(25)
        for i in range(20):
            quiz.submit_answer(f"palabra{i:03d}", correct=True)
        assert quiz.due_count() == 0
        picked = quiz.pick_word()
        assert picked["due"] is False  # 자유 연습 모드로 전환

    def test_wrong_new_word_becomes_review_beyond_cap(self):
        # 오답으로 리셋된 단어는 복습이므로 한도와 무관하게 due
        self._add_many(25)
        quiz.submit_answer("palabra000", correct=False)
        # 복습 1 + 새 단어 19 (오늘 1개 시작해 한도 차감) = 20
        assert quiz.due_count() == 20
        pool_words = {w["word"] for w in quiz._due_pool(db.get_all_words())}
        assert "palabra000" in pool_words

    def test_mixed_reviews_not_capped(self):
        # 복습 단어가 많아도 한도는 새 단어에만 적용
        self._add_many(25)
        for i in range(20):
            quiz.submit_answer(f"palabra{i:03d}", correct=False)  # 전부 즉시 복습으로
        # 복습 20 + 새 단어 0 (한도 소진) = 20
        assert quiz.due_count() == 20


class TestHardWords:
    def _make(self, word, test, correct):
        db.add_word(word, Gender.NONE, "뜻")
        for i in range(test):
            db.record_attempt(word, i < correct)

    def test_is_hard_boundaries(self):
        assert not quiz.is_hard({"test_count": 3, "correct_count": 0})   # 출제 부족
        assert quiz.is_hard({"test_count": 4, "correct_count": 2})       # 50% < 60%
        assert not quiz.is_hard({"test_count": 5, "correct_count": 3})   # 60%는 어렵지 않음
        assert not quiz.is_hard({"test_count": 10, "correct_count": 9})

    def test_hard_pool_empty_returns_none(self):
        self._make("facil", 10, 10)
        assert quiz.pick_word(hard_only=True) is None

    def test_hard_only_picks_hard_word(self):
        self._make("facil", 10, 10)
        self._make("dificil", 10, 2)
        for _ in range(10):
            picked = quiz.pick_word(hard_only=True)
            assert picked["word"] == "dificil"
            assert picked["due"] is True

    def test_hard_count(self):
        self._make("facil", 10, 10)
        self._make("dificil", 10, 2)
        assert quiz.hard_count() == 1
