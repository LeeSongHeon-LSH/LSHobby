import sqlite3
from enum import Enum

DB_PATH = "spanish.db"


class Gender(str, Enum):
    MASCULINE = "m"
    FEMININE = "f"
    NEUTRAL = "n"
    NONE = "none"


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
                correct_count INTEGER NOT NULL DEFAULT 0
            )
        """)


def add_word(word: str, gender: Gender, meaning: str):
    if not meaning.strip():
        raise ValueError("meaning must not be empty")
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO words (word, gender, meaning) VALUES (?, ?, ?)",
            (word.strip().lower(), gender.value, meaning.strip()),
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


def delete_word(word: str):
    with get_connection() as conn:
        conn.execute(
            "DELETE FROM words WHERE word = ?", (word.strip().lower(),)
        )
