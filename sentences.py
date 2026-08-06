import json
import re
import urllib.parse
import urllib.request

import db

API = "https://tatoeba.org/en/api_v0/search"
HEADERS = {"User-Agent": "Spanish-Practice (personal study app)"}
MAX_SENTENCES = 3
MAX_LEN = 70


def _query(word: str, trans_to: str) -> dict:
    params = {
        "from": "spa",
        "to": trans_to,
        "query": word,
        "trans_filter": "limit",
        "trans_to": trans_to,
        "sort": "words",
        "limit": 10,
    }
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=5) as res:
        return json.loads(res.read().decode())


def _extract(data: dict, word: str, trans_lang: str) -> list[dict]:
    """검색 결과에서 단어가 그대로 들어간 짧은 문장 + 번역만 추림."""
    # 검색은 어간 매칭이라 casas 같은 변형도 옴 → 표층형 그대로일 때만 채택
    pattern = re.compile(rf"(?<!\w){re.escape(word)}(?!\w)", re.IGNORECASE)
    out = []
    for r in data.get("results", []):
        text = r.get("text", "")
        if len(text) > MAX_LEN or not pattern.search(text):
            continue
        trans = None
        for group in r.get("translations", []):
            for tr in group:
                if tr.get("lang") == trans_lang:
                    trans = tr.get("text")
                    break
            if trans:
                break
        out.append({
            "es_text": text,
            "ko_text": trans if trans_lang == "kor" else None,
            "en_text": trans if trans_lang == "eng" else None,
            "source_url": f"https://tatoeba.org/en/sentences/show/{r.get('id')}",
        })
    return out


def fetch_for_word(word: str) -> list[dict]:
    """Tatoeba에서 예문 수집: 한국어 번역 우선, 부족하면 영어 번역으로 보충."""
    found = []
    for lang in ("kor", "eng"):
        if len(found) >= MAX_SENTENCES:
            break
        try:
            data = _query(word, lang)
        except Exception:
            continue
        for s in _extract(data, word, lang):
            if any(f["es_text"] == s["es_text"] for f in found):
                continue
            found.append(s)
            if len(found) >= MAX_SENTENCES:
                break
    return found


def ensure_sentences(word: str) -> list[dict]:
    """캐시 우선. 미수집 단어면 지금 수집해 저장 (실패 시 빈 결과도 기록해 재시도 방지)."""
    if db.sentences_fetched(word):
        return db.get_sentences(word)
    found = fetch_for_word(word)
    db.save_sentences(word, found)
    return found
