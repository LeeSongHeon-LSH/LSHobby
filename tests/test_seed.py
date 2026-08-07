import db
import seed
from db import Gender


class TestSeedIfEmpty:
    def test_seeds_empty_db(self):
        seed.seed_if_empty()
        assert len(db.get_all_words()) == len(seed.SEED_WORDS)

    def test_second_call_is_noop(self):
        seed.seed_if_empty()
        seed.seed_if_empty()
        assert len(db.get_all_words()) == len(seed.SEED_WORDS)

    def test_nonempty_db_untouched(self):
        # 단어가 하나라도 있으면 시드하지 않음 — 시드 단어를 지워도 되살아나지 않게
        db.add_word("casa", Gender.FEMININE, "집")
        seed.seed_if_empty()
        words = db.get_all_words()
        assert len(words) == 1
        assert words[0]["word"] == "casa"

    def test_seeded_word_fields(self):
        seed.seed_if_empty()
        w = db.get_word("estudiante")
        assert w["gender"] == "n"
        assert w["test_count"] == 0
        assert w["box"] == 0
        assert w["norm"] == "estudiante"


class TestSeedDataIntegrity:
    def test_genders_valid(self):
        for word, gender, _ in seed.SEED_WORDS:
            Gender(gender)  # 잘못된 값이면 ValueError

    def test_meanings_nonempty(self):
        assert all(m.strip() for _, _, m in seed.SEED_WORDS)

    def test_words_lowercase_and_stripped(self):
        assert all(w == w.strip().lower() for w, _, _ in seed.SEED_WORDS)

    def test_no_norm_duplicates(self):
        norms = [db.normalize_word(w) for w, _, _ in seed.SEED_WORDS]
        assert len(norms) == len(set(norms))

    def test_reasonable_size(self):
        # 합의된 규모(~200)에서 크게 벗어나지 않는지
        assert 180 <= len(seed.SEED_WORDS) <= 260
