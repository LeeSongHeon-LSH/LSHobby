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
