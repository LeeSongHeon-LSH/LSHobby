import csv
import io
import sqlite3

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import db
from db import Gender
import quiz
import stats

app = FastAPI(title="Spanish Practice")


# ── Pydantic models ────────────────────────────────────
class WordIn(BaseModel):
    word: str
    gender: str
    meaning: str


class AnswerIn(BaseModel):
    word: str
    correct: bool


# ── Startup ────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    db.init_db()


# ── Static ─────────────────────────────────────────────
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def index():
    return FileResponse("index.html")


@app.get("/sw.js")
async def service_worker():
    # 서비스워커는 루트 scope를 가지려면 루트 경로에서 제공되어야 함
    return FileResponse("static/sw.js", media_type="application/javascript")


# ── Words ──────────────────────────────────────────────
@app.get("/api/words")
async def get_words():
    return db.get_all_words()


@app.post("/api/words", status_code=201)
async def add_word(body: WordIn):
    try:
        gender = Gender(body.gender)
    except ValueError:
        raise HTTPException(422, detail=f"invalid_gender: {body.gender}")
    try:
        db.add_word(body.word, gender, body.meaning)
    except ValueError as e:
        raise HTTPException(422, detail=str(e))
    except sqlite3.IntegrityError:
        raise HTTPException(409, detail="duplicate")
    return {"ok": True}


@app.put("/api/words/{word}")
async def update_word(word: str, body: WordIn):
    try:
        gender = Gender(body.gender)
    except ValueError:
        raise HTTPException(422, detail=f"invalid_gender: {body.gender}")
    try:
        db.update_word(word, body.word, gender, body.meaning)
    except ValueError as e:
        raise HTTPException(422, detail=str(e))
    except sqlite3.IntegrityError:
        raise HTTPException(409, detail="duplicate")
    return {"ok": True}


@app.delete("/api/words/{word}")
async def delete_word(word: str):
    db.delete_word(word)
    return {"ok": True}


# ── Quiz ───────────────────────────────────────────────
@app.get("/api/quiz/pick")
async def pick(hard: bool = False):
    word = quiz.pick_word(hard_only=hard)
    if word is None:
        raise HTTPException(404, detail="no_words")
    return word


@app.post("/api/quiz/answer")
async def answer(body: AnswerIn):
    quiz.submit_answer(body.word, body.correct)
    return {"ok": True}


# ── Stats ──────────────────────────────────────────────
@app.get("/api/stats")
async def get_stats():
    return stats.get_stats()


# ── Export ─────────────────────────────────────────────
EXPORT_COLUMNS = ["word", "gender", "meaning", "test_count", "correct_count", "box", "due_at"]


@app.get("/api/export.csv")
async def export_csv():
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(EXPORT_COLUMNS)
    for w in db.get_all_words():
        writer.writerow([w[c] for c in EXPORT_COLUMNS])
    return PlainTextResponse(
        buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="spanish-words.csv"'},
    )
