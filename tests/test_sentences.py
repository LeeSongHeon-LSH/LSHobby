import db
import sentences


FAKE_RESULTS = {
    "results": [
        {
            "id": 1,
            "text": "¿Tienen casa?",
            "translations": [[], [{"lang": "kor", "text": "집 있어요?"}]],
        },
        {
            "id": 2,
            "text": "Las casas son caras.",  # casa 표층형 아님 → 제외
            "translations": [[{"lang": "kor", "text": "집들이 비싸요."}]],
        },
        {
            "id": 3,
            "text": "Mi casa " + "x" * 80,  # 너무 긴 문장 → 제외
            "translations": [[{"lang": "kor", "text": "..."}]],
        },
        {
            "id": 4,
            "text": "La casa es grande.",
            "translations": [[]],  # 번역 없음 → 채택은 하되 trans None
        },
    ]
}


class TestExtract:
    def test_surface_form_and_length_filter(self):
        out = sentences._extract(FAKE_RESULTS, "casa", "kor")
        texts = [s["es_text"] for s in out]
        assert "¿Tienen casa?" in texts
        assert "Las casas son caras." not in texts
        assert all(len(t) <= sentences.MAX_LEN for t in texts)

    def test_translation_extraction(self):
        out = sentences._extract(FAKE_RESULTS, "casa", "kor")
        by_text = {s["es_text"]: s for s in out}
        assert by_text["¿Tienen casa?"]["ko_text"] == "집 있어요?"
        assert by_text["¿Tienen casa?"]["en_text"] is None
        assert by_text["La casa es grande."]["ko_text"] is None

    def test_source_url(self):
        out = sentences._extract(FAKE_RESULTS, "casa", "kor")
        assert out[0]["source_url"] == "https://tatoeba.org/en/sentences/show/1"


class TestEnsureSentences:
    def test_fetch_once_then_cache(self, monkeypatch):
        calls = []

        def fake_fetch(word):
            calls.append(word)
            return [{"es_text": "Hola casa.", "ko_text": "안녕 집.", "en_text": None, "source_url": "u"}]

        monkeypatch.setattr(sentences, "fetch_for_word", fake_fetch)
        first = sentences.ensure_sentences("casa")
        second = sentences.ensure_sentences("casa")
        assert calls == ["casa"]  # 두 번째는 캐시
        assert first[0]["es_text"] == "Hola casa."
        assert second == first

    def test_empty_result_not_refetched(self, monkeypatch):
        calls = []
        monkeypatch.setattr(sentences, "fetch_for_word", lambda w: calls.append(w) or [])
        assert sentences.ensure_sentences("rara") == []
        assert sentences.ensure_sentences("rara") == []
        assert calls == ["rara"]  # 빈 결과도 기록되어 재조회 안 함


class TestSentenceEndpoint:
    def test_returns_cached_sentence(self, monkeypatch):
        from fastapi.testclient import TestClient
        import main

        db.save_sentences("casa", [
            {"es_text": "Mi casa es grande.", "ko_text": "우리 집은 커요.", "en_text": None, "source_url": "u"},
        ])
        client = TestClient(main.app)
        res = client.get("/api/sentence/casa")
        assert res.status_code == 200
        assert res.json()["es_text"] == "Mi casa es grande."

    def test_404_when_none(self, monkeypatch):
        from fastapi.testclient import TestClient
        import main

        monkeypatch.setattr(sentences, "fetch_for_word", lambda w: [])
        client = TestClient(main.app)
        assert client.get("/api/sentence/nada").status_code == 404
