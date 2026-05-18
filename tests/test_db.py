import pytest
import sqlite3
import db
from db import Gender


class TestGender:
    def test_all_values_exist(self):
        assert Gender.MASCULINE.value == "m"
        assert Gender.FEMININE.value == "f"
        assert Gender.NEUTRAL.value == "n"
        assert Gender.NONE.value == "none"


class TestAddWord:
    def test_add_and_get(self):
        db.add_word("casa", Gender.FEMININE, "집")
        word = db.get_word("casa")
        assert word["word"] == "casa"
        assert word["gender"] == "f"
        assert word["meaning"] == "집"
        assert word["test_count"] == 0
        assert word["correct_count"] == 0

    def test_add_all_genders(self):
        db.add_word("libro", Gender.MASCULINE, "책")
        db.add_word("casa", Gender.FEMININE, "집")
        db.add_word("estudiante", Gender.NEUTRAL, "학생")
        db.add_word("hablar", Gender.NONE, "말하다")
        words = {w["word"]: w["gender"] for w in db.get_all_words()}
        assert words["libro"] == "m"
        assert words["casa"] == "f"
        assert words["estudiante"] == "n"
        assert words["hablar"] == "none"

    def test_none_gender_for_verb(self):
        db.add_word("comer", Gender.NONE, "먹다")
        word = db.get_word("comer")
        assert word["gender"] == "none"

    def test_duplicate_raises(self):
        db.add_word("casa", Gender.FEMININE, "집")
        with pytest.raises(sqlite3.IntegrityError):
            db.add_word("casa", Gender.MASCULINE, "집")

    def test_invalid_gender_raises(self):
        with pytest.raises(ValueError):
            db.add_word("test", Gender("x"), "테스트")

    def test_strips_and_lowercases(self):
        db.add_word("  LIBRO  ", Gender.MASCULINE, "책")
        assert db.get_word("libro") is not None
        assert db.get_word("  LIBRO  ") is not None


class TestMeaning:
    def test_meaning_stored_correctly(self):
        db.add_word("perro", Gender.MASCULINE, "개")
        assert db.get_word("perro")["meaning"] == "개"

    def test_meaning_stripped(self):
        db.add_word("gato", Gender.MASCULINE, "  고양이  ")
        assert db.get_word("gato")["meaning"] == "고양이"

    def test_empty_meaning_raises_value_error(self):
        with pytest.raises(ValueError):
            db.add_word("pueblo", Gender.MASCULINE, "")

    def test_whitespace_only_meaning_raises_value_error(self):
        with pytest.raises(ValueError):
            db.add_word("pueblo", Gender.MASCULINE, "   ")

    def test_db_rejects_empty_meaning_directly(self):
        with pytest.raises(sqlite3.IntegrityError):
            with db.get_connection() as conn:
                conn.execute(
                    "INSERT INTO words (word, gender, meaning) VALUES (?, ?, ?)",
                    ("bypass", "m", ""),
                )


class TestGetWord:
    def test_returns_none_for_missing(self):
        assert db.get_word("nonexistent") is None

    def test_get_all_empty(self):
        assert db.get_all_words() == []

    def test_get_all_returns_all(self):
        db.add_word("uno", Gender.MASCULINE, "하나")
        db.add_word("dos", Gender.FEMININE, "둘")
        db.add_word("ser", Gender.NONE, "~이다")
        assert len(db.get_all_words()) == 3

    def test_get_all_returns_dicts_with_meaning(self):
        db.add_word("casa", Gender.FEMININE, "집")
        word = db.get_all_words()[0]
        assert isinstance(word, dict)
        assert all(k in word for k in ("word", "gender", "meaning", "test_count", "correct_count"))


class TestRecordAttempt:
    def test_correct_answer(self):
        db.add_word("casa", Gender.FEMININE, "집")
        db.record_attempt("casa", correct=True)
        word = db.get_word("casa")
        assert word["test_count"] == 1
        assert word["correct_count"] == 1

    def test_wrong_answer(self):
        db.add_word("casa", Gender.FEMININE, "집")
        db.record_attempt("casa", correct=False)
        word = db.get_word("casa")
        assert word["test_count"] == 1
        assert word["correct_count"] == 0

    def test_multiple_attempts_accumulate(self):
        db.add_word("casa", Gender.FEMININE, "집")
        db.record_attempt("casa", correct=True)
        db.record_attempt("casa", correct=True)
        db.record_attempt("casa", correct=False)
        word = db.get_word("casa")
        assert word["test_count"] == 3
        assert word["correct_count"] == 2

    def test_correct_count_never_exceeds_test_count(self):
        db.add_word("casa", Gender.FEMININE, "집")
        for _ in range(5):
            db.record_attempt("casa", correct=True)
        word = db.get_word("casa")
        assert word["correct_count"] <= word["test_count"]


class TestDeleteWord:
    def test_delete_removes_word(self):
        db.add_word("casa", Gender.FEMININE, "집")
        db.delete_word("casa")
        assert db.get_word("casa") is None

    def test_delete_does_not_affect_others(self):
        db.add_word("casa", Gender.FEMININE, "집")
        db.add_word("libro", Gender.MASCULINE, "책")
        db.delete_word("casa")
        assert db.get_word("libro") is not None

    def test_delete_nonexistent_is_silent(self):
        db.delete_word("nonexistent")
