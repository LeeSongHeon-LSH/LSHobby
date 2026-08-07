import sqlite3
import unicodedata
from datetime import datetime
from enum import Enum

DB_PATH = "spanish.db"


class Gender(str, Enum):
    MASCULINE = "m"
    FEMININE = "f"
    NEUTRAL = "n"
    NONE = "none"


def normalize_word(word: str) -> str:
    """중복 비교용 정규화: 소문자화 후 모음 악센트만 제거, ñ은 유지.

    채점 원칙(모음 악센트만 관대, ñ은 엄격)과 동일 규칙 —
    index.html의 deaccentGrading과 짝을 이룬다.
    país → pais, año → año
    """
    nfd = unicodedata.normalize("NFD", word.strip().lower())
    kept = "".join(c for c in nfd if not (unicodedata.combining(c) and c != "̃"))
    return unicodedata.normalize("NFC", kept)


def get_connection():
    return sqlite3.connect(DB_PATH)


def init_db():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT NOT NULL UNIQUE,
                gender TEXT NOT NULL CHECK(gender IN ('m', 'f', 'n', 'none')),
                meaning TEXT NOT NULL CHECK(length(meaning) > 0),
                test_count INTEGER NOT NULL DEFAULT 0,
                correct_count INTEGER NOT NULL DEFAULT 0,
                box INTEGER NOT NULL DEFAULT 0,
                due_at TEXT,
                norm TEXT
            )
        """)
        # 기존 DB 마이그레이션: SRS 컬럼이 없으면 추가
        cols = {row[1] for row in conn.execute("PRAGMA table_info(words)")}
        if "box" not in cols:
            conn.execute("ALTER TABLE words ADD COLUMN box INTEGER NOT NULL DEFAULT 0")
        if "due_at" not in cols:
            conn.execute("ALTER TABLE words ADD COLUMN due_at TEXT")
        # 악센트 무시 중복 차단용 norm 컬럼: 없으면 추가 후 backfill
        if "norm" not in cols:
            conn.execute("ALTER TABLE words ADD COLUMN norm TEXT")
        for (w,) in conn.execute("SELECT word FROM words WHERE norm IS NULL"):
            conn.execute(
                "UPDATE words SET norm = ? WHERE word = ?", (normalize_word(w), w)
            )
        # fresh/기존 DB 모두 인덱스 방식으로 통일해 유일성 보장
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_words_norm ON words(norm)"
        )
        # 학습 이력 (통계·스트릭용)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT NOT NULL,
                correct INTEGER NOT NULL,
                ts TEXT NOT NULL
            )
        """)
        # Tatoeba 예문 캐시
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sentences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT NOT NULL,
                es_text TEXT NOT NULL,
                ko_text TEXT,
                en_text TEXT,
                source_url TEXT
            )
        """)
        # 수집 시도 기록 (예문이 없는 단어를 매번 재조회하지 않게)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sentence_fetch (
                word TEXT PRIMARY KEY,
                fetched_at TEXT NOT NULL
            )
        """)


def add_word(word: str, gender: Gender, meaning: str):
    if not meaning.strip():
        raise ValueError("meaning must not be empty")
    w = word.strip().lower()
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO words (word, gender, meaning, norm) VALUES (?, ?, ?, ?)",
            (w, gender.value, meaning.strip(), normalize_word(w)),
        )


def get_all_words() -> list[dict]:
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM words").fetchall()
    return [dict(row) for row in rows]


def get_word(word: str) -> dict | None:
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM words WHERE word = ?", (word.strip().lower(),)
        ).fetchone()
    return dict(row) if row else None


def record_attempt(word: str, correct: bool):
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE words
            SET test_count = test_count + 1,
                correct_count = correct_count + ?
            WHERE word = ?
            """,
            (1 if correct else 0, word.strip().lower()),
        )
        # 로컬 시각으로 저장해 substr(ts,1,10)이 로컬 날짜가 되게 함
        conn.execute(
            "INSERT INTO attempts (word, correct, ts) VALUES (?, ?, ?)",
            (word.strip().lower(), 1 if correct else 0, datetime.now().astimezone().isoformat()),
        )


def get_daily_attempts(days: int) -> dict:
    """최근 N일의 일별 출제/정답 수. {날짜: {total, correct}}"""
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT substr(ts, 1, 10) AS d, COUNT(*), SUM(correct)
            FROM attempts GROUP BY d ORDER BY d DESC LIMIT ?
            """,
            (days,),
        ).fetchall()
    return {r[0]: {"total": r[1], "correct": r[2]} for r in rows}


def get_attempt_dates() -> list[str]:
    """학습한 날짜 목록 (최신순, 중복 제거)."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT DISTINCT substr(ts, 1, 10) FROM attempts ORDER BY 1 DESC"
        ).fetchall()
    return [r[0] for r in rows]


def set_srs(word: str, box: int, due_at: str | None):
    with get_connection() as conn:
        conn.execute(
            "UPDATE words SET box = ?, due_at = ? WHERE word = ?",
            (box, due_at, word.strip().lower()),
        )


def update_word(old_word: str, new_word: str, gender: Gender, meaning: str):
    if not meaning.strip():
        raise ValueError("meaning must not be empty")
    w = new_word.strip().lower()
    with get_connection() as conn:
        conn.execute(
            "UPDATE words SET word = ?, gender = ?, meaning = ?, norm = ? WHERE word = ?",
            (w, gender.value, meaning.strip(), normalize_word(w), old_word.strip().lower()),
        )


def delete_word(word: str):
    with get_connection() as conn:
        conn.execute(
            "DELETE FROM words WHERE word = ?", (word.strip().lower(),)
        )


def sentences_fetched(word: str) -> bool:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT 1 FROM sentence_fetch WHERE word = ?", (word.strip().lower(),)
        ).fetchone()
    return row is not None


def get_sentences(word: str) -> list[dict]:
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT es_text, ko_text, en_text, source_url FROM sentences WHERE word = ?",
            (word.strip().lower(),),
        ).fetchall()
    return [dict(row) for row in rows]


def save_sentences(word: str, sentences: list[dict]):
    w = word.strip().lower()
    with get_connection() as conn:
        for s in sentences:
            conn.execute(
                "INSERT INTO sentences (word, es_text, ko_text, en_text, source_url) VALUES (?, ?, ?, ?, ?)",
                (w, s["es_text"], s.get("ko_text"), s.get("en_text"), s.get("source_url")),
            )
        conn.execute(
            "INSERT OR REPLACE INTO sentence_fetch (word, fetched_at) VALUES (?, ?)",
            (w, datetime.now().astimezone().isoformat()),
        )
