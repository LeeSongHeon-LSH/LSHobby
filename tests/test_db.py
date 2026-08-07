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

    def test_accent_variant_is_duplicate(self):
        # 모음 악센트만 다른 단어는 같은 단어로 취급해 차단
        db.add_word("país", Gender.MASCULINE, "나라")
        with pytest.raises(sqlite3.IntegrityError):
            db.add_word("pais", Gender.MASCULINE, "나라")

    def test_enye_is_distinct(self):
        # ñ은 별개 글자 — año와 ano는 서로 다른 단어
        db.add_word("año", Gender.MASCULINE, "년")
        db.add_word("ano", Gender.MASCULINE, "항문")
        assert db.get_word("año") is not None
        assert db.get_word("ano") is not None

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


class TestNormalizeWord:
    def test_strips_vowel_accents(self):
        assert db.normalize_word("país") == "pais"
        assert db.normalize_word("Dónde") == "donde"
        assert db.normalize_word("  MÉdico ") == "medico"

    def test_keeps_enye(self):
        assert db.normalize_word("año") == "año"
        assert db.normalize_word("España") == "españa"


class TestNormMigration:
    def test_legacy_table_backfilled(self):
        # norm 컬럼이 없던 예전 스키마에서 init_db가 backfill하는지 확인
        with db.get_connection() as conn:
            conn.execute("DROP INDEX IF EXISTS idx_words_norm")
            conn.execute("DROP TABLE words")
            conn.execute("""
                CREATE TABLE words (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    word TEXT NOT NULL UNIQUE,
                    gender TEXT NOT NULL,
                    meaning TEXT NOT NULL
                )
            """)
            conn.execute(
                "INSERT INTO words (word, gender, meaning) VALUES ('país', 'm', '나라')"
            )
        db.init_db()
        with db.get_connection() as conn:
            row = conn.execute("SELECT norm FROM words WHERE word = 'país'").fetchone()
        assert row[0] == "pais"
        # 마이그레이션 후에도 유일성이 동작해야 함
        with pytest.raises(sqlite3.IntegrityError):
            db.add_word("pais", Gender.MASCULINE, "나라")


class TestUpdateWordNorm:
    def test_update_refreshes_norm(self):
        db.add_word("casa", Gender.FEMININE, "집")
        db.update_word("casa", "café", Gender.MASCULINE, "커피")
        with pytest.raises(sqlite3.IntegrityError):
            db.add_word("cafe", Gender.MASCULINE, "커피")

    def test_update_collision_raises(self):
        db.add_word("país", Gender.MASCULINE, "나라")
        db.add_word("casa", Gender.FEMININE, "집")
        with pytest.raises(sqlite3.IntegrityError):
            db.update_word("casa", "pais", Gender.MASCULINE, "나라")

    def test_update_same_word_is_fine(self):
        # 뜻만 고칠 때 자기 자신과의 norm 충돌은 없어야 함
        db.add_word("país", Gender.MASCULINE, "나라")
        db.update_word("país", "país", Gender.MASCULINE, "나라, 국가")
        assert db.get_word("país")["meaning"] == "나라, 국가"


class TestAddWordAPI:
    def test_accent_variant_returns_409(self, monkeypatch):
        from fastapi.testclient import TestClient
        import main
        import sentences

        # POST가 백그라운드로 예문을 수집하므로 네트워크 호출은 막는다
        monkeypatch.setattr(sentences, "fetch_for_word", lambda w: [])
        client = TestClient(main.app)
        r1 = client.post("/api/words", json={"word": "país", "gender": "m", "meaning": "나라"})
        assert r1.status_code == 201
        r2 = client.post("/api/words", json={"word": "pais", "gender": "m", "meaning": "나라"})
        assert r2.status_code == 409
        assert r2.json()["detail"] == "duplicate"


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
